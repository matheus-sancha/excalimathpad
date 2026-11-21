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
// It then chooses ☰ → Language → Português (section 8, Language, 0.5.0) and
// checks, in Portuguese, that the texts came from the bundle with no request,
// that the choice is in `data.json`, and that what the app finds in
// Excalidraw's DOM (More tools' Math items, the image tool, the plugin's
// hidden items, the reduced properties panel and the canvas hint) it still
// finds: none of it goes by Excalidraw's English text (section 14, 0.5.0).
// From 0.6.0 the app's own ☰ items, More tools' Cálculo items and the canvas
// hint read in Portuguese too, from the text tables in `main.js`.
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
    window.__plugin = plugin
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
  await portuguese(tab, manifest)
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

/**
 * ☰ → Language → Português, in the built plugin (section 8, Language). Each
 * check that fails is added to `failures`; the requests are the run's own log.
 */
async function portuguese(tab, manifest) {
  const choose = async () => {
    await tab.click('[data-testid="main-menu-trigger"]')
    await tab.selectOption('[data-testid="language-select"]', 'pt-BR')
  }
  await choose()
  const translated = await tab
    .waitForFunction(
      () => document.querySelector('[data-testid="toolbar-rectangle"]')?.closest('label')?.title.startsWith('Retângulo'),
      null,
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false)
  if (!translated) failures.push("☰ → Language → Português didn't put Excalidraw's toolbar in Portuguese")
  const menu = await tab.evaluate(() => ({
    entries: [...document.querySelectorAll('.dropdown-menu .dropdown-menu-item__text')].map((item) => item.textContent.trim()),
    label: document.querySelector('.language-row__label')?.textContent,
    stamp: document.querySelector('[data-testid="build-stamp"]')?.textContent.trim(),
  }))
  // Excalidraw's own ☰ items in Portuguese, and the app's with them (0.6.0), from the bundle.
  if (!menu.entries.includes('Modo escuro')) failures.push(`☰ isn't in Portuguese under Português: ${JSON.stringify(menu.entries)}`)
  if (!menu.entries.includes('Guia de cálculo') || !menu.entries.includes('Imprimir…') || menu.label !== 'Idioma' || menu.stamp !== manifest.version) {
    failures.push(`the app's own ☰ text isn't in Portuguese under Português: ${JSON.stringify(menu)}`)
  }
  const data = await tab.evaluate(() => window.__plugin.dataJson)
  if (data?.language !== 'pt-BR') failures.push(`data.json holds ${JSON.stringify(data)}, not the language chosen`)
  await tab.keyboard.press('Escape')

  // More tools: the app's Cálculo heading and two items, and the plugin's hidden items still hidden.
  await tab.click('.App-toolbar__extra-tools-trigger')
  await tab.waitForSelector('.math-tools__heading', { timeout: 10_000 }).catch(() => null)
  const tools = await tab.evaluate(() => {
    const shown = (element) => !!element && getComputedStyle(element).display !== 'none'
    const dropdown = document.querySelector('.App-toolbar__extra-tools-dropdown')
    return {
      heading: dropdown?.querySelector('.math-tools__heading')?.textContent,
      items: [...(dropdown?.querySelectorAll('.math-tools__heading ~ * .dropdown-menu-item__text, .math-tools__heading ~ .dropdown-menu-item .dropdown-menu-item__text') ?? [])].map(
        (item) => item.childNodes[0]?.textContent.trim(),
      ),
      embed: shown(dropdown?.querySelector('[data-testid="toolbar-embeddable"]')),
      generate: shown(dropdown?.querySelector('.dropdown-menu-container > div:not([class])')),
    }
  })
  if (tools.heading !== 'Cálculo' || tools.items.join() !== 'Adicionar cálculo,Configurações de cálculo') {
    failures.push(`More tools' Math items under Português: ${JSON.stringify(tools)}`)
  }
  if (tools.embed || tools.generate) failures.push(`a hidden More tools item shows under Português: ${JSON.stringify(tools)}`)
  await tab.click('.App-toolbar__extra-tools-trigger')

  // The image tool opens the vault's picker, never the system's.
  let chooser = false
  tab.once('filechooser', () => (chooser = true))
  await tab.click('label.ToolIcon:has([data-testid="toolbar-image"])')
  await tab.waitForTimeout(300)
  const picker = await tab.evaluate(() => FakeObsidian.modals.filter((modal) => modal.isOpen).length)
  if (chooser || picker !== 1) failures.push(`the image tool under Português: ${picker} vault picker(s), system chooser ${chooser}`)
  await tab.evaluate(() => FakeObsidian.modals.forEach((modal) => modal.close()))

  // One math element selected: the reduced properties panel and the app's hint, in Portuguese.
  const box = await tab.locator('.math-element').first().boundingBox()
  await tab.mouse.click(box.x + 6, box.y + 6)
  await tab.waitForSelector('[data-math-selection="one"]', { timeout: 10_000 }).catch(() => null)
  const selected = await tab.evaluate(() => {
    const column = document.querySelector('.App-menu__left .panelColumn')
    const children = column ? [...column.children] : []
    const opacity = children.findIndex((child) => child.matches('label.control-label'))
    const hint = document.querySelector('.HintViewer')
    return {
      before: children.slice(0, Math.max(opacity, 0)).filter((child) => getComputedStyle(child).display !== 'none').length,
      opacity: opacity >= 0 ? children[opacity].textContent.trim() : null,
      hint: hint ? getComputedStyle(hint, '::after').content : null,
    }
  })
  if (selected.opacity === null || selected.before !== 0) failures.push(`the reduced properties panel under Português: ${JSON.stringify(selected)}`)
  if (selected.hint !== JSON.stringify('Clique duas vezes em uma linha ou pressione Enter para editar')) {
    failures.push(`the canvas hint under Português reads ${selected.hint}`)
  }

  // Copy to clipboard as SVG stays hidden in Excalidraw's right-click menu.
  await tab.mouse.click(box.x + 6, box.y + 6, { button: 'right' })
  const copyAsSvg = await tab
    .waitForSelector('.context-menu', { timeout: 10_000 })
    .then(() =>
      tab.evaluate(() => {
        const item = document.querySelector('.context-menu [data-testid="copyAsSvg"]')
        return item ? getComputedStyle(item).display : 'missing'
      }),
    )
    .catch(() => 'no menu')
  if (copyAsSvg !== 'none') failures.push(`Copy to clipboard as SVG under Português: ${copyAsSvg}`)
  await tab.keyboard.press('Escape')
}

if (failures.length) {
  console.error('Network-blocked run failed (docs/spec-v1.md section 12a, Data protection):')
  for (const failure of [...new Set(failures)]) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('Network-blocked run passed: math, a table, a plot, an image, CJK text, the Math guide and Português, and no request.')
