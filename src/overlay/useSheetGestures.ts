import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AppState } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { cancelPlacing, isPlacing, startPlacing, watchPlacing } from '../canvas/addMath.ts'
import { listenToCanvas } from '../canvas/canvasEvents.ts'
import { isMathAnchor, type MathAnchor } from '../canvas/mathAnchor.ts'
import { deselectAll } from '../canvas/selection.ts'
import { splitLines } from '../math/evaluate.ts'
import { clickTarget, keyAction, ownerAt, type CanvasState, type Press } from './gestures.ts'
import { containsPoint, lineAt, onHeader, type RowBox } from './lineHit.ts'
import { TITLE_LINE, type LineEdit } from './lineEdit.ts'
import type { SceneApi } from './MathOverlay.tsx'
import { stageToScene, type Point } from './viewport.ts'

export interface SheetGestures {
  api: SceneApi
  /**
   * The box Excalidraw fills, where the canvas's input is heard
   * (`listenToCanvas`).
   */
  canvasRoot: HTMLElement
  /** Live anchors in Excalidraw's z-order, bottom first. */
  anchors: () => readonly MathAnchor[]
  /** An element's rows as laid out, top first. */
  rowsOf: (anchorId: string) => RowBox[]
  /** An element's header as laid out, or null when it shows no title. */
  headerOf: (anchorId: string) => RowBox | null
  edit: () => LineEdit | null
  /** Leaves any open edit, then opens this line with the caret at the end. */
  openLine: (anchorId: string, lineIndex: number) => void
  /** Leaves the open edit, writing its line. */
  leaveLine: () => void
  focusCanvas: () => void
}

/**
 * The stage's math gestures (docs/spec-v1.md section 4, section 14): double-click
 * on a line, Enter on a selected element, the second Esc, a press that leaves
 * or moves the edit, and Add math: M starts placing, Esc cancels it, and the
 * placing click opens the new element's first line (section 8). Excalidraw keeps click, drag, select and rotate, because the
 * overlay takes no pointer events and the anchor's fill takes clicks inside it.
 *
 * `listenToCanvas` (`src/canvas/`) hands each event over before Excalidraw hears
 * it; the decisions are in `gestures.ts` and `lineHit.ts`. This wires them to
 * the app state and the line edit.
 */
export function useSheetGestures(gestures: SheetGestures) {
  const latest = useRef(gestures)
  useLayoutEffect(() => {
    latest.current = gestures
  })
  const { api, canvasRoot } = gestures

  useEffect(() => {
    const g = () => latest.current
    const anchorById = (id: string) => g().anchors().find((anchor) => anchor.id === id)

    const toScene = (event: MouseEvent): Point => {
      const { offsetLeft, offsetTop, scrollX, scrollY, zoom } = api.getAppState()
      return stageToScene(
        { x: event.clientX - offsetLeft, y: event.clientY - offsetTop },
        { scrollX, scrollY, zoom: zoom.value },
      )
    }

    // The line under the point, or the title when the point is on the header.
    const lineUnder = (anchor: MathAnchor, point: Point) =>
      onHeader(anchor, point, g().headerOf(anchor.id))
        ? TITLE_LINE
        : lineAt(anchor, point, g().rowsOf(anchor.id))

    const facts = (event: Event) => ({ targetOwnsEvent: isTypingTarget(event.target) })

    // A press on the edited element, kept until its click.
    let press: Press | null = null

    const stopPlacing = watchPlacing(api, canvasRoot, (anchorId) => g().openLine(anchorId, 0))

    const stopListening = listenToCanvas(canvasRoot, {
      // Leaving comes before Excalidraw sees the press, so a drag starts on the
      // committed scene: the line is one undo step and the move is its own.
      pointerDown(event) {
        press = null
        const edit = g().edit()
        if (!edit) return
        const anchor = anchorById(edit.anchorId)
        const point = toScene(event)
        if (anchor && containsPoint(anchor, point)) {
          const lineIndex = lineUnder(anchor, point)
          press = { anchorId: anchor.id, lineIndex, x: anchor.x, y: anchor.y }
        }
        g().leaveLine()
        g().focusCanvas()
      },

      click(event) {
        const pressed = press
        press = null
        if (!pressed) return
        const elements = api.getSceneElements()
        const target = clickTarget(
          canvasState(api.getAppState(), elements),
          g().anchors(),
          toScene(event),
          pressed,
          facts(event),
        )
        if (target) g().openLine(target.id, pressed.lineIndex)
      },

      doubleClick(event) {
        const point = toScene(event)
        const elements = api.getSceneElements()
        const owner = ownerAt(
          canvasState(api.getAppState(), elements),
          g().anchors(),
          point,
          facts(event),
        )
        if (!owner) return false
        g().openLine(owner.id, lineUnder(owner, point))
        return true
      },

      keyDown(event) {
        const app = api.getAppState()
        const elements = api.getSceneElements()
        const math = new Set(elements.filter(isMathAnchor).map(({ id }) => id))
        const selection = elements
          .filter(({ id }) => app.selectedElementIds[id])
          .map(({ id }) => id)
        const action = keyAction(canvasState(app, elements), selection, (id) => math.has(id), {
          key: event.key,
          modifier: event.ctrlKey || event.metaKey || event.altKey || event.shiftKey,
          composing: event.isComposing,
          ...facts(event),
        })
        if (!action) return false
        if (action.kind === 'deselect') {
          deselectAll(api)
          return true
        }
        if (action.kind === 'add-math') {
          startPlacing(api)
          return true
        }
        if (action.kind === 'cancel-placing') {
          cancelPlacing(api)
          return true
        }
        const anchor = anchorById(action.anchorId)
        if (anchor) g().openLine(anchor.id, splitLines(anchor.source).length - 1)
        return true
      },
    })

    return () => {
      stopPlacing()
      stopListening()
    }
  }, [api, canvasRoot])
}

function canvasState(app: AppState, elements: readonly ExcalidrawElement[]): CanvasState {
  return {
    tool: app.activeTool.type,
    placing: isPlacing(app),
    busy: Boolean(
      app.editingTextElement ||
        app.editingLinearElement ||
        app.newElement ||
        app.multiElement ||
        app.openMenu ||
        app.openDialog ||
        app.openPopup ||
        app.contextMenu,
    ),
    selected: app.selectedElementIds,
    zIndex: Object.fromEntries(elements.map(({ id }, index) => [id, index])),
  }
}

const TYPING_TARGETS = 'input, textarea, select, button, [contenteditable]:not([contenteditable="false"])'

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TYPING_TARGETS) !== null
}
