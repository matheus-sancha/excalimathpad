import { describe, expect, it } from 'vitest'
import { FOOTER_MM, MARGIN_MM, paperSize, printPages, type PrintBox } from './printPages.ts'

const A4 = { size: 'A4', orientation: 'portrait' } as const
const MM = 96 / 25.4
/** A4 portrait's printable box at scale 1, in scene units. */
const WIDTH = (210 - 2 * MARGIN_MM) * MM
const HEIGHT = (297 - 2 * MARGIN_MM - FOOTER_MM) * MM

const box = (left: number, top: number, right: number, bottom: number, extra: Partial<PrintBox> = {}): PrintBox => ({
  left,
  top,
  right,
  bottom,
  ...extra,
})

/** Rows of `height` stacked from `top`, in one column from x = 0 to 200. */
const rows = (count: number, height: number, top = 0, left = 0): PrintBox[] =>
  Array.from({ length: count }, (_, i) => box(left, top + i * height, left + 200, top + (i + 1) * height))

const cuts = (boxes: PrintBox[], page = A4) => printPages(boxes, page).pages.map((p) => [p.top, p.bottom])

/** True when no page's edge passes through the inside of an unbreakable box. */
function cutsNoBox(boxes: PrintBox[], pageHeight: number) {
  const pages = printPages(boxes, A4).pages
  return pages.every((page) =>
    boxes
      .filter((b) => b.bottom - b.top <= pageHeight)
      .every((b) => !(b.top + 0.5 < page.bottom && page.bottom < b.bottom - 0.5)),
  )
}

describe('paper and scale (section 11)', () => {
  it('A4 and Letter, portrait and landscape, in CSS pixels', () => {
    expect(paperSize(A4).width).toBeCloseTo(793.7, 1)
    expect(paperSize(A4).height).toBeCloseTo(1122.5, 1)
    expect(paperSize({ size: 'A4', orientation: 'landscape' }).width).toBeCloseTo(1122.5, 1)
    expect(paperSize({ size: 'Letter', orientation: 'portrait' }).width).toBeCloseTo(816)
    expect(paperSize({ size: 'Letter', orientation: 'portrait' }).height).toBeCloseTo(1056)
    expect(paperSize({ size: 'Letter', orientation: 'landscape' }).width).toBeCloseTo(1056)
  })

  it('a narrow sheet prints at 100%, never enlarged, from its left edge', () => {
    const layout = printPages([box(40, 10, 300, 90)], A4)
    expect(layout.scale).toBe(1)
    expect(layout.left).toBe(40)
    expect(layout.margin).toBeCloseTo(15 * MM)
  })

  it('a wide sheet shrinks to the printable width, with no floor', () => {
    expect(printPages([box(0, 0, WIDTH * 2, 50)], A4).scale).toBeCloseTo(0.5)
    expect(printPages([box(-100, 0, WIDTH * 20 - 100, 50)], A4).scale).toBeCloseTo(0.05)
  })

  it('a shrunk sheet fits more of its height on a page', () => {
    const boxes = [box(0, 0, WIDTH * 2, 10), ...rows(100, 20, 10)]
    // At 0.5 a page holds 2 × HEIGHT scene units, so 2010 units need 2 pages.
    expect(printPages(boxes, A4).pages).toHaveLength(Math.ceil(2010 / (HEIGHT * 2)))
  })

  it('landscape fits less height on a page than portrait', () => {
    const boxes = rows(60, 30)
    expect(printPages(boxes, { size: 'A4', orientation: 'landscape' }).pages.length).toBeGreaterThan(
      printPages(boxes, A4).pages.length,
    )
  })

  it('an empty sheet is one empty page', () => {
    expect(printPages([], A4).pages).toEqual([{ top: 0, bottom: 0, headers: [], headerRoom: 0 }])
  })

  it('a sheet that fits is one page, from its top to its bottom', () => {
    expect(cuts(rows(5, 20, 100))).toEqual([[100, 200]])
  })
})

describe('page breaks (section 11)', () => {
  it('never cuts a math line: the break moves up to the gap between two lines', () => {
    const boxes = rows(60, 30)
    const pages = printPages(boxes, A4).pages
    expect(pages.length).toBeGreaterThan(1)
    for (const page of pages.slice(0, -1)) expect(page.bottom % 30).toBe(0)
    expect(pages[0].bottom).toBe(Math.floor(HEIGHT / 30) * 30)
    // Pages run on with no gap and no overlap.
    for (let i = 1; i < pages.length; i++) expect(pages[i].top).toBe(pages[i - 1].bottom)
    expect(cutsNoBox(boxes, HEIGHT)).toBe(true)
  })

  it('a drawing that fits a page stays whole', () => {
    const drawing = box(0, HEIGHT - 100, 300, HEIGHT + 200)
    expect(cuts([box(0, 0, 300, 50), drawing])).toEqual([
      [0, HEIGHT - 100],
      [HEIGHT - 100, HEIGHT + 200],
    ])
  })

  it('a drawing taller than a page does not hold back the break', () => {
    const tall = box(0, 0, 300, HEIGHT * 2.5)
    expect(cuts([tall])).toEqual([
      [0, HEIGHT],
      [HEIGHT, HEIGHT * 2],
      [HEIGHT * 2, HEIGHT * 2.5],
    ])
  })

  it('a tall drawing beside math: the break still avoids the math lines', () => {
    const tall = box(400, 0, 600, HEIGHT * 1.5)
    const math = rows(40, 37)
    const first = printPages([tall, ...math], A4).pages[0]
    expect(first.bottom).toBe(Math.floor(HEIGHT / 37) * 37)
  })

  it('side-by-side content moves together: the break goes above a box that would be cut on either side', () => {
    // Gaps every 30 on the left and every 45 on the right line up only every 90.
    const leftColumn = rows(60, 30)
    const rightColumn = rows(40, 45, 0, 300)
    const pages = printPages([...leftColumn, ...rightColumn], A4).pages
    expect(pages[0].bottom).toBe(Math.floor(HEIGHT / 90) * 90)
    expect(cutsNoBox([...leftColumn, ...rightColumn], HEIGHT)).toBe(true)
  })

  it('falls back to the page bottom when staggered side-by-side boxes leave no clean gap', () => {
    // Each column's boxes are 600 tall; the right column is offset by 300, so every line crosses a box.
    const leftColumn = [box(0, 0, 200, 600), box(0, 600, 200, 1200), box(0, 1200, 200, 1800)]
    const rightColumn = [box(300, -300, 500, 300), box(300, 300, 500, 900), box(300, 900, 500, 1500)]
    const pages = printPages([...leftColumn, ...rightColumn], A4).pages
    expect(pages[0]).toMatchObject({ top: -300, bottom: -300 + HEIGHT })
    expect(pages[1].top).toBe(-300 + HEIGHT)
  })

  it('Excalidraw text counts as a drawing: a box like any other', () => {
    const heading = box(0, HEIGHT - 10, 300, HEIGHT + 20)
    expect(cuts([box(0, 0, 300, 40), heading])[0]).toEqual([0, HEIGHT - 10])
  })

  it('a plot is never cut', () => {
    const plot = box(0, HEIGHT - 150, 500, HEIGHT + 150)
    expect(cuts([...rows(5, 30), plot])[0]).toEqual([0, HEIGHT - 150])
  })

  it('treats rows that touch within a rounding error as touching', () => {
    const boxes = Array.from({ length: 60 }, (_, i) => box(0, i * 30 - 0.2, 200, (i + 1) * 30 + 0.2))
    const pages = printPages(boxes, A4).pages
    expect(Math.abs(pages[0].bottom - Math.floor(HEIGHT / 30) * 30)).toBeLessThan(0.5)
  })

  it('a page starts at its first content, so empty space never makes a blank page', () => {
    const top = rows(3, 30)
    const far = rows(3, 30, HEIGHT * 3)
    expect(cuts([...top, ...far])).toEqual([
      [0, HEIGHT],
      [HEIGHT * 3, HEIGHT * 3 + 90],
    ])
  })

  it('gives the same pages for the same boxes and Page', () => {
    const boxes = [...rows(80, 23), box(250, 400, 600, 1300)]
    expect(printPages(boxes, A4)).toEqual(printPages([...boxes].reverse(), A4))
  })
})

describe('a table split across pages (section 11)', () => {
  const header = box(0, 100, 300, 140, { table: 't', header: true })
  const body = Array.from({ length: 150 }, (_, i) => box(0, 140 + i * 20, 300, 160 + i * 20, { table: 't' }))

  it('repeats its header row, which takes room on the next page', () => {
    const pages = printPages([header, ...body], A4).pages
    expect(pages[0].headers).toEqual([])
    expect(pages[1].headers).toEqual(['t'])
    expect(pages[1].headerRoom).toBe(40)
    // The second page holds 40 units fewer of the table's rows.
    const rowsOn = (page: { top: number; bottom: number }) => (page.bottom - page.top) / 20
    expect(rowsOn(pages[1])).toBe(Math.floor((HEIGHT - 40) / 20))
    expect(cutsNoBox([header, ...body], HEIGHT)).toBe(true)
  })

  it('does not repeat the header when the break goes above the table', () => {
    const above = rows(1, HEIGHT - 120)
    // The header row straddles the page's bottom, so the whole table moves on.
    const shortTable = [
      box(0, HEIGHT - 20, 300, HEIGHT + 20, { table: 't', header: true }),
      ...Array.from({ length: 8 }, (_, i) => box(0, HEIGHT + 20 + i * 20, 300, HEIGHT + 40 + i * 20, { table: 't' })),
    ]
    const pages = printPages([...above, ...shortTable], A4).pages
    expect(pages[0].bottom).toBe(HEIGHT - 20)
    expect(pages.map((page) => page.headers)).toEqual([[], []])
  })

  it('does not repeat the header once the table has ended above the break', () => {
    const table = [header, ...body.slice(0, 5)]
    const after = rows(60, 30, 300)
    const pages = printPages([...table, ...after], A4).pages
    expect(pages.every((page) => page.headers.length === 0)).toBe(true)
  })
})
