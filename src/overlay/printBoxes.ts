import type { MathAnchor } from '../canvas/mathAnchor.ts'
import type { PrintBox } from '../print/printPages.ts'

type Placed = Pick<MathAnchor, 'id' | 'x' | 'y' | 'width' | 'height' | 'angle'>

/**
 * The math elements' print boxes (docs/spec-v1.md section 11, Page breaks), in
 * scene units, measured from the overlay as it is drawn. A break never cuts a
 * math line, comment row, table row or plot, so each is its own box: the
 * title's header, each row, and for a table line its equation, its header row
 * (marked, so a split repeats it) and each body row. A plot is inside its
 * line's row, so the row is one box.
 *
 * Measured with `getBoundingClientRect`, not `offsetTop`, whose whole pixels add
 * up over a long table (docs/research/print-pdf.md), and divided by the zoom the
 * overlay draws at. A rotated element, or one not laid out, is one box: its
 * anchor's bounds as rotated.
 */
export function mathBoxes(root: ParentNode, anchors: readonly Placed[], zoom: number): PrintBox[] {
  return anchors.flatMap((anchor) => {
    const body = root.querySelector<HTMLElement>(
      `.math-element[data-anchor-id="${CSS.escape(anchor.id)}"] .math-element__body`,
    )
    const origin = body?.getBoundingClientRect()
    if (!body || !origin || origin.width === 0 || anchor.angle !== 0) return [anchorBox(anchor)]

    const toScene = (rect: DOMRect): PrintBox => ({
      left: anchor.x + (rect.left - origin.left) / zoom,
      top: anchor.y + (rect.top - origin.top) / zoom,
      right: anchor.x + (rect.right - origin.left) / zoom,
      bottom: anchor.y + (rect.bottom - origin.top) / zoom,
    })

    const boxes: PrintBox[] = []
    const header = body.querySelector('[data-title]')
    if (header) boxes.push(toScene(header.getBoundingClientRect()))
    for (const row of body.querySelectorAll<HTMLElement>('.math-element__row')) {
      const rowBox = toScene(row.getBoundingClientRect())
      const table = row.querySelector('.math-element__table')
      if (!table) {
        boxes.push(rowBox)
        continue
      }
      const id = `${anchor.id}:${row.dataset.line}`
      const cell = toScene(row.querySelector('.math-element__table-cell')!.getBoundingClientRect())
      boxes.push({ ...rowBox, bottom: cell.top })
      for (const tr of table.querySelectorAll('thead tr')) {
        boxes.push({ ...toScene(tr.getBoundingClientRect()), table: id, header: true })
      }
      for (const tr of table.querySelectorAll('tbody tr')) {
        boxes.push({ ...toScene(tr.getBoundingClientRect()), table: id })
      }
    }
    return boxes.length > 0 ? boxes : [anchorBox(anchor)]
  })
}

/** The anchor's axis-aligned bounds as rotated about its centre, Excalidraw's rule. */
function anchorBox({ x, y, width, height, angle }: Placed): PrintBox {
  const sin = Math.abs(Math.sin(angle))
  const cos = Math.abs(Math.cos(angle))
  const halfWidth = (width * cos + height * sin) / 2
  const halfHeight = (width * sin + height * cos) / 2
  const cx = x + width / 2
  const cy = y + height / 2
  return { left: cx - halfWidth, top: cy - halfHeight, right: cx + halfWidth, bottom: cy + halfHeight }
}
