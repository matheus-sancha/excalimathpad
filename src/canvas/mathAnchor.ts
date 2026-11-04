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
function sourceOf(element: ExcalidrawElement): string {
  const source: unknown = element.customData?.source
  return typeof source === 'string' ? source : ''
}

export function toMathAnchor(element: ExcalidrawElement): MathAnchor {
  const { id, x, y, width, height, angle } = element
  return { id, x, y, width, height, angle, source: sourceOf(element) }
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
 * The only way source enters the scene. One call that changes the source is
 * exactly one step on Excalidraw's undo stack; a call that changes nothing, or
 * names no live anchor, writes nothing and adds no step. Returns whether it
 * wrote.
 *
 * Each of these fails silently if dropped (docs/spec-v1.md section 14):
 * - `newElementWith` gives a new `versionNonce`; a plain spread isn't recorded.
 * - `IMMEDIATELY` is the only safe capture. After `EVENTUALLY` or the default,
 *   later updates to that anchor drop off the undo stack.
 *
 * The list stays the whole scene, deleted elements included: a source write has
 * no reason to change anything but its own anchor.
 */
export function writeAnchorSource(
  api: SourceWriteApi,
  anchorId: string,
  source: string,
): boolean {
  const elements = api.getSceneElementsIncludingDeleted()
  const anchor = elements.find((element) => element.id === anchorId)
  if (!anchor || !isMathAnchor(anchor) || sourceOf(anchor) === source) return false
  api.updateScene({
    elements: elements.map((element) =>
      element === anchor
        ? newElementWith(element, { customData: { ...element.customData, source } })
        : element,
    ),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  return true
}
