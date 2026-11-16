import type { PrintLayout, PrintPage, PrintRow } from './pages.ts'

/**
 * The print view (docs/spec-v1.md section 11, Print, and section 14, Print):
 * the pages `printPages` laid out, drawn as DOM in any document, the page's
 * own or a frame's. It draws no math itself: each math element is a copy of
 * the overlay's own view (so formats, rules, results, tables, plots and
 * failures print as they show), and the drawings are Excalidraw's SVG.
 * Plain DOM, no React and no Excalidraw: the same in both homes.
 */

/** A math element to print: its place, its laid-out size and rows, and the overlay's view to copy. */
export interface PrintElementView {
  id: string
  x: number
  y: number
  angle: number
  width: number
  height: number
  rows: readonly PrintRow[]
  /** The overlay's `.math-element`, copied into the pages. */
  view: HTMLElement
}

/** The drawings that cross one page, as SVG, and the scene point its top-left sits at. */
export interface PageDrawings {
  svg: SVGSVGElement
  x: number
  y: number
}

export interface PrintParts {
  layout: PrintLayout
  elements: readonly PrintElementView[]
  /** For each page, the drawings that cross it; null where none does. */
  drawings: readonly (PageDrawings | null)[]
  /** The footer: the file's name ("Untitled" unsaved) and the print date, `YYYY-MM-DD`. */
  footer: { name: string; date: string }
  /** The overlay's colours (`--math-*`), which its views read from their ancestor. */
  colors: Readonly<Record<string, string>>
  /** A body's row nodes, in the order of its measured rows (`printRowNodes`). */
  rowNodes: (body: Element) => Element[]
}

/** The print view's root, which the print styles show alone on paper. */
export const PRINT_VIEW_CLASS = 'print-view'
/** Boxes outside a page's slice, so their text stays out of the PDF (section 14). */
const HIDDEN = 'print-view__hidden'
const SHOWN = 'print-view__shown'
/** A row this close to the slice's edge counts as outside it (as `pages.ts` breaks). */
const EDGE = 0.5

/**
 * The print view's styles for a layout: the paper (`@page`, margin 0, the 15
 * mm margins and the footer drawn inside each page), each part of section
 * 14's recipe, and, in print, nothing but the view. Off screen until printed,
 * laid out so its fonts load.
 */
export function printCss({ paper, room }: PrintLayout): string {
  const px = (n: number) => `${Math.round(n * 1000) / 1000}px`
  return `
@page { size: ${px(paper.width)} ${px(paper.height)}; margin: 0 }
@media screen {
  .${PRINT_VIEW_CLASS} { position: fixed; left: -100000px; top: 0; pointer-events: none }
}
@media print {
  html, body { margin: 0 !important; background: #fff !important }
  body > :not(.${PRINT_VIEW_CLASS}) { display: none !important }
  body > .${PRINT_VIEW_CLASS} { display: block !important }
  body::before, body::after { content: none !important; display: none !important }
}
.${PRINT_VIEW_CLASS} { color-scheme: light; background: #fff; color: #1e1e1e }
.print-view__page {
  position: relative; width: ${px(paper.width)}; height: 100vh; contain: strict; overflow: hidden;
  background: #fff; break-after: page;
}
.print-view__page:last-child { break-after: auto }
.print-view__frame {
  position: absolute; left: ${px(paper.margin)}; top: ${px(paper.margin)};
  width: ${px(room.width)}; height: ${px(room.height)}; overflow: hidden;
}
.print-view__band { position: absolute; left: 0; overflow: hidden }
.print-view__slice { position: absolute; left: 0; top: 0; transform-origin: 0 0 }
.print-view__slice > svg { position: absolute; overflow: visible }
.print-view__footer {
  position: absolute; left: ${px(paper.margin)}; bottom: ${px(paper.margin)};
  width: ${px(room.width)}; height: ${px(paper.footer)};
  display: flex; align-items: flex-end; gap: 16px;
  font: 9px/12px system-ui, 'Segoe UI', sans-serif; color: #888;
  print-color-adjust: exact; -webkit-print-color-adjust: exact;
}
.print-view__count { margin-left: auto }
.${PRINT_VIEW_CLASS} .math-element { pointer-events: none }
.${PRINT_VIEW_CLASS} .math-element__gear,
.${PRINT_VIEW_CLASS} .math-plot-settings,
.${PRINT_VIEW_CLASS} .math-suggest,
.${PRINT_VIEW_CLASS} .math-hover-tip { display: none }
.${PRINT_VIEW_CLASS} .math-element__detailed { border-bottom: none }
/* A point's label without its halo: Chromium writes haloed text twice into a PDF, so it came up twice in search. */
.${PRINT_VIEW_CLASS} .plot-point-label { stroke: none }
.${PRINT_VIEW_CLASS} .${HIDDEN} { visibility: hidden }
.${PRINT_VIEW_CLASS} .${SHOWN} { visibility: visible }
`
}

/** Screen-only marks a view can carry at the moment it is copied: hover, the flash. */
const SCREEN_ONLY = ['is-hovered', 'is-flash']

/** A copy of an element's view in `doc`, at its scene place, as it would print. */
function copyOf(doc: Document, element: PrintElementView): { copy: HTMLElement; body: Element | null } {
  const copy = doc.importNode(element.view, true)
  // At its scene place, at scale 1: the slice scales the whole page.
  copy.style.transform = `translate(${element.x}px, ${element.y}px)`
  copy.style.width = `${element.width}px`
  copy.style.height = `${element.height}px`
  for (const mark of SCREEN_ONLY) {
    for (const node of copy.querySelectorAll(`.${mark}`)) node.classList.remove(mark)
  }
  return { copy, body: copy.querySelector(':scope > .math-element__body') }
}

/** Whether a band from `top` to `bottom` crosses the page's slice. */
const crosses = (page: PrintPage, top: number, bottom: number) => bottom > page.top + EDGE && top < page.bottom - EDGE

/** The element's box on the sheet, rotation included. */
function boundsOf(element: PrintElementView): { top: number; bottom: number } {
  if (!element.angle) return { top: element.y, bottom: element.y + element.height }
  const tall = element.width * Math.abs(Math.sin(element.angle)) + element.height * Math.abs(Math.cos(element.angle))
  const middle = element.y + element.height / 2
  return { top: middle - tall / 2, bottom: middle + tall / 2 }
}

/** A box scaled from scene units, with the slice's own origin. */
function slice(doc: Document, scale: number, x: number, y: number): HTMLElement {
  const box = doc.createElement('div')
  box.className = 'print-view__slice'
  box.style.transform = `scale(${scale}) translate(${-x}px, ${-y}px)`
  return box
}

function band(doc: Document, top: number, width: number, height: number): HTMLElement {
  const box = doc.createElement('div')
  box.className = 'print-view__band'
  box.style.top = `${top}px`
  box.style.width = `${width}px`
  box.style.height = `${height}px`
  return box
}

/**
 * Builds the pages in `doc`, not yet attached: a root holding one box per
 * page, each the paper with its margins, the repeated table headers, the
 * scene's slice and the footer.
 */
export function buildPrintView(doc: Document, parts: PrintParts): HTMLElement {
  const { layout, elements, drawings, footer, colors, rowNodes } = parts
  const { scale, content, room, pages } = layout
  const root = doc.createElement('div')
  root.className = PRINT_VIEW_CLASS
  for (const [name, value] of Object.entries(colors)) root.style.setProperty(name, value)
  const byId = new Map(elements.map((element) => [element.id, element]))

  pages.forEach((page, index) => {
    const paper = doc.createElement('div')
    paper.className = 'print-view__page'
    const frame = doc.createElement('div')
    frame.className = 'print-view__frame'

    // A table split by the break above: its header row, alone, at the page's top.
    for (const header of page.headers) {
      const element = byId.get(header.element)
      const at = element?.rows.findIndex((row) => row.kind === 'table-header' && row.line === header.line) ?? -1
      if (!element || at < 0) continue
      const top = element.y + element.rows[at].top
      const holder = band(doc, 0, room.width, header.height * scale)
      const scaled = slice(doc, scale, content.x, top)
      const { copy, body } = copyOf(doc, element)
      copy.classList.add(HIDDEN)
      const node = body ? rowNodes(body)[at] : undefined
      node?.classList.add(SHOWN)
      scaled.append(copy)
      holder.append(scaled)
      frame.append(holder)
    }

    // The scene from the page's top to its bottom, below the repeated headers.
    const holder = band(doc, page.headerRoom * scale, room.width, (page.bottom - page.top) * scale)
    const scaled = slice(doc, scale, content.x, page.top)
    const drawing = drawings[index]
    if (drawing) {
      const svg = doc.importNode(drawing.svg, true)
      svg.style.left = `${drawing.x}px`
      svg.style.top = `${drawing.y}px`
      scaled.append(svg)
    }
    for (const element of elements) {
      const bounds = boundsOf(element)
      if (!crosses(page, bounds.top, bounds.bottom)) continue
      const { copy, body } = copyOf(doc, element)
      // A rotated element is one box; otherwise each row prints on the page whose slice holds it.
      if (!element.angle && body) {
        const nodes = rowNodes(body)
        element.rows.forEach((row, i) => {
          const top = element.y + row.top
          nodes[i]?.classList.add(crosses(page, top, top + row.height) ? SHOWN : HIDDEN)
        })
      }
      scaled.append(copy)
    }
    holder.append(scaled)
    frame.append(holder)

    const foot = doc.createElement('div')
    foot.className = 'print-view__footer'
    const name = doc.createElement('span')
    name.textContent = footer.name
    const date = doc.createElement('span')
    date.textContent = footer.date
    const count = doc.createElement('span')
    count.className = 'print-view__count'
    count.textContent = `${index + 1} of ${pages.length}`
    foot.append(name, date, count)

    paper.append(frame, foot)
    root.append(paper)
  })
  return root
}

/** The print date, `YYYY-MM-DD`, in local time. */
export function printDate(now: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`
}
