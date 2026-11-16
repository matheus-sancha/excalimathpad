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
const sheet = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [{ id: 'calc', type: 'rectangle', x: 40, y: 120, width: 160, height: 60, customData: { kind: 'math', source: SOURCE } }],
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
const px = (n) => (n === null || n === undefined ? 'none' : Math.round(n * 10) / 10)

/** A window of `width` px on `url`, and `act` with its checks. */
async function run(where, width, act, { data = null, url = '/' } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 })
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
    start: async (withData = data) => {
      await tab.goto(`${origin}${url}`)
      await tab.evaluate(([text, m, d]) => window.__start(text, m, d), [sheet, manifest, withData])
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
console.log('Panel run passed: 320 px, icon tabs, the drag handle, docking by width, and every tab usable at 280 px.')
