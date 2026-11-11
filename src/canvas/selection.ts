import { CaptureUpdateAction } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

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

/**
 * Excalidraw docks its sidebar only when the editor is wider than this
 * (`MQ_RIGHT_SIDEBAR_MIN_WIDTH`, Excalidraw 0.18); narrower, it floats over
 * the canvas.
 */
export const SIDEBAR_DOCKS_ABOVE = 1229
