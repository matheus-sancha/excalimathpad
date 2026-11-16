import type { PrintRow } from '../print/pages.ts'

/**
 * A math element's rows as laid out, for the print pages (docs/spec-v1.md
 * section 11, Page breaks): each from the body's top, in scene units. The
 * title, a failed element's notice, each line and comment row, a plot line
 * whole (its line and its chart), and a table line as its line, its header
 * row and each of its rows. Read from the boxes Chromium lays out, so a
 * scale on the element (the canvas's zoom) is taken back out; a rotated body
 * is never measured here (the pages count it as one box).
 */
export function printRows(body: HTMLElement): PrintRow[] {
  const origin = body.getBoundingClientRect()
  // The canvas's zoom, from the body's laid-out height against its height on screen.
  const zoom = body.offsetHeight > 0 && origin.height > 0 ? origin.height / body.offsetHeight : 1
  const span = (element: Element, to?: number) => {
    const box = element.getBoundingClientRect()
    return { top: (box.top - origin.top) / zoom, height: ((to ?? box.bottom) - box.top) / zoom }
  }
  const rows: PrintRow[] = []
  const title = body.querySelector(':scope > [data-title]')
  if (title) rows.push({ kind: 'title', line: -1, ...span(title) })
  const notice = body.querySelector(':scope > .math-element__failed')
  if (notice) rows.push({ kind: 'notice', line: -1, ...span(notice) })
  for (const row of body.querySelectorAll(':scope > .math-element__grid > [data-line]')) {
    const line = Number(row.getAttribute('data-line'))
    const table = row.querySelector('.math-element__table')
    if (row.querySelector('.math-element__plot-cell')) {
      rows.push({ kind: 'plot', line, ...span(row) })
    } else if (table) {
      rows.push({ kind: 'line', line, ...span(row, table.getBoundingClientRect().top) })
      const header = table.querySelector('thead tr')
      if (header) rows.push({ kind: 'table-header', line, ...span(header) })
      for (const tr of table.querySelectorAll('tbody tr')) rows.push({ kind: 'table-row', line, ...span(tr) })
    } else {
      rows.push({ kind: row.classList.contains('is-comment') ? 'comment' : 'line', line, ...span(row) })
    }
  }
  return rows
}
