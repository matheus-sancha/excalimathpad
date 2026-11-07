import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { isMathAnchor } from './mathAnchor.ts'

/**
 * A math element's box always fits its content (docs/spec-v1.md section 4,
 * Size). The overlay measures the content; this writes the size to the anchor
 * and snaps Excalidraw's resize handles back. Every write is
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

/** The slice of Excalidraw's API snapping back needs. */
export type SnapBackApi = SizeWriteApi & Pick<ExcalidrawImperativeAPI, 'onPointerUp'>

/**
 * Resize handles snap back to the fit, in place (section 4, Gestures): when a
 * resize ends, each math anchor it changed gets back the `x`, `y`, `width` and
 * `height` it had when the press began, whether it was resized alone, with
 * other elements, in a group, or rotated. Drawings keep their resize. The
 * rotate handle is left alone. `write` wraps the write (the sheet keeps its
 * clean mark through it). Returns the unsubscribe.
 */
export function snapBackResizes(api: SnapBackApi, write: (run: () => void) => void): () => void {
  return api.onPointerUp((_tool, pointerDown) => {
    const { resize, originalElements } = pointerDown
    if (!resize.isResizing || resize.handleType === 'rotation') return
    let changed = false
    const elements = api.getSceneElementsIncludingDeleted().map((element) => {
      const original = originalElements.get(element.id)
      if (!original || !isMathAnchor(element) || sameBox(element, original)) return element
      changed = true
      const { x, y, width, height } = original
      return newElementWith(element, { x, y, width, height })
    })
    if (!changed) return
    write(() => api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER }))
  })
}

function sameBox(a: ExcalidrawElement, b: ExcalidrawElement): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
