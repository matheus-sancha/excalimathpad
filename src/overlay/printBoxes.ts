import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { PrintBox } from '../print/printPages.ts'

type Placed = Pick<MathAnchor, 'id' | 'x' | 'y' | 'width' | 'height' | 'angle'>

/** One part of a drawn math element that a break never cuts, and its node. */
export interface BoxNode {
  node: HTMLElement
  /** A table line's row stands for its equation only: its box ends where its table starts. */
  until?: HTMLElement
  table?: string
  header?: boolean
}

/**
 * The parts of one element's body that are print boxes (docs/spec-v1.md
 * section 11, Page breaks), in a fixed order: the title's header, each row,
 * and for a table line its equation, its header row and each body row. A plot
 * is inside its line's row, so the row is one box. The print view walks a
 * cloned body the same way, so the i-th part of a clone is the i-th box.
 */
export function boxNodes(body: HTMLElement, anchorId: string): BoxNode[] {
  const parts: BoxNode[] = []
  const header = body.querySelector<HTMLElement>('[data-title]')
  if (header) parts.push({ node: header })
  for (const row of body.querySelectorAll<HTMLElement>('.math-element__row')) {
    const table = row.querySelector('.math-element__table')
    if (!table) {
      parts.push({ node: row })
      continue
    }
    const id = `${anchorId}:${row.dataset.line}`
    parts.push({ node: row, until: row.querySelector<HTMLElement>('.math-element__table-cell')! })
    for (const tr of table.querySelectorAll<HTMLElement>('thead tr')) parts.push({ node: tr, table: id, header: true })
    for (const tr of table.querySelectorAll<HTMLElement>('tbody tr')) parts.push({ node: tr, table: id })
  }
  return parts
}

/** The body of the element drawn for an anchor, inside `root`. */
export function bodyOf(root: ParentNode, anchorId: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(`.math-element[data-anchor-id="${CSS.escape(anchorId)}"] .math-element__body`)
}

/**
 * The math elements' print boxes (docs/spec-v1.md section 11, Page breaks), in
 * scene units, measured from the elements as drawn: `boxNodes` of each.
 *
 * Measured with `getBoundingClientRect`, not `offsetTop`, whose whole pixels add
 * up over a long table (docs/research/print-pdf.md), and divided by the zoom the
 * elements are drawn at. A rotated element, or one not laid out, is one box: its
 * anchor's bounds as rotated.
 */
export function mathBoxes(root: ParentNode, anchors: readonly Placed[], zoom: number): PrintBox[] {
  return anchors.flatMap((anchor) => {
    const body = bodyOf(root, anchor.id)
    const origin = body?.getBoundingClientRect()
    if (!body || !origin || origin.width === 0 || anchor.angle !== 0) return [anchorBox(anchor)]

    const toScene = (rect: DOMRect): PrintBox => ({
      left: anchor.x + (rect.left - origin.left) / zoom,
      top: anchor.y + (rect.top - origin.top) / zoom,
      right: anchor.x + (rect.right - origin.left) / zoom,
      bottom: anchor.y + (rect.bottom - origin.top) / zoom,
    })
    const boxes = boxNodes(body, anchor.id).map(({ node, until, table, header }) => {
      const box = toScene(node.getBoundingClientRect())
      if (until) box.bottom = toScene(until.getBoundingClientRect()).top
      if (table !== undefined) box.table = table
      if (header) box.header = true
      return box
    })
    return boxes.length > 0 ? boxes : [anchorBox(anchor)]
  })
}

/** The anchor's axis-aligned bounds as rotated about its centre, Excalidraw's rule. */
export function anchorBox({ x, y, width, height, angle }: Placed): PrintBox {
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  const halfWidth = (width * cos + height * sin) / 2
  const halfHeight = (width * sin + height * cos) / 2
  const cx = x + width / 2
  const cy = y + height / 2
  return { left: cx - halfWidth, top: cy - halfHeight, right: cx + halfWidth, bottom: cy + halfHeight }
}
