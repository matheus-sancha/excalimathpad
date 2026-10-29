import type { MathAnchor } from '../canvas/mathAnchor.ts'

/**
 * The sheet's reading order (ADR 0003): math elements sorted by the top of
 * their anchor's visual bounding box, then by its left, then by anchor id, so
 * ties are deterministic. Derived from positions every time, never stored.
 *
 * A rotated anchor is placed by its rotated bounds, i.e. where it is seen,
 * not by Excalidraw's unrotated `x`/`y`.
 */
export function readingOrder(anchors: readonly MathAnchor[]): string[] {
  return anchors
    .map((anchor) => ({ id: anchor.id, ...visualTopLeft(anchor) }))
    .sort((a, b) => a.top - b.top || a.left - b.left || compareIds(a.id, b.id))
    .map(({ id }) => id)
}

/** Top-left of the axis-aligned box around the anchor as rotated about its centre. */
function visualTopLeft({ x, y, width, height, angle }: MathAnchor) {
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const halfWidth = (width * cos + height * sin) / 2
  const halfHeight = (width * sin + height * cos) / 2
  return { top: y + height / 2 - halfHeight, left: x + width / 2 - halfWidth }
}

// Code-unit order, not locale order: the same on every machine.
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
