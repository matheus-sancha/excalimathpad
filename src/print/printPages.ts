/**
 * Print pages (docs/spec-v1.md sections 2 and 11): the sheet laid out for its
 * Page setting. Pure, and free of the DOM and Excalidraw: it gets the sheet's
 * boxes in scene units (drawings from the canvas, rows measured by the overlay)
 * and returns where each page starts and ends. Computed at print time, never
 * stored; the same boxes and Page give the same pages.
 */

export type PaperSize = 'A4' | 'Letter'
export type Orientation = 'portrait' | 'landscape'
export interface PageSetting {
  size: PaperSize
  orientation: Orientation
}

/** One box of the sheet, in scene units. */
export interface PrintBox {
  left: number
  top: number
  right: number
  bottom: number
  /**
   * A table's rows carry its id, so a break between them repeats its header
   * row on the next page; the header row is marked `header`.
   */
  table?: string
  header?: boolean
}

export interface PrintPage {
  /** The slice of the sheet this page shows, in scene units: `top` to `bottom`. */
  top: number
  bottom: number
  /** Tables split by the break above this page: their header rows repeat at its top. */
  headers: string[]
  /** The repeated header rows' room, in scene units, above `top`'s content. */
  headerRoom: number
}

export interface PrintLayout {
  /** The paper, in CSS pixels. */
  paper: { width: number; height: number }
  /** Each margin, and the footer's band above the bottom margin, in CSS pixels. */
  margin: number
  footer: number
  /** CSS pixels per scene unit: shrink only, at most 1 (section 11, Scale). */
  scale: number
  /** The content's left edge in scene units, which maps to the left margin. */
  left: number
  pages: PrintPage[]
}

const PX_PER_MM = 96 / 25.4
/** Section 11, Furniture. */
export const MARGIN_MM = 15
/** The small grey footer's band: one line of small text and the gap above it. */
export const FOOTER_MM = 7

const PAPER_MM: Record<PaperSize, [number, number]> = {
  A4: [210, 297],
  Letter: [215.9, 279.4],
}

/**
 * Measured boxes of rows that touch can overlap by a rounding error; a break
 * within this many scene units of a box's edge counts as on the edge.
 */
const EDGE = 0.5

/** The paper in millimetres, for the Page setting: what `@page` is given. */
export function paperMillimetres(page: PageSetting): { width: number; height: number } {
  const [short, long] = PAPER_MM[page.size]
  return page.orientation === 'portrait' ? { width: short, height: long } : { width: long, height: short }
}

/** The paper in CSS pixels, for the Page setting. */
export function paperSize(page: PageSetting): { width: number; height: number } {
  const { width, height } = paperMillimetres(page)
  return { width: width * PX_PER_MM, height: height * PX_PER_MM }
}

/**
 * Lays the sheet's boxes out on pages (section 11, Page breaks). The content's
 * bounds map to the printable width, shrunk to fit and never enlarged. A break
 * is one line across the full width: from the page's bottom it moves up to the
 * nearest clean gap, a line through no unbreakable box, and with none it cuts at
 * the page's bottom. A box is unbreakable when it fits a page; a taller one
 * doesn't hold back the break. A table split by a break repeats its header row,
 * whose room the next page gives up. Each page starts at its first content, so
 * empty space on the sheet never makes a blank page.
 */
export function printPages(boxes: readonly PrintBox[], page: PageSetting): PrintLayout {
  const paper = paperSize(page)
  const margin = MARGIN_MM * PX_PER_MM
  const footer = FOOTER_MM * PX_PER_MM
  const printableWidth = paper.width - 2 * margin
  const printableHeight = paper.height - 2 * margin - footer
  const layout = { paper, margin, footer }

  if (boxes.length === 0) {
    return { ...layout, scale: 1, left: 0, pages: [{ top: 0, bottom: 0, headers: [], headerRoom: 0 }] }
  }

  const left = Math.min(...boxes.map((box) => box.left))
  const width = Math.max(...boxes.map((box) => box.right)) - left
  const scale = width > 0 ? Math.min(1, printableWidth / width) : 1
  const pageHeight = printableHeight / scale
  const unbreakable = boxes.filter((box) => box.bottom - box.top <= pageHeight)
  const tables = tableExtents(boxes)
  const bottom = Math.max(...boxes.map((box) => box.bottom))

  const pages: PrintPage[] = []
  let top = Math.min(...boxes.map((box) => box.top))
  let headers: string[] = []
  for (;;) {
    let headerRoom = Math.max(0, ...headers.map((id) => tables.get(id)!.headerHeight))
    // A header row as tall as the page leaves no room for rows under it.
    if (headerRoom >= pageHeight - EDGE) {
      headers = []
      headerRoom = 0
    }
    const limit = top + pageHeight - headerRoom
    if (limit >= bottom - EDGE) {
      pages.push({ top, bottom, headers, headerRoom })
      break
    }
    const cut = cleanGap(unbreakable, top, limit) ?? limit
    pages.push({ top, bottom: cut, headers, headerRoom })

    headers = [...tables]
      .filter(([, table]) => table.headerBottom <= cut + EDGE && table.bottom > cut + EDGE)
      .map(([id]) => id)
    const next = Math.min(...boxes.filter((box) => box.bottom > cut + EDGE).map((box) => box.top))
    top = Math.max(cut, next)
  }
  return { ...layout, scale, left, pages }
}

/**
 * The lowest line from `top` (exclusive) to `limit` that passes through no
 * unbreakable box, or null. A clean gap is at a box's edge or at the limit.
 */
function cleanGap(unbreakable: readonly PrintBox[], top: number, limit: number): number | null {
  const candidates = [limit]
  for (const box of unbreakable) {
    for (const y of [box.top, box.bottom]) {
      if (y > top + EDGE && y < limit) candidates.push(y)
    }
  }
  const clean = candidates.filter((y) =>
    unbreakable.every((box) => !(box.top + EDGE < y && y < box.bottom - EDGE)),
  )
  return clean.length > 0 ? Math.max(...clean) : null
}

interface TableExtent {
  headerBottom: number
  headerHeight: number
  bottom: number
}

/** Each table's header row and its last row's bottom. A table with no header row repeats nothing. */
function tableExtents(boxes: readonly PrintBox[]): Map<string, TableExtent> {
  const tables = new Map<string, TableExtent>()
  for (const header of boxes) {
    if (header.table === undefined || !header.header) continue
    const rows = boxes.filter((box) => box.table === header.table)
    tables.set(header.table, {
      headerBottom: header.bottom,
      headerHeight: header.bottom - header.top,
      bottom: Math.max(...rows.map((row) => row.bottom)),
    })
  }
  return tables
}
