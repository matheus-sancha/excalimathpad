import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { anchorBox, bodyOf, boxNodes, mathBoxes } from '../overlay/printBoxes.ts'
import { paperMillimetres, printPages, type PageSetting, type PrintBox, type PrintLayout } from './printPages.ts'
import './print.css'

type Placed = Pick<MathAnchor, 'id' | 'x' | 'y' | 'width' | 'height' | 'angle'>

/** What the print view is built from, all read at print time. */
export interface PrintParts {
  /** The overlay as drawn (`.math-overlay`): its elements are cloned, never moved. */
  overlay: HTMLElement
  anchors: readonly Placed[]
  /** The drawings' SVG and its scene position, or null with no drawings. */
  drawings: { svg: SVGSVGElement; left: number; top: number } | null
  /** The drawings' print boxes, from the canvas. */
  drawingBoxes: readonly PrintBox[]
  page: PageSetting
  /** The footer's file name: the sheet's, or "Untitled". */
  name: string
  /** The print date, `YYYY-MM-DD`. */
  date: string
}

export interface PrintView {
  layout: PrintLayout
  /** Takes the print view and its `@page` rule out of the document. */
  remove: () => void
}

/**
 * The print view (docs/spec-v1.md sections 11 and 14): the sheet laid out on
 * pages, appended to `document.body` as `.print-root`, which only print shows.
 * The math is the overlay's own elements, cloned and placed in scene units, so
 * it prints as it shows on a light screen; the drawings are their SVG. Each
 * page is the whole sheet scaled with `transform` inside a clipped frame, with
 * every box outside its slice hidden, so no text is printed twice. A split
 * table's header row is drawn again in a band at the next page's top.
 *
 * On screen the root is laid out far off to the left, so the fonts the view
 * uses are requested before printing (section 14: no fonts, no math).
 */
export function buildPrintView(parts: PrintParts): PrintView {
  const doc = parts.overlay.ownerDocument
  const root = doc.createElement('div')
  root.className = 'print-root'
  doc.body.append(root)

  // Measure the sheet as it prints: the clones at zoom 1.
  const sheet = sheetCopy(parts)
  root.append(sheet)
  const boxesOf = new Map(parts.anchors.map((anchor) => [anchor.id, measure(sheet, anchor)]))
  const layout = printPages([...parts.drawingBoxes, ...[...boxesOf.values()].flat()], parts.page)
  sheet.remove()

  const style = doc.createElement('style')
  const paper = paperMillimetres(parts.page)
  style.textContent = `@page { size: ${paper.width}mm ${paper.height}mm; margin: 0 }`
  doc.head.append(style)

  layout.pages.forEach((page, i) => {
    const element = doc.createElement('section')
    element.className = 'print-page'
    element.style.width = `${paper.width}mm`

    const frame = doc.createElement('div')
    frame.className = 'print-frame'
    Object.assign(frame.style, {
      left: px(layout.margin),
      top: px(layout.margin),
      width: px(layout.paper.width - 2 * layout.margin),
      // From the page's real height (100vh), above the footer's band.
      bottom: px(layout.margin + layout.footer),
    })

    const band = page.headerRoom * layout.scale
    for (const id of page.headers) frame.append(headerBand(parts, boxesOf, id, layout, band))

    const slice = doc.createElement('div')
    slice.className = 'print-slice'
    Object.assign(slice.style, { top: px(band), height: px((page.bottom - page.top) * layout.scale) })
    const content = placed(doc, layout, page.top)
    if (parts.drawings) content.append(drawingCopy(parts.drawings))
    const copy = sheetCopy(parts)
    for (const anchor of parts.anchors) {
      for (const { node, box } of pairs(copy, anchor, boxesOf.get(anchor.id)!)) {
        const inside = box.bottom > page.top + 0.5 && box.top < page.bottom - 0.5
        node.style.visibility = inside ? 'visible' : 'hidden'
      }
    }
    content.append(copy)
    slice.append(content)
    frame.append(slice)

    element.append(frame, footer(doc, layout, parts, `${i + 1} of ${layout.pages.length}`))
    root.append(element)
  })

  return {
    layout,
    remove: () => {
      root.remove()
      style.remove()
    },
  }
}

/** The math elements, cloned from the overlay and placed in scene units, with nothing that is screen only. */
function sheetCopy(parts: PrintParts): HTMLElement {
  const doc = parts.overlay.ownerDocument
  const sheet = doc.createElement('div')
  sheet.className = 'math-overlay print-sheet'
  sheet.style.setProperty('--math-result', parts.overlay.style.getPropertyValue('--math-result'))
  for (const anchor of parts.anchors) {
    const drawn = parts.overlay.querySelector(`.math-element[data-anchor-id="${CSS.escape(anchor.id)}"]`)
    if (!drawn) continue
    const clone = drawn.cloneNode(true) as HTMLElement
    clone.style.transform = `translate(${anchor.x}px, ${anchor.y}px)`
    clone.querySelectorAll(SCREEN_ONLY).forEach((node) => node.remove())
    clone.querySelectorAll('.is-hovered, .is-flash').forEach((node) => node.classList.remove('is-hovered', 'is-flash'))
    // A warning's mark: its message lives on hover, so it doesn't print (section 11).
    clone.querySelectorAll('.math-element__gutter.is-warning').forEach((node) => (node.textContent = ''))
    sheet.append(clone)
  }
  return sheet
}

/** Hover, the field, its bar and the unit and plot popovers: none print (section 11, What's on paper). */
const SCREEN_ONLY = [
  '.math-element__gear',
  '.math-unit-field',
  '.math-plot-settings',
  '.math-suggest',
  '.math-format-bar',
  '.math-hover-tip',
].join(', ')

/** An element's boxes in a laid-out sheet copy: its parts, or its anchor when rotated or not drawn. */
function measure(sheet: HTMLElement, anchor: Placed): PrintBox[] {
  return bodyOf(sheet, anchor.id) ? mathBoxes(sheet, [anchor], 1) : [anchorBox(anchor)]
}

/** Each box of an element with its node in a sheet copy: the body as a whole when it was one box. */
function pairs(copy: HTMLElement, anchor: Placed, boxes: PrintBox[]): { node: HTMLElement; box: PrintBox }[] {
  const body = bodyOf(copy, anchor.id)
  if (!body) return []
  const nodes = boxNodes(body, anchor.id)
  if (anchor.angle !== 0 || nodes.length !== boxes.length) {
    const whole = boxes.reduce((a, b) => ({
      left: Math.min(a.left, b.left),
      top: Math.min(a.top, b.top),
      right: Math.max(a.right, b.right),
      bottom: Math.max(a.bottom, b.bottom),
    }))
    return [{ node: body, box: whole }]
  }
  return nodes.map(({ node }, i) => ({ node, box: boxes[i] }))
}

/** A layer that maps the scene onto a page: the content's left edge and `top` at its top-left, scaled. */
function placed(doc: Document, layout: PrintLayout, top: number): HTMLElement {
  const content = doc.createElement('div')
  content.className = 'print-content'
  content.style.transform = `scale(${layout.scale}) translate(${-layout.left}px, ${-top}px)`
  return content
}

function drawingCopy(drawings: NonNullable<PrintParts['drawings']>): SVGSVGElement {
  const svg = drawings.svg.cloneNode(true) as SVGSVGElement
  svg.classList.add('print-drawings')
  svg.style.left = px(drawings.left)
  svg.style.top = px(drawings.top)
  return svg
}

/**
 * A split table's header row at the top of the next page (section 11): its
 * element cloned again, everything hidden but that row, placed so the row sits
 * at the band's top.
 */
function headerBand(
  parts: PrintParts,
  boxesOf: Map<string, PrintBox[]>,
  table: string,
  layout: PrintLayout,
  height: number,
): HTMLElement {
  const doc = parts.overlay.ownerDocument
  const anchorId = table.slice(0, table.lastIndexOf(':'))
  const anchor = parts.anchors.find((a) => a.id === anchorId)!
  const header = boxesOf.get(anchorId)!.find((box) => box.table === table && box.header)!
  const band = doc.createElement('div')
  band.className = 'print-band'
  band.style.height = px(height)
  const content = placed(doc, layout, header.top)
  const copy = sheetCopy({ ...parts, anchors: [anchor] })
  const body = bodyOf(copy, anchorId)
  if (body) {
    body.style.visibility = 'hidden'
    for (const part of boxNodes(body, anchorId)) {
      if (part.table === table && part.header) part.node.style.visibility = 'visible'
    }
  }
  content.append(copy)
  band.append(content)
  return band
}

/** The small grey footer: file name, print date, and `2 of 3` (section 11, Furniture). */
function footer(doc: Document, layout: PrintLayout, parts: PrintParts, count: string): HTMLElement {
  const element = doc.createElement('footer')
  element.className = 'print-footer'
  Object.assign(element.style, {
    left: px(layout.margin),
    right: px(layout.margin),
    bottom: px(layout.margin),
    height: px(layout.footer),
  })
  for (const text of [parts.name, parts.date, count]) {
    const span = doc.createElement('span')
    span.textContent = text
    element.append(span)
  }
  return element
}

/** Today as `YYYY-MM-DD`, in local time. */
export function printDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const px = (value: number) => `${value}px`
