import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPrintView, printDate, type PrintParts } from './printView.ts'

/**
 * jsdom lays nothing out, so each node of the fake overlay carries its box in
 * the element's own units as `data-rect` (left top width height), which clones
 * keep, and the body sits at 0, 0.
 */
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const [left, top, width, height] = (this.getAttribute('data-rect') ?? '0 0 0 0').split(' ').map(Number)
    return new DOMRect(left, top, width, height)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  document.head.querySelectorAll('style').forEach((style) => style.remove())
})

/** An overlay with one element at (0, 0): `rows` lines 30 tall, then optionally a table line. */
function overlay({ rows = 0, tableRows = 0 } = {}) {
  const root = document.createElement('div')
  root.className = 'math-overlay'
  root.style.setProperty('--math-result', '#e03131')
  const lines = Array.from(
    { length: rows },
    (_, i) => `<li class="math-element__row is-math" data-line="${i}" data-rect="0 ${i * 30} 300 30">
      <span class="math-element__gutter${i === 1 ? ' is-warning' : ''}">${i === 0 ? '●' : i === 1 ? '⚠' : ''}</span>
      <span class="math-element__unit${i === 2 ? ' is-hovered' : ''}"></span>
      ${i === 3 ? '<span class="math-element__gear">⚙</span>' : ''}
    </li>`,
  ).join('')
  const top = rows * 30
  const table = tableRows
    ? `<li class="math-element__row is-math" data-line="${rows}" data-rect="0 ${top} 300 ${30 + 30 * (tableRows + 1)}">
        <div class="math-element__table-cell" data-rect="0 ${top + 30} 300 ${30 * (tableRows + 1)}">
          <table class="math-element__table">
            <thead><tr data-rect="0 ${top + 30} 300 30"><th>Q</th></tr></thead>
            <tbody>${Array.from({ length: tableRows }, (_, r) => `<tr data-rect="0 ${top + 60 + r * 30} 300 30"><td>${r}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </li>`
    : ''
  root.innerHTML = `
    <div class="math-element" data-anchor-id="m" style="transform: translate(5px, 5px) scale(2)">
      <div class="math-element__body" data-rect="0 0 300 ${top + (tableRows ? 30 * (tableRows + 2) : 0)}">
        <ol class="math-element__grid">${lines}${table}</ol>
      </div>
    </div>`
  document.body.append(root)
  return root
}

const parts = (root: HTMLElement, extra: Partial<PrintParts> = {}): PrintParts => ({
  overlay: root,
  anchors: [{ id: 'm', x: 0, y: 0, width: 300, height: 100, angle: 0 }],
  drawings: null,
  drawingBoxes: [],
  page: { size: 'A4', orientation: 'portrait' },
  name: 'pump-sizing.excalimathpad',
  date: '2026-11-13',
  ...extra,
})

const visibleRows = (page: Element) =>
  [...page.querySelectorAll<HTMLElement>('.print-slice .math-element__row')]
    .filter((row) => row.style.visibility === 'visible')
    .map((row) => Number(row.dataset.line))

describe('buildPrintView (section 11)', () => {
  it('lays the sheet out on pages, each row on exactly one page', () => {
    const view = buildPrintView(parts(overlay({ rows: 40 })))
    const pages = document.querySelectorAll('.print-root .print-page')
    expect(view.layout.pages).toHaveLength(2)
    expect(pages).toHaveLength(2)
    const first = visibleRows(pages[0])
    const second = visibleRows(pages[1])
    expect([...first, ...second]).toEqual(Array.from({ length: 40 }, (_, i) => i))
    expect(first.length).toBe(Math.floor(view.layout.pages[0].bottom / 30))
  })

  it('maps the slice to the page with transform, from the content left and the page top', () => {
    const view = buildPrintView(parts(overlay({ rows: 40 })))
    const [, second] = document.querySelectorAll<HTMLElement>('.print-content')
    expect(second.style.transform).toBe(`scale(1) translate(0px, ${-view.layout.pages[1].top}px)`)
    // The clone sits at its scene position, at zoom 1.
    expect(second.querySelector<HTMLElement>('.math-element')!.style.transform).toBe('translate(0px, 0px)')
  })

  it('gives each page a footer: file name, date, and n of N', () => {
    buildPrintView(parts(overlay({ rows: 40 })))
    const footers = [...document.querySelectorAll('.print-footer')].map((footer) =>
      [...footer.children].map((span) => span.textContent),
    )
    expect(footers).toEqual([
      ['pump-sizing.excalimathpad', '2026-11-13', '1 of 2'],
      ['pump-sizing.excalimathpad', '2026-11-13', '2 of 2'],
    ])
  })

  it('sets the paper with @page and no margin, and remove() takes it all out', () => {
    const view = buildPrintView(parts(overlay({ rows: 3 }), { page: { size: 'Letter', orientation: 'landscape' } }))
    const style = [...document.head.querySelectorAll('style')].find((s) => s.textContent!.includes('@page'))!
    expect(style.textContent).toBe('@page { size: 279.4mm 215.9mm; margin: 0 }')
    expect(document.querySelector<HTMLElement>('.print-page')!.style.width).toBe('279.4mm')
    view.remove()
    expect(document.querySelector('.print-root')).toBeNull()
    expect(style.isConnected).toBe(false)
  })

  it('prints what shows, not hover: an error mark stays, a warning mark, the ⚙ and a hovered outline go', () => {
    buildPrintView(parts(overlay({ rows: 5 })))
    const page = document.querySelector('.print-page')!
    const gutters = page.querySelectorAll('.math-element__gutter')
    expect(gutters[0].textContent).toBe('●')
    expect(gutters[1].textContent).toBe('')
    expect(page.querySelector('.math-element__gear')).toBeNull()
    expect(page.querySelector('.is-hovered')).toBeNull()
  })

  it('prints in light colours: the result colour comes along, the dark theme filter does not', () => {
    const root = overlay({ rows: 2 })
    root.style.filter = 'invert(93%) hue-rotate(180deg)'
    buildPrintView(parts(root))
    const sheet = document.querySelector<HTMLElement>('.print-page .print-sheet')!
    expect(sheet.style.getPropertyValue('--math-result')).toBe('#e03131')
    expect(sheet.style.filter).toBe('')
  })

  it('leaves the overlay itself as it was', () => {
    const root = overlay({ rows: 5 })
    const before = root.innerHTML
    buildPrintView(parts(root))
    expect(root.innerHTML).toBe(before)
  })

  it('repeats a split table\'s header row in a band at the next page\'s top', () => {
    const view = buildPrintView(parts(overlay({ rows: 2, tableRows: 60 })))
    expect(view.layout.pages[1].headers).toEqual(['m:2'])
    const [first, second] = document.querySelectorAll('.print-page')
    expect(first.querySelector('.print-band')).toBeNull()
    const band = second.querySelector<HTMLElement>('.print-band')!
    expect(band.style.height).toBe('30px')
    expect(second.querySelector<HTMLElement>('.print-slice')!.style.top).toBe('30px')
    expect(band.querySelector<HTMLElement>('.math-element__body')!.style.visibility).toBe('hidden')
    expect(band.querySelector<HTMLElement>('thead tr')!.style.visibility).toBe('visible')
    // Only the header row shows in the band, moved to its top.
    expect(band.querySelector<HTMLElement>('.print-content')!.style.transform).toBe('scale(1) translate(0px, -90px)')
  })

  it('draws the drawings on every page, at their scene position', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    buildPrintView(parts(overlay({ rows: 40 }), { drawings: { svg, left: -20, top: 400 } }))
    const copies = document.querySelectorAll<SVGSVGElement>('.print-page svg.print-drawings')
    expect(copies).toHaveLength(2)
    expect(copies[1].style.top).toBe('400px')
    expect(copies[1].style.left).toBe('-20px')
  })
})

describe('printDate', () => {
  it('is the local date as YYYY-MM-DD', () => {
    expect(printDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
