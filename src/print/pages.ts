/**
 * The print pages (docs/spec-v1.md section 11, Print; section 2, Print pages
 * and Unbreakable box): one pure function from the scene's boxes, the
 * overlay's measured rows and the sheet's Page setting to the pages and where
 * they break. The same in the web app and the plugin, and computed at print
 * time, never stored: the same input gives the same pages, and nothing here
 * changes the scene.
 *
 * Everything is in scene units (1 scene unit = 1 CSS px at 100%), except the
 * paper, in CSS px.
 */

/** The sheet's Page setting (section 7, `settings.page`). */
export interface PageSetting {
  size: 'A4' | 'Letter'
  orientation: 'portrait' | 'landscape'
}

/** An axis-aligned box in scene units. */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * One measured row of a math element, from the element's top, in scene units.
 * `line` is the source line it belongs to (-1 for the title and the failure
 * notice); a table's header and rows carry their table line's index.
 */
export interface PrintRow {
  kind: 'title' | 'notice' | 'line' | 'comment' | 'plot' | 'table-header' | 'table-row'
  line: number
  top: number
  height: number
}

/**
 * A math element: its anchor's box (unrotated, as stored), its rotation in
 * radians and its rows. A rotated element's rows aren't horizontal, so it
 * counts as one box, as a drawing does.
 */
export interface PrintElement extends Box {
  id: string
  angle: number
  rows: readonly PrintRow[]
}

export interface PrintInput {
  /** Every drawing's bounds, Excalidraw text included; never a math anchor. */
  drawings: readonly Box[]
  elements: readonly PrintElement[]
  page: PageSetting
}

/** A table split by the break above a page: its header row repeats at that page's top. */
export interface RepeatedHeader {
  element: string
  line: number
  /** The header row's height, in scene units. */
  height: number
}

export interface PrintPage {
  /** The scene's slice this page shows: from `top` to `bottom`. */
  top: number
  bottom: number
  /** Header rows repeated above the slice, and the room they take (scene units). */
  headers: RepeatedHeader[]
  headerRoom: number
  /**
   * How the page ends: `last`, the sheet's end; `gap`, a break moved up to the
   * nearest clean gap; `cut`, the fallback at the page's bottom, with no clean gap.
   */
  end: 'last' | 'gap' | 'cut'
}

export interface PrintLayout {
  /** The paper and its furniture, in CSS px. */
  paper: { width: number; height: number; margin: number; footer: number }
  /** What one page holds at scale 1, in CSS px: the paper less the margins and the footer. */
  room: { width: number; height: number }
  /** Scene units to CSS px: shrink only, capped at 1. */
  scale: number
  /** The content's bounds, in scene units; its left edge prints at the left margin. */
  content: Box
  pages: PrintPage[]
}

/** CSS px per millimetre. */
const PX_PER_MM = 96 / 25.4
/** Section 11, Furniture: margins of 15 mm. */
export const MARGIN_MM = 15
/** The footer's band above the bottom margin: room for one line of small grey text. */
export const FOOTER_MM = 8
/** The paper, portrait, in millimetres. */
const PAPER_MM = { A4: [210, 297], Letter: [215.9, 279.4] } as const
/**
 * A break this close to a box's edge counts as on it: measured rows can
 * overlap their neighbours by a fraction of a pixel.
 */
const EDGE = 0.5

/** The paper and the room on it for the Page setting, in CSS px. */
export function paperOf(page: PageSetting): PrintLayout['paper'] & { room: PrintLayout['room'] } {
  const [short, long] = PAPER_MM[page.size]
  const [w, h] = page.orientation === 'portrait' ? [short, long] : [long, short]
  const margin = MARGIN_MM * PX_PER_MM
  const footer = FOOTER_MM * PX_PER_MM
  const width = w * PX_PER_MM
  const height = h * PX_PER_MM
  return { width, height, margin, footer, room: { width: width - 2 * margin, height: height - 2 * margin - footer } }
}

/** An interval of y a break may not pass through. */
interface Span {
  top: number
  bottom: number
}

/** A table on the sheet: its header row's height and its body rows. */
interface Table {
  element: string
  line: number
  header: number
  rows: Span[]
}

/** The box a rotated box covers. */
function rotatedBounds(box: Box, angle: number): Box {
  if (!angle) return box
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const width = box.width * cos + box.height * sin
  const height = box.width * sin + box.height * cos
  return { x: cx - width / 2, y: cy - height / 2, width, height }
}

/**
 * The print pages for a sheet (section 11): the content's bounds mapped to
 * the printable width, shrunk only, then broken onto pages down its height.
 */
export function printPages({ drawings, elements, page }: PrintInput): PrintLayout {
  const { room, ...paper } = paperOf(page)

  // Every box that has a place on the sheet: the drawings and the math elements.
  const placed: Box[] = [...drawings, ...elements.map((e) => rotatedBounds(e, e.angle))].filter(
    (b) => Number.isFinite(b.x) && Number.isFinite(b.y) && b.width >= 0 && b.height >= 0,
  )
  if (placed.length === 0) {
    return {
      paper,
      room,
      scale: 1,
      content: { x: 0, y: 0, width: 0, height: 0 },
      pages: [{ top: 0, bottom: 0, headers: [], headerRoom: 0, end: 'last' }],
    }
  }
  const left = Math.min(...placed.map((b) => b.x))
  const top = Math.min(...placed.map((b) => b.y))
  const right = Math.max(...placed.map((b) => b.x + b.width))
  const bottom = Math.max(...placed.map((b) => b.y + b.height))
  const content = { x: left, y: top, width: right - left, height: bottom - top }

  // Scale: shrink only, capped at 100%, no floor.
  const scale = content.width > room.width ? room.width / content.width : 1
  // A page's height in scene units.
  const tall = room.height / scale

  // The unbreakable boxes (section 2): a drawing that fits a page, and each
  // math line, comment row, table row and whole plot. One taller than a page
  // doesn't hold back the break.
  const spans: Span[] = []
  // Every box with something to print, a tall one too.
  const inks: Span[] = []
  const tables: Table[] = []
  const add = (span: Span) => {
    inks.push(span)
    if (span.bottom - span.top <= tall) spans.push(span)
  }
  for (const d of drawings) add({ top: d.y, bottom: d.y + d.height })
  for (const element of elements) {
    // A rotated element, or one with no measured rows, is one box.
    if (element.angle || element.rows.length === 0) {
      const b = rotatedBounds(element, element.angle)
      add({ top: b.y, bottom: b.y + b.height })
      continue
    }
    const at = (row: PrintRow): Span => ({ top: element.y + row.top, bottom: element.y + row.top + row.height })
    const byTable = new Map<number, { line?: Span; header?: Span; rows: Span[] }>()
    const tableOf = (line: number) => {
      let table = byTable.get(line)
      if (!table) byTable.set(line, (table = { rows: [] }))
      return table
    }
    for (const row of element.rows) {
      if (row.kind === 'table-header') tableOf(row.line).header = at(row)
      else if (row.kind === 'table-row') tableOf(row.line).rows.push(at(row))
      else if (row.kind === 'line' && element.rows.some((r) => r.line === row.line && r.kind === 'table-header')) {
        tableOf(row.line).line = at(row)
      } else add(at(row))
    }
    for (const [line, table] of byTable) {
      const rows = [...table.rows].sort((a, b) => a.top - b.top)
      // A table's line, its header row and its first row stay together, so a
      // page never ends on a header with no row under it.
      const head = [table.line, table.header, rows[0]].filter((s): s is Span => s !== undefined)
      if (head.length > 0) add({ top: Math.min(...head.map((s) => s.top)), bottom: Math.max(...head.map((s) => s.bottom)) })
      for (const row of rows.slice(1)) add(row)
      if (table.header && rows.length > 0) {
        tables.push({ element: element.id, line, header: table.header.bottom - table.header.top, rows })
      }
    }
  }

  // The largest y at or above `y` that no unbreakable box crosses.
  const cleanAt = (y: number): number => {
    for (;;) {
      const crossing = spans.filter((s) => s.top + EDGE < y && y < s.bottom - EDGE)
      if (crossing.length === 0) return y
      y = Math.min(...crossing.map((s) => s.top))
    }
  }
  // The tables a break at `y` splits: a row above it and a row below it.
  const splitAt = (y: number): RepeatedHeader[] =>
    tables
      .filter((t) => t.rows.some((r) => r.bottom <= y + EDGE) && t.rows.some((r) => r.top >= y - EDGE && r.bottom > y + EDGE))
      .map((t) => ({ element: t.element, line: t.line, height: t.header }))

  const pages: PrintPage[] = []
  let from = top
  let headers: RepeatedHeader[] = []
  for (;;) {
    // A repeated header takes its room from the page; one that would leave no room isn't repeated.
    let headerRoom = Math.max(0, ...headers.map((h) => h.height))
    if (headerRoom >= tall / 2) {
      headers = []
      headerRoom = 0
    }
    const limit = from + tall - headerRoom
    if (limit >= bottom - EDGE) {
      pages.push({ top: from, bottom, headers, headerRoom, end: 'last' })
      return { paper, room, scale, content, pages }
    }
    const clean = cleanAt(limit)
    // A gap above the page's first box would leave the page empty, so it isn't one.
    const first = Math.min(...inks.filter((s) => s.bottom > from + EDGE).map((s) => Math.max(s.top, from)))
    // Fallback: no clean gap on the page (staggered side-by-side boxes), so cut at its bottom.
    const [at, end] = clean > first + EDGE ? [clean, 'gap' as const] : [limit, 'cut' as const]
    pages.push({ top: from, bottom: at, headers, headerRoom, end })
    headers = splitAt(at)
    from = at
  }
}
