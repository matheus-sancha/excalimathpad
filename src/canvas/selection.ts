import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { SHEET_SIDEBAR_CLASS } from './panelPresses.ts'

/**
 * Clears Excalidraw's selection, for the second Esc on a math element
 * (docs/spec-v1.md section 4): Excalidraw 0.18 keeps a selection on Esc. With
 * `NEVER` it adds no undo step, so the next Ctrl+Z still takes the last line.
 */
export function deselectAll(api: Pick<ExcalidrawImperativeAPI, 'updateScene'>) {
  api.updateScene({
    appState: { selectedElementIds: {}, selectedGroupIds: {}, editingGroupId: null },
    captureUpdate: CaptureUpdateAction.NEVER,
  })
}

/**
 * A jump from the Sheet panel (docs/spec-v1.md section 8): the view scrolls
 * the element into the middle and selects it. The select is `NEVER`, like
 * the second Esc's deselect, so a jump adds no undo step.
 */
export function jumpToAnchor(
  api: Pick<ExcalidrawImperativeAPI, 'getSceneElements' | 'scrollToContent' | 'updateScene'>,
  anchorId: string,
) {
  const anchor = api.getSceneElements().find((element) => element.id === anchorId)
  if (!anchor) return
  api.scrollToContent(anchor, { fitToContent: false, animate: true })
  api.updateScene({
    appState: { selectedElementIds: { [anchorId]: true }, selectedGroupIds: {}, editingGroupId: null },
    captureUpdate: CaptureUpdateAction.NEVER,
  })
}

/** A box in px, in any one frame: the window's, here. */
export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** How far inside the visible area the caret's row is kept (section 4, While editing a line). */
export const FOLLOW_MARGIN = 48

/**
 * The follow rule (docs/spec-v1.md section 4, While editing a line, 0.2.1,
 * #191): when `row` isn't wholly inside `area` less the margin, the canvas
 * scrolls the least distance that puts it there, up, down or sideways. Where
 * the area is too small for the row and both margins, the margin gives way
 * and the row is centred. No zoom change and no undo step. Returns whether it
 * scrolled.
 */
export function scrollIntoArea(
  api: Pick<ExcalidrawImperativeAPI, 'getAppState' | 'updateScene'>,
  row: Box,
  area: Box,
  margin = FOLLOW_MARGIN,
): boolean {
  const dx = leastShift(row.left, row.right, area.left, area.right, margin)
  const dy = leastShift(row.top, row.bottom, area.top, area.bottom, margin)
  // Under half a pixel is rounding, not a row out of place.
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return false
  const { scrollX, scrollY, zoom } = api.getAppState()
  api.updateScene({
    appState: { scrollX: scrollX + dx / zoom.value, scrollY: scrollY + dy / zoom.value },
    captureUpdate: CaptureUpdateAction.NEVER,
  })
  return true
}

/** How far `from..to` moves to sit inside `low..high` less the margin: 0 when it does. */
function leastShift(from: number, to: number, low: number, high: number, margin: number): number {
  if (high <= low) return 0
  if (to - from > high - low - 2 * margin) return (low + high) / 2 - (from + to) / 2
  if (from < low + margin) return low + margin - from
  if (to > high - margin) return high - margin - to
  return 0
}

/**
 * The visible area (section 4, While editing a line): the canvas less the
 * Sheet panel where it covers the canvas's right (floating, and docked too:
 * Excalidraw draws its docked sidebar over the canvas) and, with `phone`, the
 * bottom sheet; and less the on-screen keyboard, which is where the visual
 * viewport ends.
 */
export function visibleArea(root: HTMLElement, phone: boolean): Box {
  const { left, top, right, bottom } = root.getBoundingClientRect()
  const area = { left, top, right, bottom }
  const panel = root.querySelector(`.${SHEET_SIDEBAR_CLASS}`)?.getBoundingClientRect()
  if (panel && panel.width > 0 && panel.height > 0) {
    if (phone) area.bottom = Math.min(area.bottom, panel.top)
    else if (panel.left > area.left) area.right = Math.min(area.right, panel.left)
  }
  const viewport = root.ownerDocument.defaultView?.visualViewport
  if (viewport) area.bottom = Math.min(area.bottom, viewport.offsetTop + viewport.height)
  return area
}
