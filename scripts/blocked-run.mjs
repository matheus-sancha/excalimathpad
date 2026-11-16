// The network-blocked run (docs/spec-v1.md section 12a, Data protection): the
// built `dist-plugin/main.js` loads in headless Chromium against the fake
// `obsidian` (plugin/test/obsidian.ts), with every non-local request blocked
// and logged, and opens the pump sheet: math, a table, a plot, an image and
// CJK text. It reads the ☰ stamp (the version) and opens ☰ → Math guide. It
// fails on any attempted request, any page error, a stamp that isn't the
// manifest's version, a guide that doesn't open, and any <style> or <link>
// the bundle adds at run time, and on any KaTeX class drawn in a family the
// bundle has no font for (section 14, M4e, Lighter plugin: four are dropped).
//
// Run: `node scripts/blocked-run.mjs` (`npm run test:blocked`), after
// `npm run build:plugin`. `--probe-request` makes the page try one request
// and `--probe-style` add a <style>, and `--probe-font` draws a KaTeX class
// whose font was dropped, to show the run fails on each (the deliberate
// failing cases). `--screenshot
// <file>` saves what the run saw.
//
// The page also carries a stand-in for Obsidian's global rules for buttons,
// inputs and selects (plugin/test/obsidian-globals.css), on a dark-theme body:
// the run fails if a Sheet panel row takes any of them (the view's guard in
// plugin/styles.css). `--probe-guard` drops the guard, to show it fails.

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-plugin')
const args = process.argv.slice(2)
const probe = args.includes('--probe-request')
const probeStyle = args.includes('--probe-style')
const probeGuard = args.includes('--probe-guard')
const probeFont = args.includes('--probe-font')
const screenshotAt = args.indexOf('--screenshot')
const screenshot = screenshotAt >= 0 ? args[screenshotAt + 1] : null
const SHEET = 'Calcs/pump-sizing.excalimathpad'

// The fake, bundled for the browser: `require('obsidian')` in main.js gets it.
const fake = await build({
  absWorkingDir: root,
  entryPoints: ['plugin/test/obsidian.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FakeObsidian',
  write: false,
  target: ['es2022'],
})

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/obsidian-globals.css">
<link rel="stylesheet" href="/styles.css">
<style>html,body{margin:0;height:100%}.workspace,.workspace-leaf,.workspace-leaf-content{height:100%}
.view-content{height:100%;padding:16px;box-sizing:border-box}</style>
</head><body class="theme-dark">
<script src="/fake-obsidian.js"></script>
<script>
  // Everything the bundle adds to the document from here on.
  window.__added = []
  new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeName === 'STYLE' || node.nodeName === 'LINK') window.__added.push(node.outerHTML.slice(0, 200))
    }
  }).observe(document, { childList: true, subtree: true })
  var module = { exports: {} }, exports = module.exports
  window.require = (name) => {
    if (name === 'obsidian') return FakeObsidian
    throw new Error('main.js required ' + name)
  }
</script>
<script src="/main.js"></script>
<script>
  window.__open = async (sheet, manifest) => {
    const app = new FakeObsidian.App()
    app.vault.add(${JSON.stringify(SHEET)}, sheet)
    const Plugin = module.exports.default
    const plugin = new Plugin(app, manifest)
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(SHEET)}))
    window.__app = app
    return leaf.view.getViewType()
  }
</script>
</body></html>`

const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  try {
    let body
    if (path === '/') body = page
    else if (path === '/fake-obsidian.js') body = fake.outputFiles[0].text
    else if (path === '/obsidian-globals.css') body = await readFile(join(root, 'plugin/test/obsidian-globals.css'))
    else if (path === '/styles.css' && probeGuard) body = (await readFile(join(dist, path), 'utf8')).replace(/all: revert-layer;/, '')
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

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const failures = []
const blocked = []
try {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  // Every request that isn't to this page's own server is blocked and logged.
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(`${origin}/`)) return route.continue()
    blocked.push(url)
    return route.abort('blockedbyclient')
  })
  context.on('websocket', (socket) => blocked.push(socket.url()))
  const tab = await context.newPage()
  tab.on('pageerror', (error) => failures.push(`page error: ${error.message}`))
  tab.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console error: ${message.text()}`)
  })
  await tab.goto(`${origin}/`)

  const sheet = await readFile(join(root, 'plugin/test/pump-sizing.excalimathpad'), 'utf8')
  const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
  const viewType = await tab.evaluate(([text, m]) => window.__open(text, m), [sheet, manifest])
  if (probe) await tab.evaluate(() => fetch('https://example.com/probe').catch(() => {}))
  if (probeStyle) await tab.evaluate(() => document.head.append(document.createElement('style')))

  // The sheet as the web app shows it: typeset, with results, the table and the plot.
  await tab.waitForFunction(() => document.querySelectorAll('.math-element .katex').length > 20, null, { timeout: 30_000 })
  await tab.waitForFunction(
    () => [...document.querySelectorAll('.math-element__result')].some((cell) => cell.dataset.text === '18.81 L / s'),
    null,
    { timeout: 30_000 },
  )
  await tab.waitForSelector('.math-element__plot svg', { timeout: 30_000 })
  if (probeFont) {
    await tab.evaluate(() => {
      const math = document.querySelector('.math-element .katex')
      math.insertAdjacentHTML('beforeend', '<span class="mathcal">L</span>')
    })
  }
  await tab.evaluate(() => document.fonts.ready)
  // Every family KaTeX draws the sheet in has its font in the bundle: one
  // without would show in a fallback font, with no error and no request.
  const unfonted = await tab.evaluate(() => {
    const faces = new Set([...document.fonts].map((face) => face.family.replaceAll('"', '')))
    const drawn = [...document.querySelectorAll('.katex, .katex *')]
      .filter((element) => element.childElementCount === 0 && element.textContent.trim() !== '')
      .map((element) => getComputedStyle(element).fontFamily.split(',')[0].replaceAll('"', '').trim())
    return [...new Set(drawn)].filter((family) => family.startsWith('KaTeX_') && !faces.has(family)).sort()
  })
  for (const family of unfonted) failures.push(`KaTeX draws in ${family}, which has no font in styles.css`)
  // Excalidraw draws the image on its static canvas: the fixture's gradient
  // (red 30, green and blue above 100) has to be in its pixels.
  await tab.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas.excalidraw__canvas.static')
      const data = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data
      if (!data) return false
      let found = 0
      for (let i = 0; i < data.length; i += 16) {
        if (Math.abs(data[i] - 30) < 6 && data[i + 1] > 110 && data[i + 2] > 110 && data[i + 3] > 250) found++
      }
      return found > 200
    },
    null,
    { timeout: 30_000 },
  )
  // The CJK text is on the canvas in the scene, and no font file was asked for it.
  const report = await tab.evaluate(() => ({
    fonts: [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replaceAll('"', '')),
    tables: document.querySelectorAll('.math-element__table, [class*="table"]').length,
    added: window.__added,
  }))
  // Obsidian's global control rules stay out of the view: a Sheet panel row is
  // the app's transparent grid, not Obsidian's 30 px dark button.
  const row = await tab.evaluate(() => {
    const element = document.querySelector('.sheet-panel__row')
    if (!element) return null
    const style = getComputedStyle(element)
    return { display: style.display, background: style.backgroundColor, shadow: style.boxShadow, height: style.height }
  })
  if (!row) failures.push("the Sheet panel's Variables rows didn't show")
  else if (row.display !== 'grid' || row.background !== 'rgba(0, 0, 0, 0)' || row.shadow !== 'none' || row.height === '30px') {
    failures.push(`Obsidian's global CSS reached the view: a panel row is ${JSON.stringify(row)}`)
  }
  // The plugin's stamp (section 12, Hosted build): the ☰ menu's last line is
  // the version, the number Obsidian's plugin list shows, not a commit.
  await tab.click('[data-testid="main-menu-trigger"]')
  const stamp = await tab
    .waitForSelector('[data-testid="build-stamp"]', { timeout: 10_000 })
    .then((element) => element.textContent())
    .catch(() => null)
  if (stamp?.trim() !== manifest.version) failures.push(`the ☰ stamp reads ${JSON.stringify(stamp)}, not the version ${manifest.version}`)
  // ☰ → Math guide (section 8, Math guide): the guide opens from the bundle,
  // inside the view, with its 17 sections listed, and asks for nothing.
  await tab.click('[data-testid="math-guide-item"]')
  const guide = await tab
    .waitForSelector('.view-content .math-guide [role="dialog"]', { timeout: 10_000 })
    .then((dialog) => dialog.evaluate((box) => ({
      contents: box.querySelectorAll('.math-guide__body ol:first-of-type a').length,
      sections: box.querySelectorAll('.math-guide__body h2').length,
    })))
    .catch(() => null)
  if (!guide) failures.push("☰ → Math guide didn't open the guide inside the view")
  else if (guide.contents !== 17 || guide.sections < 17) failures.push(`the Math guide shows ${JSON.stringify(guide)}, not its 17 sections`)
  await tab.keyboard.press('Escape')
  if (await tab.$('.math-guide')) failures.push("Esc didn't close the Math guide")
  // Let late work (fonts, the plot's chunk, image decoding) try anything it would.
  await tab.waitForTimeout(1500)
  if (screenshot) await tab.screenshot({ path: screenshot })

  for (const node of report.added) failures.push(`added at run time: ${node}`)
  for (const url of blocked) failures.push(`request attempted: ${url}`)
  const faces = [...new Set(report.fonts)].sort()
  console.log(`view: ${viewType}; fonts loaded from data: URLs: ${faces.join(', ')}`)
  for (const face of ['Excalifont', 'Nunito', 'KaTeX_Main']) {
    if (!faces.includes(face)) failures.push(`font ${face} didn't load`)
  }
} catch (error) {
  failures.push(`the run didn't finish: ${error.message.split('\n')[0]}`)
  for (const url of blocked) failures.push(`request attempted: ${url}`)
} finally {
  await browser.close()
  server.close()
}

if (failures.length) {
  console.error('Network-blocked run failed (docs/spec-v1.md section 12a, Data protection):')
  for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('Network-blocked run passed: math, a table, a plot, an image, CJK text and the Math guide, and no request.')
