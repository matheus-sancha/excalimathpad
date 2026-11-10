import { CaptureUpdateAction, newElementWith } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ANCHOR_STYLE, isMathAnchor } from './mathAnchor.ts'

/**
 * Keeps every anchor in the fixed style (docs/spec-v1.md section 4, Selected
 * math element). Paste styles, a style change on a mixed selection, or a
 * hand-edited file can change it; the app writes it back with no undo step.
 * Opacity isn't part of the fixed style, so it is never restored.
 */

type StyleKey = keyof typeof ANCHOR_STYLE
const STYLE_KEYS = Object.keys(ANCHOR_STYLE) as StyleKey[]

export function hasAnchorStyle(element: ExcalidrawElement): boolean {
  return STYLE_KEYS.every((key) => element[key] === ANCHOR_STYLE[key])
}

/** The slice of Excalidraw's API a style restore needs. */
export type StyleRestoreApi = Pick<
  ExcalidrawImperativeAPI,
  'getSceneElementsIncludingDeleted' | 'updateScene'
>

/**
 * True when some anchor has lost the fixed style. Cheap enough for every
 * `onChange`, so the caller sets up a write only when there is one to make.
 */
export function anchorStylesChanged(api: Pick<StyleRestoreApi, 'getSceneElementsIncludingDeleted'>) {
  return api
    .getSceneElementsIncludingDeleted()
    .some((element) => isMathAnchor(element) && !hasAnchorStyle(element))
}

/**
 * Writes the fixed style back to every anchor that lost it, in one update.
 * Anchors that have it are left alone, so calling this from `onChange` settles
 * after one write. Returns whether it wrote.
 *
 * `newElementWith` + `CaptureUpdateAction.NEVER`, called from `onChange`: the
 * restore lands before Excalidraw records the change that broke the style, so
 * a paste styles on math alone adds no undo step at all, and one on a mixed
 * selection records only the drawings' change
 * (`anchorStyle.excalidraw.test.tsx`, with the control).
 */
export function restoreAnchorStyles(api: StyleRestoreApi): boolean {
  let wrote = false
  const elements = api.getSceneElementsIncludingDeleted().map((element) => {
    if (!isMathAnchor(element) || hasAnchorStyle(element)) return element
    wrote = true
    return newElementWith(element, ANCHOR_STYLE)
  })
  if (wrote) api.updateScene({ elements, captureUpdate: CaptureUpdateAction.NEVER })
  return wrote
}
