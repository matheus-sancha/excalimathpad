import { describe, expect, it } from 'vitest'
import { printPages, type PrintRow } from './pages.ts'
import { buildPrintView, printCss, printDate, PRINT_VIEW_CLASS, type PrintElementView } from './printView.ts'

/**
 * The print view (docs/spec-v1.md section 11, Print, and section 14, Print),
 * as DOM: jsdom lays nothing out, so the pages' places come from the layout
 * given, and the print run (`scripts/print-run.mjs`) holds what Chromium prints.
 */

/** A stand-in for the overlay's view: a body of `count` rows (one a table line), as `printRows` reads them. */
function viewOf(id: string, count: number, table?: { line: number; rows: number }): HTMLElement {
  const view = document.createElement('div')
  view.className = 'math-element'
  view.dataset.anchorId = id
  view.style.transform = 'translate(5px, 6px) scale(2)'
  const body = document.createElement('div')
  body.className = 'math-element__body'
  const grid = document.createElement('ol')
  grid.className = 'math-element__grid'
  for (let i = 0; i < count; i += 1) {
    const row = document.createElement('li')
    row.className = i === 0 ? 'math-element__row is-hovered' : 'math-element__row'
    row.dataset.line = String(i)
    row.textContent = `line ${i}`
    if (table?.line === i) {
      const box = document.createElement('table')
      box.className = 'math-element__table'
      box.innerHTML = `<thead><tr><th>Q</th></tr></thead><tbody>${Array.from({ length: table.rows }, (_, r) => `<tr><td>${r + 1}</td></tr>`).join('')}</tbody>`
      row.append(box)
    }
    grid.append(row)
  }
  body.append(grid)
  view.append(body)
  return view
}

/** The rows `printRows` would measure for `viewOf`: each 24 tall, a table's rows 20. */
function rowsOf(count: number, table?: { line: number; rows: number }): PrintRow[] {
  const rows: PrintRow[] = []
  let top = 0
  for (let i = 0; i < count; i += 1) {
    rows.push({ kind: 'line', line: i, top, height: 24 })
    top += 24
    if (table?.line === i) {
      rows.push({ kind: 'table-header', line: i, top, height: 20 })
      top += 20
      for (let r = 0; r < table.rows; r += 1) {
        rows.push({ kind: 'table-row', line: i, top, height: 20 })
        top += 20
      }
    }
  }
  return rows
}

/** The overlay's row nodes, in `printRows`'s order (as `printRowNodes` reads them). */
const rowNodes = (body: Element) =>
  [...body.querySelectorAll(':scope > .math-element__grid > [data-line]')].flatMap((row) => [
    row,
    ...row.querySelectorAll('thead tr, tbody tr'),
  ])

function element(id: string, y: number, count: number, table?: { line: number; rows: number }): PrintElementView {
  const rows = rowsOf(count, table)
  const last = rows.at(-1)!
  return { id, x: 40, y, angle: 0, width: 300, height: last.top + last.height, rows, view: viewOf(id, count, table) }
}

const A4 = { size: 'A4', orientation: 'portrait' } as const
const footer = { name: 'pump-sizing.excalimathpad', date: '2026-11-16' }

function build(elements: PrintElementView[], drawings: Parameters<typeof buildPrintView>[1]['drawings'] = []) {
  const layout = printPages({ drawings: [], elements, page: A4 })
  const root = buildPrintView(document, { layout, elements, drawings, footer, colors: { '--math-result': '#2f9e44' }, rowNodes })
  return { layout, root, pages: [...root.querySelectorAll('.print-view__page')] }
}

const shown = (page: Element) => [...page.querySelectorAll('.print-view__shown')].map((node) => node.textContent?.slice(0, 7))

describe('the print view', () => {
  it('draws one page per page of the layout, each with the footer: the name, the date and "2 of 3"', () => {
    const { layout, root, pages } = build([element('a', 0, 120)])

    expect(root.classList.contains(PRINT_VIEW_CLASS)).toBe(true)
    expect(layout.pages.length).toBe(3)
    expect(pages).toHaveLength(3)
    expect(pages.map((page) => page.querySelector('.print-view__footer')?.textContent)).toEqual([
      'pump-sizing.excalimathpad2026-11-161 of 3',
      'pump-sizing.excalimathpad2026-11-162 of 3',
      'pump-sizing.excalimathpad2026-11-163 of 3',
    ])
  })

  it('shows each row on the page whose slice holds it, and hides it on the others (section 14)', () => {
    const { layout, pages } = build([element('a', 0, 120)])

    pages.forEach((page, i) => {
      const { top, bottom } = layout.pages[i]
      const expected = Array.from({ length: 120 }, (_, n) => n).filter((n) => n * 24 >= top - 0.5 && (n + 1) * 24 <= bottom + 0.5)
      expect(shown(page)).toEqual(expected.map((n) => `line ${n}`.slice(0, 7)))
      // Every row of the copy is marked, so nothing is left to print twice.
      expect(page.querySelectorAll('[data-line]:not(.print-view__shown):not(.print-view__hidden)')).toHaveLength(0)
    })
  })

  it('copies the view at its scene place in a slice scaled from the content, without its hover', () => {
    const { layout, pages } = build([element('a', 0, 10)])
    const copy = pages[0].querySelector<HTMLElement>('.print-view__slice > .math-element')!

    expect(copy.dataset.anchorId).toBe('a')
    expect(copy.style.transform).toBe('translate(40px, 0px)')
    expect(copy.style.width).toBe('300px')
    expect(copy.querySelector('.is-hovered')).toBeNull()
    expect(pages[0].querySelector<HTMLElement>('.print-view__slice')!.style.transform).toBe(
      `scale(${layout.scale}) translate(-40px, 0px)`,
    )
  })

  it('repeats a split table’s header above the next page, the header alone, and shifts the slice by its room', () => {
    const { layout, pages } = build([element('a', 0, 2, { line: 1, rows: 80 })])
    const split = layout.pages.findIndex((page) => page.headers.length > 0)

    expect(split).toBeGreaterThan(0)
    const page = pages[split]
    const bands = page.querySelectorAll<HTMLElement>('.print-view__frame > .print-view__band')
    // The header's band, then the slice's, below it.
    expect(bands).toHaveLength(2)
    const header = bands[0]
    expect(header.querySelector('.math-element')!.classList.contains('print-view__hidden')).toBe(true)
    expect([...header.querySelectorAll('.print-view__shown')].map((node) => node.textContent)).toEqual(['Q'])
    expect(bands[1].style.top).toBe(`${layout.pages[split].headerRoom * layout.scale}px`)
    // No page repeats a header it didn't break.
    pages.forEach((p, i) => {
      if (layout.pages[i].headers.length === 0) expect(p.querySelectorAll('.print-view__band')).toHaveLength(1)
    })
  })

  it('leaves out an element that crosses no part of a page', () => {
    const { pages } = build([element('a', 0, 2), element('b', 3000, 2)])

    expect(pages[0].querySelectorAll('.print-view__slice .math-element')).toHaveLength(1)
    expect(pages.at(-1)!.querySelectorAll('.print-view__slice .math-element')).toHaveLength(1)
  })

  it('puts each page’s drawings at their scene place, below the math', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const { pages } = build([element('a', 0, 2)], [{ svg, x: 12, y: -8 }])
    const slice = pages[0].querySelector('.print-view__slice')!

    const drawn = slice.firstElementChild as SVGSVGElement
    expect(drawn.tagName).toBe('svg')
    expect(drawn.style.left).toBe('12px')
    expect(drawn.style.top).toBe('-8px')
    expect(slice.lastElementChild?.classList.contains('math-element')).toBe(true)
  })

  it('carries the overlay’s colours, which the copies read', () => {
    const { root } = build([element('a', 0, 2)])

    expect(root.style.getPropertyValue('--math-result')).toBe('#2f9e44')
  })
})

describe('printCss', () => {
  it('sets the paper with no margin, and each part of section 14’s recipe', () => {
    const css = printCss(printPages({ drawings: [], elements: [], page: { size: 'Letter', orientation: 'landscape' } }))

    expect(css).toContain('@page { size: 1056px 816px; margin: 0 }')
    expect(css).toMatch(/\.print-view__page \{[^}]*height: 100vh; contain: strict;/)
    expect(css).toMatch(/\.print-view__frame \{[^}]*overflow: hidden;/)
    expect(css).toMatch(/\.print-view__footer \{[^}]*print-color-adjust: exact;/)
    expect(css).toMatch(/@media print \{[^@]*body > :not\(\.print-view\) \{ display: none !important \}/)
  })
})

describe('printDate', () => {
  it('is YYYY-MM-DD, in local time', () => {
    expect(printDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
