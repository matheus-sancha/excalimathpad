// The touch run (docs/spec-v1.md section 4, Touch; section 8, On a phone;
// section 12a, Releases; section 14, Two taps reach the app first): the built
// `dist-plugin/main.js` in headless Chromium against the fake `obsidian`, with
// touch (Playwright's `hasTouch`) at a phone and a tablet viewport. Each runs
// twice: as Android, and as iOS, where Excalidraw cancels every `touchstart`
// on its canvas, so the browser sends no click (`navigator.platform` is what
// Excalidraw reads). On the phone the plugin's `Platform.isPhone` is set, so
// the Sheet panel is the bottom sheet.
//
// It covers what the device checklist can't leave to chance: a double tap
// opens a line (and a drawing on top keeps Excalidraw's own), the Format tab's
// Done, ↑ ↓ and Edit, the canvas hint by tap and by click (in English, then Português, 0.6.0), a tap's tips and the slots and ⚙ a touch selection
// shows, the quick keys and their undo, the panel's open and restore, the
// suggestions opening above the field, and a rule's condition typed in the
// Rules list with the line still open (M4e, #197), and the Format tab's sample
// (M4e, #199: on the phone's bottom sheet 72 px at most, scrolling inside, and
// never a chart or a table); on the tablet, a mouse keeps hover. On both
// there is no Print…: no command and no ☰ item (section 11, M5, #81). A
// rename from a Variables row (0.5.0, #261): the ✎ and the form's buttons are
// 40 px or more, the form fits the panel (the bottom sheet on the phone), and
// its toast names Undo. The offer on a committed line (0.5.0, #262): on the
// phone a row at the top of the bottom sheet, above the quick keys, which
// opens the sheet for it and counts "1 of 2"; on the tablet the card; Rename
// and Keep 40 px or more.
// The tablet lies on its side (1180 px), where the panel docks; held upright
// (820 px) it is too narrow to dock, so an edit opens no panel and Math
// settings opens it floating, with the quick keys (M4e, #198). It
// runs in Chromium, so it covers neither WebKit nor a real on-screen keyboard:
// those are the device checklist's (CONTRIBUTING.md). It fails on any check
// that doesn't hold, and on any page error.
//
// Then the Português pass (0.6.0, #293; section 8, Sheet panel, and section
// 14, 0.6.0): the phone as Android, its language Português in data.json, at
// 360 and 320 px, and in English at 320 px, where every name once ran out of
// its pill. With a line open, each of the bottom sheet's six tabs is shown in
// turn: every tab stays a 40 px target inside the row, clear of Close, and the
// active one's name shows only whole, else its icon alone (the name shows at
// 360 px where it fits). The Format tab's link keeps its arrow on its last
// word's line, a rule's note keeps its condition on one line, and Settings →
// Custom's options are whole in their selects. It presses by class, role and
// position, never by English text, and prints the time it adds.
//
// Run: `node scripts/touch-run.mjs` (`npm run test:touch`), after
// `npm run build:plugin`. TOUCH_RUN_ONLY=<name> runs only the passes whose
// name starts with it (`phone/android`, `phone pt-BR`).

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-plugin')
const FILE = 'Calcs/touch.excalimathpad'

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
<meta name="viewport" content="width=device-width, initial-scale=1">
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
  window.__start = async (sheet, manifest, phone, data = null) => {
    FakeObsidian.Platform.isPhone = phone
    FakeObsidian.Platform.isTablet = !phone
    FakeObsidian.Platform.isMobile = true
    const app = new FakeObsidian.App()
    app.vault.add(${JSON.stringify(FILE)}, sheet)
    const plugin = new module.exports.default(app, manifest)
    plugin.dataJson = data
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(FILE)}))
    window.__leaf = leaf
    window.__commands = plugin.commands.map((command) => command.id)
  }
  // Whether Excalidraw's text editor has opened since the last reset: in
  // Chromium's touch, as Android, it closes again by itself (the browser's
  // \`dblclick\` follows Excalidraw's double tap), the app or not.
  window.__editorSeen = false
  new MutationObserver(() => {
    if (document.querySelector('textarea.excalidraw-wysiwyg')) window.__editorSeen = true
  }).observe(document, { childList: true, subtree: true })
  // The scene's text elements, from the view's file as the app holds it.
  window.__texts = () => JSON.parse(window.__leaf.view.getViewData()).elements.filter((e) => !e.isDeleted && e.type === 'text').length
</script>
</body></html>`

const math = (id, x, y, source) => ({
  id, type: 'rectangle', x, y, width: 160, height: 60, customData: { kind: 'math', source },
})
const sheet = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [
    math('calc', 40, 120, '# Pipe\na = 2 m\nb = a * 3\nc = q + 1'),
    math('plot', 40, 330, 'x = 0 .. 4\nplot(x, x^2)'),
    math('under', 230, 120, 'd = 5'),
    // A drawing on top of `under`: its double tap stays Excalidraw's.
    {
      id: 'box', type: 'rectangle', x: 220, y: 110, width: 110, height: 50,
      backgroundColor: '#ffc9c9', fillStyle: 'solid',
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

const DEVICES = [
  { name: 'phone', os: 'android', viewport: { width: 390, height: 844 }, phone: true },
  { name: 'phone', os: 'ios', viewport: { width: 390, height: 844 }, phone: true, platform: 'iPhone' },
  // On its side a tablet is wider than the panel's docking width (960 px at 320 px), so the
  // panel docks and an edit opens it; upright, at the run's end, it doesn't (section 8, M4e, #198).
  { name: 'tablet', os: 'android', viewport: { width: 1180, height: 820 }, upright: { width: 820, height: 1180 }, phone: false },
  { name: 'tablet', os: 'ios', viewport: { width: 1180, height: 820 }, upright: { width: 820, height: 1180 }, phone: false, platform: 'iPad' },
]

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
const results = []
const errors = []
const timings = []
const ONLY = process.env.TOUCH_RUN_ONLY
try {
  for (const device of DEVICES) {
    const where = `${device.name}/${device.os}`
    if (ONLY && !where.startsWith(ONLY)) continue
    const row = (check, ok, detail = '') => results.push({ where, check, ok, detail })
    const context = await browser.newContext({ viewport: device.viewport, hasTouch: true, isMobile: true })
    if (device.platform) {
      await context.addInitScript((platform) => {
        Object.defineProperty(navigator, 'platform', { get: () => platform })
      }, device.platform)
    }
    const tab = await context.newPage()
    tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
    tab.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${where} console: ${message.text().slice(0, 300)}`)
    })
    try {
      await tab.goto(`${origin}/`)
      await tab.evaluate(([text, m, phone]) => window.__start(text, m, phone), [sheet, manifest, device.phone])
      await tab.waitForSelector('[data-anchor-id="calc"] .katex', { timeout: 30_000 })
      await tab.waitForSelector('[data-anchor-id="plot"] [data-line="1"]', { timeout: 30_000 })

      const pause = (ms = 400) => tab.waitForTimeout(ms)
      // The middle-left of a line's row, or of any box in it, read from where the overlay drew it.
      const pointOf = async (selector, left = 18) => {
        const box = await tab.locator(selector).first().boundingBox()
        if (!box) throw new Error(`nothing drawn at ${selector}`)
        return { x: box.x + Math.min(left, box.width / 2), y: box.y + box.height / 2 }
      }
      const lineOf = (anchor, line) => `[data-anchor-id="${anchor}"] [data-line="${line}"]`

      // Print is for a computer (section 11, Changed on 2026-11-15): no command, and ☰ has no item.
      const commands = await tab.evaluate(() => window.__commands)
      await tab.locator('[data-testid="main-menu-trigger"]').first().tap()
      await tab.waitForSelector('[data-testid="math-guide-item"]', { timeout: 10_000 })
      const printItems = await tab.locator('[data-testid="print-item"]').count()
      await tab.locator('[data-testid="main-menu-trigger"]').first().tap()
      await pause()
      row(
        'no Print… command and no ☰ item',
        commands.includes('add-math') && !commands.includes('print') && printItems === 0 && (await tab.locator('[data-testid="math-guide-item"]').count()) === 0,
        `commands: ${commands.join(', ')}; ☰ print items: ${printItems}`,
      )
      // One tap. The next comes after Excalidraw's 300 ms, which counts any two
      // touches as a double tap, wherever they land.
      const tap = async (point) => {
        await tab.touchscreen.tap(point.x, point.y)
        await pause(350)
      }
      // Two taps within Excalidraw's 300 ms, after a rest that starts its count afresh.
      const doubleTap = async (point) => {
        await pause()
        await tab.touchscreen.tap(point.x, point.y)
        await pause(60)
        await tab.touchscreen.tap(point.x, point.y)
        await pause()
      }
      const field = () => tab.locator('textarea.math-element__field')
      const fieldText = async () => ((await field().count()) ? field().inputValue() : null)
      const fieldFocused = () => tab.evaluate(() => document.activeElement?.classList.contains('math-element__field') ?? false)
      const wysiwyg = () => tab.locator('textarea.excalidraw-wysiwyg').count()
      // Empty canvas: clear of the elements, Excalidraw's bars and the panel.
      const empty = device.phone ? { x: 200, y: 220 } : { x: 330, y: 330 }
      const panel = () => tab.locator(device.phone ? '.sheet-bottom' : '.sheet-sidebar').first()
      const panelOpen = async () => (await panel().count()) > 0 && (await panel().isVisible())
      const activeTab = () =>
        tab.evaluate(() => document.querySelector('.sheet-sidebar .sheet-tab[data-state="active"]')?.getAttribute('title') ?? null)
      const pressPanel = async (name) => tap(await pointOf(`.sheet-sidebar [aria-label="${name}"]`, 1000))
      const tabTo = async (name) => tap(await pointOf(`.sheet-sidebar .sheet-tab[title="${name}"]`, 1000))
      // The panel's own close: a floating panel covers More tools, so Math
      // settings isn't reachable while it is open.
      const closePanel = async () =>
        tap(await pointOf(device.phone ? '.sheet-bottom__close' : '.sheet-sidebar [data-testid="sidebar-close"]', 1000))
      const mathSettings = async () => {
        await tap(await pointOf('[data-testid="toolbar-more-tools"], .App-toolbar__extra-tools-trigger', 1000))
        await pause(200)
        await tap(await pointOf('.dropdown-menu-item:has-text("Math settings")', 1000))
        await pause(200)
      }

      // A double tap on a selected element's line opens it, and Excalidraw adds no label.
      await tap(empty)
      await doubleTap(await pointOf(lineOf('calc', 2)))
      row(
        'a double tap opens the line, and no label is added',
        (await fieldText()) === 'b = a * 3' && (await fieldFocused()) && (await wysiwyg()) === 0 && (await tab.evaluate(() => window.__texts())) === 0,
        `field: ${await fieldText()}, text editors: ${await wysiwyg()}`,
      )

      // The edit opens the panel on Format: the bottom sheet on a phone, short while editing.
      const short = device.phone ? await tab.locator('.sheet-bottom.is-compact').count() : 1
      row('the edit opens the panel on Format', (await panelOpen()) && (await activeTab()) === 'Format' && short === 1, `active: ${await activeTab()}`)
      if (device.phone) {
        const sheetTop = (await panel().boundingBox()).y
        const line = await field().boundingBox()
        row('the open line sits above the bottom sheet', line.y + line.height <= sheetTop, `line bottom ${Math.round(line.y + line.height)}, sheet top ${Math.round(sheetTop)}`)
      }

      // The quick keys: above the tab icons, typing at the caret and keeping the line, each one Ctrl+Z step.
      const keys = await tab.locator('.sheet-quick-keys').boundingBox()
      const tabs = await tab.locator('.sheet-sidebar .sheet-tab').first().boundingBox()
      row('the quick keys sit above the tab icons', !!keys && !!tabs && keys.y + keys.height <= tabs.y + 1)
      await tap(await pointOf('.sheet-quick-keys [aria-label="To the power"]', 1000))
      const powered = await fieldText()
      row('a quick key types at the caret and keeps the line', powered === 'b = a * 3^' && (await fieldFocused()), `field: ${powered}`)
      await tap(await pointOf('.sheet-quick-keys [aria-label="Open bracket"]', 1000))
      const bracket = await fieldText()
      await tab.keyboard.press('Control+z')
      const undone = await fieldText()
      row('( types alone, and Ctrl+Z takes one key back', bracket === 'b = a * 3^(' && undone === 'b = a * 3^', `${bracket} → ${undone}`)
      await tab.keyboard.press('Control+z')
      row('Ctrl+Z takes the next key back', (await fieldText()) === 'b = a * 3')

      // A tap on another line of the element moves the edit (on iOS the browser sends no click).
      await tap(await pointOf(lineOf('calc', 1)))
      await pause(200)
      row('a tap on another line moves the edit', (await fieldText()) === 'a = 2 m', `field: ${await fieldText()}`)

      // ↓ and ↑ move the edit. Done leaves it; the panel stays as it is, since the
      // press was in it (section 8), on Format with Edit at hand, taller on a phone.
      await pressPanel('Down (↓)')
      const down = await fieldText()
      await pressPanel('Up (↑)')
      const up = await fieldText()
      row('↓ and ↑ move the edit', down === 'b = a * 3' && up === 'a = 2 m', `${down} / ${up}`)
      await pressPanel('Done (Esc)')
      await pause()
      const tall = device.phone ? (await tab.locator('.sheet-bottom.is-compact').count()) === 0 : true
      row(
        'Done leaves the line, and the panel stays on Format',
        (await field().count()) === 0 && (await panelOpen()) && (await activeTab()) === 'Format' && tall,
        `active: ${await activeTab()}`,
      )
      await closePanel()

      // The panel open on Variables: an edit switches it to Format, and an end on the canvas puts it back.
      await tap(await pointOf(lineOf('calc', 1)))
      await mathSettings()
      await tabTo('Variables')
      const opened = await activeTab()
      await doubleTap(await pointOf(lineOf('calc', 2)))
      const during = await activeTab()
      await tap(empty)
      row(
        'an edit shows Format, and its end restores the panel',
        // The bottom sheet and the tablet's docked panel both stay through a press on the canvas.
        opened === 'Variables' && during === 'Format' && (await panelOpen()) && (await activeTab()) === 'Variables',
        `${opened} → ${during} → ${await activeTab()}`,
      )

      // With the element selected and nothing open, the hint names the taps, and Edit opens its last line.
      await tap(await pointOf(lineOf('calc', 1)))
      if (!(await panelOpen())) await mathSettings()
      await tabTo('Format')
      const hint = await tab.locator('.sheet-format__hint').innerText()
      await pressPanel('Edit (Enter)')
      await pause()
      row('the hint names the taps, and Edit opens the last line', hint.includes('Double-tap a line, or tap Edit') && (await fieldText()) === 'c = q + 1', `hint: ${hint.replace(/\s+/g, ' ').trim()}, field: ${await fieldText()}`)
      await pressPanel('Done (Esc)')
      await pause()
      await closePanel()
      row('the panel’s close closes it', !(await panelOpen()))

      // One element selected by touch, the canvas hint names the taps; a mouse press brings back the keys.
      const canvasHint = () =>
        tab.evaluate(() => {
          const hint = document.querySelector('.HintViewer')
          return hint ? getComputedStyle(hint, '::after').content : null
        })
      await tap(empty)
      await tap(await pointOf(lineOf('calc', 1)))
      const byTouch = await canvasHint()
      const first = await pointOf(lineOf('calc', 1))
      await tab.mouse.click(first.x, first.y)
      await pause()
      const byMouse = await canvasHint()
      row(
        'the canvas hint names the taps after a tap, and the keys after a click',
        byTouch === JSON.stringify('Double-tap a line, or tap Edit in Math settings') &&
          byMouse === JSON.stringify('Double-click a line or press Enter to edit'),
        `tap: ${byTouch}, click: ${byMouse}`,
      )
      // The same hint in Português (section 13, App, 0.6.0), then back to English for the checks after.
      const language = async (code, rectangle) => {
        await tab.click('[data-testid="main-menu-trigger"]')
        await tab.selectOption('[data-testid="language-select"]', code)
        await tab
          .waitForFunction((start) => document.querySelector('[data-testid="toolbar-rectangle"]')?.closest('label')?.title.startsWith(start), rectangle, { timeout: 10_000 })
          .catch(() => null)
        await tab.click('[data-testid="main-menu-trigger"]')
        await pause()
      }
      await language('pt-BR', 'Retângulo')
      await tap(empty)
      await tap(await pointOf(lineOf('calc', 1)))
      const ptTouch = await canvasHint()
      await tab.mouse.click(first.x, first.y)
      await pause()
      const ptMouse = await canvasHint()
      row(
        'in Português the canvas hint names the taps after a tap, and the keys after a click',
        ptTouch === JSON.stringify('Toque duas vezes em uma linha, ou toque em Editar em Configurações de cálculo') &&
          ptMouse === JSON.stringify('Clique duas vezes em uma linha ou pressione Enter para editar'),
        `tap: ${ptTouch}, click: ${ptMouse}`,
      )
      await language('en', 'Rectangle')

      // A tap on a gutter mark shows its message at once; the next tap anywhere closes it.
      await tap(empty)
      await tap(await pointOf(`${lineOf('calc', 3)} [data-tip]`, 3))
      await pause(100)
      const tip = (await tab.locator('.math-hover-tip').count()) ? await tab.locator('.math-hover-tip').innerText() : ''
      await tap(empty)
      await pause(100)
      row('a tap shows a mark’s message, and the next tap closes it', tip.includes('q') && (await tab.locator('.math-hover-tip').count()) === 0, `tip: ${tip}`)

      // Selected by touch, an element shows its unit slots outlined and its plot's ⚙; a tap on a slot opens the unit choice.
      await tap(await pointOf(lineOf('calc', 1)))
      await pause(100)
      const outlined = await tab.locator('[data-anchor-id="calc"] .math-element__unit.is-hovered').count()
      await tap(await pointOf(lineOf('plot', 0)))
      await pause(200)
      const gear = await tab.locator('[data-anchor-id="plot"] .math-element__gear').count()
      row('selected by touch, the slots show outlined and the plot shows its ⚙', outlined >= 2 && gear === 1, `outlined slots: ${outlined}, ⚙: ${gear}`)
      await tap(await pointOf(lineOf('calc', 1)))
      await pause(100)
      await tap(await pointOf(`${lineOf('calc', 1)} [data-unit-slot]`, 4))
      await pause(200)
      row('a tap on a shown slot opens the unit choice', (await tab.locator('.math-unit-field').count()) === 1)
      await tab.keyboard.press('Escape')
      await tap(empty)

      // A drawing on top keeps Excalidraw's own double tap: its label, not math.
      const boxPoint = await pointOf('[data-anchor-id="under"] [data-line="0"]', 40)
      await tab.evaluate(() => (window.__editorSeen = false))
      await doubleTap(boxPoint)
      const seen = await tab.evaluate(() => window.__editorSeen)
      row('a drawing on top keeps Excalidraw’s double tap', seen && (await field().count()) === 0, `Excalidraw’s editor opened: ${seen}`)
      await tab.keyboard.press('Escape')
      await pause()

      if (device.phone) {
        // Room shrinks above the sheet (as a keyboard that resizes the page): the list opens above the field.
        await doubleTap(await pointOf(lineOf('calc', 1)))
        const line = await field().boundingBox()
        const height = Math.round(line.y + line.height + 250)
        await tab.setViewportSize({ width: device.viewport.width, height })
        await pause()
        await field().press('End')
        // `sq`, not `s`: a word that is a unit already offers no list.
        await tab.keyboard.type(' + sq')
        await pause(200)
        const above = await tab.locator('.math-suggest.is-above').count()
        const list = await tab.locator('.math-suggest').boundingBox()
        const sheetTop = (await panel().boundingBox())?.y ?? 0
        row('the suggestions open above the field when the sheet would cover them', above === 1 && !!list && list.y + list.height <= sheetTop, `view height ${height}`)
        await tap(await pointOf('.math-suggest .math-suggest__option', 1000))
        const taken = await fieldText()
        row('a tap on a suggestion takes it', !!taken && taken.startsWith('a = 2 m + sq') && taken.length > 'a = 2 m + sq'.length, `field: ${taken}`)
        await tab.keyboard.press('Escape')
        await tab.setViewportSize(device.viewport)
        await pause()
      } else {
        // A mouse on a tablet keeps hover: a row's slot outlines, a mark's message shows after a rest.
        await tap(empty)
        const slot = await pointOf(lineOf('calc', 2))
        await tab.mouse.move(slot.x, slot.y)
        await pause(200)
        const hovered = await tab.locator(`${lineOf('calc', 2)} .math-element__unit.is-hovered`).count()
        const mark = await pointOf(`${lineOf('calc', 3)} [data-tip]`, 3)
        await tab.mouse.move(mark.x, mark.y)
        await pause(800)
        const shown = await tab.locator('.math-hover-tip').count()
        row('a mouse keeps hover on a tablet', hovered === 1 && shown === 1, `outlined: ${hovered}, tip: ${shown}`)
      }

      // A rule's condition (section 4, Rules list, M4e, #197): its field takes the
      // keyboard and the line stays open; on a phone the sheet stays short, above
      // the keyboard, here a page that the keyboard resizes.
      const LIST = 'x = 0 .. 4'
      await tap(empty)
      await doubleTap(await pointOf(lineOf('plot', 0)))
      const rule = () =>
        tab.evaluate(() => {
          const condition = document.querySelector('.sheet-rules__field')
          const box = condition?.getBoundingClientRect()
          return {
            focused: !!condition && document.activeElement === condition,
            value: condition?.value ?? null,
            line: document.querySelector('.math-element__field')?.value ?? null,
            state: document.querySelector('.sheet-rules__state')?.textContent ?? null,
            box: box ? { top: box.top, bottom: box.bottom } : null,
          }
        })
      await tab.locator('.sheet-sidebar [aria-label="+ Add rule"]').scrollIntoViewIfNeeded()
      await pressPanel('+ Add rule')
      await pause(200)
      let added = await rule()
      row(
        '+ Add rule puts the keyboard in the rule’s condition, and the line stays open',
        added.focused && added.value === 'x ' && added.line === LIST,
        JSON.stringify(added),
      )
      if (device.phone) {
        const height = 520
        await tab.setViewportSize({ width: device.viewport.width, height })
        await pause()
        const sheetBox = await panel().boundingBox()
        const compact = await tab.locator('.sheet-bottom.is-compact').count()
        added = await rule()
        row(
          'the bottom sheet stays short and above the keyboard while the condition has it',
          compact === 1 && !!sheetBox && sheetBox.y > 0 && Math.abs(sheetBox.y + sheetBox.height - height) <= 1 && added.focused && added.line === LIST,
          sheetBox ? `sheet ${Math.round(sheetBox.y)}–${Math.round(sheetBox.y + sheetBox.height)} of ${height}` : 'no sheet',
        )
        row(
          'the condition’s field is in view inside the sheet',
          !!added.box && !!sheetBox && added.box.top >= sheetBox.y && added.box.bottom <= sheetBox.y + sheetBox.height,
          added.box ? `field ${Math.round(added.box.top)}–${Math.round(added.box.bottom)}` : 'no field',
        )
      }
      await tab.keyboard.type('>= 0')
      await pause(200)
      added = await rule()
      row('the condition is typed, and its live state follows', added.value === 'x >= 0' && added.state === '5 of 5 points' && added.line === LIST, JSON.stringify(added))
      if (device.phone) {
        await tab.setViewportSize(device.viewport)
        await pause()
      }
      await tab.locator('.sheet-sidebar [aria-label="Done (Esc)"]').scrollIntoViewIfNeeded()
      await pressPanel('Done (Esc)')
      await pause()
      const stored = await tab.evaluate(() => JSON.parse(window.__leaf.view.getViewData()).elements.find((e) => e.id === 'plot')?.customData)
      row(
        'Done leaves the line, with the condition saved beside it',
        (await field().count()) === 0 && stored?.formats === '@text-red if x >= 0\n' && stored.source.startsWith(`${LIST}\n`),
        JSON.stringify(stored?.formats),
      )

      // The Format tab's sample (section 4, Format tab, M4e, #199). On a phone's
      // bottom sheet it is 72 px at most and scrolls inside, and never holds a
      // chart, a table or the chart's note; a tablet's panel shows the note and
      // the table, as a computer's does.
      // With no line open the bottom sheet is tall, and covers the element.
      if (device.phone && (await panelOpen())) await closePanel()
      await tap(empty)
      await doubleTap(await pointOf(lineOf('plot', 0)))
      await tab.keyboard.press('ArrowDown')
      await pause()
      const sample = () =>
        tab.evaluate(() => {
          const side = document.querySelector('.sheet-sidebar')
          const box = side?.querySelector('.sheet-format__drawing')
          if (!box) return null
          const before = box.scrollTop
          box.scrollTop = 100000
          const scrolled = box.scrollTop
          box.scrollTop = before
          return {
            height: box.getBoundingClientRect().height,
            width: box.getBoundingClientRect().width,
            line: box.querySelector('.math-element__row')?.getAttribute('aria-label') ?? null,
            font: box.querySelector('.is-line-sample') ? getComputedStyle(box.querySelector('.is-line-sample')).fontSize : null,
            charts: box.querySelectorAll('.math-element__plot-cell, .math-element__plot, .math-element__plot-chart').length,
            tables: box.querySelectorAll('table').length,
            note: side.querySelector('.sheet-format__chart-note')?.textContent ?? null,
            content: box.scrollHeight,
            scrolled,
          }
        })
      const retype = async (text) => {
        await tab.keyboard.press('ControlOrMeta+a')
        await tab.keyboard.type(text)
        await pause()
      }
      const most = device.phone ? 72 : 150
      const told = (s) => (s ? `${s.line.slice(0, 24)}: ${Math.round(s.height * 10) / 10} px high, content ${s.content} px, ${s.charts} chart(s), ${s.tables} table(s), note ${JSON.stringify(s.note)}` : 'no sample')
      let drawn = await sample()
      row(
        device.phone ? 'the bottom sheet’s sample of a plot line is its line only: no chart, no note' : 'the sample of a plot line is its line and the note, with no chart',
        !!drawn && drawn.line === 'plot(x, x^2)' && drawn.font === '13px' && drawn.charts === 0 && drawn.height <= most + 0.5 && (device.phone ? drawn.note === null : drawn.note === 'Its chart is drawn on the sheet.'),
        told(drawn),
      )
      await retype('table(x, x^2, x^3)')
      drawn = await sample()
      row(
        device.phone ? 'the bottom sheet’s sample of a table line is its line only: no table' : 'the sample of a table line holds the whole table',
        !!drawn && drawn.line === 'table(x, x^2, x^3)' && drawn.charts === 0 && drawn.note === null && (device.phone ? drawn.tables === 0 && drawn.height <= 72.5 : drawn.tables === 1 && drawn.height <= 300.5 && drawn.scrolled === 0),
        told(drawn),
      )
      const LONG = 'r = 1 + sqrt(2/3) + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20 + 21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 + 29 + 30 + 31 + 32 + 33 + 34 + 35 + 36 + 37 + 38 + 39 + 40 + 41 + 42 + 43 + 44 + 45 + 46 + 47 + 48 + 49 + 50 + 51 + 52 + 53 + 54 + 55 + 56 + 57 + 58 + 59 + 60 + 61 + 62 + 63 + 64 + 65 + 66 + 67 + 68 + 69 + 70 + 71 + 72 + 73 + 74 + 75 + 76 + 77 + 78 + 79'
      await retype(LONG)
      drawn = await sample()
      row(
        `a long line’s sample is ${most} px at most, and scrolls inside`,
        !!drawn && drawn.line === LONG && drawn.height <= most + 0.5 && drawn.height > most - 12 && drawn.content > drawn.height && drawn.scrolled > 0 && (await fieldFocused()),
        told(drawn),
      )
      await retype('plot(x, x^2)')
      await tab.locator('.sheet-sidebar [aria-label="Done (Esc)"]').scrollIntoViewIfNeeded()
      await pressPanel('Done (Esc)')
      await pause()

      // A rename by touch (section 4, Renaming a name, 0.5.0, #261): the ✎ on a Variables row, and
      // its form in the panel, the bottom sheet on a phone, with buttons of 40 px or more.
      await tabTo('Variables')
      const pencil = tab.locator('.sheet-sidebar .sheet-panel__rename').first()
      const old = (await pencil.getAttribute('aria-label')).replace(/^Rename /, '')
      const linesBefore = await tab.evaluate(() => [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((r) => r.getAttribute('aria-label')))
      await pencil.scrollIntoViewIfNeeded()
      const pencilBox = await pencil.boundingBox()
      await tap(await pointOf('.sheet-sidebar .sheet-panel__rename', 1000))
      await pause()
      await tab.keyboard.press('ControlOrMeta+a')
      await tab.keyboard.type(`${old}_t`)
      await pause()
      await tab.locator('.sheet-rename__button').first().scrollIntoViewIfNeeded()
      const formed = await tab.evaluate((phone) => {
        const box = (e) => {
          const { left, right, width, height } = e.getBoundingClientRect()
          return { left, right, width, height }
        }
        const form = document.querySelector('.sheet-sidebar .sheet-rename')
        if (!form) return null
        const field = form.querySelector('.sheet-rename__field')
        return {
          form: box(form),
          panel: box(document.querySelector(phone ? '.sheet-bottom' : '.sheet-sidebar')),
          field: { value: field.value, focused: document.activeElement === field, ...box(field) },
          buttons: [...form.querySelectorAll('.sheet-rename__button')].map((b) => ({ name: b.textContent, disabled: b.disabled, ...box(b) })),
          listed: form.querySelectorAll('.sheet-rename__lines li').length,
        }
      }, device.phone)
      row(
        'a Variables row’s ✎ is 40 px or more, and a tap opens the form with the keyboard in its field',
        !!formed && pencilBox.width >= 40 && pencilBox.height >= 40 && formed.field.focused && formed.field.value === `${old}_t` && formed.listed >= 1,
        formed ? `✎ ${Math.round(pencilBox.width)} × ${Math.round(pencilBox.height)} px, field: ${formed.field.value}` : 'no form',
      )
      row(
        `the form fits the ${device.phone ? 'bottom sheet' : 'panel'}, its Rename and Cancel 40 px or more`,
        !!formed && formed.form.left >= formed.panel.left - 0.5 && formed.form.right <= formed.panel.right + 0.5 && formed.buttons.length === 2 && formed.buttons.every((b) => b.width >= 40 && b.height >= 40 && b.left >= formed.form.left && b.right <= formed.form.right) && !formed.buttons[0].disabled,
        formed ? `form ${Math.round(formed.form.width)} of ${Math.round(formed.panel.width)} px; ${formed.buttons.map((b) => `${b.name} ${Math.round(b.width)} × ${Math.round(b.height)}`).join(', ')}` : 'no form',
      )
      await tap(await pointOf('.sheet-rename__button.is-primary', 1000))
      await pause()
      const toast = await tab.evaluate(() => document.querySelector('.Toast')?.textContent ?? null)
      const renamedRows = await tab.locator(`.sheet-sidebar [aria-label="Rename ${old}_t"]`).count()
      row(
        'Rename by touch writes it, closes the form, and the toast names Undo',
        new RegExp(`^Renamed ${old} to ${old}_t in \\d+ lines?\\. Undo takes it back\\.$`).test(toast ?? '') && renamedRows === 1 && (await tab.locator('.sheet-rename').count()) === 0,
        `toast: ${toast}`,
      )
      // One undo puts every line back (the keyboard is the canvas's again). As iOS, Excalidraw's undo is ⌘Z.
      await tab.keyboard.press(device.platform ? 'Meta+z' : 'Control+z')
      await pause()
      const linesAfter = await tab.evaluate(() => [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((r) => r.getAttribute('aria-label')))
      row('one undo takes the rename back', JSON.stringify(linesAfter) === JSON.stringify(linesBefore), linesAfter.filter((l, i) => l !== linesBefore[i]).join(' | '))

      // The offer on a committed line (section 4, Renaming a name, 0.5.0, #262): on a phone a
      // row at the top of the bottom sheet, above the quick keys, which opens the sheet for it;
      // on a tablet whose panel docks, the card beside the line. Buttons of 40 px or more.
      const offers = () =>
        tab.evaluate(() => {
          const box = (e) => {
            if (!e) return null
            const { left, top, right, bottom, width, height } = e.getBoundingClientRect()
            return { left, top, right, bottom, width, height }
          }
          const sheet = document.querySelector('.sheet-bottom')
          return {
            cards: [...document.querySelectorAll('.math-offer')].map((card) => ({
              row: card.classList.contains('is-row'),
              inSheet: !!sheet && sheet.contains(card),
              text: card.querySelector('.math-offer__ask').textContent,
              box: box(card),
              buttons: [...card.querySelectorAll('button')].map((b) => ({ name: b.textContent, ...box(b) })),
            })),
            keys: box(document.querySelector('.sheet-quick-keys')),
          }
        })
      // Earlier steps may have panned the view: the wheel brings a line back near the top.
      const bringIntoView = async (selector) => {
        const box = await tab.locator(selector).first().boundingBox()
        if (!box || (box.y > 90 && box.y < 300)) return
        await tab.mouse.move(empty.x, empty.y)
        await tab.mouse.wheel(0, box.y - 150)
        await pause()
      }
      if (await panelOpen()) await closePanel()
      await tap(empty)
      await bringIntoView(lineOf('calc', 1))
      await doubleTap(await pointOf(lineOf('calc', 1)))
      await tab.keyboard.press('ControlOrMeta+a')
      await tab.keyboard.type('a_t = 2 m')
      await tab.locator('.sheet-sidebar [aria-label="Down (↓)"]').scrollIntoViewIfNeeded()
      await pressPanel('Down (↓)')
      await pause()
      let o = await offers()
      const [offer] = o.cards
      const fingers = (card) => card.buttons.every((b) => b.width >= 40 && b.height >= 40)
      if (device.phone) {
        row(
          'the offer is a row at the top of the bottom sheet, above the quick keys, its buttons 40 px or more',
          o.cards.length === 1 && offer.row && offer.inSheet && offer.text === 'Rename a to a_t in 1 line?' && !!o.keys && offer.box.bottom <= o.keys.top + 0.5 && fingers(offer),
          offer ? `${offer.text}; row ends ${Math.round(offer.box.bottom)}, keys from ${Math.round(o.keys?.top ?? -1)}; ${offer.buttons.map((b) => `${b.name} ${Math.round(b.width)} × ${Math.round(b.height)}`).join(', ')}` : 'no offer',
        )
      } else {
        row(
          'the offer is a card beside the line, its buttons 40 px or more',
          o.cards.length === 1 && !offer.row && offer.text === 'Rename a to a_t in 1 line?' && fingers(offer),
          offer ? `${offer.text}; ${offer.buttons.map((b) => `${b.name} ${Math.round(b.width)} × ${Math.round(b.height)}`).join(', ')}` : 'no offer',
        )
      }
      row('the next line is open while it waits', (await fieldText()) === 'b = a * 3')
      await pressPanel('Done (Esc)')
      await pause()
      if (device.phone) {
        // A second offer, made with the sheet closed: the sheet opens for it, showing the newest and "1 of 2".
        if (await panelOpen()) await closePanel()
        await tap(empty)
        await bringIntoView(lineOf('plot', 0))
        await doubleTap(await pointOf(lineOf('plot', 0)))
        await tab.keyboard.press('ControlOrMeta+a')
        await tab.keyboard.type('x_t = 0 .. 4')
        await pressPanel('Done (Esc)')
        await pause()
        o = await offers()
        row(
          'with two waiting, the sheet opens for the newest, with "1 of 2"',
          (await panelOpen()) && o.cards.length === 1 && o.cards[0].row && o.cards[0].text.startsWith('1 of 2') && o.cards[0].text.includes('Rename x to x_t'),
          o.cards[0]?.text ?? 'no offer',
        )
        await tap(await pointOf('.math-offer__button.is-primary', 1000))
        await pause()
        o = await offers()
        row('its Rename renames, and the other offer shows next', o.cards.length === 1 && o.cards[0].text === 'Rename a to a_t in 1 line?', o.cards[0]?.text ?? 'none')
      }
      await tap(await pointOf('.math-offer__button.is-primary', 1000))
      await pause()
      const offered = await tab.evaluate(() => [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((r) => r.getAttribute('aria-label')))
      row('Rename by touch renames the uses', offered.includes('b = a_t * 3') && (await offers()).cards.length === 0, offered.join(' | '))
      // Undone step by step (selections are Excalidraw's own steps between them), the sheet is as it was.
      const sheetLines = () => tab.evaluate(() => [...document.querySelectorAll('[data-anchor-id] [data-line]')].map((r) => r.getAttribute('aria-label')))
      let presses = 0
      while (presses < 8 && JSON.stringify(await sheetLines()) !== JSON.stringify(linesBefore)) {
        await tab.keyboard.press(device.platform ? 'Meta+z' : 'Control+z')
        await pause(200)
        presses += 1
      }
      const unoffered = await sheetLines()
      row('undo takes back the renames and the lines', JSON.stringify(unoffered) === JSON.stringify(linesBefore), `${presses} presses${unoffered.some((l, i) => l !== linesBefore[i]) ? `; ${unoffered.filter((l, i) => l !== linesBefore[i]).join(' | ')}` : ''}`)

      if (device.upright) {
        // Held upright the tablet is too narrow for the panel to dock (section 8, M4e, #198).
        await closePanel()
        await tab.setViewportSize(device.upright)
        await pause()
        await tap(empty)
        await doubleTap(await pointOf(lineOf('calc', 2)))
        row('upright, a double tap opens the line and no panel', (await fieldText()) === 'b = a * 3' && !(await panelOpen()), `field: ${await fieldText()}`)
        await tab.keyboard.press('Escape')
        await pause()
        // Math settings opens it floating; Edit in its Format tab opens the line, with the quick keys.
        await mathSettings()
        const floats = (await panelOpen()) && (await tab.locator('.sheet-sidebar [data-testid="sidebar-dock"]').count()) === 0
        await tabTo('Format')
        await pressPanel('Edit (Enter)')
        await pause()
        row(
          'upright, Math settings opens the panel floating, and its Edit opens the line with the quick keys',
          floats && (await fieldText()) === 'c = q + 1' && (await fieldFocused()) && (await activeTab()) === 'Format' && (await tab.locator('.sheet-quick-keys').count()) === 1,
          `floating: ${floats}, field: ${await fieldText()}, active: ${await activeTab()}`,
        )
        await pressPanel('Done (Esc)')
        await pause()
        await tap(empty)
        row('upright, a tap on the canvas closes the floating panel', !(await panelOpen()) && (await field().count()) === 0)
      }
    } catch (error) {
      errors.push(`${where}: the run didn't finish: ${error.message.split('\n')[0]}`)
      // TOUCH_RUN_SHOTS=<folder> keeps a screenshot of where it stopped.
      if (process.env.TOUCH_RUN_SHOTS) {
        await tab.screenshot({ path: join(process.env.TOUCH_RUN_SHOTS, `${device.name}-${device.os}.png`) }).catch(() => {})
      }
    } finally {
      await context.close()
    }
  }

  // The Português pass (0.6.0, #293): the bottom sheet's fit rules where they are at risk.
  for (const [language, width] of [['pt-BR', 360], ['pt-BR', 320], ['en', 320]]) {
    const where = `phone ${language} ${width}`
    if (ONLY && !where.startsWith(ONLY)) continue
    const began = Date.now()
    const row = (check, ok, detail = '') => results.push({ where, check, ok, detail })
    const context = await browser.newContext({ viewport: { width, height: 780 }, hasTouch: true, isMobile: true })
    const tab = await context.newPage()
    tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
    try {
      await tab.goto(`${origin}/`)
      await tab.evaluate(([text, m, data]) => window.__start(text, m, true, data), [sheet, manifest, { language }])
      await tab.waitForSelector('[data-anchor-id="calc"] .katex', { timeout: 30_000 })
      const pause = (ms = 400) => tab.waitForTimeout(ms)
      const pointOf = async (selector, left = 18) => {
        const box = await tab.locator(selector).first().boundingBox()
        if (!box) throw new Error(`nothing drawn at ${selector}`)
        return { x: box.x + Math.min(left, box.width / 2), y: box.y + box.height / 2 }
      }
      const tap = async (point) => {
        await tab.touchscreen.tap(point.x, point.y)
        await pause(350)
      }
      await tap({ x: Math.round(width / 2), y: 240 })
      await pause()
      // A double tap opens the element's second line, `a = 2 m`, and the bottom sheet on Format.
      const line = await pointOf('[data-anchor-id="calc"] [data-line="1"]')
      await tab.touchscreen.tap(line.x, line.y)
      await pause(60)
      await tab.touchscreen.tap(line.x, line.y)
      await pause(700)
      row('a double tap opens the line, and the bottom sheet', (await tab.locator('textarea.math-element__field').count()) === 1 && (await tab.locator('.sheet-bottom').count()) === 1)

      // The link row: the arrow stays on its last word's line, the link inside the sheet.
      const link = await tab.evaluate(() => {
        const button = document.querySelector('.sheet-bottom .sheet-format__link')
        const sheet = document.querySelector('.sheet-bottom').getBoundingClientRect()
        const text = button.firstChild
        const rectOf = (from, to) => {
          const range = document.createRange()
          range.setStart(text, from)
          range.setEnd(text, to)
          return range.getBoundingClientRect()
        }
        const value = text.textContent
        const arrow = rectOf(value.length - 1, value.length)
        const word = rectOf(value.length - 3, value.length - 2)
        const box = button.getBoundingClientRect()
        return { text: value, together: Math.abs(arrow.top - word.top) < 2, inside: box.left >= sheet.left - 0.5 && box.right <= sheet.right + 0.5 }
      })
      row('the Format tab’s link keeps its arrow with its last word, inside the sheet', link.together && link.inside, link.text)

      // A rule's note: + Add rule (its class), its condition typed to `a > 1 m`, which is true.
      await tab.locator('.sheet-bottom .sheet-rules__add').scrollIntoViewIfNeeded()
      await tap(await pointOf('.sheet-bottom .sheet-rules__add', 1000))
      await tab.keyboard.type('> 1 m')
      await pause(600)
      const note = await tab.evaluate(() => {
        const p = document.querySelector('.sheet-bottom .sheet-format__override')
        const whole = p?.querySelector('.sheet-panel__whole')
        if (!p || !whole) return null
        const sheet = document.querySelector('.sheet-bottom').getBoundingClientRect()
        const box = whole.getBoundingClientRect()
        const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || parseFloat(getComputedStyle(p).fontSize) * 1.3
        return { text: p.textContent, condition: whole.textContent, lines: Math.round(box.height / lineHeight), inside: box.left >= sheet.left - 0.5 && box.right <= sheet.right + 0.5 }
      })
      const ruleSets = language === 'pt-BR' ? /^Uma regra define .+ enquanto a > 1 m\.$/ : /^A rule sets .+ while a > 1 m\.$/
      row('a rule’s note keeps its condition on one line, inside the sheet', !!note && ruleSets.test(note.text) && note.lines === 1 && note.inside, note ? `${note.text} (${note.lines} line)` : 'no note')

      // Each tab in turn, by its place: 40 px targets inside the row, clear of Close, the active name whole or not shown.
      const named = []
      for (let index = 0; index < 6; index += 1) {
        await tap(await pointOf(`.sheet-bottom .sheet-tab >> nth=${index}`, 1000))
        const bar = await tab.evaluate(() => {
          const box = (e) => e.getBoundingClientRect()
          const list = document.querySelector('.sheet-bottom__tabs')
          const tabs = [...list.querySelectorAll('.sheet-tab')]
          const active = tabs.find((t) => t.dataset.state === 'active')
          const label = active.querySelector('.sheet-tab__label')
          const shown = getComputedStyle(label).position !== 'absolute'
          const range = document.createRange()
          range.selectNodeContents(label)
          const text = range.getBoundingClientRect()
          const row = box(list)
          return {
            name: active.getAttribute('title'),
            shown,
            whole: !shown || (text.left >= box(active).left - 0.5 && text.right <= box(active).right + 0.5),
            fits: tabs.every((t) => box(t).width >= 39.5 && box(t).left >= row.left - 0.5 && box(t).right <= row.right + 0.5),
            clear: row.right <= box(document.querySelector('.sheet-bottom__close')).left + 0.5,
            widths: tabs.map((t) => Math.round(box(t).width)),
          }
        })
        if (bar.shown) named.push(bar.name)
        row(`tab ${index + 1}, ${bar.name}: the row fits, and its name shows whole or not at all`, bar.fits && bar.clear && bar.whole, `${bar.shown ? 'named' : 'icon only'}; ${bar.widths.join(', ')} px`)
      }
      if (width === 360) row('at 360 px a name that fits shows', named.length > 0, `named: ${named.join(', ')}`)

      // Settings → Custom: each kind's default option whole in its select (its units only, 0.6.0).
      await tab.locator('.sheet-bottom .sheet-settings select').first().selectOption('custom')
      await pause()
      const custom = await tab.evaluate(() => {
        const measure = document.createElement('canvas').getContext('2d')
        const sheet = document.querySelector('.sheet-bottom').getBoundingClientRect()
        return [...document.querySelectorAll('.sheet-bottom .sheet-settings__kinds select')].map((select) => {
          measure.font = getComputedStyle(select).font
          const box = select.getBoundingClientRect()
          return { option: select.options[0].textContent, text: measure.measureText(select.options[0].textContent).width, width: select.clientWidth, inside: box.left >= sheet.left - 0.5 && box.right <= sheet.right + 0.5 }
        })
      })
      const cut = custom.filter((c) => !c.inside || c.width < c.text + 36)
      row('Settings → Custom: every kind’s default option is whole in its select', custom.length === 18 && cut.length === 0, cut.length ? cut.map((c) => `${c.option} ${Math.round(c.text)} px in ${c.width} px`).join(', ') : `${custom.length} selects`)
    } catch (error) {
      errors.push(`${where}: the run didn't finish: ${error.message.split('\n')[0]}`)
      if (process.env.TOUCH_RUN_SHOTS) await tab.screenshot({ path: join(process.env.TOUCH_RUN_SHOTS, `${where.replaceAll(' ', '-')}.png`) }).catch(() => {})
    } finally {
      await context.close()
      timings.push({ where, ms: Date.now() - began })
    }
  }
} finally {
  await browser.close()
  server.close()
}

for (const { where, check, ok, detail } of results) {
  console.log(`${where.padEnd(15)} ${ok ? 'yes' : 'NO '}  ${check}${detail ? `  (${detail})` : ''}`)
}
const failed = results.filter(({ ok }) => !ok)
if (failed.length || errors.length || results.length === 0) {
  console.error('Touch run failed (docs/spec-v1.md section 4, Touch; section 8, On a phone):')
  for (const { where, check } of failed) console.error(`  - ${where}: ${check}`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
for (const { where, ms } of timings) console.log(`${where}: the Português pass took ${(ms / 1000).toFixed(1)} s`)
console.log('Touch run passed: a phone and a tablet, as Android and as iOS, edit by touch; the bottom sheet in Português.')
