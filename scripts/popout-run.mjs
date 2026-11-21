// The pop-out run (docs/spec-v1.md section 8, Inside an Obsidian tab; section
// 17, Verify first, M4d): the built `dist-plugin/main.js` in headless Chromium
// against the fake `obsidian`, with sheet tabs in the main window and in a
// pop-out window, as Obsidian makes them: the plugin's code runs in the main
// window, and the pop-out's view is DOM in a second, same-origin window
// (`window.open`), so `window` and `document` in the code are the main
// window's. One pop-out tab opens there; another opens in the main window and
// is then moved there, as Obsidian's Move to new window does.
//
// In each tab it drags the math element, places math with M and a click,
// opens and closes Excalidraw's Help and the Math guide, pastes text and
// copies the element, and prints from the "Print…" command (M5, #81): the
// hidden frame is made in that tab's window and prints its sheet there, the
// system's dialog stood in for by the frame's own `print()`. The
// main window's tab is the control; the pop-out's work only through the
// bridge (`src/canvas/popoutBridge.ts`). It fails on any check that doesn't
// hold, and on any page error.
//
// Run: `node scripts/popout-run.mjs` (`npm run test:popout`), after
// `npm run build:plugin`.

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-plugin')
const MAIN = 'Calcs/main.excalimathpad'
const POPOUT = 'Calcs/popout.excalimathpad'
const MOVED = 'Calcs/moved.excalimathpad'

const fake = await build({
  absWorkingDir: root,
  entryPoints: ['plugin/test/obsidian.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FakeObsidian',
  write: false,
  target: ['es2022'],
})

const frame = `<style>html,body{margin:0;height:100%}.workspace,.workspace-leaf,.workspace-leaf-content{height:100%}
.view-content{height:100%}</style>`

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Main - Obsidian</title>
<link rel="stylesheet" href="/styles.css">${frame}
</head><body>
<script src="/fake-obsidian.js"></script>
<script>
  var module = { exports: {} }, exports = module.exports
  window.require = (name) => {
    if (name === 'obsidian') return FakeObsidian
    throw new Error('main.js required ' + name)
  }
</script>
<script src="/main.js"></script>
<script>
  window.__start = async (sheet, manifest) => {
    const app = new FakeObsidian.App()
    app.vault.add(${JSON.stringify(MAIN)}, sheet)
    app.vault.add(${JSON.stringify(POPOUT)}, sheet)
    app.vault.add(${JSON.stringify(MOVED)}, sheet)
    const plugin = new module.exports.default(app, manifest)
    await plugin.onload()
    window.__plugin = plugin
    // The main window's tab.
    const main = app.workspace.getLeaf()
    await main.openFile(new FakeObsidian.TFile(${JSON.stringify(MAIN)}))
    // The pop-out: a window of its own, its leaf moved into it before the file opens.
    const popout = window.open('/popout.html', 'popout', 'width=1000,height=800')
    await new Promise((resolve) => popout.addEventListener('load', resolve, { once: true }))
    const leaf = app.workspace.getLeaf()
    popout.document.body.appendChild(leaf.containerEl)
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(POPOUT)}))
    window.__app = app
    window.__popout = popout
    window.__leaves = { main, popout: leaf }
    return leaf.containerEl.ownerDocument === popout.document
  }
  // Closes the pop-out's tab, then opens a sheet in the main window and moves it into the pop-out.
  window.__moveIn = async () => {
    await window.__leaves.popout.detach()
    const leaf = window.__app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(MOVED)}))
    FakeObsidian.migrateWindow(leaf.containerEl, window.__popout)
    window.__leaves.moved = leaf
    return leaf.containerEl.ownerDocument === window.__popout.document
  }
  // The anchor's scene position and the element count, read from the view's file as the app holds it.
  window.__scene = (which) => {
    const view = window.__leaves[which].view
    const text = view.getViewData()
    const scene = JSON.parse(text)
    const live = scene.elements.filter((e) => !e.isDeleted)
    const math = live.filter((e) => e.customData && e.customData.kind === 'math')
    return { count: live.length, math: math.length, first: math[0] ? { x: Math.round(math[0].x), y: Math.round(math[0].y) } : null }
  }
</script>
</body></html>`

const popoutPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pop-out - Obsidian</title>
<link rel="stylesheet" href="/styles.css">${frame}</head><body></body></html>`

const sheet = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [
    {
      id: 'calc', type: 'rectangle', x: 200, y: 200, width: 160, height: 60,
      customData: { kind: 'math', source: 'a = 2 m\nb = a * 3' },
    },
  ],
  appState: {},
  files: {},
  excalimathpad: { format: 1 },
})

const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  try {
    let body
    if (path === '/') body = page
    else if (path === '/popout.html') body = popoutPage
    else if (path === '/fake-obsidian.js') body = fake.outputFiles[0].text
    else if (['/main.js', '/styles.css', '/manifest.json'].includes(path)) body = await readFile(join(dist, path))
    else throw new Error('not found')
    response.writeHead(200, { 'content-type': types[path.slice(path.lastIndexOf('.'))] ?? 'text/html' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

/**
 * Excalidraw's own two messages as Print… puts its fonts inside the drawings'
 * SVG in the plugin, where font subsetting is trimmed (section 12a): no
 * worker, then the whole font as its fallback. Any other console error fails
 * the run (the print run checks the fallback's font on paper).
 */
const excalidrawsFontFallback = (text) =>
  (text.startsWith('Failed to use workers for subsetting') && text.includes('WorkerUrlNotDefinedError')) ||
  (text.startsWith('Failed to fetch font family') && text.includes('is not in the plugin'))

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const results = []
const errors = []
try {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin })
  // The system's print dialog, stood in for: the print frame's `print()` waits, recorded in its window.
  await context.addInitScript(() => {
    if (!window.frameElement?.matches('iframe.excalimathpad-print-frame')) return
    const host = window.parent
    window.print = () =>
      new Promise((resolve) => {
        host.__framePrints = host.__framePrints ?? []
        host.__framePrints.push({ title: host.document.title, resolve })
      })
  })
  const mainPage = await context.newPage()
  mainPage.on('pageerror', (error) => errors.push(`main: ${error.message}`))
  await mainPage.goto(`${origin}/`)
  const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
  const popoutOpened = context.waitForEvent('page')
  const moved = await mainPage.evaluate(([text, m]) => window.__start(text, m), [sheet, manifest])
  const popoutPageHandle = await popoutOpened
  popoutPageHandle.on('pageerror', (error) => errors.push(`popout: ${error.message}`))
  for (const [name, p] of [['main', mainPage], ['popout', popoutPageHandle]]) {
    p.on('console', (message) => {
      if (message.type() !== 'error' || excalidrawsFontFallback(message.text())) return
      errors.push(`${name} console: ${message.text().slice(0, 300)}`)
    })
  }
  console.log(`pop-out view's DOM is in the pop-out's document: ${moved}`)

  const scene = (which) => mainPage.evaluate((w) => window.__scene(w), which)
  const windows = [
    ['main', mainPage],
    ['popout', popoutPageHandle],
    ['moved', popoutPageHandle],
  ]
  for (const [which, tab] of windows) {
    if (which === 'moved') {
      const movedIn = await mainPage.evaluate(() => window.__moveIn())
      results.push({ window: which, check: 'the tab moved into the pop-out', ok: movedIn, detail: '' })
    }
    const row = (check, ok, detail = '') => results.push({ window: which, check, ok, detail })
    await tab.waitForSelector('.math-element .katex', { timeout: 30_000 })
    row('the sheet typesets', true)
    await tab.bringToFront()
    const box = await tab.locator('canvas.interactive').boundingBox()
    // Where the overlay drew the element: Excalidraw centres the scene as it opens.
    const at = () =>
      tab.evaluate(() => {
        const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(
          document.querySelector('[data-anchor-id="calc"]').style.transform,
        )
        return { x: Number(match[1]), y: Number(match[2]) }
      })
    const element = await at()

    // Drag the math element by its inside (its anchor's fill takes the press).
    const before = await scene(which)
    const startPoint = { x: box.x + element.x + 40, y: box.y + element.y + 20 }
    await tab.mouse.move(startPoint.x, startPoint.y)
    await tab.mouse.down()
    for (let i = 1; i <= 10; i++) await tab.mouse.move(startPoint.x + i * 12, startPoint.y + i * 8)
    await tab.mouse.up()
    await tab.waitForTimeout(300)
    const dragged = await scene(which)
    const moved = dragged.first && before.first && (dragged.first.x !== before.first.x || dragged.first.y !== before.first.y)
    row('a drag moves the element', !!moved, `${JSON.stringify(before.first)} → ${JSON.stringify(dragged.first)}`)
    // Whether a drag left Excalidraw stuck mid-gesture: a plain move after it.
    await tab.mouse.move(startPoint.x + 300, startPoint.y + 200)
    await tab.waitForTimeout(200)
    const after = await scene(which)
    row(
      'a move after the release leaves it in place',
      JSON.stringify(after.first) === JSON.stringify(dragged.first),
      `${JSON.stringify(dragged.first)} → ${JSON.stringify(after.first)}`,
    )
    await tab.keyboard.press('Escape')

    // M, then a click on empty canvas, places math in this window's tab.
    await tab.mouse.click(box.x + 60, box.y + box.height - 120)
    const placedBefore = (await scene(which)).math
    await tab.keyboard.press('m')
    await tab.mouse.click(box.x + 60, box.y + box.height - 100)
    await tab.waitForTimeout(200)
    await tab.keyboard.type('c = 4')
    await tab.keyboard.press('Escape')
    await tab.waitForTimeout(200)
    row('M and a click place math here', (await scene(which)).math === placedBefore + 1)

    // ? opens Excalidraw's Help: in which window does its dialog land?
    await tab.mouse.click(box.x + 60, box.y + box.height - 160)
    await tab.keyboard.press('Shift+?')
    await tab.waitForTimeout(300)
    const helpHere = await tab.locator('.HelpDialog').count()
    const helpInMain = await mainPage.locator('.HelpDialog').count()
    const helpRight = which === 'main' ? helpHere === 1 : helpHere === 1 && helpInMain === 0
    row('? opens Help in this window', helpRight, `Help dialogs here: ${helpHere}, in the main window: ${helpInMain}`)
    // Esc closes it, and Excalidraw's removal finds the box where it is.
    await tab.keyboard.press('Escape')
    await tab.waitForTimeout(300)
    const left = (await tab.locator('.HelpDialog').count()) + (await mainPage.locator('.HelpDialog').count())
    const boxes = await Promise.all([tab, mainPage].map((p) => p.locator('.excalidraw-modal-container').count()))
    row('Esc closes Help, and its box goes', left === 0 && boxes.every((n) => n === 0), `dialogs left: ${left}, boxes: ${boxes}`)

    // ☰ → Math guide (section 8, M4d) opens its dialog in this window, inside this tab's view.
    const ofThisTab = (selector) => (which === 'moved' ? tab.locator(selector).last() : tab.locator(selector).first())
    await ofThisTab('[data-testid="main-menu-trigger"]').click()
    await ofThisTab('[data-testid="math-guide-item"]').click()
    await tab.waitForTimeout(300)
    const guideHere = await tab.locator('.math-guide [role="dialog"]').count()
    const guideInMain = which === 'main' ? 0 : await mainPage.locator('.math-guide').count()
    row('☰ → Math guide opens the guide in this window', guideHere === 1 && guideInMain === 0, `here: ${guideHere}, in the main window: ${guideInMain}`)
    await tab.keyboard.press('Escape')
    await tab.waitForTimeout(200)
    row('Esc closes the Math guide', (await tab.locator('.math-guide').count()) === 0)

    // A paste of text, as the browser fires it on the focused element: a
    // headless Ctrl+V fires none, so the event is made here. Excalidraw hears
    // paste on the code's \`document\`, so this checks where it listens.
    await tab.mouse.click(box.x + 60, box.y + box.height - 160)
    // Excalidraw pastes only with a canvas under the pointer, and since the canary it reads the
    // pointer's place a frame late: a paste in the click's own instant still sees the place before it.
    await tab.waitForTimeout(200)
    const count = (await scene(which)).count
    await tab.evaluate(() => {
      const data = new DataTransfer()
      data.setData('text/plain', 'pasted text')
      const target = document.activeElement ?? document.body
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await tab.waitForTimeout(500)
    const pasted = (await scene(which)).count
    row('a paste adds the text', pasted > count, `${count} → ${pasted} elements`)

    // A copy with the math element selected writes Excalidraw's clipboard data.
    const now = await at()
    await tab.mouse.click(box.x + now.x + 40, box.y + now.y + 20)
    // Since the canary Excalidraw writes a copy into the event itself, as the browser then takes
    // it, and stops the event (0.18.1 wrote with the Clipboard API). In a pop-out the event it
    // hears is the bridge's copy, which carries this event's data and passes the stop back.
    const copy = await tab.evaluate(() => {
      const data = new DataTransfer()
      const target = document.activeElement ?? document.body
      const event = new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true })
      target.dispatchEvent(event)
      return { text: data.getData('text/plain'), stopped: event.defaultPrevented }
    })
    row(
      'a copy writes the selected element into the event, and stops it',
      copy.text.includes('excalidraw/clipboard') && copy.stopped,
      copy.text ? `${copy.text.length} characters, stopped: ${copy.stopped}` : 'nothing',
    )
    await tab.keyboard.press('Escape')

    // Print… (section 11, M5): the frame is made in this tab's own window and prints this tab's sheet.
    const FRAME = 'iframe.excalimathpad-print-frame'
    const titleBefore = await tab.evaluate(() => document.title)
    const printsBefore = await tab.evaluate(() => window.__framePrints?.length ?? 0)
    const offered = await mainPage.evaluate((w) => {
      window.__app.workspace.setActiveLeaf(window.__leaves[w])
      return FakeObsidian.runCommand(window.__plugin.commands.find((command) => command.id === 'print'))
    }, which)
    await tab.waitForFunction((n) => (window.__framePrints?.length ?? 0) > n, printsBefore, { timeout: 30_000 })
    const printing = await tab.evaluate((selector) => {
      const doc = document.querySelector(selector)?.contentDocument
      return {
        frames: document.querySelectorAll(selector).length,
        title: window.__framePrints.at(-1).title,
        pages: doc?.querySelectorAll('.print-view__page').length ?? 0,
        lines: doc ? [...doc.querySelectorAll('.print-view .math-element [data-line]')].map((line) => line.getAttribute('aria-label')) : [],
        katex: doc ? [...doc.fonts].some((face) => face.family.replaceAll('"', '') === 'KaTeX_Main' && face.status === 'loaded') : false,
      }
    }, FRAME)
    const framesInMain = which === 'main' ? 0 : await mainPage.locator(FRAME).count()
    const plain = which === 'main' ? 'main' : which === 'popout' ? 'popout' : 'moved'
    row(
      'Print… builds the pages in a frame in this window, from this tab’s sheet, its fonts loaded',
      offered && printing.frames === 1 && framesInMain === 0 && printing.pages === 1 && printing.lines.includes('b = a * 3') && printing.katex,
      `frames here: ${printing.frames}, in the main window: ${framesInMain}, pages: ${printing.pages}, KaTeX_Main: ${printing.katex}`,
    )
    row('this window’s title is the plain name while its dialog is open', printing.title === plain, `${titleBefore} → ${printing.title}`)
    await tab.evaluate(() => window.__framePrints.at(-1).resolve())
    await tab.waitForTimeout(400)
    const printed = await tab.evaluate((selector) => ({ frames: document.querySelectorAll(selector).length, title: document.title }), FRAME)
    row('afterwards the frame is gone and the title is back', printed.frames === 0 && printed.title === titleBefore, `${printed.frames} frames, ${printed.title}`)
  }
} catch (error) {
  errors.push(`the run didn't finish: ${error.message.split('\n')[0]}`)
} finally {
  await browser.close()
  server.close()
}

for (const { window, check, ok, detail } of results) {
  console.log(`${window.padEnd(7)} ${ok ? 'yes' : 'NO '}  ${check}${detail ? `  (${detail})` : ''}`)
}
const failed = results.filter(({ ok }) => !ok)
if (failed.length || errors.length || results.length === 0) {
  console.error('Pop-out run failed (docs/spec-v1.md section 8, Inside an Obsidian tab):')
  for (const { window, check } of failed) console.error(`  - ${window}: ${check}`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('Pop-out run passed: a sheet tab in a pop-out window drags, places, opens Help and the Math guide, pastes, copies and prints its own sheet.')
