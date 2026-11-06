import {
  CaptureUpdateAction,
  hashElementsVersion,
  restore,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import type { ImportedDataState } from '@excalidraw/excalidraw/data/types'
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

/**
 * The Excalidraw half of the sheet file (ADR 0004): the scene as Excalidraw's
 * own JSON, and loading one back. The block is `src/file/sheetFormat.ts`.
 */

/** The slice of Excalidraw's API the file needs. */
export type SceneFileApi = Pick<
  ExcalidrawImperativeAPI,
  | 'getSceneElements'
  | 'getSceneElementsIncludingDeleted'
  | 'getAppState'
  | 'getFiles'
  | 'updateScene'
  | 'addFiles'
  | 'history'
  | 'scrollToContent'
  | 'onChange'
>

/** The scene as the sheet session sees it (`src/file/sheetSession.ts`'s `SceneFile`). */
export function sceneFileFor(api: SceneFileApi) {
  return {
    serialize: () => serializeScene(api),
    load: (scene: Record<string, unknown>) => loadScene(api, scene),
    saveKey: () => saveKey(api),
    onChange: (listener: () => void) => api.onChange(listener),
    ready: () => sceneReady(api),
  }
}

/**
 * Resolves once Excalidraw has loaded its starting scene. Before that, element
 * versions still change as `initialData` comes in.
 */
export function sceneReady(api: Pick<SceneFileApi, 'getAppState' | 'onChange'>) {
  return new Promise<void>((resolve) => {
    if (!api.getAppState().isLoading) return resolve()
    const stop = api.onChange(() => {
      if (api.getAppState().isLoading) return
      stop()
      resolve()
    })
  })
}

/**
 * The app state a saved file keeps: what Excalidraw's own "local" save keeps.
 * Anything else (selection, scroll, zoom, theme, open dialogs) is never saved.
 */
export const SAVED_APP_STATE = ['viewBackgroundColor', 'gridModeEnabled', 'gridSize', 'gridStep'] as const

type SavedAppState = Pick<AppState, (typeof SAVED_APP_STATE)[number]>

function savedAppState(appState: SavedAppState): SavedAppState {
  return Object.fromEntries(SAVED_APP_STATE.map((key) => [key, appState[key]])) as SavedAppState
}

/** The scene as Excalidraw's own file JSON: live elements, kept app state, used files. */
export function serializeScene(api: SceneFileApi): string {
  return serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local')
}

/**
 * A key of everything a save would write. It changes when an element is added,
 * changed, deleted or undone, and when the background or grid changes; not on
 * selection, scroll, zoom or hover. Equal keys mean nothing to save. It is cheap
 * enough for every `onChange`.
 */
export function saveKey(api: SceneFileApi): string {
  const versions = hashElementsVersion(api.getSceneElementsIncludingDeleted())
  return `${versions}|${JSON.stringify(savedAppState(api.getAppState()))}`
}

/**
 * Replaces the scene with a file's. It isn't an undo step, and it clears the
 * undo history, so Ctrl+Z never reaches back into the previous sheet. Settings
 * that aren't saved (theme, zoom) stay as they are.
 */
export function loadScene(api: SceneFileApi, scene: Record<string, unknown>) {
  const restored = restore(scene as ImportedDataState, api.getAppState(), null, {
    repairBindings: true,
  })
  api.updateScene({
    elements: restored.elements,
    appState: {
      ...savedAppState(restored.appState),
      selectedElementIds: {},
      selectedGroupIds: {},
      editingGroupId: null,
    },
    captureUpdate: CaptureUpdateAction.NEVER,
  })
  const files = Object.values(restored.files)
  if (files.length > 0) api.addFiles(files)
  api.history.clear()
  if (restored.elements.length > 0) {
    api.scrollToContent(undefined, { fitToViewport: false, animate: false })
  }
}
