import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'

/**
 * A math element's anchor: a plain Excalidraw rectangle marked with
 * `customData.kind === "math"`. Excalidraw owns its position, size, rotation,
 * selection, deletion and undo; the math overlay only reads it (ADR 0002).
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
}

export function isMathAnchor(element: ExcalidrawElement): boolean {
  return (
    !element.isDeleted &&
    element.type === 'rectangle' &&
    element.customData?.kind === MATH_ANCHOR_KIND
  )
}

export function toMathAnchor(element: ExcalidrawElement): MathAnchor {
  const { id, x, y, width, height, angle } = element
  return { id, x, y, width, height, angle }
}

/** Builds the scene elements for new anchors (e.g. for `initialData`). */
export function createMathAnchorElements(
  anchors: ReadonlyArray<Omit<MathAnchor, 'angle'>>,
) {
  return convertToExcalidrawElements(
    anchors.map(({ id, x, y, width, height }) => ({
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
      customData: { kind: MATH_ANCHOR_KIND },
    })),
    // Keep our ids: the overlay keys each element's source by anchor id.
    { regenerateIds: false },
  )
}
