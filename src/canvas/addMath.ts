import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { createMathAnchorElements } from './mathAnchor.ts'

/**
 * Add math (docs/spec-v1.md section 8): a public Excalidraw custom tool, per
 * ADR 0001. While it is active the app is **placing**: nothing is in the scene,
 * and the next click on the canvas creates the anchor there. Excalidraw draws
 * nothing for a custom tool, and a click with it neither selects nor moves what
 * lies under the pointer, so an element can be placed on top of another
 * (`addMath.excalidraw.test.tsx`).
 */
export const ADD_MATH_TOOL = 'add-math'

/**
 * A new element's box until its first size write, which follows at once: the
 * empty element as it lays out, its field at the minimum width
 * (`MathOverlay.css`). The ghost box shows the same size.
 */
export const NEW_ANCHOR_SIZE = { width: 305, height: 48 }

type PlacingApi = Pick<
  ExcalidrawImperativeAPI,
  | 'getAppState'
  | 'getSceneElementsIncludingDeleted'
  | 'onPointerUp'
  | 'setActiveTool'
  | 'setCursor'
  | 'updateScene'
>

export function isPlacing({ activeTool }: Pick<AppState, 'activeTool'>): boolean {
  return activeTool.type === 'custom' && activeTool.customType === ADD_MATH_TOOL
}

/** Starts placing. Called again while placing, it changes nothing. */
export function startPlacing(api: Pick<PlacingApi, 'setActiveTool' | 'setCursor'>) {
  api.setActiveTool({ type: 'custom', customType: ADD_MATH_TOOL })
  api.setCursor('crosshair')
}

/** Leaves placing with nothing added: no element and no undo step. */
export function cancelPlacing(api: Pick<PlacingApi, 'getAppState' | 'setActiveTool'>) {
  if (isPlacing(api.getAppState())) api.setActiveTool({ type: 'selection' })
}

/**
 * While placing, turns the next click on the canvas into a new, empty math
 * element with its top-left at the press, and hands its id to `placed`. Also
 * holds the crosshair. Returns the function that stops.
 *
 * - Add math is exactly one undo step. The element and its selection go in one
 *   `updateScene`: starting the tool cleared the selection, and Excalidraw
 *   records selection changes, so a separate select would make undo take two
 *   steps whenever something was selected before (spec section 14).
 * - The tool returns to selection first, so each Add math places one element.
 * - Excalidraw resets the cursor on every pointer move, so the crosshair is set
 *   again two animation frames after each one (spec section 14).
 */
export function watchPlacing(
  api: PlacingApi,
  root: HTMLElement,
  placed: (anchorId: string) => void,
): () => void {
  const offPointerUp = api.onPointerUp((tool, pointerDownState) => {
    if (tool.type !== 'custom' || tool.customType !== ADD_MATH_TOOL) return
    const [anchor] = createMathAnchorElements([
      {
        id: `math-${crypto.randomUUID()}`,
        x: pointerDownState.origin.x,
        y: pointerDownState.origin.y,
        ...NEW_ANCHOR_SIZE,
      },
    ])
    api.setActiveTool({ type: 'selection' })
    api.updateScene({
      elements: [...api.getSceneElementsIncludingDeleted(), anchor],
      appState: { selectedElementIds: { [anchor.id]: true } },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    })
    placed(anchor.id)
  })

  let frame = 0
  const onPointerMove = () => {
    if (!isPlacing(api.getAppState())) return
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (isPlacing(api.getAppState())) api.setCursor('crosshair')
      })
    })
  }
  root.addEventListener('pointermove', onPointerMove, true)

  return () => {
    offPointerUp()
    cancelAnimationFrame(frame)
    root.removeEventListener('pointermove', onPointerMove, true)
  }
}
