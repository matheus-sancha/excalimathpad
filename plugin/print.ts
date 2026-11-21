import { Notice } from 'obsidian'
import type { PageSetting } from '../src/print/pages.ts'
import { printFailed, printSheet, type SheetToPrint } from '../src/print/printSheet.ts'

/**
 * Print… in a vault (docs/spec-v1.md section 11, Changed on 2026-11-15 and
 * 2026-11-16): the pages are built in a hidden frame inside the view's own
 * window, and that frame is printed, through the operating system's dialog,
 * so only the pages reach the paper. On a computer only: the plugin offers no
 * Print… on a phone or tablet. No Node or Electron API, nothing written to the
 * vault and no request (section 12a, Data protection).
 */

/** The hidden frame's class (`plugin/styles.css`). */
export const PRINT_FRAME_CLASS = 'excalimathpad-print-frame'

/**
 * The cascade layer the build puts the app's and Excalidraw's CSS in
 * (`APP_LAYER` in `esbuild.plugin.mjs`): a style sheet that holds it is the
 * plugin's `styles.css`.
 */
const APP_LAYER = 'excalimathpad'

/**
 * The notice before the dialog opens (section 13, In a vault): the paper to
 * choose there, from the sheet's Page setting. The system's dialog prints on
 * its own paper, whatever `@page` asks (section 17, M5, in the history).
 */
export const paperNotice = ({ size, orientation }: PageSetting) => `Choose ${size}, ${orientation} in the print dialog.`

/**
 * The app's own style sheets in `doc`, as text: the ones that hold its cascade
 * layer. Obsidian's and a theme's never reach the frame, its print styles
 * included. A sheet whose rules can't be read (another origin) is skipped.
 */
export function appStyles(doc: Document): string[] {
  const styles: string[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRule[]
    try {
      rules = Array.from(sheet.cssRules)
    } catch {
      continue
    }
    // By its constructor's name: a pop-out's sheets are of that window's classes.
    const ours = rules.some(
      (rule) => rule.constructor.name === 'CSSLayerBlockRule' && (rule as CSSLayerBlockRule).name === APP_LAYER,
    )
    if (ours) styles.push(rules.map((rule) => rule.cssText).join('\n'))
  }
  return styles
}

/** What the view hands the route at each Print…. */
export interface FramePrint {
  /** The view's own document: the main window's, or a pop-out's. */
  doc: Document
  /** Reads the sheet as drawn (App's). */
  sheet: () => SheetToPrint
  page: PageSetting
  /** The vault file's name, for the footer (`pump-sizing.excalimathpad`). */
  name: string
  /** The name without its extension: the window's title while the dialog is open. */
  plain: string
}

/** Two frames of `view`: the notice is painted before the dialog takes the window. */
function frames(view: Window | null): Promise<void> {
  if (!view) return Promise.resolve()
  return new Promise((resolve) => view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())))
}

/**
 * A hidden frame in `doc`, loaded: a blank page in standards mode (KaTeX needs
 * one), made by no request. It is in the window's viewport but transparent and
 * takes no pointer, so the browser draws it, and its fonts load and its frames
 * run, while nothing shows.
 */
function openFrame(doc: Document): Promise<HTMLIFrameElement> {
  const frame = doc.createElement('iframe')
  frame.className = PRINT_FRAME_CLASS
  frame.setAttribute('aria-hidden', 'true')
  frame.setAttribute('tabindex', '-1')
  frame.setAttribute('srcdoc', '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>')
  const loaded = new Promise<HTMLIFrameElement>((resolve, reject) => {
    frame.addEventListener(
      'load',
      () => (frame.contentDocument?.body ? resolve(frame) : reject(new Error('The print frame has no document'))),
      { once: true },
    )
  })
  doc.body.appendChild(frame)
  return loaded
}

/**
 * Print… from the view (section 11): a hidden frame in the view's window, the
 * pages built in it by `printSheet` with the app's styles, the paper's notice,
 * the frame's own print dialog, and the frame removed once it closes. The
 * window's title is the plain name while the dialog is open (section 8), since
 * Save as PDF names the file from it. A failure before the dialog is the
 * notice that nothing was printed, and leaves nothing behind.
 */
export async function printInFrame({ doc, sheet, page, name, plain }: FramePrint): Promise<void> {
  let frame: HTMLIFrameElement | null = null
  const shown: { paper?: Notice } = {}
  try {
    frame = await openFrame(doc)
    const frameDoc = frame.contentDocument
    const frameWindow = frame.contentWindow
    if (!frameDoc || !frameWindow) throw new Error('The print frame has no document')
    frameDoc.title = plain
    await printSheet({
      doc: frameDoc,
      sheet,
      name,
      title: {
        get: () => doc.title,
        set: (title) => {
          doc.title = title
        },
        plain,
      },
      styles: appStyles(doc),
      print: async () => {
        // Shown until the dialog closes (section 13, In a vault).
        shown.paper = new Notice(paperNotice(page), 0)
        await frames(doc.defaultView)
        // The frame's fonts, KaTeX's included, as laid out since the pages went in.
        await frameDoc.fonts.ready
        // Returns once the dialog has closed (a stand-in's promise, in the print run).
        return frameWindow.print()
      },
      notify: (message) => new Notice(message),
    })
  } catch (error) {
    // The frame couldn't be made, or its dialog couldn't open: nothing was printed.
    console.error('Excalimathpad: the print frame', error)
    new Notice(printFailed())
  } finally {
    shown.paper?.hide()
    frame?.remove()
  }
}
