import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { Point } from './viewport.ts'

/**
 * Which math element and which line are under a point, from geometry alone
 * (docs/spec-v1.md section 14). The overlay is pointer-transparent, so the DOM
 * can't say what was hit: the stage listeners hand in a scene point and the
 * rows as laid out.
 */

/** One row as laid out in its element, in scene units before rotation. */
export interface RowBox {
  /** From the element's top edge: the row's `offsetTop`. */
  top: number
  /** The row's `offsetHeight`. */
  height: number
}

/**
 * The point in the anchor's own frame: scene units from its top-left corner,
 * with its rotation undone. Excalidraw rotates an element about its centre.
 */
export function toAnchorFrame(anchor: MathAnchor, point: Point): Point {
  const cx = anchor.x + anchor.width / 2
  const cy = anchor.y + anchor.height / 2
  const cos = Math.cos(-anchor.angle)
  const sin = Math.sin(-anchor.angle)
  const dx = point.x - cx
  const dy = point.y - cy
  return {
    x: dx * cos - dy * sin + anchor.width / 2,
    y: dx * sin + dy * cos + anchor.height / 2,
  }
}

export function containsPoint(anchor: MathAnchor, point: Point): boolean {
  const { x, y } = toAnchorFrame(anchor, point)
  return x >= 0 && x <= anchor.width && y >= 0 && y <= anchor.height
}

/**
 * The topmost anchor under the point. `anchors` come in Excalidraw's z-order,
 * bottom first, as `getSceneElements` returns them.
 */
export function anchorAt(anchors: readonly MathAnchor[], point: Point): MathAnchor | null {
  for (let i = anchors.length - 1; i >= 0; i--) {
    if (containsPoint(anchors[i], point)) return anchors[i]
  }
  return null
}

/**
 * The line under the point, as an index into `rows`. A point above the first
 * row counts as the first line, one below the last as the last, and one in a gap
 * between rows as the nearer row. Only the height decides: a row spans the
 * element's width, its result and anything drawn under it included.
 */
export function lineAt(anchor: MathAnchor, point: Point, rows: readonly RowBox[]): number {
  if (rows.length === 0) return 0
  const { y } = toAnchorFrame(anchor, point)
  const inRow = rows.findIndex(({ top, height }) => y >= top && y < top + height)
  if (inRow >= 0) return inRow
  let nearest = 0
  let nearestDistance = Infinity
  rows.forEach(({ top, height }, index) => {
    const distance = y < top ? top - y : y - (top + height)
    if (distance < nearestDistance) {
      nearest = index
      nearestDistance = distance
    }
  })
  return nearest
}
