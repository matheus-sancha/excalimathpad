import type { PrintRow } from '../print/pages.ts'

/** What a row is, by its node: `printRowNodes` and `printRows` read the same nodes in the same order. */
type RowNode = { kind: PrintRow['kind']; line: number; node: Element; to?: () => number }

/**
 * A math element's row nodes, in the order `printRows` measures them: the
 * title, a failed element's notice, then each line and comment row, a plot
 * line whole, and a table line as its line, its header row and each of its
 * rows. The print view reads the same nodes in its copy of the body, so the
 * Nth node is the Nth measured row.
 */
function rowNodesOf(body: Element): RowNode[] {
  const nodes: RowNode[] = []
  const title = body.querySelector(':scope > [data-title]')
  if (title) nodes.push({ kind: 'title', line: -1, node: title })
  const notice = body.querySelector(':scope > .math-element__failed')
  if (notice) nodes.push({ kind: 'notice', line: -1, node: notice })
  for (const row of body.querySelectorAll(':scope > .math-element__grid > [data-line]')) {
    const line = Number(row.getAttribute('data-line'))
    const table = row.querySelector('.math-element__table')
    if (row.querySelector('.math-element__plot-cell')) {
      nodes.push({ kind: 'plot', line, node: row })
    } else if (table) {
      // The line's own part: down to the table's top.
      nodes.push({ kind: 'line', line, node: row, to: () => table.getBoundingClientRect().top })
      const header = table.querySelector('thead tr')
      if (header) nodes.push({ kind: 'table-header', line, node: header })
      for (const tr of table.querySelectorAll('tbody tr')) nodes.push({ kind: 'table-row', line, node: tr })
    } else {
      nodes.push({ kind: row.classList.contains('is-comment') ? 'comment' : 'line', line, node: row })
    }
  }
  return nodes
}

/** The nodes of `printRows(body)`'s rows, one for one (a table line's node is its whole row). */
export function printRowNodes(body: Element): Element[] {
  return rowNodesOf(body).map(({ node }) => node)
}

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
  return rowNodesOf(body).map(({ kind, line, node, to }) => {
    const box = node.getBoundingClientRect()
    return { kind, line, top: (box.top - origin.top) / zoom, height: ((to?.() ?? box.bottom) - box.top) / zoom }
  })
}

/** A math element as the overlay draws it, for the print view. */
export interface PrintView {
  id: string
  /** The element's view (`.math-element`), which the print view copies. */
  view: HTMLElement
  /** Its body's laid-out size, in scene units (the anchor's size is a copy of it). */
  width: number
  height: number
  rows: PrintRow[]
}

/**
 * Every math element the overlay draws inside `stage` (the box the canvas and
 * the overlay share), by anchor id, with its laid-out size and rows; and the
 * overlay's colours (`--math-*`: the results' colour from Settings, section
 * 7, and the rest), which its views read from it. An element whose body isn't
 * laid out (0 × 0) is left out.
 */
export function printViews(stage: Element): { views: Map<string, PrintView>; colors: Record<string, string> } {
  const overlay = stage.querySelector<HTMLElement>('.math-overlay')
  const views = new Map<string, PrintView>()
  for (const view of overlay?.querySelectorAll<HTMLElement>(':scope > [data-anchor-id]') ?? []) {
    const body = view.querySelector<HTMLElement>(':scope > .math-element__body')
    const id = view.dataset.anchorId
    if (!id || !body || (body.offsetWidth === 0 && body.offsetHeight === 0)) continue
    views.set(id, { id, view, width: body.offsetWidth, height: body.offsetHeight, rows: printRows(body) })
  }
  const colors: Record<string, string> = {}
  const style = overlay && overlay.ownerDocument.defaultView?.getComputedStyle(overlay)
  for (const name of Array.from(style ?? [])) {
    if (name.startsWith('--math-')) colors[name] = style!.getPropertyValue(name).trim()
  }
  return { views, colors }
}
