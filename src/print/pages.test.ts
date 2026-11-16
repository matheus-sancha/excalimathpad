import { describe, expect, it } from 'vitest'
import { paperOf, printPages, type Box, type PageSetting, type PrintElement, type PrintLayout, type PrintRow } from './pages.ts'

const A4: PageSetting = { size: 'A4', orientation: 'portrait' }
const mm = (n: number) => (n * 96) / 25.4
/** A4 portrait's room, in CSS px: 180 × 259 mm (the paper less 15 mm margins and the 8 mm footer). */
const ROOM = { width: mm(180), height: mm(259) }

/** A math element at (x, y) of `count` rows `height` tall, of `kind`. */
function lines(id: string, x: number, y: number, count: number, height = 24, kind: PrintRow['kind'] = 'line'): PrintElement {
  const rows = Array.from({ length: count }, (_, i) => ({ kind, line: i, top: i * height, height }))
  return { id, x, y, width: 300, height: count * height, angle: 0, rows }
}

/** Every break between two pages. */
const breaks = (layout: PrintLayout) => layout.pages.slice(0, -1).map((p) => p.bottom)

/** The boxes, in scene units, a break passes through (by more than half a px). */
function cutBy(y: number, boxes: { top: number; bottom: number }[]) {
  return boxes.filter((b) => b.top + 0.5 < y && y < b.bottom - 0.5)
}

const rowsOf = (e: PrintElement) => e.rows.map((r) => ({ top: e.y + r.top, bottom: e.y + r.top + r.height }))

describe('the print pages (docs/spec-v1.md section 11)', () => {
  describe('Page and Furniture', () => {
    it('gives A4 and Letter, portrait and landscape, less 15 mm margins and the footer', () => {
      const a4 = paperOf(A4)
      expect(a4.width).toBeCloseTo(mm(210))
      expect(a4.height).toBeCloseTo(mm(297))
      expect(a4.margin).toBeCloseTo(mm(15))
      expect(a4.footer).toBeCloseTo(mm(8))
      expect(a4.room.width).toBeCloseTo(ROOM.width)
      expect(a4.room.height).toBeCloseTo(ROOM.height)

      const a4Landscape = paperOf({ size: 'A4', orientation: 'landscape' })
      expect(a4Landscape.width).toBeCloseTo(mm(297))
      expect(a4Landscape.room.height).toBeCloseTo(mm(210 - 30 - 8))

      const letter = paperOf({ size: 'Letter', orientation: 'portrait' })
      expect(letter.width).toBeCloseTo(8.5 * 96)
      expect(letter.height).toBeCloseTo(11 * 96)
      const letterLandscape = paperOf({ size: 'Letter', orientation: 'landscape' })
      expect(letterLandscape.width).toBeCloseTo(11 * 96)
      expect(letterLandscape.room.width).toBeCloseTo(11 * 96 - mm(30))
    })

    it('flows a long sheet onto as many pages as it needs, each no taller than the room', () => {
      const element = lines('m', 0, 0, 200)
      for (const page of [A4, { size: 'Letter', orientation: 'landscape' }] as const) {
        const layout = printPages({ drawings: [], elements: [element], page })
        const tall = layout.room.height / layout.scale
        expect(layout.pages.length).toBe(Math.ceil(4800 / (Math.floor(tall / 24) * 24)))
        for (const p of layout.pages) expect(p.bottom - p.top).toBeLessThanOrEqual(tall + 1e-9)
        expect(layout.pages[0].top).toBe(0)
        expect(layout.pages.at(-1)).toMatchObject({ bottom: 4800, end: 'last' })
        // Each page starts where the last one ended: nothing is skipped or printed twice.
        layout.pages.slice(1).forEach((p, i) => expect(p.top).toBe(layout.pages[i].bottom))
      }
    })

    it('gives an empty sheet one empty page', () => {
      const layout = printPages({ drawings: [], elements: [], page: A4 })
      expect(layout.scale).toBe(1)
      expect(layout.pages).toEqual([{ top: 0, bottom: 0, headers: [], headerRoom: 0, end: 'last' }])
    })
  })

  describe('What prints and Scale', () => {
    it('maps the content’s bounds, drawings and math elements, from the left margin', () => {
      const layout = printPages({
        drawings: [{ x: -40, y: 300, width: 100, height: 50 }],
        elements: [lines('m', 120, 80, 3)],
        page: A4,
      })
      expect(layout.content).toEqual({ x: -40, y: 80, width: 460, height: 270 })
      expect(layout.pages[0].top).toBe(80)
    })

    it('prints a narrow sheet at 100%, never larger', () => {
      expect(printPages({ drawings: [], elements: [lines('m', 0, 0, 3)], page: A4 }).scale).toBe(1)
    })

    it('shrinks a wide sheet to the printable width, with no floor', () => {
      const wide = (width: number) => printPages({ drawings: [{ x: 0, y: 0, width, height: 10 }], elements: [], page: A4 })
      expect(wide(ROOM.width * 2).scale).toBeCloseTo(0.5)
      expect(wide(ROOM.width * 40).scale).toBeCloseTo(1 / 40)
      // Landscape is wider, so the same sheet shrinks less.
      const landscape = printPages({ drawings: [{ x: 0, y: 0, width: ROOM.width * 2, height: 10 }], elements: [], page: { size: 'A4', orientation: 'landscape' } })
      expect(landscape.scale).toBeCloseTo(mm(267) / (ROOM.width * 2))
    })

    it('holds more of a shrunk sheet on a page, in scene units', () => {
      const element = lines('m', 0, 0, 200)
      const layout = printPages({ drawings: [{ x: 0, y: 0, width: ROOM.width * 2, height: 10 }], elements: [element], page: A4 })
      expect(layout.scale).toBeCloseTo(0.5)
      expect(layout.pages[0].bottom).toBe(Math.floor((ROOM.height * 2) / 24) * 24)
    })
  })

  describe('Page breaks', () => {
    it('never cuts a math line: the break moves up to the gap above it', () => {
      // Rows of 37 units, so the page's bottom falls inside one.
      const element = lines('m', 0, 0, 40, 37)
      const layout = printPages({ drawings: [], elements: [element], page: A4 })
      expect(breaks(layout)).toEqual([Math.floor(ROOM.height / 37) * 37])
      expect(layout.pages[0].end).toBe('gap')
      expect(cutBy(breaks(layout)[0], rowsOf(element))).toEqual([])
    })

    it('never cuts a comment row, however many lines it wraps to', () => {
      const element: PrintElement = {
        id: 'c', x: 0, y: 0, width: 320, height: 1200, angle: 0,
        rows: [
          { kind: 'comment', line: 0, top: 0, height: 900 },
          { kind: 'comment', line: 1, top: 900, height: 300 },
        ],
      }
      const layout = printPages({ drawings: [], elements: [element], page: A4 })
      expect(breaks(layout)).toEqual([900])
    })

    it('never cuts a whole plot, a square chart among them', () => {
      const element: PrintElement = {
        id: 'p', x: 0, y: 0, width: 480, height: 1300, angle: 0,
        rows: [
          ...Array.from({ length: 30 }, (_, i) => ({ kind: 'line' as const, line: i, top: i * 24, height: 24 })),
          // The pump sheet's chart: its line, 280 px of chart and its legend.
          { kind: 'plot', line: 30, top: 720, height: 330 },
          // The true-position chart at L: square, 360 px, and its line.
          { kind: 'plot', line: 31, top: 1050, height: 390 },
        ],
      }
      const layout = printPages({ drawings: [], elements: [element], page: A4 })
      expect(breaks(layout)).toEqual([720])
      const landscape = printPages({ drawings: [], elements: [element], page: { size: 'A4', orientation: 'landscape' } })
      expect(breaks(landscape)).toEqual([648, 1050])
      for (const y of [...breaks(layout), ...breaks(landscape)]) expect(cutBy(y, rowsOf(element))).toEqual([])
    })

    it('never cuts a table row, and repeats a split table’s header row, which takes its room', () => {
      // A table line (24), its header (30) and 60 rows of 20.
      const rows: PrintRow[] = [
        { kind: 'line', line: 0, top: 0, height: 24 },
        { kind: 'line', line: 1, top: 24, height: 24 },
        { kind: 'table-header', line: 1, top: 48, height: 30 },
        ...Array.from({ length: 60 }, (_, i) => ({ kind: 'table-row' as const, line: 1, top: 78 + i * 20, height: 20 })),
        { kind: 'line', line: 2, top: 1278, height: 24 },
      ]
      const element: PrintElement = { id: 't', x: 0, y: 0, width: 300, height: 1302, angle: 0, rows }
      const layout = printPages({ drawings: [], elements: [element], page: A4 })
      const first = 78 + Math.floor((ROOM.height - 78) / 20) * 20
      expect(breaks(layout)).toEqual([first])
      expect(layout.pages[0].headers).toEqual([])
      expect(layout.pages[1]).toMatchObject({ top: first, headers: [{ element: 't', line: 1, height: 30 }], headerRoom: 30, end: 'last' })
      for (const y of breaks(layout)) expect(cutBy(y, rowsOf(element))).toEqual([])

      // On a shrunk sheet the repeated header takes its room from the next page too.
      const long: PrintElement = {
        ...element,
        rows: [
          { kind: 'line', line: 1, top: 0, height: 24 },
          { kind: 'table-header', line: 1, top: 24, height: 30 },
          ...Array.from({ length: 150 }, (_, i) => ({ kind: 'table-row' as const, line: 1, top: 54 + i * 20, height: 20 })),
        ],
        height: 54 + 3000,
      }
      const split = printPages({ drawings: [], elements: [long], page: A4 })
      const [b1, b2] = breaks(split)
      expect(b1).toBe(54 + Math.floor((ROOM.height - 54) / 20) * 20)
      // The second page holds the header's 30 units fewer of the table.
      expect(b2).toBe(b1 + Math.floor((ROOM.height - 30) / 20) * 20)
      expect(split.pages.slice(1).every((p) => p.headerRoom === 30 && p.headers.length === 1)).toBe(true)
      for (const p of split.pages) expect(p.bottom - p.top + p.headerRoom).toBeLessThanOrEqual(ROOM.height)
    })

    it('keeps a table’s line, its header row and its first row together', () => {
      // The page's bottom falls under the header: the break goes above the table's line.
      const head = 4 * Math.floor((ROOM.height - 60) / 4)
      const rows: PrintRow[] = [
        ...Array.from({ length: head / 4 }, (_, i) => ({ kind: 'line' as const, line: i, top: i * 4, height: 4 })),
        { kind: 'line', line: 999, top: head, height: 24 },
        { kind: 'table-header', line: 999, top: head + 24, height: 30 },
        ...Array.from({ length: 10 }, (_, i) => ({ kind: 'table-row' as const, line: 999, top: head + 54 + i * 20, height: 20 })),
      ]
      const layout = printPages({ drawings: [], elements: [{ id: 't', x: 0, y: 0, width: 300, height: head + 254, angle: 0, rows }], page: A4 })
      expect(breaks(layout)).toEqual([head])
      expect(layout.pages[1].headers).toEqual([])
    })

    it('keeps a drawing that fits on one page whole', () => {
      const element = lines('m', 0, 0, 60)
      const frame: Box = { x: 400, y: ROOM.height - 200, width: 200, height: 400 }
      const layout = printPages({ drawings: [frame], elements: [element], page: A4 })
      expect(breaks(layout)).toEqual([Math.floor((ROOM.height - 200) / 24) * 24])
      expect(breaks(layout)[0]).toBeLessThanOrEqual(frame.y)
    })

    it('counts Excalidraw text as a drawing', () => {
      // A heading is a drawing's box; a page never cuts it.
      const heading: Box = { x: 0, y: ROOM.height - 10, width: 200, height: 35 }
      const layout = printPages({ drawings: [{ x: 0, y: 0, width: 10, height: 10 }, heading, { x: 0, y: 2000, width: 10, height: 10 }], elements: [], page: A4 })
      expect(breaks(layout)[0]).toBe(heading.y)
    })

    it('doesn’t let a drawing taller than a page hold back the break', () => {
      // A rectangle around a section, taller than a page: the break stays at the rows’ gap near the bottom.
      const element = lines('m', 20, 20, 80)
      const around: Box = { x: 0, y: 0, width: 400, height: 1960 }
      const layout = printPages({ drawings: [around], elements: [element], page: A4 })
      expect(breaks(layout)[0]).toBe(20 + Math.floor((ROOM.height - 20) / 24) * 24)
      expect(layout.pages[0].end).toBe('gap')
    })

    it('makes a break one line across the full width, so side-by-side content moves together', () => {
      // Two elements side by side; the right one has a plot where the left one's page would end.
      const leftSide = lines('a', 0, 0, 60)
      const rightSide: PrintElement = {
        id: 'b', x: 320, y: 0, width: 340, height: 1030, angle: 0,
        rows: [
          ...Array.from({ length: 25 }, (_, i) => ({ kind: 'line' as const, line: i, top: i * 28, height: 28 })),
          { kind: 'plot', line: 25, top: 700, height: 330 },
        ],
      }
      const layout = printPages({ drawings: [], elements: [leftSide, rightSide], page: A4 })
      // Above the plot, 696 is inside the right side's last line; 672 is a gap on both sides.
      expect(breaks(layout)).toEqual([672])
      for (const y of breaks(layout)) expect(cutBy(y, [...rowsOf(leftSide), ...rowsOf(rightSide)])).toEqual([])
    })

    it('falls back to a cut at the page’s bottom when no clean gap is left (staggered side-by-side elements)', () => {
      // Rows of 24 beside rows of 24 offset by 12: every gap of one is inside a row of the other.
      const leftSide = lines('a', 0, 0, 100)
      const rightSide = lines('b', 340, 12, 100)
      const layout = printPages({ drawings: [], elements: [leftSide, rightSide], page: A4 })
      expect(layout.pages[0]).toMatchObject({ top: 0, bottom: ROOM.height, end: 'cut' })
      expect(layout.pages[1].top).toBe(ROOM.height)
      expect(layout.pages.at(-1)!.bottom).toBe(2412)
    })

    it('takes no gap above the page’s first row for a clean one: the page would be empty', () => {
      // As Chromium lays the staggered pair out: each element's rows start below its top.
      const pad = (e: PrintElement): PrintElement => ({ ...e, rows: e.rows.map((r) => ({ ...r, top: r.top + 8 })), height: e.height + 8 })
      const layout = printPages({ drawings: [], elements: [pad(lines('a', 0, 0, 100)), pad(lines('b', 340, 12, 100))], page: A4 })
      expect(layout.pages[0]).toMatchObject({ top: 0, bottom: ROOM.height, end: 'cut' })
    })

    it('moves to a clean gap when side-by-side elements share one above the page’s bottom', () => {
      // The staggered pair, but the right one has a gap of its own at 480 where the left one has one too.
      const leftSide = lines('a', 0, 0, 100)
      const rightSide: PrintElement = {
        id: 'b', x: 340, y: 12, width: 300, height: 2400, angle: 0,
        rows: [
          { kind: 'line', line: 0, top: 0, height: 468 },
          ...Array.from({ length: 80 }, (_, i) => ({ kind: 'line' as const, line: i + 1, top: 468 + 12 + i * 24, height: 24 })),
        ],
      }
      // The right side's rows from 480 are [480 + 24k + 12 … ]: offset again, so 480 is the last shared gap.
      const layout = printPages({ drawings: [], elements: [leftSide, rightSide], page: A4 })
      expect(breaks(layout)[0]).toBe(480)
      expect(layout.pages[0].end).toBe('gap')
    })

    it('treats a rotated element as one box', () => {
      const rotated: PrintElement = { ...lines('r', 0, ROOM.height - 100, 10), angle: Math.PI / 2 }
      const filler = lines('m', 0, 0, 60, 4)
      const layout = printPages({ drawings: [], elements: [filler, rotated], page: A4 })
      // Turned a quarter, 300 × 240 covers 240 × 300 about the same centre.
      const top = ROOM.height - 100 + 120 - 150
      expect(breaks(layout)[0]).toBeCloseTo(top)
    })
  })

  describe('Invariants (section 2)', () => {
    it('gives the same pages for the same scene, results and Page, and changes nothing it is given', () => {
      const element = lines('m', 0, 0, 100, 37)
      const drawings = [{ x: 400, y: 900, width: 100, height: 100 }]
      const freeze = <T,>(value: T): T => {
        if (value && typeof value === 'object') {
          Object.values(value).forEach(freeze)
          Object.freeze(value)
        }
        return value
      }
      const input = freeze({ drawings, elements: [element], page: A4 })
      const before = JSON.stringify(input)
      expect(printPages(input)).toEqual(printPages(input))
      expect(JSON.stringify(input)).toBe(before)
    })
  })
})
