// The print run (docs/spec-v1.md section 11, Print, and section 14, Print; M5,
// #81): the built web app in `dist/`, in headless Chromium, prints through
// Print… into real PDFs, which `scripts/pdf-read.mjs` reads back. The browser's
// dialog can't be driven headless, so the page's `window.print` is replaced by
// one that waits: while it waits the run asks Chromium for the PDF
// (`page.pdf`, print media, the page's own `@page` size), exactly what the
// dialog's Save as PDF prints at its defaults, then lets it return.
//
// - The pump sheet (section 15; its heading in Nunito, Excalidraw text) and the
//   true-position sheet, opened by a drop as a file and printed from ☰ →
//   Print… and from Ctrl+P (real keys): every line, its result, every table
//   row and each plot's chart on paper, no math missing (KaTeX's fonts in the
//   PDF), no text twice in the PDF's text, the footer on each page (the file's
//   name, the date and `2 of 3`), the paper the Page setting's, A4 portrait and
//   Letter landscape.
// - The window's title is the plain name while the dialog is open and comes
//   back with its `●` after; the scene (its recovery copy), the `●` and the undo history are as
//   they were, and the print view is gone.
// - The browser's own Print (no Print…) prints the one line "Use Print… from
//   the app's menu", on one page.
// - Section 17's web items for M5: a drawing taller than a page, an image in
//   a drawing and dark mode, in one PDF; KaTeX 0.16.47's fonts; and a
//   hand-set Scale (`page.pdf`'s `scale`, the dialog's own setting).
// - A sheet whose pages can't be built: no dialog, the notice, the sheet as it was.
// - The plugin's Print… (section 11, Changed on 2026-11-15 and 2026-11-16): the
//   built `dist-plugin/main.js` against the fake `obsidian`, with every request
//   blocked and logged, prints the pump sheet from the "Print…" command and the
//   true-position sheet from ☰ → Print…. The pages are built in the hidden
//   frame, whose `print()` is stood in for the same way; Chromium can't print a
//   frame by itself (`page.pdf` prints a page), so the run prints the frame's
//   document as it is at that moment, its HTML and its constructed style
//   sheets, from a page of its own, and reads that PDF. It also reads the frame
//   itself: standards mode, KaTeX's fonts loaded there, no family without a
//   font, and a stand-in for Obsidian's own print rules that never reaches it.
//   The notice names the paper, the window's title is the plain name while the
//   dialog is open, and afterwards the frame and the notice are gone, the
//   title is back, the vault was never written and no request was made.
//
// Run: `node scripts/print-run.mjs` (`npm run test:print`), after `npm run
// build`. PRINT_RUN_PDFS=<folder> keeps each PDF.

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPdf } from './pdf-read.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const web = join(root, 'dist')
const plugin = join(root, 'dist-plugin')
const fonts = join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts')
const PDFS = process.env.PRINT_RUN_PDFS
if (PDFS) await mkdir(PDFS, { recursive: true })

// The plugin's page: the fake `obsidian` bundled for the browser, then the built main.js.
const fake = await build({
  absWorkingDir: root,
  entryPoints: ['plugin/test/obsidian.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FakeObsidian',
  write: false,
  target: ['es2022'],
})
/** The window's title as Obsidian sets it, which the dialog's Save as names the PDF from (section 17, M5). */
const OBSIDIAN_TITLE = 'Pump-Sizing - Vault - Obsidian'
const pluginPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${OBSIDIAN_TITLE}</title>
<link rel="stylesheet" href="/plugin/styles.css">
<style>html,body{margin:0;height:100%}.workspace,.workspace-leaf,.workspace-leaf-content,.view-content{height:100%}
/* A stand-in for Obsidian's own print rules: were they to reach the frame, it would print nothing. */
@media print { body > * { display: none !important } .print-view { display: none !important } }</style>
</head><body>
<script src="/plugin/fake-obsidian.js"></script>
<script>
  var module = { exports: {} }, exports = module.exports
  window.require = (name) => {
    if (name === 'obsidian') return FakeObsidian
    throw new Error('main.js required ' + name)
  }
</script>
<script src="/plugin/main.js"></script>
<script>
  window.__open = async (path, sheet, manifest) => {
    const app = new FakeObsidian.App()
    app.vault.add(path, sheet)
    const plugin = new module.exports.default(app, manifest)
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(path))
    app.workspace.setActiveLeaf(leaf)
    window.__app = app
    window.__plugin = plugin
    window.__leaf = leaf
  }
</script>
</body></html>`

const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.woff': 'font/woff' }
const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
  try {
    const file = normalize(path.slice(1) || 'index.html')
    if (file.startsWith('..')) throw new Error('not found')
    let body
    if (path === '/plugin.html') body = pluginPage
    else if (path === '/plugin/fake-obsidian.js') body = fake.outputFiles[0].text
    else if (['/plugin/main.js', '/plugin/styles.css', '/plugin/manifest.json'].includes(path)) body = await readFile(join(plugin, path.slice('/plugin/'.length)))
    else body = await readFile(join(web, file))
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

/** The acceptance sheets' lines (section 15), as their tables list them. */
const linesOf = async (file) =>
  [...(await readFile(join(root, 'docs/acceptance', file), 'utf8')).matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|(?: (`.+?`|—) \|)?/gm)].map(
    ([, , source, stored]) => (stored && stored !== '—' ? `${source} ${stored.slice(1, -1)}` : source),
  )
const PUMP = await linesOf('pump-sizing.md')
const TRUE_POSITION = await linesOf('true-position.md')

const heading = (id, x, y, text) => ({
  id, type: 'text', x, y, width: 220, height: 35, angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
  fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100, groupIds: [], frameId: null,
  roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: null, updated: 1, link: null,
  locked: false, text, originalText: text, fontSize: 28, fontFamily: 6, textAlign: 'left', verticalAlign: 'top',
  containerId: null, lineHeight: 1.25, autoResize: true,
})
const math = (id, x, y, source) => ({ id, type: 'rectangle', x, y, width: 160, height: 60, customData: { kind: 'math', source } })
const sheetFile = (elements, { page, files = {} } = {}) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements,
    appState: {},
    files,
    // Format 1: a clause in a line moves to its stored format as the sheet opens (section 7).
    excalimathpad: { format: 1, ...(page ? { settings: { page } } : {}) },
  })

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const results = []
const errors = []
const row = (where, check, ok, detail = '') => results.push({ where, check, ok: !!ok, detail })

/** A page on the web app, with the sheet `text` dropped on it as `name`. */
async function open(where, { name, text, width = 1280, height = 900 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  // Nothing leaves this machine: Excalidraw's fonts come from its own package, not its CDN.
  await context.route((to) => !to.href.startsWith(origin), async (route) => {
    const font = route.request().url().match(/\/dist\/prod\/fonts\/(.+)$/)
    if (!font) return route.abort()
    try {
      return route.fulfill({ body: await readFile(join(fonts, decodeURIComponent(font[1]))), contentType: 'font/woff2' })
    } catch {
      return route.abort()
    }
  })
  const tab = await context.newPage()
  tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
  // The dialog, stood in for: `print()` waits until the run has its PDF.
  await tab.addInitScript(() => {
    window.__prints = []
    window.print = () =>
      new Promise((resolve) => {
        window.__prints.push({ title: document.title, view: !!document.querySelector('.print-view'), resolve })
      })
  })
  await tab.goto(`${origin}/`)
  await tab.waitForSelector('.excalidraw .main-menu-trigger', { timeout: 30_000 })
  if (text) {
    await tab.evaluate(([name, text]) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([text], name, { type: 'application/json' }))
      const event = new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true })
      document.querySelector('.excalidraw canvas').dispatchEvent(event)
    }, [name, text])
    await tab.waitForFunction((name) => document.querySelector('[data-testid="file-name"]')?.textContent?.includes(name), name, { timeout: 30_000 })
    await tab.waitForSelector('.math-element .katex', { timeout: 30_000 })
    await tab.waitForTimeout(1500)
  }
  return { context, tab }
}

/** The page's state: what printing must leave alone. */
const state = (tab) =>
  tab.evaluate(() => ({
    title: document.title,
    name: document.querySelector('[data-testid="file-name"]')?.textContent,
    undo: document.querySelector('[data-testid="button-undo"]')?.disabled ?? null,
    redo: document.querySelector('[data-testid="button-redo"]')?.disabled ?? null,
    view: !!document.querySelector('.print-view'),
    styles: document.adoptedStyleSheets.length,
    field: !!document.querySelector('.math-element__field'),
    toast: document.querySelector('.Toast__message')?.textContent ?? null,
  }))

/** What the overlay shows: each row's results, each table row's cells and each chart, for the PDF to hold. */
const shown = (tab) =>
  tab.evaluate(() =>
    [...document.querySelectorAll('.math-overlay > [data-anchor-id] [data-line]')].map((row) => ({
      line: row.getAttribute('aria-label'),
      results: [...row.querySelectorAll('[data-text]')].map((cell) => cell.getAttribute('data-text')),
      cells: [...row.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent).join('')),
      chart: row.querySelector('.math-element__plot-chart > svg') ? [...row.querySelectorAll('.math-element__plot-chart text')].map((t) => t.textContent) : null,
      legend: [...row.querySelectorAll('.math-element__legend, [class*="legend"] .katex')].length,
    })),
  )

/**
 * What each print page paints as text, from the DOM while the dialog is open:
 * every text node shown (visibility visible, laid out), KaTeX's hidden MathML
 * left out, in each page's box; and the footer's three parts.
 */
const painted = (tab, frame = null) =>
  tab.evaluate((frame) => {
    // The page itself on the web; the plugin's print frame there.
    const doc = frame ? document.querySelector(frame).contentDocument : document
    return [...doc.querySelectorAll('.print-view__page')].map((page) => {
      const walker = doc.createTreeWalker(page, NodeFilter.SHOW_TEXT)
      let text = ''
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const element = node.parentElement
        if (!element || element.closest('.katex-mathml, style, title, desc, metadata')) continue
        if (doc.defaultView.getComputedStyle(element).visibility !== 'visible' || element.getClientRects().length === 0) continue
        text += node.data
      }
      return { text, footer: [...page.querySelectorAll('.print-view__footer > span')].map((span) => span.textContent) }
    })
  }, frame)

/** Text as searched: no spaces, no private-use glyphs (a font's alternate figures), the result's plain forms as KaTeX sets them. */
const SUPERSCRIPT = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '−' }
const norm = (text) =>
  text
    .replace(/[\s​-]/g, '')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, (c) => SUPERSCRIPT[c])
    .replaceAll('^', '')
    .replaceAll('·', '⋅')
    .replaceAll('-', '−')
const count = (haystack, needle) => (needle ? haystack.split(needle).length - 1 : 0)
/** Each letter and how often it appears: the PDF's text and the page's painted text must hold the same. */
const letters = (text) => {
  const counts = new Map()
  for (const c of text.match(/\p{L}/gu) ?? []) counts.set(c, (counts.get(c) ?? 0) + 1)
  return counts
}
const lettersDiffer = (a, b) => {
  const x = letters(a)
  const y = letters(b)
  return [...new Set([...x.keys(), ...y.keys()])].filter((c) => (x.get(c) ?? 0) !== (y.get(c) ?? 0)).map((c) => `${c} ${x.get(c) ?? 0}/${y.get(c) ?? 0}`)
}

/** Starts Print… with `how`, waits for the dialog, prints the PDF meanwhile; returns it, what the page painted and the state then. */
async function printWith(tab, how, pdfOptions = {}) {
  const before = await tab.evaluate(() => window.__prints.length)
  await how()
  await tab.waitForFunction((n) => window.__prints.length > n, before, { timeout: 30_000 })
  const during = await tab.evaluate(() => ({
    title: window.__prints.at(-1).title,
    pages: document.querySelectorAll('.print-view__page').length,
    // Dark mode reaches no page: no filter on the view or above a copy, the drawings' SVG exported light.
    filters: [...document.querySelectorAll('.print-view .math-element, .print-view svg')].flatMap((node) => {
      const found = []
      for (let at = node; at && at !== document.documentElement; at = at.parentElement) {
        const filter = getComputedStyle(at).filter
        if (filter && filter !== 'none') found.push(filter)
      }
      return found
    }),
  }))
  const pages = await painted(tab)
  const pdf = await tab.pdf({ preferCSSPageSize: true, ...pdfOptions })
  await tab.evaluate(() => window.__prints.at(-1).resolve())
  await tab.waitForTimeout(400)
  return { pdf, during, pages, read: readPdf(pdf) }
}

/**
 * The sheet as the web app keeps it while dirty: its recovery copy in
 * IndexedDB (section 7), written 500 ms after each scene change, so a print
 * that touched the scene would leave a different one.
 */
async function recoveryCopy(tab) {
  await tab.waitForTimeout(1200)
  return tab.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('excalimathpad', 1)
        request.onsuccess = () => {
          const get = request.result.transaction('recovery', 'readonly').objectStore('recovery').get('current')
          get.onsuccess = () => resolve(get.result?.text ?? null)
          get.onerror = () => resolve(null)
        }
        request.onerror = () => resolve(null)
      }),
  )
}

const fromMenu = (tab) => async () => {
  if (!(await tab.isVisible('[data-testid="print-item"]'))) await tab.click('.main-menu-trigger')
  await tab.click('[data-testid="print-item"]')
}
const fromKeys = (tab) => () => tab.keyboard.press('Control+P')
const keep = async (name, pdf) => PDFS && writeFile(join(PDFS, `${name}.pdf`), pdf)
const PAPER = { A4: [210, 297], Letter: [215.9, 279.4] }
const paperOk = (read, size, orientation) => {
  const [a, b] = PAPER[size].map((mm) => (mm / 25.4) * 72)
  const [w, h] = orientation === 'portrait' ? [a, b] : [b, a]
  return read.pages.every((p) => Math.abs(p.width - w) < 1 && Math.abs(p.height - h) < 1)
}
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The checks every printed sheet answers (section 11; #81's acceptance). */
function checkSheet(where, name, rows, { read, pages, during }, { size = 'A4', orientation = 'portrait' } = {}) {
  const all = norm(read.pages.map((p) => p.text).join(''))
  row(where, `${read.pages.length} pages, ${size} ${orientation}, as many as the print view drew`, read.pages.length === during.pages && read.pages.length === pages.length && paperOk(read, size, orientation), read.pages.map((p) => `${Math.round(p.width)}×${Math.round(p.height)} pt`).join(', '))
  const differ = read.pages.map((p, i) => lettersDiffer(p.text, pages[i]?.text ?? ''))
  row(where, 'each page’s PDF text holds exactly the letters the page paints: no math missing, nothing twice', differ.every((d) => d.length === 0), differ.map((d, i) => `p${i + 1}: ${d.slice(0, 8).join(', ') || 'same'}`).join('; '))
  const results = rows.flatMap((r) => r.results).filter(Boolean)
  // A list's summary sets its `…` before its last value.
  const missing = results.filter((r) => !all.replaceAll('…', '').includes(norm(r).replaceAll('…', '')))
  row(where, `every result on paper (${results.length})`, results.length > 0 && missing.length === 0, missing.join(' | '))
  const cells = rows.flatMap((r) => r.cells)
  const wrong = cells.filter((c) => count(all, norm(c)) !== 1)
  row(where, `every table row on paper once (${cells.length})`, wrong.length === 0, wrong.slice(0, 5).join(' | '))
  const charts = rows.filter((r) => r.chart)
  // A chart's labels, letters and digits only: the system font sets some signs as alternate glyphs.
  const alnum = (text) => text.replace(/[^\p{L}\p{N}]/gu, '')
  const chartText = charts.flatMap((r) => r.chart).map(alnum).filter((t) => /\p{L}/u.test(t))
  const paper = alnum(all)
  row(where, `every chart on paper (${charts.length}), with its labels`, charts.length > 0 && chartText.every((t) => paper.includes(t)), chartText.filter((t) => !paper.includes(t)).join(' | '))
  row(where, 'KaTeX’s fonts are in the PDF', ['KaTeX_Main-Regular', 'KaTeX_Math-Italic'].every((f) => read.fonts.includes(f)), read.fonts.filter((f) => f.startsWith('KaTeX')).join(', '))
  const footers = pages.map((p) => p.footer)
  row(
    where,
    `the footer on each page: ${name}, ${today()}, "k of ${pages.length}"`,
    footers.every((f, i) => f[0] === name && f[1] === today() && f[2] === `${i + 1} of ${pages.length}`) &&
      read.pages.every((p, i) => norm(p.text).replace(/[−-]/g, '').includes(norm(`${name}${today().replaceAll('-', '')}${i + 1}of${pages.length}`).replace(/[−-]/g, ''))),
    footers.map((f) => f.join(' · ')).join(' / '),
  )
}

const FRAME = 'iframe.excalimathpad-print-frame'

/**
 * Excalidraw's own two messages as it puts its fonts inside the drawings' SVG
 * in the plugin, where font subsetting is trimmed (section 12a, One source, two
 * builds): it has no worker, its subsetting throws, and it falls back to the
 * whole font, a data: URL. The heading's Nunito in the PDF shows the fallback
 * works; any other console error fails the run.
 */
const excalidrawsFontFallback = (text) =>
  (text.startsWith('Failed to use workers for subsetting') && text.includes('WorkerUrlNotDefinedError')) ||
  (text.startsWith('Failed to fetch font family') && text.includes('is not in the plugin'))

/**
 * The plugin's page with `text` opened from the vault at `path`. Every request
 * that isn't to this page's own server is blocked and logged in `blocked`,
 * and every request at all after the sheet is up is logged in `late`.
 */
async function openPlugin(where, { path, text, width = 1400, height = 900 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const blocked = []
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(`${origin}/`)) return route.continue()
    blocked.push(url)
    return route.abort('blockedbyclient')
  })
  context.on('websocket', (socket) => blocked.push(socket.url()))
  // The system's dialog, stood in for: the frame's `print()` waits until the run has its PDF.
  await context.addInitScript((frame) => {
    if (!window.frameElement?.matches(frame)) return
    const host = window.parent
    window.print = () =>
      new Promise((resolve) => {
        host.__framePrints = host.__framePrints ?? []
        host.__framePrints.push({ title: host.document.title, resolve })
      })
  }, FRAME)
  const tab = await context.newPage()
  tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
  tab.on('console', (message) => {
    if (message.type() !== 'error' || excalidrawsFontFallback(message.text())) return
    errors.push(`${where} console: ${message.text().slice(0, 300)}`)
  })
  await tab.goto(`${origin}/plugin.html`)
  const manifest = JSON.parse(await readFile(join(plugin, 'manifest.json'), 'utf8'))
  await tab.evaluate(([path, text, manifest]) => window.__open(path, text, manifest), [path, text, manifest])
  await tab.waitForSelector('.math-element .katex', { timeout: 30_000 })
  await tab.waitForTimeout(1500)
  const late = []
  tab.on('request', (request) => late.push(request.url()))
  return { context, tab, blocked, late }
}

/** The plugin's state: what printing must leave alone, and what it shows. */
const pluginState = (tab) =>
  tab.evaluate((frame) => ({
    title: document.title,
    frames: document.querySelectorAll(frame).length,
    view: !!document.querySelector('.print-view'),
    styles: document.adoptedStyleSheets.length,
    data: window.__leaf.view.getViewData(),
    writes: window.__app.vault.writes.length,
    notices: [...FakeObsidian.notices],
    hidden: [...FakeObsidian.hiddenNotices],
  }), FRAME)

/**
 * The frame's document as it is while the dialog waits, printed from a page of
 * its own (Chromium's PDF prints a page, not a frame): its HTML, then its
 * constructed style sheets, its fonts loaded, at its own `@page` size. That
 * page is offline too.
 */
async function framePdf(tab) {
  const copy = await tab.evaluate((frame) => {
    const doc = document.querySelector(frame).contentDocument
    return {
      html: doc.documentElement.outerHTML,
      css: doc.adoptedStyleSheets.map((sheet) => [...sheet.cssRules].map((rule) => rule.cssText).join('\n')),
    }
  }, FRAME)
  const context = await browser.newContext({ deviceScaleFactor: 1 })
  await context.route('**/*', (route) => route.abort())
  try {
    const page = await context.newPage()
    await page.setContent(`<!doctype html>${copy.html}`)
    await page.evaluate(async (css) => {
      document.adoptedStyleSheets = css.map((text) => {
        const sheet = new CSSStyleSheet()
        sheet.replaceSync(text)
        return sheet
      })
      void document.body.offsetHeight
      await document.fonts.ready
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      await document.fonts.ready
    }, copy.css)
    return await page.pdf({ preferCSSPageSize: true })
  } finally {
    await context.close()
  }
}

/** Starts the plugin's Print… with `how`, waits for the frame's dialog, prints the frame meanwhile. */
async function printPluginWith(tab, how) {
  const before = await tab.evaluate(() => window.__framePrints?.length ?? 0)
  await how()
  await tab.waitForFunction((n) => (window.__framePrints?.length ?? 0) > n, before, { timeout: 30_000 })
  const during = await tab.evaluate((frame) => {
    const element = document.querySelector(frame)
    const doc = element.contentDocument
    const faces = [...doc.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replaceAll('"', ''))
    const known = new Set([...doc.fonts].map((face) => face.family.replaceAll('"', '')))
    // Every family KaTeX draws the pages in has its font in the frame (as the blocked run asks of the view).
    const drawn = [...doc.querySelectorAll('.print-view .katex, .print-view .katex *')]
      .filter((node) => node.childElementCount === 0 && node.textContent.trim() !== '')
      .map((node) => doc.defaultView.getComputedStyle(node).fontFamily.split(',')[0].replaceAll('"', '').trim())
    return {
      title: window.__framePrints.at(-1).title,
      pages: doc.querySelectorAll('.print-view__page').length,
      compat: doc.compatMode,
      inView: element.ownerDocument === document,
      katex: [...new Set(faces)].filter((face) => face.startsWith('KaTeX_')).sort(),
      unfonted: [...new Set(drawn)].filter((family) => family.startsWith('KaTeX_') && !known.has(family)),
      obsidianPrintRule: doc.adoptedStyleSheets.some((sheet) => [...sheet.cssRules].some((rule) => rule.cssText.includes('.print-view { display: none'))),
    }
  }, FRAME)
  const state = await pluginState(tab)
  const pages = await painted(tab, FRAME)
  const pdf = await framePdf(tab)
  await tab.evaluate(() => window.__framePrints.at(-1).resolve())
  await tab.waitForTimeout(400)
  return { pdf, during: { ...during, state }, pages, read: readPdf(pdf) }
}

/** The checks every plugin print answers besides `checkSheet`'s. */
function checkPlugin(where, notice, before, after, printed, { blocked, late }) {
  const { during } = printed
  row(where, 'the pages are in a hidden frame in the view’s own window, in standards mode, and not on the view’s page', during.inView && during.state.frames === 1 && during.compat === 'CSS1Compat' && !during.state.view && during.state.styles === before.styles, `${during.state.frames} frame, ${during.compat}`)
  row(where, 'KaTeX’s fonts are loaded inside the frame, and every family KaTeX draws there has one', ['KaTeX_Main', 'KaTeX_Math'].every((face) => during.katex.includes(face)) && during.unfonted.length === 0, `${during.katex.join(', ')}${during.unfonted.length ? `; no font: ${during.unfonted.join(', ')}` : ''}`)
  row(where, 'Obsidian’s own print rules don’t reach the frame: only the app’s style sheets are copied', !during.obsidianPrintRule && printed.read.pages.length > 0)
  row(where, `the notice before the dialog: "${notice}", shown until it closes`, during.state.notices.at(-1) === notice && !during.state.hidden.includes(notice) && after.hidden.includes(notice), during.state.notices.at(-1))
  row(where, 'the window’s title is the plain name while the dialog is open, and comes back after', during.title === 'pump-sizing' && before.title === OBSIDIAN_TITLE && after.title === before.title, `${before.title} → ${during.title} → ${after.title}`)
  row(where, 'afterwards the frame is gone, no styles are left, the sheet is as it was and the vault was never written', after.frames === 0 && !after.view && after.styles === before.styles && after.data === before.data && after.writes === 0 && !after.notices.includes("The pages couldn't be built, so nothing was printed."), `${after.frames} frames, ${after.writes} writes`)
  row(where, 'no request: none blocked, and none made at all while printing', blocked.length === 0 && late.length === 0, [...blocked, ...late].slice(0, 3).join(' | '))
}

try {
  // The pump sheet (section 15), from ☰ → Print…: its heading is Excalidraw text in Nunito.
  {
    const where = 'pump'
    const { context, tab } = await open(where, {
      name: 'pump-sizing.excalimathpad',
      text: sheetFile([heading('heading', 40, 40, 'Pump sizing'), math('calc', 40, 100, PUMP.join('\n'))]),
    })
    const rows = await shown(tab)
    const before = await state(tab)
    const printed = await printWith(tab, fromMenu(tab))
    await keep('pump', printed.pdf)
    checkSheet(where, 'pump-sizing.excalimathpad', rows, printed)
    row(where, 'the sheet: every line, a table of 30 rows and the plot', rows.length === PUMP.length && rows.flatMap((r) => r.cells).length === 30 && rows.some((r) => r.chart), `${rows.length} lines`)
    row(where, 'the heading prints in Nunito, as Excalidraw text (section 17)', printed.read.fonts.some((f) => /^Nunito/.test(f)) && norm(printed.read.pages[0].text).startsWith('Pumpsizing'), printed.read.fonts.filter((f) => /Nunito/.test(f)).join(', '))
    row(where, 'a table split by a break repeats its header row', printed.pages.length > 1 && printed.pages.slice(1).some((p) => norm(p.text).startsWith(norm('Qs L/s'))), printed.pages.map((p) => norm(p.text).slice(0, 12)).join(' / '))
    const after = await state(tab)
    row(where, 'the title is the plain name while the dialog is open', printed.during.title === 'pump-sizing', printed.during.title)
    row(where, 'afterwards the pages and their styles are gone, and the sheet is as it was', !after.view && after.styles === before.styles && after.title === before.title && after.name === before.name && after.undo === before.undo && after.redo === before.redo, JSON.stringify(after))
    await context.close()
  }

  // The true-position sheet (section 15), from Ctrl+P with real keys, on Letter landscape.
  {
    const where = 'true position'
    const { context, tab } = await open(where, {
      name: 'true-position.excalimathpad',
      text: sheetFile([math('calc', 40, 40, TRUE_POSITION.join('\n'))], { page: { size: 'Letter', orientation: 'landscape' } }),
    })
    const rows = await shown(tab)
    const printed = await printWith(tab, fromKeys(tab))
    await keep('true-position', printed.pdf)
    checkSheet(where, 'true-position.excalimathpad', rows, { ...printed }, { size: 'Letter', orientation: 'landscape' })
    row(where, 'Pass, its point and its circle on paper', norm(printed.read.pages.map((p) => p.text).join('')).includes('Pass') && rows.some((r) => r.chart), '')
    await context.close()
  }

  // Printing leaves the sheet as it was: a dirty sheet with an undo step, Ctrl+P with a line open.
  {
    const where = 'leaves alone'
    const { context, tab } = await open(where, {
      name: 'pump-sizing.excalimathpad',
      text: sheetFile([math('calc', 40, 40, 'a = 2 m\nb = a * 3')]),
    })
    // A rectangle drawn: the sheet is dirty and has an undo step.
    await tab.click('[data-testid="toolbar-rectangle"]', { force: true })
    await tab.mouse.move(600, 300)
    await tab.mouse.down()
    await tab.mouse.move(700, 380, { steps: 5 })
    await tab.mouse.up()
    await tab.keyboard.press('Escape')
    await tab.waitForTimeout(400)
    const before = await state(tab)
    const kept = await recoveryCopy(tab)
    const printed = await printWith(tab, fromKeys(tab))
    const after = await state(tab)
    const keptAfter = await recoveryCopy(tab)
    row(where, 'a dirty sheet: the title drops its ● while the dialog is open', before.title === '● pump-sizing' && printed.during.title === 'pump-sizing', `${before.title} → ${printed.during.title}`)
    row(where, 'and gets it back afterwards; the file name’s ● and the undo history as they were', after.title === before.title && after.name === before.name && after.name.startsWith('●') && after.undo === false && after.undo === before.undo && after.redo === before.redo, `${after.title}, ${after.name}, undo ${after.undo ? 'off' : 'on'}`)
    row(where, 'the scene as it was: the sheet’s recovery copy unchanged, no palette hint from Excalidraw', kept !== null && kept === keptAfter && JSON.parse(kept).elements.length === 2 && after.toast === null, `copy ${kept === null ? 'missing' : `${kept.length} chars`}, toast ${after.toast}`)
    // A line open and unchanged: Print… ends it first, and the sheet stays as it was.
    const box = await tab.locator('[data-anchor-id="calc"] [data-line="1"]').boundingBox()
    await tab.mouse.dblclick(box.x + 20, box.y + box.height / 2)
    await tab.waitForSelector('.math-element__field')
    const withLine = await printWith(tab, fromKeys(tab))
    const closed = await state(tab)
    row(where, 'Ctrl+P with a line open ends the line first, then prints it', !closed.field && withLine.pages.length === 1 && norm(withLine.read.pages[0].text).includes('a⋅3'), norm(withLine.read.pages[0].text).slice(0, 40))
    row(where, 'and the sheet’s title and undo are still as they were', closed.title === before.title && closed.undo === before.undo, closed.title)
    await context.close()
  }

  // The browser's own Print (section 11, Changed on 2026-11-15): the one line, on one page.
  {
    const where = 'browser print'
    const { context, tab } = await open(where, {
      name: 'pump-sizing.excalimathpad',
      text: sheetFile([math('calc', 40, 40, 'a = 2 m')]),
    })
    const read = readPdf(await tab.pdf({ preferCSSPageSize: true }))
    row(where, 'the browser’s own Print prints the one line', read.pages.length === 1 && norm(read.pages[0].text) === norm("Use Print… from the app's menu"), `${read.pages.length} page, "${read.pages[0]?.text.replace(/\s+/g, '')}"`)
    await context.close()
  }

  // Section 17, M5, for the web: a drawing taller than a page, an image in a drawing, dark mode.
  {
    const where = 'drawings'
    // A 2 × 2 PNG.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg=='
    const { context, tab } = await open(where, {
      name: 'drawings.excalimathpad',
      text: sheetFile(
        [
          { id: 'tall', type: 'rectangle', x: 20, y: 20, width: 500, height: 2600, strokeColor: '#1e1e1e', backgroundColor: 'transparent' },
          heading('label', 560, 60, 'Beside the frame'),
          { id: 'picture', type: 'image', x: 560, y: 160, width: 160, height: 160, fileId: 'png1', status: 'saved', scale: [1, 1] },
          math('calc', 60, 60, Array.from({ length: 70 }, (_, i) => `x_${i} = ${i} m`).join('\n')),
        ],
        { files: { png1: { id: 'png1', mimeType: 'image/png', dataURL: png, created: 1 } } },
      ),
    })
    // Dark mode, from ☰.
    await tab.click('.main-menu-trigger')
    await tab.click('[data-testid="toggle-dark-mode"]')
    await tab.waitForTimeout(500)
    const dark = await tab.evaluate(() => !!document.querySelector('.excalidraw.theme--dark'))
    const rows = await shown(tab)
    const printed = await printWith(tab, fromMenu(tab))
    await keep('drawings', printed.pdf)
    const differ = printed.read.pages.map((p, i) => lettersDiffer(p.text, printed.pages[i]?.text ?? ''))
    row(where, 'a rectangle taller than a page prints across the pages, the math beside it whole', printed.read.pages.length >= 2 && differ.every((d) => d.length === 0) && rows.length === 70, `${printed.read.pages.length} pages`)
    row(where, 'the image in the drawing is on paper, and nothing else is a picture', printed.read.images >= 1 && printed.read.images <= 2, `${printed.read.images} image objects`)
    row(where, 'dark mode: no page takes the canvas’s filter (a white page in light colours)', dark && printed.during.filters.length === 0, `dark ${dark}, filters ${printed.during.filters.join(', ') || 'none'}`)
    await context.close()
  }

  // Section 17, M5: a hand-set Scale in the dialog, as Chromium's own `scale`.
  {
    const where = 'scale 50%'
    const { context, tab } = await open(where, {
      name: 'pump-sizing.excalimathpad',
      text: sheetFile([heading('heading', 40, 40, 'Pump sizing'), math('calc', 40, 100, PUMP.join('\n'))]),
    })
    const printed = await printWith(tab, fromMenu(tab), { scale: 0.5 })
    await keep('scale-50', printed.pdf)
    const differ = printed.read.pages.map((p, i) => lettersDiffer(p.text, printed.pages[i]?.text ?? ''))
    row(where, 'at 50% each app page is still one sheet of paper, with everything on it', printed.read.pages.length === printed.during.pages && differ.every((d) => d.length === 0), `${printed.read.pages.length} PDF pages for ${printed.during.pages} app pages`)
    await context.close()
  }

  // The pages can't be built: no dialog, the notice, the sheet as it was.
  {
    const where = 'failure'
    const { context, tab } = await open(where, {
      name: 'pump-sizing.excalimathpad',
      text: sheetFile([math('calc', 40, 40, 'a = 2 m')]),
    })
    await tab.evaluate(() => {
      CSSStyleSheet.prototype.replaceSync = () => {
        throw new Error('a stand-in failure')
      }
    })
    const before = await state(tab)
    await fromMenu(tab)()
    await tab.waitForSelector('.Toast__message', { timeout: 10_000 })
    const after = await state(tab)
    const prints = await tab.evaluate(() => window.__prints.length)
    row(where, 'no dialog; the notice says the pages couldn’t be built; nothing left behind', prints === 0 && after.toast === "The pages couldn't be built, so nothing was printed." && !after.view && after.title === before.title && after.undo === before.undo, `${prints} dialogs, "${after.toast}"`)
    await context.close()
  }

  // The plugin's Print… (section 11, Changed on 2026-11-15): the pump sheet from the "Print…" command.
  {
    const where = 'plugin pump'
    const opened = await openPlugin(where, {
      path: 'Calcs/pump-sizing.excalimathpad',
      text: sheetFile([heading('heading', 40, 40, 'Pump sizing'), math('calc', 40, 100, PUMP.join('\n'))]),
    })
    const { context, tab } = opened
    const rows = await shown(tab)
    const before = await pluginState(tab)
    const command = () =>
      tab.evaluate(() => {
        const print = window.__plugin.commands.find((command) => command.id === 'print')
        if (!FakeObsidian.runCommand(print)) throw new Error('Print… isn’t offered')
      })
    const printed = await printPluginWith(tab, command)
    await keep('plugin-pump', printed.pdf)
    const after = await pluginState(tab)
    checkSheet(where, 'pump-sizing.excalimathpad', rows, printed)
    row(where, 'the heading prints in Nunito: Excalidraw’s fonts inside the drawings’ SVG', printed.read.fonts.some((f) => /^Nunito/.test(f)) && norm(printed.read.pages[0].text).startsWith('Pumpsizing'), printed.read.fonts.filter((f) => /Nunito/.test(f)).join(', '))
    checkPlugin(where, 'Choose A4, portrait in the print dialog.', before, after, printed, opened)
    await context.close()
  }

  // The plugin's ☰ → Print…, its first item: the true-position sheet on Letter landscape.
  {
    const where = 'plugin ☰'
    const opened = await openPlugin(where, {
      path: 'Calcs/pump-sizing.excalimathpad',
      text: sheetFile([math('calc', 40, 40, TRUE_POSITION.join('\n'))], { page: { size: 'Letter', orientation: 'landscape' } }),
    })
    const { context, tab } = opened
    const rows = await shown(tab)
    const before = await pluginState(tab)
    await tab.click('[data-testid="main-menu-trigger"]')
    const first = await tab.evaluate(() => document.querySelector('.dropdown-menu-item')?.textContent?.trim())
    row(where, 'Print… is the first ☰ item, with no key', first === 'Print…' && (await tab.locator('[data-testid="print-item"] .dropdown-menu-item__shortcut').count()) === 0, first)
    const printed = await printPluginWith(tab, () => tab.click('[data-testid="print-item"]'))
    await keep('plugin-true-position', printed.pdf)
    const after = await pluginState(tab)
    checkSheet(where, 'pump-sizing.excalimathpad', rows, printed, { size: 'Letter', orientation: 'landscape' })
    checkPlugin(where, 'Choose Letter, landscape in the print dialog.', before, after, printed, opened)
    await context.close()
  }
} finally {
  await browser.close()
  server.close()
}

for (const { where, check, ok, detail } of results) {
  console.log(`${where.padEnd(14)} ${ok ? 'yes' : 'NO '}  ${check}${detail ? `  (${detail})` : ''}`)
}
const failed = results.filter(({ ok }) => !ok)
if (failed.length || errors.length || results.length === 0) {
  console.error('Print run failed (docs/spec-v1.md section 11, Print):')
  for (const { where, check } of failed) console.error(`  - ${where}: ${check}`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('Print run passed: the pump and true-position sheets through Print…, the footer, the title, the sheet left alone, the one line, section 17’s web items, and the plugin’s Print… in its frame.')
