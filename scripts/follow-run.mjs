// The follow run (docs/spec-v1.md section 4, While editing a line: the math
// is always drawn on its box, and the view follows the caret; 0.2.2, #191):
// the built `dist-plugin/main.js` in headless Chromium against the fake
// `obsidian`, with real keys and mouse.
//
// On a 14-inch laptop's window (1366 × 768) it opens the last line of the
// true-position sheet, placed so the element ends near the window's bottom,
// types the 146-character plot line, presses Enter and then Esc. At each step
// it checks that nothing has been scrolled by the browser (the overlay or any
// box around it), that the element's content is drawn where the overlay put
// it, on its box, and that the caret is inside the visible area less the
// 48 px margin. Then: a pan by hand is left alone until the next keystroke,
// and ↑ from a line above the window brings it back. On a small window
// (1000 × 800) the panel floats, and a line opened under it moves clear by
// the same rule. It fails on any check that doesn't hold, and on any page
// error.
//
// Run: `node scripts/follow-run.mjs` (`npm run test:follow`), after
// `npm run build:plugin`. FOLLOW_RUN_SHOTS=<folder> keeps a screenshot of each step.

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-plugin')
const FILE = 'Calcs/follow.excalimathpad'
const SHOTS = process.env.FOLLOW_RUN_SHOTS
const MARGIN = 48

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
<link rel="stylesheet" href="/styles.css">
<style>html,body{margin:0;height:100%}.workspace,.workspace-leaf,.workspace-leaf-content,.view-content{height:100%}</style>
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
    app.vault.add(${JSON.stringify(FILE)}, sheet)
    const plugin = new module.exports.default(app, manifest)
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(FILE)}))
  }
  // What the checks read, in the window's px.
  window.__state = () => {
    const box = (element) => {
      if (!element) return null
      const { left, top, right, bottom } = element.getBoundingClientRect()
      return { left, top, right, bottom }
    }
    const element = document.querySelector('[data-anchor-id="calc"]')
    const body = element.querySelector('.math-element__body')
    // Every box the browser has scrolled, from the content up to the page.
    const scrolled = []
    for (let e = body; e; e = e.parentElement) {
      if (e.scrollLeft || e.scrollTop) scrolled.push((String(e.className) || e.tagName) + ' ' + e.scrollLeft + ',' + e.scrollTop)
    }
    if (window.scrollX || window.scrollY) scrolled.push('window ' + window.scrollX + ',' + window.scrollY)
    // Where the overlay put the element: its translate, from the stage's corner.
    const at = /translate\\((-?[\\d.e+-]+)px, (-?[\\d.e+-]+)px\\)/.exec(element.style.transform)
    const stage = box(document.querySelector('.app-shell__stage'))
    const field = document.querySelector('.math-element__field')
    let caret = null
    if (field) {
      const copy = field.parentElement.querySelector('.math-element__field-text').firstChild
      const fieldBox = box(field)
      let x = fieldBox.left
      if (copy && field.selectionStart > 0) {
        const range = document.createRange()
        range.setStart(copy, 0)
        range.setEnd(copy, field.selectionStart)
        x = range.getBoundingClientRect().right
      }
      caret = { x, top: fieldBox.top, bottom: fieldBox.bottom, focused: document.activeElement === field }
    }
    const canvas = document.querySelector('.excalidraw')
    const panel = document.querySelector('.sheet-sidebar')
    return {
      scrolled,
      body: box(body),
      put: at && { left: stage.left + Number(at[1]), top: stage.top + Number(at[2]) },
      field: box(field),
      caret,
      canvas: box(canvas),
      panel: box(panel),
    }
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

// The true-position sheet of the map (#172), its plot line last.
const SOURCE = `# True position, RFS (ASME Y14.5)
dx = 0.08 mm
dy = -0.05 mm
T_p = 0.25 mm
TP = 2 sqrt(dx^2 + dy^2) in mm
check = if(TP <= T_p, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"
used = TP / T_p * 100
margin = T_p - TP in mm
# Graph: tolerance zone and the measured point
r_t = T_p / 2 in mm
theta = 0 .. 2 pi step pi / 90
zone_x = r_t cos(theta) in mm
zone(a) = r_t sin(a)
measured(a) = dy + 0 mm * a
plot(zone_x in mm, zone(theta) in mm, measured(theta) in mm), mark dx, x -2.3 r_t .. 2.3 r_t, y -1.2 r_t .. 1.2 r_t, size L, title "True position"`
const PLOT = SOURCE.split('\n').at(-1)
const LAST = SOURCE.split('\n').length - 1
// The same sheet with a short last line, as it is before the plot line is typed.
const SHORT = `${SOURCE.split('\n').slice(0, -1).join('\n')}\nplot(zone_x, zone(theta))`
const sheetAt = (x, y, source) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements: [{ id: 'calc', type: 'rectangle', x, y, width: 160, height: 60, customData: { kind: 'math', source } }],
    appState: {},
    files: {},
    excalimathpad: { format: 1 },
  })

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
const results = []
const errors = []
if (SHOTS) await mkdir(SHOTS, { recursive: true })

/** Opens `sheet` in a window of `viewport` and runs `act` with the step checks. */
async function run(where, viewport, sheet, act) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const tab = await context.newPage()
  tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
  tab.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${where} console: ${message.text().slice(0, 300)}`)
  })
  const row = (check, ok, detail = '') => results.push({ where, check, ok, detail })
  const px = (n) => Math.round(n)
  const state = () => tab.evaluate(() => window.__state())
  // The three checks of the issue, at one step.
  const step = async (name, { open = true } = {}) => {
    await tab.waitForTimeout(600)
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where}-${name}.png`) })
    const s = await state()
    row(`${name}: nothing was scrolled by the browser`, s.scrolled.length === 0, s.scrolled.join('; '))
    row(
      `${name}: the content is drawn on its box`,
      s.put !== null && Math.abs(s.body.left - s.put.left) < 1 && Math.abs(s.body.top - s.put.top) < 1,
      `drawn at ${px(s.body.left)}, ${px(s.body.top)}; put at ${s.put && px(s.put.left)}, ${s.put && px(s.put.top)}`,
    )
    if (!open) {
      row(`${name}: no line is open`, s.caret === null)
      return s
    }
    // The visible area: the canvas less the Sheet panel, which covers its right, docked or floating.
    const area = { ...s.canvas }
    if (s.panel && s.panel.left > area.left) area.right = Math.min(area.right, s.panel.left)
    const c = s.caret
    row(
      `${name}: the caret is inside the visible area less ${MARGIN} px`,
      c !== null &&
        c.focused &&
        c.x >= area.left + MARGIN - 1 &&
        c.x <= area.right - MARGIN + 1 &&
        c.top >= area.top + MARGIN - 1 &&
        c.bottom <= area.bottom - MARGIN + 1,
      c && `caret x ${px(c.x)}, row ${px(c.top)}–${px(c.bottom)}; area ${px(area.left)}–${px(area.right)} by ${px(area.top)}–${px(area.bottom)}`,
    )
    return s
  }
  try {
    await tab.goto(`${origin}/`)
    await tab.evaluate(([text, m]) => window.__start(text, m), [sheet, manifest])
    await tab.waitForSelector('[data-anchor-id="calc"] .katex', { timeout: 30_000 })
    await tab.waitForTimeout(800)
    const lineBox = async (line) => {
      const box = await tab.locator(`[data-anchor-id="calc"] [data-line="${line}"]`).boundingBox()
      if (!box) throw new Error(`line ${line} isn't drawn`)
      return box
    }
    await act({ tab, row, step, state, lineBox, px })
  } catch (error) {
    errors.push(`${where}: the run didn't finish: ${error.message.split('\n')[0]}`)
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where}-stopped.png`) }).catch(() => {})
  } finally {
    await context.close()
  }
}

try {
  // The issue's steps. The element's last line sits near the window's bottom.
  await run('laptop', { width: 1366, height: 768 }, sheetAt(40, 300, SHORT), async ({ tab, row, step, lineBox, px }) => {
    const last = await lineBox(LAST)
    // Its row holds a chart, which runs past the window: the press is on the row's first 24 px.
    row('the last line starts near the window’s bottom', last.y > 768 - 150 && last.y + 12 < 768, `at y ${px(last.y)}`)
    await tab.mouse.dblclick(last.x + 30, last.y + 10)
    await step('the line opens')
    await tab.keyboard.press('ControlOrMeta+a')
    await tab.keyboard.type(PLOT, { delay: 5 })
    const typed = await step('the plot line is typed')
    row('the field is wider than the window, so the view moved sideways', typed.field.right - typed.field.left > 1366, `field ${px(typed.field.right - typed.field.left)} px wide`)
    await tab.keyboard.press('Enter')
    const entered = await step('Enter')
    await tab.keyboard.press('Escape')
    const left = await step('Esc', { open: false })
    row(
      'the view doesn’t scroll back when the edit ends',
      Math.abs(left.body.left - entered.body.left) < 1 && Math.abs(left.body.top - entered.body.top) < 1,
      `content at ${px(left.body.left)}, ${px(left.body.top)} after Esc; ${px(entered.body.left)}, ${px(entered.body.top)} before`,
    )
  })

  // A pan by hand is left alone until the caret next moves; ↑ follows upwards.
  await run('laptop, panned', { width: 1366, height: 768 }, sheetAt(300, 200, SHORT), async ({ tab, row, step, state, lineBox, px }) => {
    const line = await lineBox(3)
    await tab.mouse.dblclick(line.x + 30, line.y + line.height / 2)
    const opened = await step('a line in view opens')
    row('a line already in view moves nothing', Math.abs(opened.field.top - line.y) < 2, `row at ${px(opened.field.top)}, was ${px(line.y)}`)
    await tab.mouse.move(700, 600)
    await tab.mouse.wheel(0, 500)
    await tab.waitForTimeout(600)
    const panned = await state()
    row('a pan by hand during the edit is left alone', panned.field.bottom < 0, `row at ${px(panned.field.top)}`)
    await tab.keyboard.type('0')
    await step('a keystroke after the pan')
    await tab.mouse.wheel(0, 500)
    await tab.waitForTimeout(300)
    await tab.keyboard.press('ArrowUp')
    await step('↑ to a line above the window')
    await tab.keyboard.press('Escape')
    await step('Esc after ↑', { open: false })
  })

  // A small window: the panel floats over the canvas's right, and a line opened under it moves clear.
  await run('small window', { width: 1000, height: 800 }, sheetAt(700, 200, 'a = 2 m\nb = a * 3'), async ({ tab, row, step, lineBox, px }) => {
    const line = await lineBox(1)
    await tab.mouse.dblclick(line.x + 20, line.y + line.height / 2)
    const s = await step('a line under the floating panel opens')
    row('the panel floats over the canvas', s.panel !== null && s.panel.left > 0 && s.panel.left < 1000, s.panel ? `panel from x ${px(s.panel.left)}` : 'no panel')
    row('the line moved the least distance, not to the middle', s.panel !== null && Math.abs(s.field.right - (s.panel.left - MARGIN)) < 2, `row’s right at ${px(s.field.right)}`)
  })
} finally {
  await browser.close()
  server.close()
}

for (const { where, check, ok, detail } of results) {
  console.log(`${where.padEnd(15)} ${ok ? 'yes' : 'NO '}  ${check}${detail ? `  (${detail})` : ''}`)
}
const failed = results.filter(({ ok }) => !ok)
if (failed.length || errors.length || results.length === 0) {
  console.error('Follow run failed (docs/spec-v1.md section 4, While editing a line):')
  for (const { where, check } of failed) console.error(`  - ${where}: ${check}`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('Follow run passed: the math stays on its box and the view follows the caret.')
