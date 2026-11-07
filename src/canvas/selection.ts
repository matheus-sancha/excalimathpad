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
