import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
} from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

/**
 * A math element's anchor: a plain Excalidraw rectangle marked with
 * `customData.kind === "math"`, whose `customData.source` holds the element's
 * lines. Excalidraw owns its position, rotation, selection, deletion and undo;
 * the app writes the source, once per line commit (ADR 0002).
 */
export const MATH_ANCHOR_KIND = 'math'

/** What the overlay needs from an anchor, in scene coordinates. */
export interface MathAnchor {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Radians, clockwise, around the element's centre (Excalidraw's rule). */
  angle: number
  /** The element's lines. The scene holds the only stored copy. */
  source: string
}

export function isMathAnchor(element: ExcalidrawElement): boolean {
  return (
    !element.isDeleted &&
    element.type === 'rectangle' &&
    element.customData?.kind === MATH_ANCHOR_KIND
  )
}

/** A hand-edited file can hold anything here; anything but a string is no source. */
function readSource(element: ExcalidrawElement): string {
  const source: unknown = element.customData?.source
  return typeof source === 'string' ? source : ''
}

export function toMathAnchor(element: ExcalidrawElement): MathAnchor {
  const { id, x, y, width, height, angle } = element
  return { id, x, y, width, height, angle, source: readSource(element) }
}

/** True when two anchors would be drawn and evaluated identically. */
export function sameAnchor(a: MathAnchor, b: MathAnchor): boolean {
  return (
    a.id === b.id &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.angle === b.angle &&
    a.source === b.source
  )
}

/** Builds the scene elements for new anchors (e.g. for `initialData`). */
export function createMathAnchorElements(
  anchors: ReadonlyArray<Omit<MathAnchor, 'angle' | 'source'> & { source?: string }>,
) {
  return convertToExcalidrawElements(
    anchors.map(({ id, x, y, width, height, source = '' }) => ({
      type: 'rectangle' as const,
      id,
      x,
      y,
      width,
      height,
      strokeColor: '#868e96',
      strokeStyle: 'dashed' as const,
      backgroundColor: 'transparent',
      roughness: 0,
      customData: { kind: MATH_ANCHOR_KIND, source },
    })),
    // Keep our ids: callers refer to their anchors by them.
    { regenerateIds: false },
  )
}

/** The slice of Excalidraw's API a source write needs. */
export type SourceWriteApi = Pick<
  ExcalidrawImperativeAPI,
  'getSceneElementsIncludingDeleted' | 'updateScene'
>

/**
 * The only way source enters the scene. A call that changes the source adds
 * exactly one step for that source to Excalidraw's undo stack; a call that
 * changes nothing, or names no live anchor, writes nothing and adds no step.
 * Returns whether it wrote.
 *
 * Each of these fails silently if dropped (docs/spec-v1.md section 14):
 * - `newElementWith` gives a new `versionNonce`; a plain spread isn't recorded.
 * - `IMMEDIATELY` is the only safe capture. After `EVENTUALLY` or the default,
 *   later updates to that anchor drop off the undo stack.
 * - `recordPendingChange` comes first, or the write can add no step at all.
 *
 * The list stays the whole scene, deleted elements included: a source write has
 * no reason to change anything but its own anchor.
 */
export function writeAnchorSource(
  api: SourceWriteApi,
  anchorId: string,
  source: string,
): boolean {
  const anchor = api.getSceneElementsIncludingDeleted().find(({ id }) => id === anchorId)
  if (!anchor || !isMathAnchor(anchor) || readSource(anchor) === source) return false
  const committed = recordPendingChange(api, anchor)
  api.updateScene({
    elements: withElement(
      api,
      newElementWith(committed, { customData: { ...committed.customData, source } }),
    ),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  return true
}

/**
 * Records, as its own undo step, any change Excalidraw made to the anchor
 * without capturing it: its arrow-key nudge and its Link editor do this. Does
 * nothing if there is none. Returns the anchor as the scene now holds it.
 *
 * While the anchor's `version` is ahead of Excalidraw's last captured copy,
 * `updateScene` swaps it for that copy before capturing, so a write lands in the
 * scene but records nothing, and undo can't reach it. No public call flushes
 * this, and `updateScene` compares against the scene's current version. So the
 * first update parks the version at 0 without capturing, and the second captures
 * with the real version back. That comparison isn't public API:
 * `mathAnchor.excalidraw.test.tsx` fails if an upgrade changes it (ADR 0002).
 */
function recordPendingChange(api: SourceWriteApi, anchor: ExcalidrawElement) {
  api.updateScene({ elements: withElement(api, { ...anchor, version: 0 }) })
  const committed = newElementWith(anchor, {}, true)
  api.updateScene({
    elements: withElement(api, committed),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  return committed
}

function withElement(api: SourceWriteApi, next: ExcalidrawElement) {
  return api
    .getSceneElementsIncludingDeleted()
    .map((element) => (element.id === next.id ? next : element))
}
