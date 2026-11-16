import { printPages, type Box, type PageSetting } from './pages.ts'
import { buildPrintView, printCss, printDate, type PageDrawings, type PrintElementView } from './printView.ts'

/**
 * Print… (docs/spec-v1.md section 11, Print flow and Changed on 2026-11-15;
 * section 14, Print): the pages built from the sheet as it is drawn, in the
 * order section 14 asks (the drawings exported, the pages laid out, the fonts
 * loaded) and only then the print dialog. Building them never touches the
 * scene; if it fails, no dialog opens and a notice says so. The same steps in
 * both homes: what differs is the document the pages go into and how it
 * prints, which the route gives.
 */

/** The notice when the pages couldn't be built (section 13, App). */
export const PRINT_FAILED = "The pages couldn't be built, so nothing was printed."

/** The sheet as it is drawn, read at the moment Print… is chosen. */
export interface SheetToPrint {
  /** Every drawing's box, Excalidraw text included; never a math anchor. */
  drawings: readonly Box[]
  elements: readonly PrintElementView[]
  page: PageSetting
  /** The overlay's colours, which its copied views read. */
  colors: Readonly<Record<string, string>>
  /** The drawings that cross the band from `top` to `bottom` as SVG; null when none does. */
  drawingsOn: (top: number, bottom: number) => Promise<PageDrawings | null>
  /** A body's row nodes, in the order of its measured rows. */
  rowNodes: (body: Element) => Element[]
}

/** Where and how the pages print. */
export interface PrintRoute {
  /** The document the pages are built in: the page's own on the web. */
  doc: Document
  /** Reads the sheet; a throw is a failure to build the pages. */
  sheet: () => SheetToPrint
  /** The footer's file name: "Untitled" for an unsaved sheet (section 11, Furniture). */
  name: string
  /**
   * The window's title while the dialog is open (section 8: the plain name,
   * with no `●`, so Save as PDF names the file from it), put back after.
   * Unset, the title is left alone.
   */
  title?: { get: () => string; set: (title: string) => void; plain: string }
  /** Styles the document lacks, added the same way as the print view's own (a frame's copy of the app's). */
  styles?: readonly string[]
  /** Opens the print dialog on `doc`, and returns once it has closed. */
  print: () => void | Promise<void>
  /** Shows a notice. */
  notify: (message: string) => void
  /** The print date's clock. */
  now?: () => Date
}

/**
 * Adds `css` to `doc` as constructed style sheets (`adoptedStyleSheets`): no
 * `<style>` element is made, which the plugin's bundle audit and Obsidian's
 * lint both ask for (section 14, M4e, Print in the plugin). Returns the way to
 * take them off.
 */
export function adoptStyles(doc: Document, css: readonly string[]): () => void {
  const view = doc.defaultView
  if (!view || !Array.isArray(doc.adoptedStyleSheets)) throw new Error('This document takes no constructed style sheets')
  const sheets = css.map((text) => {
    const sheet = new view.CSSStyleSheet()
    sheet.replaceSync(text)
    return sheet
  })
  doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, ...sheets]
  return () => {
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((sheet) => !sheets.includes(sheet))
  }
}

/** Two frames: the copies are laid out and painted, and their images decoded, before printing. */
function settle(doc: Document): Promise<void> {
  const view = doc.defaultView
  if (!view?.requestAnimationFrame) return Promise.resolve()
  return new Promise((resolve) => view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())))
}

/**
 * Builds the pages, opens the dialog and takes the pages away again once it
 * closes. Resolves true when the dialog opened, false when the pages couldn't
 * be built (the notice shown).
 */
export async function printSheet(route: PrintRoute): Promise<boolean> {
  const { doc } = route
  const undo: (() => void)[] = []
  let built = false
  try {
    const sheet = route.sheet()
    const layout = printPages({ drawings: sheet.drawings, elements: sheet.elements, page: sheet.page })
    const drawings = await Promise.all(layout.pages.map((page) => sheet.drawingsOn(page.top, page.bottom)))
    const view = buildPrintView(doc, {
      layout,
      elements: sheet.elements,
      drawings,
      footer: { name: route.name, date: printDate(route.now?.() ?? new Date()) },
      colors: sheet.colors,
      rowNodes: sheet.rowNodes,
    })
    undo.push(adoptStyles(doc, [...(route.styles ?? []), printCss(layout)]))
    doc.body.append(view)
    undo.push(() => view.remove())
    // Printing before the fonts load gives no math at all (section 14).
    await doc.fonts?.ready
    await settle(doc)
    built = true
  } catch (error) {
    for (const step of undo.reverse()) step()
    console.error('Excalimathpad: the print pages', error)
    route.notify(PRINT_FAILED)
    return false
  }
  const title = route.title
  const before = title?.get()
  try {
    title?.set(title.plain)
    await route.print()
  } finally {
    if (title && before !== undefined) title.set(before)
    for (const step of undo.reverse()) step()
  }
  return built
}
