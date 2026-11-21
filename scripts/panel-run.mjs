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
// - The Page row (section 11, M5, #80) in the Settings tab, at 320 and 280 px:
//   its two choices whole. The page breaks on boxes Chromium lays out
//   (section 17's check for M5): the pump sheet, its heading and its 30-row
//   table, laid out for A4 portrait and the other three pages, breaks only in
//   clean gaps, through no row, plot, table row or drawing that fits, and a
//   split table repeats its header; staggered side-by-side elements taller
//   than a page are cut at the page's bottom; a rectangle taller than a page
//   doesn't hold back a break, and a heading beside the lines does.
// - A rename from a Variables row (section 4, Renaming a name, 0.5.0, #261),
//   on the pump sheet in six elements: the ✎ opens the form with the old name
//   selected and its eight lines listed; `mu`, `plot` and `2x` are refused
//   with Rename dimmed, `m` is allowed under its amber warning and says which
//   results it would change; `rho_w` changes the eight lines in five elements
//   with every result as it was, the toast, the flash and no scroll; one
//   Ctrl+Z puts every line back and redo renames again. With an element
//   nudged first, the rename is still one step and the nudge its own before
//   it; with a line open and half typed, the line is its own step before it
//   (section 17's checks for 0.5.0, with what a key in the field costs). At
//   280 px the form fits the panel.
// - The offer on a committed line (section 4, Renaming a name, 0.5.0, #262),
//   on the same sheet with real keys: `rho` changed to `rho_w` and left with
//   ↓ shows the card, "in 7 lines", beside its line; the next line is typed
//   while it waits, and the count opens the list and keeps the line; Rename
//   commits that line first, then changes the uses with every result the
//   same; the Ctrl+Z steps come back the uses first; Keep writes nothing.
//   With the element under the docked panel at its right, and on a 640 px
//   editor, the card is under its line, clear of the open line, inside the
//   visible area; on a 2560 px window it is beside its line (section 17).
// - The Português pass (0.6.0, #293; section 8, Sheet panel, and section 14,
//   0.6.0): the 280 px panel again with Português in data.json, every tab by
//   its place, nothing cut and nothing scrolling sideways, each heading in
//   Português; Settings → Custom's options whole in their selects (in English
//   too, at 280 and 320 px: the system is named once, in Starts from); the
//   Format tab's link with its arrow on its last word's line, as Add title ↑
//   and as First line ↓ on the title; and a rule's note with its condition
//   on one line. It presses by class, role and place, never by English text,
//   and the run prints the time it adds.
// - ☰ → Language on the web (section 8, Language, 0.5.0): English at first;
//   Português shows at once with the menu still open, its texts fetched from
//   the app's own address, remembered in `localStorage`, the sheet not dirty;
//   it survives a reload, and English chosen again is remembered too.
//
// Run: `node scripts/panel-run.mjs` (`npm run test:panel`), after
// `npm run build`. PANEL_RUN_SHOTS=<folder> keeps a screenshot of each step;
// PANEL_RUN_ONLY=<name> runs only the runs whose name starts with it.

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
const ONLY = process.env.PANEL_RUN_ONLY
const TABS = ['Format', 'Symbols', 'Variables', 'Problems', 'Constants', 'Settings']
// The same tabs in Português, read to check, never pressed by (0.6.0).
const TABS_PT = ['Formato', 'Símbolos', 'Variáveis', 'Problemas', 'Constantes', 'Configurações']

const fake = await build({
  absWorkingDir: root,
  entryPoints: ['plugin/test/obsidian.ts'],
  bundle: true,
  format: 'iife',
  globalName: 'FakeObsidian',
  write: false,
  target: ['es2022'],
})

// The print pages' pure function and the overlay's row reader, as the app builds them (section 11).
const printCheck = await build({
  absWorkingDir: root,
  stdin: {
    contents: "export { printRows } from './src/overlay/printRows.ts'\nexport { printPages } from './src/print/pages.ts'",
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  format: 'iife',
  globalName: 'PrintCheck',
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
  // The rename form and the sheet's lines (section 4, Renaming a name, 0.5.0).
  window.__rename = () => {
    const box = (element) => {
      if (!element) return null
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    const side = document.querySelector('.excalidraw .sidebar.sheet-sidebar')
    const form = side?.querySelector('.sheet-rename')
    const field = form?.querySelector('.sheet-rename__field')
    const reason = form?.querySelector('.sheet-rename__reason')
    const button = (name) => [...(form?.querySelectorAll('.sheet-rename__button') ?? [])].find((b) => b.textContent === name)
    return {
      panel: box(side),
      form: box(form),
      field: field ? { value: field.value, focused: document.activeElement === field, selected: field.value.slice(field.selectionStart, field.selectionEnd), box: box(field) } : null,
      reason: reason ? { text: reason.textContent, warning: reason.classList.contains('is-warning'), color: getComputedStyle(reason).color } : null,
      counts: [...(form?.querySelectorAll('.sheet-rename__count') ?? [])].map((p) => ({ text: p.textContent, color: getComputedStyle(p).color })),
      listed: [...(form?.querySelectorAll('.sheet-rename__lines') ?? [])].map((list) => [...list.querySelectorAll('li')].map((li) => ({ where: li.querySelector('.sheet-rename__where').textContent, source: li.querySelector('.sheet-rename__source').textContent, marked: [...li.querySelectorAll('mark')].map((m) => m.textContent) }))),
      rename: button('Rename') ? { disabled: button('Rename').disabled, box: box(button('Rename')) } : null,
      cancel: box(button('Cancel')),
      rows: [...(side?.querySelectorAll('.sheet-panel__rename') ?? [])].map((b) => b.getAttribute('aria-label')),
      lines: [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((row) => ({
        id: row.closest('[data-anchor-id]').dataset.anchorId,
        line: Number(row.dataset.line),
        source: row.getAttribute('aria-label'),
        result: [row.querySelector('.math-element__result')?.dataset.text ?? '', row.querySelector('table')?.textContent ?? '', row.querySelectorAll('svg path, svg circle').length].join('|'),
        flash: row.classList.contains('is-flash'),
      })),
      boxes: Object.fromEntries([...document.querySelectorAll('[data-anchor-id]')].map((e) => [e.dataset.anchorId, box(e)])),
      toast: document.querySelector('.Toast')?.textContent ?? null,
      selection: document.querySelector('[data-math-selection]')?.dataset.mathSelection ?? null,
      openLine: document.querySelector('.math-element__field')?.value ?? null,
      focus: document.activeElement?.className ?? null,
      undo: document.querySelector('[data-testid="button-undo"]')?.disabled ?? null,
    }
  }
  // The rename's offer (section 4, The offer, on a committed line, 0.5.0): each card, and where the line field is.
  window.__offer = () => {
    const box = (element) => {
      if (!element) return null
      const { left, top, right, bottom, width, height } = element.getBoundingClientRect()
      return { left, top, right, bottom, width, height }
    }
    const field = document.querySelector('.math-element__field')
    return {
      cards: [...document.querySelectorAll('.math-offer')].map((card) => ({
        name: card.getAttribute('aria-label'),
        line: card.dataset.offer,
        text: card.querySelector('.math-offer__ask').textContent,
        box: box(card),
        listed: [...card.querySelectorAll('.math-offer__lines li')].map((li) => li.querySelector('.math-offer__where').textContent),
        results: card.querySelector('.math-offer__results')?.textContent ?? null,
        buttons: [...card.querySelectorAll('button')].map((b) => ({ name: b.textContent, focusable: b.tabIndex >= 0, box: box(b) })),
      })),
      // The fluid element's second line, where the runs change rho, and its body.
      rho: box(document.querySelector('[data-anchor-id="calc"] [data-line="1"]')),
      calc: box(document.querySelector('[data-anchor-id="calc"] .math-element__body')),
      editor: box(document.querySelector('.excalidraw')),
      panel: box(document.querySelector('.excalidraw .sidebar.sheet-sidebar')),
      openLine: field?.value ?? null,
      field: box(field),
      caret: field?.selectionStart ?? null,
      focused: document.activeElement === field && field !== null,
      sources: [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((row) => row.getAttribute('aria-label')),
      results: [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((row) => row.querySelector('.math-element__result')?.dataset.text ?? ''),
      toast: document.querySelector('.Toast')?.textContent ?? null,
    }
  }
  // What a key costs (section 17, 0.5.0): each key event to its next paint, and the tasks over 50 ms.
  window.__timing = () => {
    const seen = { events: [], long: [] }
    new PerformanceObserver((list) => list.getEntries().forEach((e) => seen.events.push({ name: e.name, duration: e.duration }))).observe({ type: 'event', durationThreshold: 16 })
    new PerformanceObserver((list) => list.getEntries().forEach((e) => seen.long.push(e.duration))).observe({ type: 'longtask' })
    window.__timed = seen
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
// The pump sheet (section 15) in six elements, in reading order: by each element's top, then its left.
const PUMP_ROWS = [...(await readFile(join(root, 'docs/acceptance/pump-sizing.md'), 'utf8')).matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, id, source]) => ({ n: id === 'c' ? 0 : parseInt(id, 10), source }))
const RENAME_ELEMENTS = [
  { id: 'calc', title: 'Fluid and pipe', x: 40, y: 40, from: 0, to: 10 },
  { id: 'fn', x: 40, y: 400, from: 11, to: 15 },
  { id: 'duty', x: 520, y: 410, from: 16, to: 23 },
  { id: 'curve', x: 40, y: 640, from: 24, to: 28 },
  { id: 'curves', x: 520, y: 700, from: 29, to: 31 },
  { id: 'suction', x: 40, y: 860, from: 32, to: 36 },
]
const RENAME_SHEET = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: RENAME_ELEMENTS.map(({ id, title, x, y, from, to }) => ({
    id,
    type: 'rectangle',
    x,
    y,
    width: 160,
    height: 60,
    customData: { kind: 'math', source: PUMP_ROWS.filter(({ n }) => n >= from && n <= to).map(({ source }) => source).join('\n'), ...(title ? { title } : {}) },
  })),
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
const timings = []
if (SHOTS) await mkdir(SHOTS, { recursive: true })
const px = (n) => (n === null || n === undefined ? 'none' : Math.round(n * 10) / 10)

/** A window of `width` px on `url`, and `act` with its checks. */
async function run(where, width, act, { data = null, url = '/', height = 800 } = {}) {
  if (ONLY && !where.startsWith(ONLY)) return
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
  const began = Date.now()
  try {
    await act(tools)
  } catch (error) {
    errors.push(`${where}: the run didn't finish: ${error.message.split('\n')[0]}`)
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where}-stopped.png`.replaceAll(' ', '-')) }).catch(() => {})
  } finally {
    await context.close()
    timings.push({ where, ms: Date.now() - began })
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
    // A value of exactly 352, not the digits anywhere: a seed or a nonce Excalidraw draws at random can hold them.
    row('the width is never in the file', !/sheetPanel|panelWidth/i.test(file) && !/"[^"]*"\s*:\s*"?352"?\s*[,}\]]/.test(file) && file.includes('v = 4 m/s + 1 m'), `${file.length} characters`)
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

  // The least width (section 17, M4e): every tab's content usable at 280 px;
  // from 0.6.0 again in Português (#293), each tab and control found by its place or class.
  for (const [least, language] of [[280, 'en'], [320, 'en'], [280, 'pt-BR']]) {
    const names = language === 'pt-BR' ? TABS_PT : TABS
    await run(`${least} px panel${language === 'en' ? '' : ` ${language}`}`, 1280, async ({ tab, row, read, start, edit }) => {
      await start({ sheetPanelWidth: least, ...(language === 'en' ? {} : { language }) })
      await edit()
      // A rule, its controls open, and a condition longer than its field.
      await tab.locator('.sheet-sidebar .sheet-rules__add').scrollIntoViewIfNeeded()
      await tab.click('.sheet-sidebar .sheet-rules__add')
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
      for (const [index, name] of names.entries()) {
        await tab.click(`.sheet-sidebar .sheet-tab >> nth=${index}`)
        if (index === 5) {
          // Custom shows the kind → unit table, the widest thing in Settings.
          await tab.locator('.sheet-sidebar select').first().selectOption('custom')
          // The Page row (section 11, M5): its longest choices, whole in their boxes.
          await tab.locator('.sheet-sidebar .sheet-settings__page select').first().selectOption('Letter')
          await tab.locator('.sheet-sidebar .sheet-settings__page select').nth(1).selectOption('landscape')
          const fit = await tab.evaluate(() => {
            const measure = document.createElement('canvas').getContext('2d')
            return [...document.querySelectorAll('.sheet-sidebar .sheet-settings__page select')].map((select) => {
              measure.font = getComputedStyle(select).font
              const text = measure.measureText(select.selectedOptions[0].textContent).width
              const side = select.getBoundingClientRect()
              const panel = document.querySelector('.excalidraw .sidebar.sheet-sidebar').getBoundingClientRect()
              return { label: select.getAttribute('aria-label'), width: select.clientWidth, text, inside: side.left >= panel.left && side.right <= panel.right }
            })
          })
          row(
            'the Page row’s two choices are whole: Letter, Landscape',
            fit.length === 2 && fit.every((f) => f.inside && f.width >= f.text + 36),
            fit.map((f) => `${f.label} ${px(f.width)} px for ${px(f.text)} px of text`).join(', '),
          )
          // Custom's options (0.6.0, section 5, Unit systems): each kind's units only, whole in its select.
          const kinds = await tab.evaluate(() => {
            const measure = document.createElement('canvas').getContext('2d')
            const panel = document.querySelector('.excalidraw .sidebar.sheet-sidebar').getBoundingClientRect()
            return [...document.querySelectorAll('.sheet-sidebar .sheet-settings__kinds select')].map((select) => {
              measure.font = getComputedStyle(select).font
              const box = select.getBoundingClientRect()
              const option = select.options[0].textContent
              return { option, text: measure.measureText(option).width, width: select.clientWidth, inside: box.left >= panel.left && box.right <= panel.right }
            })
          })
          const cut = kinds.filter((k) => !k.inside || k.width < k.text + 36)
          row(
            'Custom: every kind’s default option shows its units only, whole in its select',
            kinds.length === 18 && cut.length === 0 && kinds.every((k) => !/:/.test(k.option)),
            cut.length ? cut.map((k) => `${k.option} ${px(k.text)} px in ${k.width} px`).join(', ') : `${kinds.length} selects, the narrowest ${Math.min(...kinds.map((k) => k.width))} px`,
          )
        }
        s = await read(name)
        const cut = await tab.evaluate(() => window.__cut())
        row(
          `${name}: no control is cut by the panel’s edge, and nothing scrolls sideways`,
          s.tab === name && s.headings.join() === name && cut.controls > 8 && cut.cut.length === 0 && cut.sideways.length === 0,
          `${cut.controls} controls${cut.cut.length ? `; cut: ${cut.cut.join(' | ')}` : ''}${cut.sideways.length ? `; scrolls: ${cut.sideways.join(' | ')}` : ''}`,
        )
      }
      if (language === 'en') return
      // The Format tab's link row and a rule's note (section 8, Longer text wraps), in Português at 280 px.
      await tab.click('.sheet-sidebar .sheet-tab >> nth=0')
      // The rule's condition, shorter, so the note can hold it on one line: `v > 3 m/s`, true.
      const condition = tab.locator('.sheet-sidebar .sheet-rules__field').first()
      await condition.click()
      await tab.keyboard.press('ControlOrMeta+a')
      await tab.keyboard.type('v > 3 m/s')
      await tab.keyboard.press('Enter')
      await tab.waitForTimeout(500)
      const fits = () =>
        tab.evaluate(() => {
          const panel = document.querySelector('.excalidraw .sidebar.sheet-sidebar').getBoundingClientRect()
          const button = document.querySelector('.sheet-sidebar .sheet-format__link')
          const text = button.firstChild
          const rectOf = (from, to) => {
            const range = document.createRange()
            range.setStart(text, from)
            range.setEnd(text, to)
            return range.getBoundingClientRect()
          }
          const value = text.textContent
          const link = button.getBoundingClientRect()
          const p = document.querySelector('.sheet-sidebar .sheet-format__override')
          const whole = p?.querySelector('.sheet-panel__whole')
          const lineHeight = p ? parseFloat(getComputedStyle(p).lineHeight) || parseFloat(getComputedStyle(p).fontSize) * 1.3 : 0
          return {
            link: value,
            together: Math.abs(rectOf(value.length - 1, value.length).top - rectOf(value.length - 3, value.length - 2).top) < 2,
            linkInside: link.left >= panel.left - 0.5 && link.right <= panel.right + 0.5,
            note: p?.textContent ?? null,
            noteLines: whole ? Math.round(whole.getBoundingClientRect().height / lineHeight) : 0,
            noteInside: whole ? whole.getBoundingClientRect().right <= panel.right + 0.5 : false,
          }
        })
      let f = await fits()
      row('the link keeps its arrow with its last word: Adicionar título ↑', f.link === 'Adicionar título\u00a0↑' && f.together && f.linkInside, f.link)
      row(
        'a rule’s note keeps its condition on one line: … enquanto v > 3 m/s.',
        /^Uma regra define .+ enquanto v > 3 m\/s\.$/.test(f.note ?? '') && f.noteLines === 1 && f.noteInside,
        `${f.note} (${f.noteLines} line)`,
      )
      // The link moves the edit to the title, whose link is First line ↓.
      await tab.click('.sheet-sidebar .sheet-format__link')
      await tab.waitForTimeout(500)
      f = await fits()
      row('on the title, the link keeps its arrow too: Primeira linha ↓', f.link === 'Primeira linha\u00a0↓' && f.together && f.linkInside, f.link)
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

  // The page breaks on boxes Chromium lays out (section 11, Page breaks; section 17's check for M5).
  await run('breaks', 1280, async ({ tab, row, start }) => {
    const A4 = { size: 'A4', orientation: 'portrait' }
    const PAGES = [A4, { size: 'A4', orientation: 'landscape' }, { size: 'Letter', orientation: 'portrait' }, { size: 'Letter', orientation: 'landscape' }]
    /** The sheet open in the view, its boxes measured, and its pages for each Page. */
    const measure = async (text, ids) => {
      await start(null, text)
      for (const id of ids) await tab.waitForSelector(`[data-anchor-id="${id}"] .katex`, { timeout: 30_000 })
      await tab.waitForTimeout(1500)
      await tab.addScriptTag({ content: printCheck.outputFiles[0].text })
      return tab.evaluate((pages) => {
        const scene = JSON.parse(window.__leaf.view.getViewData())
        const live = scene.elements.filter((e) => !e.isDeleted)
        const drawings = live.filter((e) => e.customData?.kind !== 'math').map(({ id, type, x, y, width, height }) => ({ id, type, x, y, width, height }))
        const elements = live.filter((e) => e.customData?.kind === 'math').map((e) => {
          const body = document.querySelector(`.math-overlay > [data-anchor-id="${e.id}"] .math-element__body`)
          // The anchor's size is the body's (section 4, Size); the body is what is laid out.
          return { id: e.id, x: e.x, y: e.y, width: body.offsetWidth, height: body.offsetHeight, angle: e.angle, rows: window.PrintCheck.printRows(body) }
        })
        return {
          drawings,
          elements,
          charts: document.querySelectorAll('.math-element__plot-chart > svg').length,
          layouts: pages.map((page) => window.PrintCheck.printPages({ drawings, elements, page })),
        }
      }, PAGES)
    }
    /** What a break at `y` passes through: rows, and drawings that fit a page. */
    const through = (y, { drawings, elements }, layout) => {
      const tall = layout.room.height / layout.scale
      const rows = elements.flatMap((e) => e.rows.map((r) => ({ name: `${e.id} ${r.kind} ${r.line}`, top: e.y + r.top, bottom: e.y + r.top + r.height })))
      const fits = drawings.filter((d) => d.height <= tall).map((d) => ({ name: `${d.type} ${d.id}`, top: d.y, bottom: d.y + d.height }))
      return [...rows, ...fits].filter((b) => b.top + 0.5 < y && y < b.bottom - 0.5).map((b) => b.name)
    }
    const name = (page) => `${page.size} ${page.orientation}`
    const breaksOf = (layout) => layout.pages.slice(0, -1).map((p) => px(p.bottom))

    // The pump sheet (section 15): its heading, Excalidraw text, over one element with every line.
    const PUMP_ALL = [...(await readFile(join(root, 'docs/acceptance/pump-sizing.md'), 'utf8')).matchAll(/^\| (c|\d+[a-z]?) \| `(.+?)` \|/gm)].map(([, , source]) => source)
    const pump = await measure(JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        { id: 'heading', type: 'text', x: 40, y: 40, width: 160, height: 35, text: 'Pump sizing', originalText: 'Pump sizing', fontSize: 28, fontFamily: 6, textAlign: 'left', verticalAlign: 'top', lineHeight: 1.25 },
        { id: 'calc', type: 'rectangle', x: 40, y: 100, width: 160, height: 60, customData: { kind: 'math', source: PUMP_ALL.join('\n') } },
      ],
      appState: {},
      files: {},
      excalimathpad: { format: 2 },
    }), ['calc'])
    const calc = pump.elements[0]
    const tableRows = calc.rows.filter((r) => r.kind === 'table-row').length
    row(
      'the pump sheet is measured: every line, the table’s header and 30 rows, the plot',
      calc.rows.filter((r) => r.kind === 'line' || r.kind === 'comment' || r.kind === 'plot').length === PUMP_ALL.length && tableRows === 30 && calc.rows.some((r) => r.kind === 'table-header') && calc.rows.some((r) => r.kind === 'plot') && pump.charts === 1,
      `${calc.rows.length} rows, ${tableRows} table rows, ${px(calc.height)} units tall`,
    )
    for (const [i, layout] of pump.layouts.entries()) {
      const cuts = layout.pages.slice(0, -1).map((p) => ({ y: p.bottom, through: through(p.bottom, pump, layout), end: p.end }))
      const tall = layout.room.height / layout.scale
      row(
        `pump sheet, ${name(PAGES[i])}: ${layout.pages.length} pages, every break in a clean gap, through no unbreakable box`,
        layout.pages.length >= 2 && cuts.every((c) => c.end === 'gap' && c.through.length === 0) && layout.pages.every((p) => p.bottom - p.top + p.headerRoom <= tall + 0.01) && layout.pages.at(-1).bottom === layout.content.y + layout.content.height,
        `scale ${px(layout.scale)}, breaks at ${breaksOf(layout).join(', ')}${cuts.some((c) => c.through.length) ? `; through ${cuts.flatMap((c) => c.through).join(' | ')}` : ''}`,
      )
      // A break between table rows repeats the header on the next page, and only then.
      const table = calc.rows.filter((r) => r.kind === 'table-row').map((r) => ({ top: calc.y + r.top, bottom: calc.y + r.top + r.height }))
      const splits = layout.pages.slice(0, -1).map((p) => table.some((r) => r.bottom <= p.bottom + 0.5) && table.some((r) => r.top >= p.bottom - 0.5))
      row(
        `pump sheet, ${name(PAGES[i])}: a page after a break in the table repeats its header, and no other does`,
        layout.pages.slice(1).every((p, k) => (p.headers.length === 1) === splits[k]),
        `${splits.filter(Boolean).length} breaks in the table`,
      )
    }

    // Staggered side-by-side elements taller than a page: no clean gap, so a cut at the page's bottom.
    const staggered = Array.from({ length: 60 }, (_, i) => `a_${i} = ${i} m`).join('\n')
    const stagger = await measure(JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        { id: 'calc', type: 'rectangle', x: 40, y: 40, width: 160, height: 60, customData: { kind: 'math', source: staggered } },
        { id: 'right', type: 'rectangle', x: 300, y: 52, width: 160, height: 60, customData: { kind: 'math', source: staggered.replaceAll('a_', 'b_') } },
      ],
      appState: {},
      files: {},
      excalimathpad: { format: 2 },
    }), ['calc', 'right'])
    const heights = [...new Set(stagger.elements.flatMap((e) => e.rows.map((r) => px(r.height))))]
    const a4 = stagger.layouts[0]
    row(
      'staggered side-by-side elements taller than a page are cut at the page’s bottom',
      stagger.elements.every((e) => e.rows.length === 60 && e.height > a4.room.height) && a4.pages[0].end === 'cut' && Math.abs(a4.pages[0].bottom - (a4.pages[0].top + a4.room.height)) < 0.01 && a4.pages[1].top === a4.pages[0].bottom,
      `rows ${heights.join(', ')} units tall; page 1 from ${px(a4.pages[0].top)} to ${px(a4.pages[0].bottom)}, ${a4.pages[0].end}`,
    )

    // A rectangle taller than a page doesn't hold back the break; a heading beside the lines does.
    const framed = await measure(JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        { id: 'frame', type: 'rectangle', x: 0, y: 0, width: 600, height: 1700 },
        { id: 'calc', type: 'rectangle', x: 20, y: 20, width: 160, height: 60, customData: { kind: 'math', source: staggered } },
        { id: 'heading', type: 'text', x: 360, y: 960, width: 160, height: 35, text: 'Pump sizing', originalText: 'Pump sizing', fontSize: 28, fontFamily: 6, textAlign: 'left', verticalAlign: 'top', lineHeight: 1.25 },
      ],
      appState: {},
      files: {},
      excalimathpad: { format: 2 },
    }), ['calc'])
    const f = framed.layouts[0]
    const heading = framed.drawings.find((d) => d.id === 'heading')
    const first = f.pages[0].bottom
    row(
      'a rectangle taller than a page is cut; the break moves up above the heading beside the lines, to a gap between rows',
      f.pages[0].end === 'gap' && first <= heading.y + 0.5 && first > heading.y - 40 && through(first, framed, f).length === 0 && f.pages.length >= 2,
      `heading ${px(heading.y)} to ${px(heading.y + heading.height)}, break at ${px(first)}`,
    )
  }, { data: null, height: 1700 })

  // A rename from a Variables row (section 4, Renaming a name, 0.5.0, #261), on the pump sheet.
  await run('rename', 1280, async ({ tab, row, start }) => {
    await start(null, RENAME_SHEET)
    await tab.waitForFunction(() => document.querySelectorAll('.math-element__plot-chart > svg').length === 1, null, { timeout: 60_000 })
    await tab.waitForTimeout(500)
    const shot = async (name) => SHOTS && (await tab.screenshot({ path: join(SHOTS, `rename-${name}.png`) }))
    const read = async (name, wait = 350) => {
      await tab.waitForTimeout(wait)
      if (name) await shot(name)
      return tab.evaluate(() => window.__rename())
    }
    const pencil = (name) => tab.locator(`.sheet-sidebar [aria-label="Rename ${name}"]`).first()
    const retype = async (text) => {
      await tab.keyboard.press('Control+A')
      await tab.keyboard.type(text, { delay: 120 })
    }
    const sources = (s) => s.lines.map((l) => l.source)
    const results = (s) => s.lines.map((l) => l.result)
    const holding = (s, name) => s.lines.filter((l) => new RegExp(`(^|[^\\w])${name}(?![\\w])`).test(l.source.split('#')[0]))
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    // Where each element is: a renamed line can change a box's size, never its place.
    const places = (s) => Object.entries(s.boxes).map(([id, box]) => [id, px(box.left), px(box.top)])

    const before = await read('launch')
    row('the pump sheet is up in six elements, each row of Variables ending in a ✎', Object.keys(before.boxes).length === 6 && before.rows.includes('Rename rho') && before.rows.includes('Rename Hs') && before.rows.length >= 30, `${before.rows.length} rows`)
    await pencil('rho').click()
    let s = await read('form')
    row('the ✎ opens the form under its row, inside the panel, and doesn’t jump', s.form && inside(s.form, s.panel) && s.selection === null && !s.lines.some((l) => l.flash) && same(s.boxes, before.boxes), s.form && `form ${px(s.form.left)}–${px(s.form.right)}, panel ${px(s.panel.left)}–${px(s.panel.right)}`)
    row('its field has the keyboard, the old name in it, selected', s.field?.focused && s.field.value === 'rho' && s.field.selected === 'rho')
    const listed = s.listed[0] ?? []
    row(
      'it lists the eight lines it changes, by element, the name marked',
      s.counts[0]?.text === 'Changes 8 lines:' && listed.length === 8 && listed[0].where === 'Fluid and pipe, line 2' && listed[0].source === 'rho = 998.2 kg/m^3' && listed.every((l) => l.marked.length >= 1 && l.marked.every((m) => m === 'rho')) && new Set(listed.map((l) => l.where.split(',')[0])).size === 5,
      listed.map((l) => l.where).join(' | '),
    )
    row('the old name dims Rename and says nothing', s.rename?.disabled && s.reason === null)

    // What a key in the field costs (section 17, 0.5.0): the engine runs twice for each.
    await tab.evaluate(() => window.__timing())
    await retype('rho_w')
    s = await read('typed')
    const timed = await tab.evaluate(() => window.__timed)
    const keys = timed.events.filter((e) => e.name === 'keydown' || e.name === 'input' || e.name === 'keypress').map((e) => e.duration)
    row(
      'a new name: Rename is enabled, and no result would change',
      s.field?.value === 'rho_w' && s.rename && !s.rename.disabled && s.reason === null && s.counts.length === 1,
      `a key to its paint: ${keys.length ? `at most ${Math.max(...keys)} ms over ${keys.length} slow events` : 'under 16 ms each'}; tasks over 50 ms: ${timed.long.length ? timed.long.map((d) => Math.round(d)).join(', ') + ' ms' : 'none'}`,
    )
    row('nothing is written until Rename', same(sources(s), sources(before)) && s.undo === true)

    for (const [name, reason] of [['mu', 'mu is already a name on this sheet.'], ['plot', 'plot is reserved.'], ['2x', "2x isn't a name."]]) {
      await retype(name)
      s = await read(`refused ${name}`)
      row(`${name} is refused: Rename dimmed, the reason under the field`, s.rename?.disabled && s.reason?.text === reason && !s.reason.warning && s.reason.color === 'rgb(224, 49, 49)', s.reason?.text)
    }
    await retype('m')
    s = await read('shadow')
    const changing = s.listed[1] ?? []
    row('m is allowed: the amber shadow warning, Rename enabled', s.rename && !s.rename.disabled && s.reason?.text === '⚠ m shadows the unit m' && s.reason.warning && s.reason.color === 'rgb(232, 89, 12)', s.reason?.text)
    row('a rename that changes results says which lines, in amber, Rename enabled', /^This changes \d+ results:$/.test(s.counts[1]?.text ?? '') && s.counts[1].color === 'rgb(232, 89, 12)' && changing.length > 1 && changing.some((l) => l.source === 'L_p = 150 m') && !s.rename.disabled, `${s.counts[1]?.text} ${changing.slice(0, 4).map((l) => l.where).join(' | ')}…`)
    row('typing and Ctrl+A in the field reached nothing else', s.selection === null && s.openLine === null && same(sources(s), sources(before)) && s.field?.focused)

    await retype('rho_w')
    await tab.locator('.sheet-rename__button', { hasText: 'Rename' }).click()
    s = await read('renamed', 150)
    const renamed = holding(s, 'rho_w')
    row('Rename changes its eight lines, in the five elements they are in', renamed.length === 8 && new Set(renamed.map((l) => l.id)).size === 5 && holding(s, 'rho').length === 0 && sources(s).filter((line, i) => line !== sources(before)[i]).length === 8, renamed.map((l) => `${l.id} ${l.line + 1}`).join(', '))
    row('every result is as it was', same(results(s), results(before)))
    row('the toast says so', s.toast === 'Renamed rho to rho_w in 8 lines. Ctrl+Z takes it back.', s.toast)
    row('every changed line flashes where it is, and no other', s.lines.filter((l) => l.flash).length === 8 && s.lines.every((l) => l.flash === renamed.includes(l)), `${s.lines.filter((l) => l.flash).length} lines flash`)
    row('the view doesn’t scroll, and nothing is selected', same(places(s), places(before)) && s.selection === null, `selection ${s.selection}`)
    row('the form closes, and its row shows the new name', s.form === null && s.rows.includes('Rename rho_w') && !s.rows.includes('Rename rho'))
    s = await read('flash over', 1600)
    row('the flash is over after about 1.5 s', !s.lines.some((l) => l.flash))

    await tab.keyboard.press('Control+Z')
    s = await read('undone')
    row('one Ctrl+Z puts every line back', same(sources(s), sources(before)) && same(results(s), results(before)) && s.undo === true)
    row('undoing shows nothing extra: no flash, no selection', !s.lines.some((l) => l.flash) && s.selection === null)
    // Excalidraw takes Ctrl+Y on Windows only; this Chromium isn't Windows, so redo's other key.
    await tab.keyboard.press('Control+Shift+Z')
    s = await read('redone')
    row('redo (Ctrl+Y on Windows, Ctrl+Shift+Z here) renames again', holding(s, 'rho_w').length === 8 && holding(s, 'rho').length === 0 && same(results(s), results(before)))
    await tab.keyboard.press('Control+Z')

    // Section 17, 0.5.0: an anchor nudged and not yet recorded, then a rename that changes it.
    // The first element is the one the open panel leaves in view.
    const first = before.boxes.calc
    await tab.mouse.click(first.left + 6, first.top + 6)
    await tab.keyboard.press('ArrowRight')
    s = await read('nudged')
    const nudged = s.boxes.calc.left - first.left
    row('an element is nudged with the arrow key', s.selection === 'one' && nudged >= 0.5, `${px(nudged)} px`)
    await pencil('rho').click()
    await retype('rho_w')
    await tab.keyboard.press('Enter')
    s = await read('renamed after a nudge')
    row('Enter renames, and the form closes', holding(s, 'rho_w').length === 8 && s.form === null && s.openLine === null)
    await tab.keyboard.press('Control+Z')
    s = await read('nudge kept')
    row('after a nudge, one Ctrl+Z still puts every line back, the element where the nudge left it', same(sources(s), sources(before)) && Math.abs(s.boxes.calc.left - first.left - nudged) < 0.01, `${px(s.boxes.calc.left - first.left)} px`)
    await tab.keyboard.press('Control+Z')
    s = await read('nudge undone')
    row('the next Ctrl+Z takes the nudge back: its own step, before the rename’s', same(sources(s), sources(before)) && Math.abs(s.boxes.calc.left - first.left) < 0.01, `${px(s.boxes.calc.left - first.left)} px`)

    // A line open and half typed: the form's field leaves it, as its own step before the rename's.
    await tab.keyboard.press('Escape')
    const line = await tab.locator('[data-anchor-id="calc"] [data-line="4"]').boundingBox()
    await tab.mouse.dblclick(line.x + 20, line.y + line.height / 2)
    await tab.waitForTimeout(500)
    await tab.keyboard.type(' + 1 m')
    await tab.click('.sheet-sidebar .sheet-tab[title="Variables"]')
    s = await read('line open')
    row('a line is open and half typed, with Variables shown', s.openLine === 'L_p = 150 m + 1 m' && s.rows.includes('Rename rho'), s.openLine)
    await pencil('rho').click()
    s = await read('line left')
    row('the ✎’s field takes the keyboard, and the line is left and written', s.field?.focused && s.openLine === null && s.lines.some((l) => l.source === 'L_p = 150 m + 1 m'))
    await retype('rho_w')
    await tab.keyboard.press('Enter')
    s = await read('renamed after a line')
    row('the rename is written', holding(s, 'rho_w').length === 8)
    await tab.keyboard.press('Control+Z')
    s = await read('rename undone')
    row('Ctrl+Z takes the rename back and keeps the line', holding(s, 'rho_w').length === 0 && s.lines.some((l) => l.source === 'L_p = 150 m + 1 m'))
    await tab.keyboard.press('Control+Z')
    s = await read('line undone')
    row('the next Ctrl+Z takes the line back: its own step, before the rename’s', same(sources(s), sources(before)))

    // Esc cancels, and reaches nothing else.
    await pencil('rho').click()
    await retype('rho_w')
    await tab.keyboard.press('Escape')
    s = await read('cancelled')
    row('Esc cancels: the form closes and nothing is written', s.form === null && same(sources(s), sources(before)))
  })

  // The offer on a committed line (section 4, Renaming a name, 0.5.0, #262), on the pump sheet with real keys.
  await run('offer', 1280, async ({ tab, row, start }) => {
    await start(null, RENAME_SHEET)
    await tab.waitForFunction(() => document.querySelectorAll('.math-element__plot-chart > svg').length === 1, null, { timeout: 60_000 })
    await tab.waitForTimeout(500)
    const read = async (name, wait = 400) => {
      await tab.waitForTimeout(wait)
      if (SHOTS && name) await tab.screenshot({ path: join(SHOTS, `offer-${name}.png`) })
      return tab.evaluate(() => window.__offer())
    }
    const holding = (s, name) => s.sources.filter((line) => new RegExp(`(^|[^\\w])${name}(?![\\w])`).test(line.split('#')[0]))
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
    const openRho = async () => {
      const line = await tab.locator('[data-anchor-id="calc"] [data-line="1"]').boundingBox()
      await tab.mouse.dblclick(line.x + 20, line.y + line.height / 2)
      await tab.waitForTimeout(500)
      // `rho = 998.2 kg/m^3`: the caret to the name's end, then `_w`.
      await tab.keyboard.press('Home')
      for (let i = 0; i < 3; i += 1) await tab.keyboard.press('ArrowRight')
      await tab.keyboard.type('_w', { delay: 80 })
    }
    const before = await read('launch')
    row('the pump sheet is up, and no card shows', before.cards.length === 0 && holding(before, 'rho').length === 8, `${holding(before, 'rho').length} lines hold rho`)

    await openRho()
    await tab.keyboard.press('ArrowDown')
    let s = await read('card')
    const [card] = s.cards
    row('rho changed to rho_w in its line and left with ↓ shows the card, with its count', s.cards.length === 1 && card.text === 'Rename rho to rho_w in 7 lines?' && card.name === 'Rename rho to rho_w in 7 lines?', card?.text)
    row('Rename and Keep rho, neither in the tab order', same(card?.buttons.map((b) => b.name), ['in 7 lines', 'Rename', 'Keep rho']) && card.buttons.every((b) => !b.focusable))
    const rowBox = s.rho
    const body = s.calc
    const field = s.field
    const clear = (a, b) => !b || a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom
    row(
      'the element runs under the panel, so the card is under its line, inside the visible area and clear of the open line',
      card && card.box.top >= rowBox.bottom - 0.5 && card.box.right <= s.panel.left + 0.5 && card.box.left >= s.editor.left && clear(card.box, field),
      card && `card ${px(card.box.left)}–${px(card.box.right)} at ${px(card.box.top)}, row ends ${px(rowBox.bottom)}, open line ${px(field?.top)}–${px(field?.bottom)}, panel from ${px(s.panel.left)}`,
    )
    row('the next line is open, with the keyboard', s.openLine === 'mu = 1.002 cP' && s.focused, s.openLine)
    await tab.keyboard.press('End')
    await tab.keyboard.type(' * 1', { delay: 80 })
    await tab.locator('.math-offer__count').click()
    s = await read('list')
    row('the next line is typed while the card waits; the count opens the list and keeps the line', s.cards.length === 1 && s.openLine === 'mu = 1.002 cP * 1' && s.focused && s.caret === s.openLine.length && s.cards[0].listed.length === 7 && !s.cards[0].listed.includes('Fluid and pipe, line 2'), s.cards[0]?.listed.slice(0, 2).join(' | '))
    await tab.locator('.math-offer__button', { hasText: 'Rename' }).click()
    s = await read('renamed', 600)
    row('Rename commits the open line, then changes the uses; no line is open', holding(s, 'rho_w').length === 8 && holding(s, 'rho').length === 0 && s.sources.includes('mu = 1.002 cP * 1') && s.openLine === null && s.cards.length === 0, `${holding(s, 'rho_w').length} lines hold rho_w`)
    // `mu`'s line, typed `* 1`, is no longer a plain input and shows its value.
    const others = (t) => t.results.filter((_, i) => t.sources[i] !== 'mu = 1.002 cP * 1' && t.sources[i] !== 'mu = 1.002 cP')
    row('every other result is as it was', same(others(s), others(before)))
    row('the toast says so', s.toast === 'Renamed rho to rho_w in 7 lines. Ctrl+Z takes it back.', s.toast)
    await tab.keyboard.press('Control+Z')
    s = await read('undo uses')
    row('the first Ctrl+Z puts the uses back', holding(s, 'rho_w').length === 1 && holding(s, 'rho').length === 7 && s.sources.includes('mu = 1.002 cP * 1'))
    await tab.keyboard.press('Control+Z')
    s = await read('undo next line')
    row('the next takes back the line typed while the card waited', s.sources.includes('mu = 1.002 cP') && holding(s, 'rho_w').length === 1)
    await tab.keyboard.press('Control+Z')
    s = await read('undo line')
    row('the next puts the name back', same(s.sources, before.sources))

    // Without a second line typed: two Ctrl+Z put the sheet back, the uses first.
    await openRho()
    await tab.keyboard.press('Escape')
    s = await read('esc')
    row('Esc makes the offer too', s.cards.length === 1 && s.cards[0].text === 'Rename rho to rho_w in 7 lines?')
    await tab.locator('.math-offer__button', { hasText: 'Rename' }).click()
    s = await read('renamed again', 600)
    row('Rename renames', holding(s, 'rho_w').length === 8)
    await tab.keyboard.press('Control+Z')
    s = await read('undo 1')
    const usesBack = holding(s, 'rho_w').length === 1 && holding(s, 'rho').length === 7
    await tab.keyboard.press('Control+Z')
    s = await read('undo 2')
    row('two Ctrl+Z put the sheet back, the uses first', usesBack && same(s.sources, before.sources))

    // Keep writes nothing; the card goes.
    await openRho()
    await tab.keyboard.press('ArrowDown')
    await read()
    await tab.locator('.math-offer__button', { hasText: 'Keep rho' }).click()
    s = await read('kept')
    row('Keep writes nothing, the card goes, the line stays open', s.cards.length === 0 && holding(s, 'rho').length === 7 && s.openLine === 'mu = 1.002 cP' && s.focused)
    await tab.keyboard.press('Escape')
    await tab.keyboard.press('Control+Z')
    await read()
  })

  // Section 17, 0.5.0: the card on a wide window, beside its element, and on a narrow editor, under its line.
  for (const [where, width] of [['offer wide', 2560], ['offer narrow', 640]]) {
    await run(where, width, async ({ tab, row, start }) => {
      await start(null, RENAME_SHEET)
      await tab.waitForTimeout(500)
      const line = await tab.locator('[data-anchor-id="calc"] [data-line="1"]').boundingBox()
      await tab.mouse.dblclick(line.x + 20, line.y + line.height / 2)
      await tab.waitForTimeout(500)
      await tab.keyboard.press('Home')
      for (let i = 0; i < 3; i += 1) await tab.keyboard.press('ArrowRight')
      await tab.keyboard.type('_w')
      await tab.keyboard.press('Escape')
      await tab.waitForTimeout(500)
      if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where.replaceAll(' ', '-')}.png`) })
      const s = await tab.evaluate(() => window.__offer())
      const [card] = s.cards
      const right = s.panel && s.panel.width > 0 && s.panel.left > s.editor.left + 1 ? Math.min(s.editor.right, s.panel.left) : s.editor.right
      const beside = card && card.box.left >= s.calc.right && Math.abs(card.box.top - s.rho.top) < 1
      const under = card && card.box.top >= s.rho.bottom - 0.5
      row(width > 1000 ? 'with room to its right, the card is beside its line' : 'with no room to its right, the card is under its line', width > 1000 ? beside : under, card && `card ${px(card.box.left)}–${px(card.box.right)} at ${px(card.box.top)}; element ends ${px(s.calc.right)}, row ${px(s.rho.top)}–${px(s.rho.bottom)}`)
      row('the card is inside the visible area, nothing cut', card && card.box.left >= s.editor.left - 0.5 && card.box.right <= right + 0.5 && card.buttons.every((b) => b.box.right <= card.box.right + 0.5), card && `card ${px(card.box.left)}–${px(card.box.right)} of ${px(s.editor.left)}–${px(right)}`)
    })
  }

  // The form at the panel's least width (section 17's check for M4e, with the form open).
  await run('rename 280 px', 1280, async ({ tab, row, start }) => {
    await start({ sheetPanelWidth: 280 }, RENAME_SHEET)
    await tab.locator('.sheet-sidebar [aria-label="Rename rho"]').first().click()
    await tab.keyboard.press('Control+A')
    await tab.keyboard.type('m')
    await tab.waitForTimeout(500)
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, 'rename-280.png') })
    const s = await tab.evaluate(() => window.__rename())
    const cut = await tab.evaluate(() => window.__cut())
    row('the panel is 280 px, and the form is inside it', Math.abs(s.panel.width - 272) < 0.5 && inside(s.form, s.panel), s.form && `form ${px(s.form.width)} px in ${px(s.panel.width)} px`)
    row('its field, its two lists and its buttons fit: nothing is cut, nothing scrolls sideways', s.field.box.width >= 160 && s.listed.length === 2 && inside(s.rename.box, s.form) && inside(s.cancel, s.form) && cut.cut.length === 0 && cut.sideways.length === 0, `field ${px(s.field.box.width)} px${cut.cut.length ? `; cut: ${cut.cut.join(' | ')}` : ''}${cut.sideways.length ? `; scrolls: ${cut.sideways.join(' | ')}` : ''}`)
  })

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

  // ☰ → Language on the web (section 8, Language, 0.5.0): Português comes
  // from the app's own address when first chosen, and survives a reload.
  await run('web language', 1280, async ({ tab, row }) => {
    const requests = []
    tab.on('request', (request) => requests.push(request.url()))
    const rectangle = () => tab.evaluate(() => document.querySelector('[data-testid="toolbar-rectangle"]')?.closest('label')?.title ?? null)
    const open = async () => {
      await tab.goto(`${origin}/web/`)
      await tab.waitForSelector('[data-testid="toolbar-rectangle"]', { timeout: 30_000 })
      await tab.waitForTimeout(300)
    }
    await open()
    row('the web app opens in English', /^Rectangle/.test(await rectangle()), await rectangle())
    const before = requests.length
    await tab.click('[data-testid="main-menu-trigger"]')
    await tab.selectOption('[data-testid="language-select"]', 'pt-BR')
    await tab.waitForFunction(() => document.querySelector('[data-testid="toolbar-rectangle"]')?.closest('label')?.title.startsWith('Retângulo'), null, { timeout: 10_000 }).catch(() => null)
    const fetched = requests.slice(before).filter((url) => /pt-BR/.test(url))
    const stored = await tab.evaluate(() => localStorage.getItem('excalimathpad.language'))
    row('Português shows at once, the menu still open', /^Retângulo/.test(await rectangle()) && !!(await tab.$('[data-testid="language-select"]')), await rectangle())
    row('its texts come from the app’s own address, and it is remembered in the browser’s storage', fetched.length > 0 && fetched.every((url) => url.startsWith(`${origin}/`)) && stored === 'pt-BR', `${fetched.map((url) => url.slice(origin.length)).join(', ')}; stored ${stored}`)
    const title = await tab.title()
    row('the sheet isn’t dirty, and its title is in Português (0.6.0)', title === 'Sem título', `title ${title}`)
    await tab.keyboard.press('Escape')
    await open()
    row('the language survives a reload', /^Retângulo/.test(await rectangle()), await rectangle())
    await tab.click('[data-testid="main-menu-trigger"]')
    const value = await tab.locator('[data-testid="language-select"]').inputValue()
    row('☰’s row shows Português (Brasil) after it', value === 'pt-BR', value)
    await tab.selectOption('[data-testid="language-select"]', 'en')
    await tab.waitForFunction(() => document.querySelector('[data-testid="toolbar-rectangle"]')?.closest('label')?.title.startsWith('Rectangle'), null, { timeout: 10_000 }).catch(() => null)
    row('English, chosen again, shows and is remembered', /^Rectangle/.test(await rectangle()) && (await tab.evaluate(() => localStorage.getItem('excalimathpad.language'))) === 'en', await rectangle())
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
for (const { where, ms } of timings.filter(({ where }) => where.includes('pt-BR'))) console.log(`${where}: the Português pass took ${(ms / 1000).toFixed(1)} s`)
console.log('Panel run passed: 320 px, icon tabs, the drag handle, docking by width, every tab usable at 280 px, the Format tab’s sample, the charts, the Page row, the page breaks, a rename from a Variables row, the offer on a committed line, the Português pass and Language on the web.')
