import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { drawingBoxes } from '../canvas/drawingBoxes.ts'
import { exportDrawings } from '../canvas/drawingExport.ts'
import { isMathAnchor, toMathAnchor } from '../canvas/mathAnchor.ts'
import { loadKatex } from '../overlay/katex.ts'
import { loadPlot } from '../overlay/plotDrawing.ts'
import type { PageSetting } from './printPages.ts'
import { buildPrintView, printDate, type PrintParts } from './printView.ts'

/** What printing needs from the app; tests pass fakes. */
export interface PrintPorts {
  /** Ends the open line edit, writing it as a leave does. */
  leaveLine: () => void
  /** The window title without the mark (`pump-sizing`), which Save as PDF names the file from. */
  plainTitle: () => string
  /** Everything the pages are built from, once the drawings are exported and the math is drawn. */
  parts: () => Promise<PrintParts>
  document: Document
  /** `window.print()`: blocks until the dialog closes. */
  print: () => void
}

let printing = false

/**
 * Print… (docs/spec-v1.md section 11, Print flow): the open line edit ends
 * first, the window title drops its `●` while printing, and the browser's
 * dialog opens on the print pages, as the preview and the route to Save as PDF.
 * The SVG export and Plot are awaited, the pages built, and the fonts awaited
 * before `window.print()`: printing before fonts load gives no math at all
 * (section 14). The scene, the clean mark and the undo history are left as they
 * were, and problems don't block it, since they print. A second request while
 * one is being prepared is ignored.
 */
export async function printSheet(ports: PrintPorts): Promise<void> {
  if (printing) return
  printing = true
  const doc = ports.document
  let title: string | null = null
  let view: ReturnType<typeof buildPrintView> | null = null
  try {
    ports.leaveLine()
    const parts = await ports.parts()
    view = buildPrintView(parts)
    await doc.fonts.ready
    // Read now: leaving the line may have marked the sheet dirty since.
    title = doc.title
    doc.title = ports.plainTitle()
    ports.print()
  } finally {
    view?.remove()
    if (title !== null) doc.title = title
    printing = false
  }
}

/**
 * The parts of the sheet's print view, read from Excalidraw and the drawn
 * overlay. KaTeX and Plot are loaded first, and the overlay is given frames to
 * draw with them, so no line prints as its source and no plot as empty.
 */
export async function sheetPrintParts(
  api: Pick<ExcalidrawImperativeAPI, 'getSceneElements' | 'getAppState' | 'getFiles'>,
  overlay: HTMLElement,
  page: PageSetting,
  fileName: string | null,
): Promise<PrintParts> {
  const [drawings] = await Promise.all([
    exportDrawings(api),
    loadKatex(),
    overlay.querySelector('.math-element__plot-cell') ? loadPlot() : null,
  ])
  await drawn(overlay)
  const elements = api.getSceneElements()
  return {
    overlay,
    anchors: elements.filter(isMathAnchor).map(toMathAnchor),
    drawings,
    drawingBoxes: drawingBoxes(elements),
    page,
    name: fileName ?? 'Untitled',
    date: printDate(new Date()),
  }
}

/** Resolves once the overlay has no chart still loading, after at least two frames; gives up after about a second. */
async function drawn(overlay: HTMLElement): Promise<void> {
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  for (let i = 0; i < 60; i++) {
    await frame()
    if (i >= 1 && !overlay.querySelector('.math-element__plot-chart.is-loading')) return
  }
}
