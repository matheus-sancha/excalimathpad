// The network-blocked run (docs/spec-v1.md section 12a, Data protection): the
// built `dist-plugin/main.js` loads in headless Chromium against the fake
// `obsidian` (plugin/test/obsidian.ts), with every non-local request blocked
// and logged, and opens the pump sheet: math, a table, a plot, an image and
// CJK text. It fails on any attempted request, any page error, and any
// <style> or <link> the bundle adds at run time.
//
// Run: `node scripts/blocked-run.mjs` (`npm run test:blocked`), after
// `npm run build:plugin`. `--probe-request` makes the page try one request
// and `--probe-style` add a <style>, to show the run fails on each (the
// deliberate failing cases). `--screenshot
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
  await tab.evaluate(() => document.fonts.ready)
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
console.log('Network-blocked run passed: math, a table, a plot, an image and CJK text, and no request.')
