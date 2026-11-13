import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { isMathAnchor } from './mathAnchor.ts'

/**
 * A math element's box always fits its content (docs/spec-v1.md section 4,
 * Size). The overlay measures the content; this writes the size to the anchor
 * and settles Excalidraw's resize handles (`settleResizes`). Every write is
 * `newElementWith` + `CaptureUpdateAction.NEVER` (section 14), so it adds no
 * undo step, and it also updates Excalidraw's last captured copy of the anchor,
 * so a line commit after it is still one step.
 *
 * Known limit (#44, answer 1): a size write doesn't run Excalidraw's binding
 * update, and no public API does, so a bound arrow's end stays where it was
 * until the element next moves, when Excalidraw re-routes it.
 */

/** Content size, in scene units. */
export interface ContentSize {
  width: number
  height: number
}

/** An anchor's geometry: Excalidraw rotates it about its centre. */
export interface AnchorBox extends ContentSize {
  x: number
  y: number
  /** Radians, clockwise. */
  angle: number
}

/** Sizes within half a pixel fit: closer than that isn't worth a write. */
export const SIZE_TOLERANCE = 0.5

export function fitsContent(box: ContentSize, size: ContentSize): boolean {
  return (
    Math.abs(box.width - size.width) <= SIZE_TOLERANCE &&
    Math.abs(box.height - size.height) <= SIZE_TOLERANCE
  )
}

/**
 * The anchor resized to its content with its top-left corner in place, so it
 * grows right and down. For a rotated anchor that is the rotated top-left
 * corner: Excalidraw rotates about the centre, so `x` and `y` move.
 */
export function fitToContent(box: AnchorBox, size: ContentSize): Omit<AnchorBox, 'angle'> {
  if (!box.angle) return { x: box.x, y: box.y, ...size }
  const cos = Math.cos(box.angle)
  const sin = Math.sin(box.angle)
  // The rotated top-left: the centre plus the half-diagonal, turned.
  const left = box.x + box.width / 2 + (-box.width / 2) * cos - (-box.height / 2) * sin
  const top = box.y + box.height / 2 + (-box.width / 2) * sin + (-box.height / 2) * cos
  // The new centre: that corner plus the new half-diagonal, turned.
  const cx = left + (size.width / 2) * cos - (size.height / 2) * sin
  const cy = top + (size.width / 2) * sin + (size.height / 2) * cos
  return { x: cx - size.width / 2, y: cy - size.height / 2, ...size }
}

/** The slice of Excalidraw's API a size write needs. */
export type SizeWriteApi = Pick<
  ExcalidrawImperativeAPI,
  'getSceneElementsIncludingDeleted' | 'updateScene'
>

/**
 * Sizes these anchors to their content, in one update that adds no undo step.
 * Anchors that already fit are left alone. Returns whether it wrote.
 */
export function writeAnchorSizes(
  api: SizeWriteApi,
  sizes: ReadonlyMap<string, ContentSize>,
): boolean {
  let wrote = false
  const elements = api.getSceneElementsIncludingDeleted().map((element) => {
    const size = sizes.get(element.id)
    if (!size || !isMathAnchor(element) || fitsContent(element, size)) return element
    wrote = true
    return newElementWith(element, fitToContent(element, size))
  })
  if (wrote) api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })
  return wrote
}

/**
 * A size write waits now: Excalidraw is in the middle of a pointer gesture (a
 * drag, a resize or rotation, a shape or line being drawn) or one of its own
 * editors (text, line). The content can't change then, and a write would
 * fight the gesture. Each flag clears in an update Excalidraw reports through
 * `onChange`, so a waiting write goes in at that change.
 * `anchorSize.excalidraw.test.tsx` pins the flags against the installed
 * package. (Not the gestures' `busy`, which also counts menus and dialogs.)
 */
export function sizeWritesWait(app: AppState): boolean {
  return Boolean(
    app.selectedElementsAreBeingDragged ||
      app.isResizing ||
      app.isRotating ||
      app.newElement ||
      app.multiElement ||
      app.editingTextElement ||
      app.editingLinearElement,
  )
}

/** The slice of Excalidraw's API settling a resize needs. */
export type ResizeApi = SizeWriteApi & Pick<ExcalidrawImperativeAPI, 'onPointerUp'>

/**
 * What a resize handle does to a math element (section 4, Chosen width, M4c),
 * when it is let go. A handle changes the width only:
 *
 * - **Width changed, at or above the floor:** the dragged width becomes the
 *   chosen width, in `customData.width`. Excalidraw's own `x` is kept, so a left
 *   handle moves the left edge; the top and the height go back to what they
 *   were, and the content's height follows at the next size write.
 * - **Below the floor:** the element goes back to automatic, its chosen width
 *   forgotten, and its box back where it was.
 * - **Width unchanged** (a top or bottom handle): the box goes back, as the
 *   snap-back always did.
 *
 * The write is `NEVER`, made while Excalidraw is still finishing the gesture,
 * so it lands in the resize's own undo step: one Ctrl+Z restores the width
 * before it, or automatic (`anchorSize.excalidraw.test.tsx`). A snap-back that
 * changes nothing runs through `keepClean`; a width change marks the sheet
 * dirty. Drawings keep their resize, and the rotate handle is left alone.
 * `floorOf` measures an element's floor in scene units (0 when it can't).
 * Returns the unsubscribe.
 */
export function settleResizes(
  api: ResizeApi,
  keepClean: (run: () => void) => void,
  floorOf: (id: string) => number,
): () => void {
  return api.onPointerUp((_tool, pointerDown) => {
    const { resize, originalElements } = pointerDown
    if (!resize.isResizing || resize.handleType === 'rotation') return
    let changed = false
    let widthSet = false
    const elements = api.getSceneElementsIncludingDeleted().map((element) => {
      const original = originalElements.get(element.id)
      if (!original || !isMathAnchor(element) || sameBox(element, original)) return element
      changed = true
      const { x, y, width, height } = original
      const back = { x, y, width, height }
      if (Math.abs(element.width - original.width) <= SIZE_TOLERANCE) return newElementWith(element, back)
      const { width: _chosen, ...automatic } = element.customData ?? {}
      widthSet = true
      if (element.width < floorOf(element.id) - SIZE_TOLERANCE) {
        return newElementWith(element, { ...back, customData: automatic })
      }
      return newElementWith(element, {
        x: element.x,
        y: element.angle ? element.y : y,
        width: element.width,
        height: element.angle ? element.height : height,
        customData: { ...automatic, width: element.width },
      })
    })
    if (!changed) return
    const run = () => api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })
    if (widthSet) run()
    else keepClean(run)
  })
}

function sameBox(a: ExcalidrawElement, b: ExcalidrawElement): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
