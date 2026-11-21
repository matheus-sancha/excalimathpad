import {
  CaptureUpdateAction,
  getCommonBounds,
  hashElementsVersion,
  restoreAppState,
  restoreElements,
  serializeAsJSON,
} from '@excalidraw/excalidraw'
import type { ImportedDataState } from '@excalidraw/excalidraw/data/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
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
  | 'setViewport'
  | 'onChange'
>

/** The scene as the sheet session sees it (`src/file/sheetSession.ts`'s `SceneFile`). */
export function sceneFileFor(api: SceneFileApi) {
  return {
    serialize: () => serializeScene(api),
    load: (scene: Record<string, unknown>, options?: { keepView?: boolean }) =>
      loadScene(api, scene, options),
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
export const SAVED_APP_STATE = [
  'viewBackgroundColor',
  'gridModeEnabled',
  'gridSize',
  'gridStep',
  // Excalidraw's lock on a group of several elements, saved with the scene since the canary.
  'lockedMultiSelections',
] as const

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
 * Excalidraw's own JSON for a sheet with nothing on it, as a New sheet in a
 * vault starts (docs/spec-v1.md section 7, A sheet in a vault). The block is
 * added by `writeSheet`.
 */
export function emptyScene(): string {
  return serializeAsJSON([], {}, {}, 'local')
}

/**
 * Replaces the scene with a file's. It isn't an undo step, and it clears the
 * undo history, so Ctrl+Z never reaches back into the previous sheet. Settings
 * that aren't saved (theme, zoom) stay as they are. It scrolls to the content,
 * unless `keepView`: a sheet reloaded after an outside change keeps scroll and
 * zoom where they were.
 */
export function loadScene(
  api: SceneFileApi,
  scene: Record<string, unknown>,
  { keepView = false }: { keepView?: boolean } = {},
) {
  // Excalidraw's `restore` took the whole file; since the canary its halves are separate.
  const data = scene as ImportedDataState
  const restored = {
    elements: restoreElements(data.elements, null, { repairBindings: true }),
    appState: restoreAppState(data.appState, api.getAppState()),
    files: data.files ?? {},
  }
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
  clearHistory(api)
  if (!keepView && restored.elements.length > 0) {
    api.setViewport({ target: contentToShow(restored.elements, api.getAppState()), fit: 'none', animation: false })
  }
}

/** What `contentToShow` reads of the view: its size, zoom and place, as Excalidraw's app state holds them. */
export type ContentView = Pick<AppState, 'width' | 'height' | 'zoom' | 'scrollX' | 'scrollY' | 'offsetLeft' | 'offsetTop'>

/**
 * What an opened sheet is centred on, at the zoom it has: all of it where it
 * fits the view, else the one element whose centre is nearest. This is the
 * rule of Excalidraw 0.18.1's `scrollToContent`, which `setViewport` no longer
 * has: it centres whatever it is given, so a sheet larger than the view would
 * open on the empty middle between its elements.
 */
export function contentToShow<T extends ExcalidrawElement>(elements: readonly T[], view: ContentView): readonly T[] {
  const [x1, y1, x2, y2] = getCommonBounds(elements)
  const zoom = view.zoom.value
  if ((x2 - x1) * zoom <= view.width && (y2 - y1) * zoom <= view.height) return elements
  // 0.18.1 measured from the scene point under the window's (scrollX, scrollY): kept, so a sheet opens where it did.
  const fromX = (view.scrollX - view.offsetLeft) / zoom - view.scrollX
  const fromY = (view.scrollY - view.offsetTop) / zoom - view.scrollY
  let nearest = elements[0]
  let least = Infinity
  for (const element of elements) {
    const [ex1, ey1, ex2, ey2] = getCommonBounds([element])
    const distance = Math.hypot((ex1 + ex2) / 2 - fromX, (ey1 + ey2) / 2 - fromY)
    if (distance < least) {
      least = distance
      nearest = element
    }
  }
  return [nearest]
}

/**
 * Empties undo and redo. Excalidraw 0.18's typings give `history.clear` as
 * `any` (its type comes from a module the published package doesn't ship),
 * so this states its shape.
 */
function clearHistory(api: { history: { clear(): void } }) {
  api.history.clear()
}
