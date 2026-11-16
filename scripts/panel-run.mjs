// The panel run (docs/spec-v1.md section 8, Sheet panel: from M4e the panel is
// narrower, resizable, and docks by its own width; #198). jsdom lays nothing
// out, so the widths, the docking, the drag and the icon tabs are held here:
// the built `dist-plugin/main.js` against the fake `obsidian`, and the built
// web app in `dist/`, in headless Chromium with a real mouse and real keys.
//
// - At 1536, 1280 and 1000 px the panel is 320 px, opens at launch docked
//   beside the sheet, and an edit shows Format and puts the tab back; at
//   880 px it stays closed at launch and on an edit, and floats when Math
//   settings opens it. Its tabs are six icons of 32 px, the shown tab's name a
//   heading over its content.
// - A drag of the left edge moves the width with the pointer between 280 and
//   480 px, with a line open and half typed: the line stays open, nothing is
//   asked to be saved, no undo step is added and the file never holds the
//   width. A double-click puts 320 px back; with the handle focused ← and →
//   move it 16 px and Home puts it back, and Excalidraw hears none of them.
// - The docking width follows the drag: at 1000 px the panel docks up to
//   359 px and floats from 360 px, to Excalidraw (the room it takes, its dock
//   button) and to the app (an edit opens it or doesn't) at the same px.
// - The width is in `data.json` and a restarted plugin opens at it; on the
//   web it survives a reload (`localStorage`).
// - At 280 px every tab's content is usable: no control is cut by the panel's
//   edge and nothing scrolls sideways (section 17's check for M4e).
// - The Format tab's sample (section 4, Format tab, M4e, #199), at 320 and at
//   280 px: 13 px with 20 px rows in a box as wide as the panel; the `check`
//   line on two rows, its result on the second with its rule; a line with two
//   roots and three fractions wrapped, its unbreakable root scrolling
//   sideways, nothing scaled; a `size L` plot line as its line and the note,
//   with no chart; a table of 3 columns and 9 rows whole, and one of 8
//   columns scaled down to the box (section 17's check); and the sample live
//   as the line is typed, with its stored format, a true rule and its note.
// - The charts (section 10, Plots, M4e, #200), in light and dark: the
//   true-position chart at S, M and L is square, 220, 280 and 360 px, its
//   circle round to a pixel, framed, with zero lines and no grid; a point's
//   label stays inside the frame with the point at the circle's edge and at
//   the chart's edge, left of the dot where the right has no room, haloed;
//   and no tick number, axis title or mark's label runs past the chart's box,
//   on these, on the pump sheet's chart (its legend, grid and mark kept) and
//   on charts made to push text out (a mark at each edge, huge tick numbers).
//
// Run: `node scripts/panel-run.mjs` (`npm run test:panel`), after
// `npm run build`. PANEL_RUN_SHOTS=<folder> keeps a screenshot of each step.

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-plugin')
const web = join(root, 'dist')
const FILE = 'Calcs/panel.excalimathpad'
const SHOTS = process.env.PANEL_RUN_SHOTS
const TABS = ['Format', 'Symbols', 'Variables', 'Problems', 'Constants', 'Settings']

const fake = await build({
  absWorkingDir: root,
  entryPoints: ['plugin/test/obsidian.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FakeObsidian',
  write: false,
  target: ['es2022'],
})

// What the checks read, in the window's px; the same in the plugin's page and the web app.
const READ = `
  window.__panel = () => {
    const box = (element) => {
      if (!element) return null
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    const editor = document.querySelector('.excalidraw')
    const side = document.querySelector('.excalidraw .sidebar.sheet-sidebar')
    const field = document.querySelector('.math-element__field')
    const active = side?.querySelector('.sheet-tab[data-state="active"]')
    return {
      editor: box(editor),
      // Excalidraw's own variable, as its container computes it.
      variable: parseFloat(getComputedStyle(editor).getPropertyValue('--right-sidebar-width')),
      panel: box(side),
      // Docked, Excalidraw's UI layer gives the panel its room and its header offers "Keep sidebar open".
      layer: box(document.querySelector('.layer-ui__wrapper')),
      dock: !!side?.querySelector('[data-testid="sidebar-dock"]'),
      close: box(side?.querySelector('[data-testid="sidebar-close"]')),
      handle: box(side?.querySelector('.sheet-sidebar__resize')),
      tab: active?.getAttribute('title') ?? null,
      tabs: [...(side?.querySelectorAll('.sheet-tab') ?? [])].map((tab) => ({
        title: tab.getAttribute('title'),
        name: tab.textContent.replace(/\\d+$/, ''),
        box: box(tab),
        icon: box(tab.querySelector('svg')),
        label: box(tab.querySelector('.sheet-tab__label')),
      })),
      headings: [...(side?.querySelectorAll('.sheet-sidebar__heading') ?? [])].filter((h) => h.offsetParent).map((h) => h.textContent),
      heading: box([...(side?.querySelectorAll('.sheet-sidebar__heading') ?? [])].find((h) => h.offsetParent)),
      field: field && { value: field.value, focused: document.activeElement === field },
      focus: document.activeElement?.className ?? null,
      element: box(document.querySelector('[data-anchor-id="calc"]')),
      undo: document.querySelector('[data-testid="button-undo"]')?.disabled ?? null,
      title: document.title,
    }
  }
  // Every control of the shown tab that the panel's edge cuts, and every box that scrolls sideways.
  window.__cut = () => {
    const side = document.querySelector('.excalidraw .sidebar.sheet-sidebar')
    const edge = side.getBoundingClientRect()
    const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || e.tagName).trim().slice(0, 30) + ' <' + e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + '>'
    const shown = [...side.querySelectorAll('button, input, select, textarea, a, table, h2, [role="tab"], [role="separator"]')].filter((e) => e.offsetParent && e.getClientRects().length)
    const cut = shown.filter((e) => {
      const r = e.getBoundingClientRect()
      // A box clipped by a scrolling parent is cut too: its own right edge past the parent's.
      let clip = edge
      for (let p = e.parentElement; p && p !== side; p = p.parentElement) {
        const style = getComputedStyle(p)
        // A condition's suggestion list and a field's own text scroll by design; nothing else may.
        if (style.overflowX !== 'visible') {
          const pr = p.getBoundingClientRect()
          clip = { left: Math.max(clip.left, pr.left), right: Math.min(clip.right, pr.right) }
        }
      }
      return r.width > 0 && (r.right > clip.right + 0.5 || r.left < clip.left - 0.5)
    })
    const sideways = [side, ...side.querySelectorAll('*')].filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1 && !e.matches('input, textarea, select, .sheet-tab, .sheet-tab__label, svg, svg *, .katex *') && getComputedStyle(e).overflowX !== 'visible')
    return { controls: shown.length, cut: cut.map(name), sideways: sideways.map(name) }
  }
  // Each chart as Chromium lays it out (section 10, Plots, M4e).
  window.__charts = () => {
    const box = (element) => {
      if (!element) return null
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    return [...document.querySelectorAll('.math-overlay > [data-anchor-id]')].filter((e) => e.querySelector('.math-element__plot-chart > svg')).map((element) => {
      const svg = element.querySelector('.math-element__plot-chart > svg')
      const frame = svg.querySelector('[aria-label="frame"]')
      return {
        id: element.getAttribute('data-anchor-id'),
        svg: box(svg),
        body: box(element.querySelector('.math-element__body')),
        texts: [...svg.querySelectorAll('text')].map((t) => ({ text: t.textContent, box: box(t) })),
        circles: [...svg.querySelectorAll('ellipse')].map(box),
        dots: [...svg.querySelectorAll('[aria-label="dot"] circle')].filter((c) => c.getAttribute('r') === '3.5').map(box),
        labels: [...svg.querySelectorAll('.plot-point-label text')].map((t) => {
          const g = t.closest('.plot-point-label')
          return { text: t.textContent, box: box(t), halo: t.getAttribute('stroke') ?? g.getAttribute('stroke'), paint: t.getAttribute('paint-order') ?? g.getAttribute('paint-order') }
        }),
        frame: !!frame,
        frameBox: box(frame) ?? box(svg),
        zero: svg.querySelectorAll('[aria-label="rule"]').length,
        grid: !!svg.querySelector('[aria-label="y-grid"]'),
        lines: svg.querySelectorAll('[aria-label="line"] path').length,
        legend: [...element.querySelectorAll('.math-element__plot-key')].map((k) => k.textContent),
        title: element.querySelector('.math-element__plot-title')?.textContent ?? null,
        filter: getComputedStyle(element.closest('.math-overlay') ?? element).filter,
      }
    })
  }
  // The Format tab's sample as it is laid out (section 4, Format tab, M4e).
  window.__sample = () => {
    const box = (element) => {
      if (!element) return null
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    const side = document.querySelector('.excalidraw .sidebar.sheet-sidebar')
    const drawing = side.querySelector('.sheet-format__drawing')
    const body = drawing.querySelector('.math-element__body.is-line-sample')
    if (!body) return null
    const row = body.querySelector('.math-element__row')
    const equation = body.querySelector('.math-element__equation')
    const result = body.querySelector('.math-element__result:not(.is-empty)')
    const table = body.querySelector('.math-element__table')
    const scaled = body.querySelector('.math-element__table-cell')
    // The equation's rows: KaTeX's top-level boxes, grouped where one starts under the row before it.
    const bases = [...(equation?.querySelectorAll('.katex-html > .base') ?? [])].map((b) => b.getBoundingClientRect()).sort((a, b) => a.top - b.top)
    const rows = []
    for (const b of bases) {
      const last = rows[rows.length - 1]
      if (last && b.top < last.bottom - 2) {
        last.bottom = Math.max(last.bottom, b.bottom)
        last.right = Math.max(last.right, b.right)
        last.left = Math.min(last.left, b.left)
      } else rows.push({ top: b.top, bottom: b.bottom, left: b.left, right: b.right })
    }
    const text = body.querySelector('.math-element__note, .math-element__raw, .math-element__comment')
    return {
      panel: box(side),
      tab: box(side.querySelector('.sheet-format')),
      drawing: box(drawing),
      client: { width: drawing.clientWidth, height: drawing.clientHeight },
      scroll: { width: drawing.scrollWidth, height: drawing.scrollHeight },
      overflow: getComputedStyle(drawing).overflowX + ' ' + getComputedStyle(drawing).overflowY,
      font: getComputedStyle(body).fontSize + '/' + getComputedStyle(body).lineHeight,
      rowMin: getComputedStyle(row).minHeight,
      rowBox: box(row),
      classes: row.className,
      rows,
      katex: equation ? getComputedStyle(equation.querySelector('.katex')).fontSize : null,
      transformed: equation ? getComputedStyle(equation).transform + ' ' + getComputedStyle(body).transform + ' ' + getComputedStyle(body).zoom : null,
      result: box(result),
      resultText: result?.getAttribute('data-text') ?? null,
      resultRule: result ? getComputedStyle(result).borderLeftWidth + ' ' + getComputedStyle(result).borderLeftStyle : null,
      note: body.querySelector('.math-element__note')?.textContent ?? null,
      text: box(text),
      charts: drawing.querySelectorAll('.math-element__plot-cell, .math-element__plot, .math-element__plot-chart').length,
      chartNote: side.querySelector('.sheet-format__chart-note')?.textContent ?? null,
      chartNoteBox: box(side.querySelector('.sheet-format__chart-note')),
      table: box(table),
      tableRows: table ? table.querySelectorAll('tbody tr').length : 0,
      tableColumns: table ? table.querySelectorAll('thead th').length : 0,
      tableWidth: table ? table.offsetWidth : 0,
      scale: scaled ? (getComputedStyle(scaled).transform === 'none' ? 1 : new DOMMatrix(getComputedStyle(scaled).transform).a) : null,
      overrides: [...side.querySelectorAll('.sheet-format__override')].map((p) => p.textContent),
      caption: side.querySelector('.sheet-format__caption')?.textContent ?? null,
    }
  }
`

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
  // \`data\` is the plugin's data.json as the last run left it: a restart of Obsidian.
  window.__start = async (sheet, manifest, data) => {
    const app = new FakeObsidian.App()
    app.vault.add(${JSON.stringify(FILE)}, sheet)
    const plugin = new module.exports.default(app, manifest)
    plugin.dataJson = data
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(FILE)}))
    window.__leaf = leaf
    window.__plugin = plugin
    window.__vault = app.vault
  }
  // What a drag must leave alone: the saves asked for, and the file's writes.
  window.__saves = () => ({ asked: window.__leaf.view.saveRequests, written: window.__vault.writes.length })
  ${READ}
</script>
</body></html>`

const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
const server = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  try {
    let body
    if (path === '/') body = page
    else if (path === '/fake-obsidian.js') body = fake.outputFiles[0].text
    else if (['/main.js', '/styles.css', '/manifest.json'].includes(path)) body = await readFile(join(dist, path))
    else if (path.startsWith('/web/')) {
      // The web app as built, under its relative base.
      const file = normalize(path.slice('/web/'.length) || 'index.html')
      if (file.startsWith('..')) throw new Error('not found')
      body = await readFile(join(web, file))
    } else throw new Error('not found')
    response.writeHead(200, { 'content-type': types[extname(path) || '.html'] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

const SOURCE = 'v_max = 3 m/s\nv = 4 m/s\nw = v'

// The sample's sheet: the lines the Format tab's sample is checked on, by index.
const SAMPLE_LINES = [
  // The true-position sheet's lines (section 15), down to its `check`.
  'dx = 0.08 mm',
  'dy = -0.05 mm',
  'T_p = 0.25 mm',
  'TP = 2 sqrt(dx^2 + dy^2) in mm',
  // Format 1: a clause moves to the line's stored format as the sheet opens.
  'check = if(TP <= T_p, "Pass", "Fail") @text-green if result == "Pass" @text-red if result == "Fail"',
  // Two roots and three fractions; the second root is longer than the box and can't break.
  'r = sqrt(2/3 + 4/5) + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + sqrt(6/7 + 12345678 * 23456789 * 34567891 * 45678912 * 56789123) + 19',
  'u = 2 m/s * 2 @bold @text-blue @text-red if u > 3 m/s # speed',
  'x = 1 .. 9',
  'plot(x, x^2), size L',
  'table(x, x^2, x^3)',
  'table(x, x^2, x^3, x^4, x^5, x^6, x^7, x^8)',
  'sqrt(',
]
const SAMPLE = { check: 4, roots: 5, rule: 6, plot: 8, table: 9, wide: 10, broken: 11 }
const sampleSheet = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'calc', type: 'rectangle', x: 40, y: 120, width: 160, height: 60, customData: { kind: 'math', source: SAMPLE_LINES.join('\n') } }],
  appState: {},
  files: {},
  excalimathpad: { format: 1 },
})
const sheet = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'calc', type: 'rectangle', x: 40, y: 120, width: 160, height: 60, customData: { kind: 'math', source: SOURCE } }],
  appState: {},
  files: {},
  excalimathpad: { format: 1 },
})

// The charts' sheet (section 10, Plots, M4e): the true-position chart at each size, a point at
// the circle's edge and at the chart's edges, the pump sheet's chart, and charts made to push text out.
const PUMP_LINES = [...(await readFile(join(root, 'docs/acceptance/pump-sizing.md'), 'utf8')).matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)]
  .filter(([, id]) => id !== '30')
  .map(([, , source]) => source)
const CHARTS = [
  { id: 'tp-S', x: 40, y: 260, side: 220, source: 'plot(dx, dy), circle T_p / 2, title "True position", size S' },
  { id: 'tp-M', x: 380, y: 260, side: 280, source: 'plot(dx, dy), circle T_p / 2, title "True position"' },
  { id: 'tp-L', x: 780, y: 260, side: 360, source: 'plot(dx, dy), circle T_p / 2, title "True position", size L' },
  { id: 'edge-circle', x: 40, y: 800, side: 280, source: 'plot(e_x, e_y), circle T_p / 2' },
  { id: 'edge-chart', x: 440, y: 800, side: 280, source: 'plot(e_x, e_y), circle T_p / 2, x -0.125 mm .. 0.125 mm' },
  { id: 'edge-top', x: 840, y: 800, side: 280, source: 'plot(e_y, e_x), circle T_p / 2, y -0.125 mm .. 0.125 mm' },
  { id: 'marks', x: 40, y: 1250, source: 't = 0 .. 10\nplot(t, t * 1.2e8 + 3e7), mark 9.9, mark 0.05, size S' },
  { id: 'direct', x: 500, y: 1250, source: 'u = 0 .. 10\nplot(u, 3 u + 1, u^2), labels direct, point (9.8, 99), size S' },
  { id: 'pump', x: 1250, y: 40, source: PUMP_LINES.join('\n') },
]
const CHART_SHEET = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [
    { id: 'calc', type: 'rectangle', x: 40, y: 40, width: 160, height: 60, customData: { kind: 'math', source: 'dx = 0.08 mm\ndy = -0.05 mm\nT_p = 0.25 mm\ne_x = 0.125 mm\ne_y = 0 mm' } },
    ...CHARTS.map(({ id, x, y, source }) => ({ id, type: 'rectangle', x, y, width: 160, height: 60, customData: { kind: 'math', source } })),
  ],
  appState: {},
  files: {},
  excalimathpad: { format: 2 },
})
const inside = (inner, outer) => !!inner && !!outer && inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
const results = []
const errors = []
if (SHOTS) await mkdir(SHOTS, { recursive: true })
const px = (n) => (n === null || n === undefined ? 'none' : Math.round(n * 10) / 10)

/** A window of `width` px on `url`, and `act` with its checks. */
async function run(where, width, act, { data = null, url = '/', height = 800 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  // The web app asks Excalidraw's CDN for its canvas fonts: nothing leaves this machine.
  await context.route((to) => !to.href.startsWith(origin), (route) => route.abort())
  const tab = await context.newPage()
  tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
  const row = (check, ok, detail = '') => results.push({ where, check, ok: !!ok, detail })
  const read = async (name) => {
    await tab.waitForTimeout(350)
    if (SHOTS && name) await tab.screenshot({ path: join(SHOTS, `${where}-${name}.png`.replaceAll(' ', '-')) })
    return tab.evaluate(() => window.__panel())
  }
  const tools = {
    tab,
    row,
    read,
    /** The plugin's page, started (again) with `data` as its data.json. */
    start: async (withData = data, text = sheet) => {
      await tab.goto(`${origin}${url}`)
      await tab.evaluate(([file, m, d]) => window.__start(file, m, d), [text, manifest, withData])
      await tab.waitForSelector('[data-anchor-id="calc"] .katex', { timeout: 30_000 })
      await tab.waitForTimeout(800)
    },
    /** Double-clicks line `line` of the element: the edit opens. */
    edit: async (line = 1) => {
      const box = await tab.locator(`[data-anchor-id="calc"] [data-line="${line}"]`).boundingBox()
      await tab.mouse.dblclick(box.x + 20, box.y + box.height / 2)
      await tab.waitForTimeout(500)
    },
    mathSettings: async () => {
      await tab.click('.App-toolbar__extra-tools-trigger')
      await tab.click('.dropdown-menu-item:has-text("Math settings")')
      await tab.waitForTimeout(300)
    },
    /** Presses the handle and moves it to where the panel is `to` px wide; `release` false keeps it held. */
    drag: async (to, { release = true } = {}) => {
      const s = await tab.evaluate(() => window.__panel())
      const y = s.handle.top + 400
      const from = s.handle.left + 3
      const target = from - (to - s.variable)
      await tab.mouse.move(from, y)
      await tab.mouse.down()
      for (let step = 1; step <= 8; step += 1) await tab.mouse.move(from + ((target - from) * step) / 8, y + step)
      if (release) await tab.mouse.up()
    },
    /** Docked: Excalidraw gives the panel its room beside the sheet and offers its dock button. */
    docked: (s) => s.panel !== null && s.dock && Math.abs(s.layer.width - (s.editor.width - s.variable)) < 1,
    floating: (s) => s.panel !== null && !s.dock && Math.abs(s.layer.width - s.editor.width) < 1,
    saves: () => tab.evaluate(() => window.__saves()),
    dataJson: () => tab.evaluate(() => window.__plugin.dataJson),
  }
  try {
    await act(tools)
  } catch (error) {
    errors.push(`${where}: the run didn't finish: ${error.message.split('\n')[0]}`)
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where}-stopped.png`.replaceAll(' ', '-')) }).catch(() => {})
  } finally {
    await context.close()
  }
}

try {
  // The acceptance widths: docked, docked, docked, and closed on an edit (floating when asked).
  for (const width of [1536, 1280, 1000, 880]) {
    await run(`${width} px`, width, async ({ tab, row, read, start, edit, mathSettings, docked, floating }) => {
      await start()
      let s = await read('launch')
      row('the panel’s width is 320 px', s.variable === 320, `--right-sidebar-width ${s.variable}`)
      if (width > 960) {
        row('the panel opens at launch, docked beside the sheet', docked(s) && s.tab === 'Variables', `panel ${s.panel ? px(s.panel.width) : 'closed'} px, UI layer ${px(s.layer.width)} of ${px(s.editor.width)}, dock button ${s.dock}`)
        row('the panel itself is 8 px narrower, at the editor’s right edge', s.panel && Math.abs(s.panel.width - 312) < 0.5 && Math.abs(s.panel.right - s.editor.right) < 0.5, s.panel && `${px(s.panel.width)} px`)
        row(
          'the six tabs are icons of 32 px with no name shown',
          s.tabs.length === 6 && s.tabs.every((t, i) => t.title === TABS[i] && t.name === TABS[i] && Math.abs(t.box.width - 32) < 0.5 && t.label.width <= 1 && t.icon.left >= t.box.left && t.icon.right <= t.box.right),
          s.tabs.map((t) => `${t.title} ${px(t.box.width)}`).join(', '),
        )
        row('the shown tab’s name is a heading over its content', s.headings.join() === 'Variables' && s.heading.left >= s.panel.left && s.heading.right <= s.panel.right, s.headings.join())
        row('Close stays in the header, inside the panel', s.close && s.close.right <= s.panel.right && s.close.left > s.tabs[5].box.right - 0.5, s.close && `Close ${px(s.close.left)}–${px(s.close.right)}, panel to ${px(s.panel.right)}`)
        await edit()
        s = await read('edit')
        row('an edit shows Format', s.field?.focused && s.tab === 'Format' && s.headings.join() === 'Format' && docked(s), `tab ${s.tab}`)
        await tab.keyboard.press('Escape')
        s = await read('after')
        row('its end puts the tab back', s.field === null && s.tab === 'Variables' && docked(s), `tab ${s.tab}`)
      } else {
        row('the panel stays closed at launch', s.panel === null)
        await edit()
        s = await read('edit')
        row('an edit opens the line and no panel', s.field?.focused && s.panel === null, `field ${JSON.stringify(s.field)}, panel ${s.panel ? 'open' : 'closed'}`)
        await tab.keyboard.press('Escape')
        await mathSettings()
        s = await read('asked')
        row('Math settings opens it floating over the sheet', floating(s) && Math.abs(s.panel.width - 312) < 0.5, `panel ${s.panel ? px(s.panel.width) : 'closed'} px, UI layer ${px(s.layer.width)} of ${px(s.editor.width)}, dock button ${s.dock}`)
        row('floating, its tabs and Close fit it too', s.close && s.close.right <= s.panel.right && s.tabs.every((t) => Math.abs(t.box.width - 32) < 0.5))
        // With the panel open, an edit from it (Format's Edit) switches it to Format.
        await tab.click('.sheet-sidebar .sheet-tab[title="Format"]')
        await tab.click('.sheet-sidebar [aria-label="Edit (Enter)"]')
        s = await read('edit from the panel')
        row('an edit with the panel open keeps it, on Format', s.field?.focused && s.tab === 'Format' && floating(s), `tab ${s.tab}`)
        await tab.keyboard.press('Escape')
        await tab.mouse.click(300, 600)
        s = await read('pressed outside')
        row('a press outside closes it', s.panel === null)
      }
    })
  }

  // The drag handle, with a line open and half typed.
  let remembered = null
  await run('drag', 1280, async ({ tab, row, read, start, edit, drag, docked, saves, dataJson }) => {
    await start()
    await edit()
    await tab.keyboard.type(' + 1 m')
    const before = await read('before')
    const savesBefore = await saves()
    row('the handle is the panel’s left edge', before.handle && Math.abs(before.handle.left - before.panel.left) < 1.5 && before.handle.width <= 16 && before.handle.height >= before.panel.height - 1, before.handle && `handle ${px(before.handle.left)}–${px(before.handle.right)}, panel from ${px(before.panel.left)}`)

    await drag(400, { release: false })
    let s = await read('held')
    row('the width follows the pointer while it is held', s.variable === 400 && Math.abs(s.panel.width - 392) < 0.5 && docked(s), `--right-sidebar-width ${s.variable}, panel ${px(s.panel.width)} px`)
    row('no width is remembered before the release', (await dataJson())?.sheetPanelWidth === undefined, JSON.stringify(await dataJson()))
    await tab.mouse.up()
    s = await read('dragged')
    row('a drag moves the panel to 400 px', s.variable === 400 && docked(s), `--right-sidebar-width ${s.variable}`)
    row('the open line stays open, with what was typed and the keyboard', s.field?.focused && s.field.value === 'v = 4 m/s + 1 m', JSON.stringify(s.field))
    const savesAfter = await saves()
    row('the drag asks for no save and writes nothing: the sheet isn’t dirty', savesAfter.asked === savesBefore.asked && savesAfter.written === savesBefore.written, `${JSON.stringify(savesBefore)} → ${JSON.stringify(savesAfter)}`)
    row('the width is in data.json', (await dataJson())?.sheetPanelWidth === 400, JSON.stringify(await dataJson()))

    await drag(700)
    s = await read('widest')
    row('480 px is the most', s.variable === 480 && Math.abs(s.panel.width - 472) < 0.5, `--right-sidebar-width ${s.variable}`)
    row('at 480 px the tabs are still 32 px', s.tabs.every((t) => Math.abs(t.box.width - 32) < 0.5), s.tabs.map((t) => px(t.box.width)).join(', '))
    await drag(100)
    s = await read('narrowest')
    row('280 px is the least', s.variable === 280 && Math.abs(s.panel.width - 272) < 0.5, `--right-sidebar-width ${s.variable}`)
    row('the line is still open after three drags', s.field?.focused && s.field.value === 'v = 4 m/s + 1 m', JSON.stringify(s.field))
    await tab.mouse.dblclick(s.handle.left + 3, s.handle.top + 300)
    s = await read('double-click')
    row('a double-click puts 320 px back, the line still open', s.variable === 320 && s.field?.focused && (await dataJson())?.sheetPanelWidth === 320, `--right-sidebar-width ${s.variable}, data.json ${JSON.stringify(await dataJson())}`)
    row('no drag asked for a save', (await saves()).asked === savesBefore.asked)

    // The keys, with the handle focused. The element is selected: Excalidraw's own ← would nudge it.
    await tab.keyboard.press('Escape')
    const rest = await read('rest')
    await tab.evaluate(() => document.querySelector('.sheet-sidebar__resize').focus())
    await tab.keyboard.press('ArrowLeft')
    s = await read('left')
    const left = s.variable
    await tab.keyboard.press('ArrowRight')
    await tab.keyboard.press('ArrowRight')
    s = await read('right')
    const right = s.variable
    row('← and → move the focused handle 16 px', left === 336 && right === 304 && s.focus.includes('sheet-sidebar__resize'), `${left}, then ${right}`)
    row('Excalidraw hears none of the keys: the selected element isn’t nudged', Math.abs(s.element.left - rest.element.left) < 0.5 && Math.abs(s.element.top - rest.element.top) < 0.5, `element at ${px(rest.element.left)} → ${px(s.element.left)}`)
    await tab.keyboard.press('Home')
    s = await read('home')
    row('Home puts 320 px back', s.variable === 320)
    await tab.keyboard.press('ArrowLeft')
    await tab.keyboard.press('ArrowLeft')
    s = await read('kept')
    remembered = await dataJson()
    row('each key’s width is remembered', remembered?.sheetPanelWidth === 352 && s.variable === 352, JSON.stringify(remembered))
    // The line's commit was the sheet's only change; the width is nowhere in the file.
    const file = await tab.evaluate(() => window.__leaf.view.getViewData())
    row('the width is never in the file', !/sheetPanel|panelWidth/i.test(file) && !file.includes('352') && file.includes('v = 4 m/s + 1 m'), `${file.length} characters`)
    // No undo step: after one more drag, a single Ctrl+Z still takes back the line's commit, the step before them all.
    await drag(300)
    await tab.evaluate(() => document.querySelector('.excalidraw').focus())
    await tab.keyboard.press('ControlOrMeta+z')
    s = await read('undone')
    const undone = await tab.evaluate(() => JSON.parse(window.__leaf.view.getViewData()).elements.find((e) => e.id === 'calc' && !e.isDeleted)?.customData.source)
    row('the drags and keys added no undo step: one Ctrl+Z takes back the line before them', undone === SOURCE && s.variable === 300, `source ${JSON.stringify(undone)}, --right-sidebar-width ${s.variable}`)
  })

  // A restart of Obsidian: the plugin reads data.json again.
  await run('restart', 1280, async ({ row, read, start, docked }) => {
    await start(remembered)
    const s = await read('launch')
    row('a restarted plugin opens the panel at the remembered width', remembered?.sheetPanelWidth === 352 && s.variable === 352 && docked(s), `--right-sidebar-width ${s.variable}`)
  })

  // The docking width follows the drag: 640 px plus the width, to Excalidraw and to the app alike.
  await run('docking', 1000, async ({ tab, row, read, start, edit, drag, docked, floating, mathSettings }) => {
    await start()
    let s = await read('launch')
    row('at 320 px a 1000 px editor docks the panel', docked(s), `UI layer ${px(s.layer.width)} of ${px(s.editor.width)}`)
    await drag(359)
    s = await read('359')
    row('at 359 px it still docks (999 px)', s.variable === 359 && docked(s), `UI layer ${px(s.layer.width)}`)
    await drag(360, { release: false })
    s = await read('360 held')
    row('at 360 px it floats (1000 px), while the handle is still held', s.variable === 360 && floating(s), `UI layer ${px(s.layer.width)} of ${px(s.editor.width)}, dock button ${s.dock}`)
    await drag(400)
    s = await read('400')
    row('the drag goes on across the docking width', s.variable === 400 && floating(s), `--right-sidebar-width ${s.variable}`)
    // The app's own decisions use the same value: floating, a press outside closes the panel and an edit opens nothing.
    await tab.mouse.click(300, 600)
    s = await read('outside')
    row('floating, a press outside closes it', s.panel === null)
    await edit()
    s = await read('edit, floating')
    row('where the panel floats, an edit opens nothing', s.field?.focused && s.panel === null)
    await tab.keyboard.press('Escape')
    await mathSettings()
    await drag(359)
    s = await read('back')
    row('dragged back to 359 px it docks again', s.variable === 359 && docked(s), `UI layer ${px(s.layer.width)}`)
    await tab.click('[data-testid="sidebar-close"]')
    await edit()
    s = await read('edit, docked')
    row('where it docks, an edit opens it on Format', s.field?.focused && s.tab === 'Format' && docked(s), `tab ${s.tab}`)
  })

  // The least width (section 17, M4e): every tab's content usable at 280 px.
  for (const least of [280, 320]) {
    await run(`${least} px panel`, 1280, async ({ tab, row, read, start, edit }) => {
      await start({ sheetPanelWidth: least })
      await edit()
      // A rule, its controls open, and a condition longer than its field.
      await tab.locator('.sheet-sidebar [aria-label="+ Add rule"]').scrollIntoViewIfNeeded()
      await tab.click('.sheet-sidebar [aria-label="+ Add rule"]')
      await tab.keyboard.type('> v_max and v < 1000000 m/s and v > 0 m/s')
      let s = await read('format')
      const size = least === 280 ? 28 : 32
      row(`the panel opens at ${least} px`, s.variable === least && Math.abs(s.panel.width - (least - 8)) < 0.5, `--right-sidebar-width ${s.variable}`)
      row(
        `the tabs are ${least === 280 ? 'about 28' : '32'} px, their icons whole`,
        s.tabs.length === 6 && s.tabs.every((t) => Math.abs(t.box.width - size) <= 1 && t.icon.left >= t.box.left - 0.5 && t.icon.right <= t.box.right + 0.5 && t.icon.width >= 17),
        s.tabs.map((t) => px(t.box.width)).join(', '),
      )
      row('Keep sidebar open and Close stay in the header, inside the panel', s.dock && s.close.right <= s.panel.right && s.close.left >= s.tabs[5].box.right - 0.5, `Close ${px(s.close.left)}–${px(s.close.right)}, panel to ${px(s.panel.right)}`)
      const format = await tab.evaluate(() => {
        const field = document.querySelector('.sheet-rules__field')
        const panel = document.querySelector('.excalidraw .sidebar.sheet-sidebar').getBoundingClientRect()
        const box = field.getBoundingClientRect()
        // A colour row wraps when its buttons stand on more than one line.
        const rows = [...document.querySelectorAll('.sheet-sidebar .sheet-format__row')].map((r) => new Set([...r.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().top))).size)
        return { inside: box.left >= panel.left && box.right <= panel.right, width: box.width, scrolls: field.scrollWidth > field.clientWidth, focused: document.activeElement === field, wrapped: rows.filter((n) => n > 1).length, rows: rows.length }
      })
      row('a rule’s condition field is inside the panel, and a long condition scrolls inside it', format.inside && format.scrolls && format.focused && format.width >= 120, `field ${px(format.width)} px wide; ${format.wrapped} of ${format.rows} rows wrap`)
      for (const name of TABS) {
        await tab.click(`.sheet-sidebar .sheet-tab[title="${name}"]`)
        if (name === 'Settings') {
          // Custom shows the kind → unit table, the widest thing in Settings.
          await tab.locator('.sheet-sidebar select').first().selectOption({ label: 'Custom' })
        }
        s = await read(name)
        const cut = await tab.evaluate(() => window.__cut())
        row(
          `${name}: no control is cut by the panel’s edge, and nothing scrolls sideways`,
          s.tab === name && s.headings.join() === name && cut.controls > 8 && cut.cut.length === 0 && cut.sideways.length === 0,
          `${cut.controls} controls${cut.cut.length ? `; cut: ${cut.cut.join(' | ')}` : ''}${cut.sideways.length ? `; scrolls: ${cut.sideways.join(' | ')}` : ''}`,
        )
      }
    }, { data: null })
  }

  // The Format tab's sample (section 4, Format tab, M4e, #199), at the panel's default and least widths.
  for (const width of [320, 280]) {
    await run(`sample ${width}`, 1280, async ({ tab, row, start, edit }) => {
      await start({ sheetPanelWidth: width }, sampleSheet)
      const inside = (inner, outer) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5
      /** Moves the edit to `line` with ↓ and ↑, and reads its sample. */
      let at = SAMPLE.check
      const sampleOf = async (line, name) => {
        for (; at < line; at += 1) await tab.keyboard.press('ArrowDown')
        for (; at > line; at -= 1) await tab.keyboard.press('ArrowUp')
        await tab.waitForTimeout(400)
        if (SHOTS) await tab.locator('.sheet-sidebar').screenshot({ path: join(SHOTS, `sample-${width}-${name}.png`) })
        return tab.evaluate(() => window.__sample())
      }
      const charts = await tab.evaluate(() => document.querySelectorAll('[data-anchor-id="calc"] .math-element__plot-cell svg').length)
      await edit(SAMPLE.check)

      // The `check` line: one row of equation, the result on the second.
      let s = await sampleOf(SAMPLE.check, 'check')
      row('the sample is 13 px with 20 px rows', s.font === '13px/20px' && s.rowMin === '20px' && Math.abs(parseFloat(s.katex) - 13 * 1.21) < 0.01, `${s.font}, rows at least ${s.rowMin}, KaTeX ${s.katex}`)
      row('its box is as wide as the panel’s content', Math.abs(s.drawing.width - s.tab.width + 20) < 1 && s.drawing.left > s.panel.left && s.drawing.right < s.panel.right, `box ${px(s.drawing.width)} px in a ${px(s.panel.width)} px panel`)
      row(
        'the check line is two rows, its result on the second',
        s.rows.length === 1 && s.result && s.result.top >= s.rows[0].bottom - 1 && s.resultText === 'Pass' && /\bis-text-green\b/.test(s.classes) && s.drawing.height <= 90,
        `equation rows ${s.rows.length} (to ${px(s.rows[0]?.right)} of ${px(s.rowBox.right)}), result at ${px(s.result?.top)} under ${px(s.rows[0]?.bottom)}, box ${px(s.drawing.height)} px high`,
      )
      row('the result keeps its rule on the left, at the row’s start', s.resultRule === '1px solid' && Math.abs(s.result.left - s.rows[0].left) < 1, `rule ${s.resultRule}, result from ${px(s.result?.left)}, equation from ${px(s.rows[0]?.left)}`)
      row('the check line needs no scrolling', s.scroll.width <= s.client.width && s.scroll.height <= s.client.height, `${s.scroll.width} × ${s.scroll.height} in ${s.client.width} × ${s.client.height}`)

      // Two roots and three fractions: wrapped after its operators, the long root scrolling sideways.
      s = await sampleOf(SAMPLE.roots, 'roots')
      const fits = s.rows.filter((r) => r.right <= s.drawing.left + s.client.width + 1)
      row('a line with two roots and three fractions wraps', s.rows.length >= 3 && fits.length >= 2, `${s.rows.length} rows, ${fits.length} inside the box`)
      row('its unbreakable part sticks out, and the box scrolls sideways', s.overflow === 'auto auto' && s.scroll.width > s.client.width + 20 && s.rows.some((r) => r.right > s.drawing.right), `${s.scroll.width} px of content in ${s.client.width} px, overflow ${s.overflow}`)
      const scrolled = await tab.evaluate(() => {
        const box = document.querySelector('.sheet-sidebar .sheet-format__drawing')
        box.scrollLeft = 100000
        const reached = box.scrollLeft
        const root = [...box.querySelectorAll('.katex-html > .base')].reduce((widest, b) => (b.getBoundingClientRect().width > widest.getBoundingClientRect().width ? b : widest))
        const end = root.getBoundingClientRect().right <= box.getBoundingClientRect().right + 1
        box.scrollLeft = 0
        return { reached, end }
      })
      row('scrolled to its end, the long root’s end is in the box', scrolled.reached > 20 && scrolled.end, `scrolled ${px(scrolled.reached)} px`)
      row('nothing is scaled down to fit', s.transformed === 'none none 1' && Math.abs(parseFloat(s.katex) - 13 * 1.21) < 0.01, `transforms ${s.transformed}, KaTeX ${s.katex}`)
      row('the box is at most about six rows high, and scrolls inside past that', s.drawing.height <= 150.5 && s.scroll.height >= s.client.height, `box ${px(s.drawing.height)} px, content ${s.scroll.height} px`)
      // The wheel over the box scrolls it: the box takes pointer events.
      const wheeled = await tab.evaluate(async () => {
        const box = document.querySelector('.sheet-sidebar .sheet-format__drawing')
        const r = box.getBoundingClientRect()
        return { over: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.sheet-format__drawing') === box }
      })
      row('the box is under the pointer, so the wheel and a finger scroll it', wheeled.over)
      row('the open line is still open, with the keyboard', await tab.evaluate(() => document.activeElement?.classList.contains('math-element__field') ?? false))

      // The stored format and a true rule, with the note; live as the line is typed.
      s = await sampleOf(SAMPLE.rule, 'rule')
      row(
        'the sample shows the stored format and a true rule, the override note under it',
        /\bis-bold\b/.test(s.classes) && /\bis-text-red\b/.test(s.classes) && s.resultText === '4 m / s' && s.note === 'speed' && s.overrides.join() === 'A rule sets the text colour while u > 3 m/s.',
        `${s.classes}; ${s.resultText}; ${s.overrides.join(' | ')}`,
      )
      const field = await tab.evaluate(() => document.querySelector('.math-element__field').value)
      row('the line’s field holds no clause: the format is stored beside it', field === 'u = 2 m/s * 2 # speed', field)
      await tab.keyboard.press('Home')
      for (let i = 0; i < 4; i += 1) await tab.keyboard.press('ArrowRight')
      await tab.keyboard.press('Delete')
      await tab.keyboard.type('1')
      s = await sampleOf(SAMPLE.rule, 'rule-typed')
      row(
        'the sample follows the line as it is typed: the rule is false, its note gone',
        /\bis-bold\b/.test(s.classes) && /\bis-text-blue\b/.test(s.classes) && !/\bis-text-red\b/.test(s.classes) && s.resultText === '2 m / s' && s.overrides.length === 0,
        `${s.classes}; ${s.resultText}; ${s.overrides.join(' | ')}`,
      )

      // A plot line: its line and the note, never the chart.
      s = await sampleOf(SAMPLE.plot, 'plot')
      row(
        'a size L plot line is its line and the note, with no chart',
        s.caption.toUpperCase().startsWith('MATH LINE') && s.rows.length >= 1 && s.charts === 0 && s.chartNote === 'Its chart is drawn on the sheet.' && s.drawing.height <= 20 * 2 + 20 && inside({ ...s.chartNoteBox, top: s.panel.top, bottom: s.panel.bottom }, s.panel),
        `${s.rows.length} row(s), ${s.charts} chart(s), note ${JSON.stringify(s.chartNote)}, box ${px(s.drawing.height)} px high`,
      )
      row('the chart is the sheet’s: one was drawn there before the line opened', charts === 1, `${charts}`)

      // A table of 3 columns and 9 rows is whole.
      s = await sampleOf(SAMPLE.table, 'table')
      row(
        'a table of 3 columns and 9 rows is whole, under its line',
        s.table && s.tableColumns === 3 && s.tableRows === 9 && inside(s.table, s.drawing) && s.rows.length === 1 && s.table.top >= s.rows[0].bottom - 1 && s.scroll.height <= s.client.height && s.scroll.width <= s.client.width && s.drawing.height <= 300.5 && s.chartNote === null,
        s.table && `table ${px(s.table.width)} × ${px(s.table.height)} px at ${px(s.scale)}, box ${px(s.drawing.width)} × ${px(s.drawing.height)} px`,
      )

      // More than three columns (section 17): the whole table, scaled down to the box, with no floor.
      s = await sampleOf(SAMPLE.wide, 'wide')
      row(
        'a table of 8 columns is scaled down to the box’s width, whole',
        s.table && s.tableColumns === 8 && s.tableRows === 9 && s.scale < 0.6 && s.tableWidth > s.client.width && inside(s.table, s.drawing) && s.scroll.height <= s.client.height && Math.abs(s.table.width - s.tableWidth * s.scale) < 1,
        s.table && `${s.tableWidth} px drawn at ${Math.round(s.scale * 100)}%: ${px(s.table.width)} × ${px(s.table.height)} px in a box ${px(s.drawing.width)} × ${px(s.drawing.height)} px`,
      )
      row('the scaled table fills the row’s width', s.table && Math.abs(s.table.right - (s.rowBox.right)) < 1.5, s.table && `table to ${px(s.table.right)}, row to ${px(s.rowBox.right)}`)

      // A line shown as source, and its error's message, wrap as text.
      s = await sampleOf(SAMPLE.broken, 'broken')
      await tab.keyboard.press('End')
      await tab.keyboard.type('1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17')
      s = await sampleOf(SAMPLE.broken, 'broken-typed')
      row(
        'a line shown as source wraps as text, and so does its error’s message',
        s.text && s.text.height > 30 && s.text.right <= s.drawing.right && s.result && s.result.right <= s.drawing.right && s.scroll.width <= s.client.width,
        s.text && `source ${px(s.text.width)} × ${px(s.text.height)} px, message ${px(s.result?.width)} × ${px(s.result?.height)} px`,
      )
    })
  }


  // The charts (section 10, Plots, M4e): nothing past the chart, a round circle, a label inside.
  for (const theme of ['light', 'dark']) {
    await run(`charts ${theme}`, 2200, async ({ tab, row, start }) => {
      await start({ theme }, CHART_SHEET)
      await tab.waitForFunction((n) => document.querySelectorAll('.math-element__plot-chart > svg').length === n, CHARTS.length, { timeout: 60_000 })
      await tab.waitForTimeout(800)
      if (SHOTS) await tab.screenshot({ path: join(SHOTS, `charts-${theme}.png`) })
      const charts = await tab.evaluate(() => window.__charts())
      const byId = Object.fromEntries(charts.map((c) => [c.id, c]))
      row('every chart is drawn', CHARTS.every(({ id }) => byId[id]), charts.map((c) => c.id).join(', '))
      row('in dark, the math darkens through the overlay’s filter', theme === 'light' ? charts.every((c) => c.filter === 'none') : charts.every((c) => c.filter !== 'none'), charts[0]?.filter)
      for (const { id, side } of CHARTS) {
        const c = byId[id]
        if (!c) continue
        const out = c.texts.filter((t) => !inside(t.box, c.svg))
        row(`${id}: no text runs past the chart`, out.length === 0, out.length ? out.map((t) => `"${t.text}" ${px(Math.max(c.svg.left - t.box.left, t.box.right - c.svg.right, c.svg.top - t.box.top, t.box.bottom - c.svg.bottom))} px out`).join('; ') : `${c.texts.length} texts in ${px(c.svg.width)} × ${px(c.svg.height)}`)
        row(`${id}: the chart is inside its element`, inside(c.svg, c.body), `chart ${px(c.svg.left)}–${px(c.svg.right)}, element ${px(c.body.left)}–${px(c.body.right)}`)
        if (side) {
          row(`${id}: square, ${side} px a side`, Math.abs(c.svg.width - side) < 0.5 && Math.abs(c.svg.height - side) < 0.5, `${px(c.svg.width)} × ${px(c.svg.height)}`)
          row(`${id}: the circle is round, its box square to a pixel`, c.circles.length > 0 && c.circles.every((e) => Math.abs(e.width - e.height) <= 1 && e.width > 20), c.circles.map((e) => `${px(e.width)} × ${px(e.height)}`).join(', '))
          row(`${id}: a frame and zero lines, no grid`, c.frame && c.zero === 2 && !c.grid, `frame ${c.frame}, zero lines ${c.zero}, grid ${c.grid}`)
          row(`${id}: the point’s label is inside the frame, haloed`, c.labels.length === 1 && c.labels.every((l) => inside(l.box, c.frameBox) && l.halo === '#ffffff' && l.paint === 'stroke'), c.labels.map((l) => `"${l.text}" ${px(l.box.left)}–${px(l.box.right)} in ${px(c.frameBox.left)}–${px(c.frameBox.right)}`).join('; '))
        }
      }
      const tp = byId['tp-M']
      row('the true-position chart: one point, its coordinates beside it, and one circle', tp && tp.dots.length === 1 && tp.circles.length === 1 && tp.labels[0]?.text === '(0.08, −0.05) mm' && (tp.labels[0].box.left > tp.dots[0].right || tp.labels[0].box.right < tp.dots[0].left) && tp.legend.length === 2 && tp.title === 'True position', tp && `label "${tp.labels[0]?.text}", legend ${tp.legend.length} rows, title ${tp.title}`)
      row('its axes are titled from its arguments', tp && tp.texts.some((t) => t.text === '↑ dy [mm]') && tp.texts.some((t) => t.text === 'dx [mm] →'), tp && tp.texts.filter((t) => /\[/.test(t.text)).map((t) => t.text).join(', '))
      // The point at the circle's edge and at the chart's edge: its label turns left, inside the frame.
      for (const id of ['edge-circle', 'edge-chart']) {
        const c = byId[id]
        const dot = c?.dots[0]
        const label = c?.labels[0]
        row(`${id}: the label is left of the point, which is at the ${id === 'edge-chart' ? 'chart’s right edge' : 'circle’s edge'}`, dot && label && label.box.right <= dot.left && inside(label.box, c.frameBox) && (id !== 'edge-chart' || Math.abs((dot.left + dot.right) / 2 - c.frameBox.right) < 1.5), dot && label && `dot at ${px((dot.left + dot.right) / 2)}, label ${px(label.box.left)}–${px(label.box.right)}, frame to ${px(c.frameBox.right)}`)
      }
      const top = byId['edge-top']
      row('a point at the chart’s top edge keeps its label inside the frame', top && top.labels[0] && inside(top.labels[0].box, top.frameBox), top?.labels[0] && `label ${px(top.labels[0].box.top)}–${px(top.labels[0].box.bottom)}, frame from ${px(top.frameBox.top)}`)
      const pump = byId.pump
      row('the pump chart keeps its size, legend, grid and mark', pump && Math.abs(pump.svg.width - 480) < 0.5 && Math.abs(pump.svg.height - 280) < 0.5 && pump.legend.length === 2 && pump.grid && !pump.frame && pump.texts.some((t) => /^Q_op = /.test(t.text)) && pump.lines === 2, pump && `${px(pump.svg.width)} × ${px(pump.svg.height)}, legend ${pump.legend.length}, grid ${pump.grid}, lines ${pump.lines}`)
    }, { data: null, height: 1700 })
  }

  // The web app: the width survives a reload, in the browser's own storage.
  await run('web', 1280, async ({ tab, row, read, drag, docked }) => {
    const open = async () => {
      await tab.goto(`${origin}/web/`)
      await tab.waitForSelector('.excalidraw .sidebar.sheet-sidebar', { timeout: 30_000 })
      await tab.evaluate((source) => new Function(source)(), READ)
      await tab.waitForTimeout(500)
    }
    await open()
    let s = await read('launch')
    row('the web app’s panel is 320 px, docked at launch', s.variable === 320 && docked(s), `--right-sidebar-width ${s.variable}`)
    await drag(416)
    s = await read('dragged')
    const stored = await tab.evaluate(() => localStorage.getItem('excalimathpad.sheetPanelWidth'))
    row('a drag is remembered in the browser’s storage', s.variable === 416 && stored === '416', `stored ${stored}`)
    row('the sheet isn’t dirty, and undo has no step', s.title === 'Untitled' && s.undo === true, `title ${s.title}, undo disabled ${s.undo}`)
    await open()
    s = await read('reloaded')
    row('the width survives a reload', s.variable === 416 && docked(s) && Math.abs(s.panel.width - 408) < 0.5, `--right-sidebar-width ${s.variable}`)
  }, { url: '/web/' })
} finally {
  await browser.close()
  server.close()
}

for (const { where, check, ok, detail } of results) {
  console.log(`${where.padEnd(13)} ${ok ? 'yes' : 'NO '}  ${check}${detail ? `  (${detail})` : ''}`)
}
const failed = results.filter(({ ok }) => !ok)
if (failed.length || errors.length || results.length === 0) {
  console.error('Panel run failed (docs/spec-v1.md section 8, Sheet panel):')
  for (const { where, check } of failed) console.error(`  - ${where}: ${check}`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log('Panel run passed: 320 px, icon tabs, the drag handle, docking by width, every tab usable at 280 px, the Format tab’s sample, and the charts.')
