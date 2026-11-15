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
// Done, ↑ ↓ and Edit, a tap's tips and the slots and ⚙ a touch selection
// shows, the quick keys and their undo, the panel's open and restore, and the
// suggestions opening above the field; on the tablet, a mouse keeps hover. It
// runs in Chromium, so it covers neither WebKit nor a real on-screen keyboard:
// those are the device checklist's (CONTRIBUTING.md). It fails on any check
// that doesn't hold, and on any page error.
//
// Run: `node scripts/touch-run.mjs` (`npm run test:touch`), after
// `npm run build:plugin`.

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
  window.__start = async (sheet, manifest, phone) => {
    FakeObsidian.Platform.isPhone = phone
    FakeObsidian.Platform.isTablet = !phone
    FakeObsidian.Platform.isMobile = true
    const app = new FakeObsidian.App()
    app.vault.add(${JSON.stringify(FILE)}, sheet)
    const plugin = new module.exports.default(app, manifest)
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(FILE)}))
    window.__leaf = leaf
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
  { name: 'tablet', os: 'android', viewport: { width: 820, height: 1180 }, phone: false },
  { name: 'tablet', os: 'ios', viewport: { width: 820, height: 1180 }, phone: false, platform: 'iPad' },
]

const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch()
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
const results = []
const errors = []
try {
  for (const device of DEVICES) {
    const where = `${device.name}/${device.os}`
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
      const field = () => tab.locator('input.math-element__field')
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
      // The panel's own close: on the tablet the floating panel covers More tools,
      // as on a small window, so Math settings isn't reachable while it is open.
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
        // A floating panel (the tablet's, narrower than 1229 px) closes at a press on the
        // canvas, as on a small window, so the edit found it closed (section 8).
        opened === 'Variables' && during === 'Format' && (device.phone ? (await panelOpen()) && (await activeTab()) === 'Variables' : !(await panelOpen())),
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
console.log('Touch run passed: a phone and a tablet, as Android and as iOS, edit by touch.')
