// The follow run (docs/spec-v1.md section 4, While editing a line: the math
// is always drawn on its box, and the view follows the caret; 0.2.1, #191):
// the built `dist-plugin/main.js` in headless Chromium against the fake
// `obsidian`, with real keys and mouse.
//
// On a 14-inch laptop's window (1366 × 768) it opens the last line of the
// true-position sheet, placed so the element ends near the window's bottom,
// types the 146-character plot line, presses Enter and then Esc. At each step
// it checks that nothing has been scrolled by the browser (the overlay, any
// box around it, or the field itself), that the element's content is drawn
// where the overlay put it, on its box, and that the caret is inside the
// visible area less the 48 px margin. Then: a pan by hand is left alone until
// the next keystroke, and ↑ from a line above the window brings it back. On a
// small window (1000 × 800) the panel floats, and a line opened under it
// moves clear by the same rule.
//
// The field wraps (M4e, #196): at 1280 px and at 880 px wide the plot line
// continues on the field's next rows short of the panel, the element grows
// taller and its anchor with it, the field and the hidden copy that sizes it
// break at the same places, ↑ and ↓ move between the field's rows and leave
// the line only from the first or the last, the suggestions open under the
// caret's row, a pasted newline becomes a space, the field's Ctrl+Z takes
// typing back, and a pan during the edit doesn't re-wrap. An element with a
// chosen width wraps at that width.
//
// A rule's condition (M4e, #197): with a line open and half-typed, + Add rule
// puts the keyboard in the new row's field, a condition is typed there with
// its suggestions and its live state, and Enter saves it, the line still open
// with its text and its caret; a press back in the line continues the edit,
// with the field's own Ctrl+Z; and after Esc one Ctrl+Z takes the condition
// back. It fails on any check that doesn't hold, and on any page error.
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
    window.__leaf = leaf
  }
  // The calc element's source and stored formats, from the view's file as the app holds it.
  window.__calc = () => JSON.parse(window.__leaf.view.getViewData()).elements.find((e) => e.id === 'calc' && !e.isDeleted)?.customData
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
    for (let e = document.querySelector('.math-element__field') ?? body; e; e = e.parentElement) {
      if (e.scrollLeft || e.scrollTop) scrolled.push((String(e.className) || e.tagName) + ' ' + e.scrollLeft + ',' + e.scrollTop)
    }
    if (window.scrollX || window.scrollY) scrolled.push('window ' + window.scrollX + ',' + window.scrollY)
    // Where the overlay put the element: its translate, from the stage's corner.
    const at = /translate\\((-?[\\d.e+-]+)px, (-?[\\d.e+-]+)px\\)/.exec(element.style.transform)
    const stage = box(document.querySelector('.app-shell__stage'))
    const field = document.querySelector('.math-element__field')
    let caret = null
    let wrapped = null
    if (field) {
      const copyBox = field.parentElement.querySelector('.math-element__field-text')
      const copy = copyBox.firstChild
      const fieldBox = box(field)
      // The caret: the left of the character it stands before, or the right of the last one.
      let x = fieldBox.left
      let top = fieldBox.top
      let bottom = fieldBox.bottom
      const at = field.selectionStart
      if (copy && copy.length > 0) {
        const range = document.createRange()
        const end = at >= copy.length
        range.setStart(copy, end ? copy.length - 1 : at)
        range.setEnd(copy, end ? copy.length : at + 1)
        const rects = range.getClientRects()
        const rect = end ? rects[rects.length - 1] : rects[0]
        x = end ? rect.right : rect.left
        // In a field of several rows, the caret's own row.
        if (field.offsetHeight > 36) {
          top = rect.top
          bottom = rect.bottom
        }
      }
      caret = { x, top, bottom, at, focused: document.activeElement === field }
      wrapped = {
        rows: Math.round(field.offsetHeight / 24),
        // The field breaks where the copy does when its own text is as tall as the copy.
        fieldText: field.scrollHeight,
        copyText: copyBox.offsetHeight,
        line: Number(field.closest('[data-line]')?.dataset.line ?? -1),
        value: field.value,
      }
    }
    const list = document.querySelector('.math-suggest')
    const canvas = document.querySelector('.excalidraw')
    const panel = document.querySelector('.sheet-sidebar')
    return {
      scrolled,
      body: box(body),
      put: at && { left: stage.left + Number(at[1]), top: stage.top + Number(at[2]) },
      field: box(field),
      caret,
      wrapped,
      list: box(list),
      // The anchor's size, as the overlay last read it, and the content's.
      anchor: { width: parseFloat(element.style.width), height: parseFloat(element.style.height) },
      content: { width: body.offsetWidth, height: body.offsetHeight },
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
const sheetAt = (x, y, source, more = {}) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    elements: [{ id: 'calc', type: 'rectangle', x, y, width: 160, height: 60, customData: { kind: 'math', source, ...more } }],
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
    const opened = await step('the line opens')
    await tab.keyboard.press('ControlOrMeta+a')
    await tab.keyboard.type(PLOT, { delay: 5 })
    const typed = await step('the plot line is typed')
    // From M4e the field wraps, so the long line grows down and the view follows it up, not sideways.
    row('the field wrapped, and the view followed the caret’s row up as the field grew', typed.wrapped.rows > 1 && typed.body.top < opened.body.top - 20 && Math.abs(typed.body.left - opened.body.left) < 1, `${typed.wrapped.rows} rows; content moved from y ${px(opened.body.top)} to ${px(typed.body.top)}`)
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

  // The field wraps (M4e, #196): the true-position sheet's longest line, at two window widths.
  for (const width of [1280, 880]) {
    await run(`wrap, ${width} px`, { width, height: 800 }, sheetAt(40, 60, SHORT), async ({ tab, row, step, state, lineBox, px }) => {
      // The sheet opens centred: pan it so the element starts near the window's
      // left edge, its last line clear of Excalidraw's own controls.
      await tab.mouse.move(600, 300)
      await tab.mouse.wheel((await state()).body.left - 40, (await lineBox(LAST)).y - 400)
      await tab.waitForTimeout(400)
      const last = await lineBox(LAST)
      await tab.mouse.dblclick(last.x + 30, last.y + 10)
      await tab.waitForTimeout(600)
      const opened = await state()
      await tab.keyboard.press('ControlOrMeta+a')
      await tab.keyboard.type(PLOT, { delay: 5 })
      const typed = await step('the plot line is typed')
      const area = { ...typed.canvas }
      if (typed.panel && typed.panel.left > area.left) area.right = Math.min(area.right, typed.panel.left)
      row(
        'the longest line wraps inside the window, short of the panel',
        typed.wrapped.rows > 1 && typed.wrapped.value === PLOT && typed.field.right <= area.right - MARGIN + 1 && typed.field.left >= area.left,
        `${typed.wrapped.rows} rows, field ${px(typed.field.left)}–${px(typed.field.right)}; visible to ${px(area.right)}`,
      )
      // At 880 px the other lines already need more than the wrap width: there the field wraps at their equations' width.
      if (width === 1280) row('the whole element is inside the visible area less the margin', typed.body.right <= area.right - MARGIN + 1, `element’s right at ${px(typed.body.right)}`)
      row('the view didn’t move sideways', Math.abs(opened.body.left - 40) < 2 && Math.abs(typed.body.left - opened.body.left) < 1, `element’s left at ${px(opened.body.left)}, then ${px(typed.body.left)}`)
      row(
        'the field and its copy break at the same places',
        typed.wrapped.fieldText === typed.wrapped.copyText && typed.wrapped.copyText === typed.wrapped.rows * 24,
        `field’s text ${typed.wrapped.fieldText} px tall, copy ${typed.wrapped.copyText} px`,
      )
      row(
        'the element grew taller, and its anchor with it',
        Math.abs(typed.anchor.height - typed.content.height) <= 0.5 && Math.abs(typed.anchor.width - typed.content.width) <= 0.5,
        `anchor ${px(typed.anchor.width)} × ${px(typed.anchor.height)}, content ${px(typed.content.width)} × ${px(typed.content.height)}`,
      )

      // ↑ moves between the field's rows, and leaves the line only from the first.
      const rows = typed.wrapped.rows
      let ups = 0
      let s = typed
      while (ups < rows + 2 && s.wrapped?.line === LAST) {
        const before = s.caret
        await tab.keyboard.press('ArrowUp')
        await tab.waitForTimeout(80)
        s = await state()
        ups += 1
        // At a row's end the caret counts as on the next row's start: it has still moved back in the text.
        if (s.wrapped?.line === LAST && !(s.caret.at < before.at)) {
          row('↑ moves the caret up a row', false, `press ${ups}: caret at ${before.at} then ${s.caret.at}`)
        }
      }
      row('↑ leaves the line only from its first row', ups === rows && s.wrapped?.line === LAST - 1, `${ups} presses for ${rows} rows; now on line ${s.wrapped?.line}`)
      // ↓ goes back, and moves down the rows; from the last row it has nowhere to go and stays.
      await tab.keyboard.press('ArrowDown')
      await tab.waitForTimeout(300)
      await tab.keyboard.press('ControlOrMeta+Home')
      s = await state()
      row('↓ opens the long line again, wrapped as before', s.wrapped?.line === LAST && s.wrapped.rows === rows && s.caret.at === 0, `line ${s.wrapped?.line}, ${s.wrapped?.rows} rows`)
      for (let down = 1; down < rows; down += 1) {
        const before = s.caret
        await tab.keyboard.press('ArrowDown')
        await tab.waitForTimeout(80)
        s = await state()
        if (s.wrapped?.line !== LAST || !(s.caret.top > before.top + 12)) {
          row('↓ moves the caret down a row', false, `press ${down}: row top ${px(before.top)} then ${px(s.caret.top)}`)
        }
      }
      row('↓ stays in the line until its last row', s.wrapped?.line === LAST && s.caret.top > s.field.bottom - 30, `caret’s row at ${px(s.caret.top)}, field’s bottom ${px(s.field.bottom)}`)
      await step('after ↑ and ↓')

      // The suggestions hang under the caret's row, not under the whole field.
      // `mark dx` is on a middle row: with its `x` taken out, `d` offers the sheet's names.
      await tab.keyboard.press('ControlOrMeta+Home')
      for (let i = 0; i < PLOT.indexOf('mark dx') + 'mark dx'.length; i += 1) await tab.keyboard.press('ArrowRight')
      await tab.keyboard.press('Backspace')
      await tab.waitForTimeout(300)
      s = await state()
      row(
        'the suggestions open under the caret’s row',
        s.list !== null && s.list.top >= s.caret.bottom && s.list.top <= s.caret.bottom + 12 && s.list.top < s.field.bottom - 20 && s.caret.top > s.field.top + 20,
        s.list ? `list’s top ${px(s.list.top)}, caret’s row ${px(s.caret.top)}–${px(s.caret.bottom)}, field’s bottom ${px(s.field.bottom)}` : 'no list',
      )
      await tab.keyboard.press('Escape')
      s = await state()
      row('Esc closes the list and keeps the line', s.list === null && s.wrapped?.line === LAST)
      // The field's own Ctrl+Z takes the typing back.
      await tab.keyboard.press('ControlOrMeta+z')
      await tab.waitForTimeout(200)
      s = await state()
      row('the field’s own Ctrl+Z takes the typing back', s.wrapped?.value === PLOT, `field: ${s.wrapped?.value.slice(0, 24)}…`)

      // A pasted newline becomes a space; the field stays one line.
      await tab.keyboard.press('ControlOrMeta+End')
      await tab.evaluate(() => {
        const data = new DataTransfer()
        data.setData('text/plain', ' # two\nlines\r\nhere')
        document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
      })
      await tab.waitForTimeout(200)
      s = await state()
      row('a pasted newline becomes a space', s.wrapped?.value === `${PLOT} # two lines here`, `field ends: ${s.wrapped?.value.slice(-24)}`)
      row('after the paste the field and its copy still break at the same places', s.wrapped.fieldText === s.wrapped.copyText)
      await tab.keyboard.press('ControlOrMeta+z')
      await tab.waitForTimeout(200)
      s = await state()
      row('the field’s own Ctrl+Z takes the paste back', s.wrapped?.value === PLOT)

      // A pan during the edit doesn't re-wrap: the wrap width was measured when the line opened.
      await tab.mouse.move(600, 300)
      await tab.keyboard.down('Shift')
      await tab.mouse.wheel(0, 200)
      await tab.keyboard.up('Shift')
      await tab.waitForTimeout(400)
      s = await state()
      row('a pan during the edit doesn’t re-wrap', Math.abs(s.body.left - opened.body.left) > 50 && s.wrapped.rows === rows, `element’s left at ${px(s.body.left)}, ${s.wrapped.rows} rows`)
      await tab.keyboard.press('Escape')
      await step('Esc', { open: false })
    })
  }

  // A chosen width is the wrap width: the field wraps at the element's own width.
  await run('wrap, chosen width', { width: 1280, height: 800 }, sheetAt(40, 60, 'a = 2 m\nb = a * 3', { width: 320 }), async ({ tab, row, step, lineBox, px }) => {
    const line = await lineBox(1)
    await tab.mouse.dblclick(line.x + 20, line.y + line.height / 2)
    await tab.waitForTimeout(600)
    // A note is the field's text and leaves the result as it was when the line opened.
    await tab.keyboard.type(' # three times a, with a note long enough to need more rows', { delay: 5 })
    const s = await step('a long line is typed')
    row('the line wraps at the chosen width', s.wrapped.rows > 1 && Math.abs(s.content.width - 320) <= 1, `${s.wrapped.rows} rows, element ${px(s.content.width)} px wide`)
    row('the field and its copy break at the same places', s.wrapped.fieldText === s.wrapped.copyText)
    // Spaces at a row's end, and a word longer than a row, break alike in both.
    await tab.keyboard.type(' '.repeat(60) + 'x'.repeat(90), { delay: 2 })
    const odd = await step('spaces and a long word are typed')
    row(
      'spaces and a long word break at the same places in the field and its copy',
      odd.wrapped.fieldText === odd.wrapped.copyText && odd.wrapped.rows > s.wrapped.rows && Math.abs(odd.content.width - 320) <= 1,
      `${odd.wrapped.rows} rows; field’s text ${odd.wrapped.fieldText} px tall, copy ${odd.wrapped.copyText} px; element ${px(odd.content.width)} px wide`,
    )
  })

  // A rule's condition is typed in the Rules list, the line still open (M4e, #197).
  await run('condition', { width: 1366, height: 768 }, sheetAt(300, 200, 'v_max = 3 m/s\nv = 4 m/s\nw = v'), async ({ tab, row, step, lineBox, px }) => {
    const rules = () =>
      tab.evaluate(() => {
        const active = document.activeElement
        const line = document.querySelector('.math-element__field')
        const fields = [...document.querySelectorAll('.sheet-rules__field')]
        const box = (element) => {
          if (!element) return null
          const { left, top, right, bottom } = element.getBoundingClientRect()
          return { left, top, right, bottom }
        }
        return {
          line: line && { value: line.value, caret: line.selectionStart, focused: active === line },
          conditions: fields.map((field) => ({
            value: field.value,
            caret: field.selectionStart,
            focused: active === field,
            box: box(field),
            scrolls: field.scrollWidth > field.clientWidth,
          })),
          states: [...document.querySelectorAll('.sheet-rules__state')].map((state) => state.textContent),
          options: [...document.querySelectorAll('.sheet-rules__option-name')].map((option) => option.textContent),
          list: box(document.querySelector('.sheet-rules__suggest')),
          panel: box(document.querySelector('.sheet-sidebar')),
          rowRed: document.querySelector('[data-anchor-id="calc"] [data-line="1"]')?.classList.contains('is-text-red') ?? false,
          active: document.activeElement?.className ?? null,
        }
      })
    // The element as the file would hold it. Reading it is a save, which commits
    // what is typed (the line's text, and a condition's): only read after a write.
    const calc = () => tab.evaluate(() => window.__calc())
    const pressPanel = async (name) => {
      const button = tab.locator(`.sheet-sidebar [aria-label="${name}"]`)
      await button.scrollIntoViewIfNeeded()
      const box = await button.boundingBox()
      await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await tab.waitForTimeout(300)
    }
    const line = await lineBox(1)
    await tab.mouse.dblclick(line.x + 30, line.y + line.height / 2)
    await step('the line opens')
    // Half-typed: a factor still to come, and the caret back inside the text.
    await tab.keyboard.type(' * 2 *')
    for (let i = 0; i < 4; i += 1) await tab.keyboard.press('ArrowLeft')
    const HALF = 'v = 4 m/s * 2 *'
    const CARET = HALF.length - 4

    await pressPanel('+ Add rule')
    let s = await rules()
    row(
      '+ Add rule puts the keyboard in the new row’s field, after the line’s name',
      s.conditions.length === 1 && s.conditions[0].focused && s.conditions[0].value === 'v ' && s.conditions[0].caret === 2,
      JSON.stringify(s.conditions[0]),
    )
    row(
      'the line is still open, with its half-typed text and its caret',
      s.line !== null && s.line.value === HALF && s.line.caret === CARET && !s.line.focused,
      JSON.stringify(s.line),
    )
    let file = await calc()
    row('nothing was written into the line: the rule is stored beside it', file.source.split('\n')[1] === HALF && file.formats === '\n@text-red if v\n', JSON.stringify(file))

    // The line is half-typed, so it has no value yet: finish it from the line, then go on in the condition.
    await tab.keyboard.type('> v_')
    await tab.waitForTimeout(200)
    s = await rules()
    row(
      'the field offers the sheet’s names, in a list inside the panel',
      s.options[0] === 'v_max' && s.list !== null && s.list.top >= s.conditions[0].box.bottom && s.list.right <= s.panel.right && s.list.left >= s.panel.left,
      `options: ${s.options.join(', ')}`,
    )
    await tab.keyboard.press('Tab')
    await tab.waitForTimeout(200)
    s = await rules()
    row('Tab takes the suggestion', s.conditions[0].value === 'v > v_max' && s.options.length === 0 && s.conditions[0].focused, s.conditions[0].value)

    // A press back in the line continues the edit: the line is finished there, with the same field.
    const fieldBox = await tab.locator('.math-element__field').boundingBox()
    await tab.mouse.click(fieldBox.x + fieldBox.width - 3, fieldBox.y + fieldBox.height / 2)
    await tab.waitForTimeout(200)
    s = await rules()
    file = await calc()
    row('a press back in the line gives it the keyboard, and saves the condition', s.line?.focused === true && s.line.value === HALF && file.formats === '\n@text-red if v > v_max\n', JSON.stringify(file.formats))
    await tab.keyboard.press('End')
    await tab.keyboard.type(' 1')
    await tab.waitForTimeout(200)
    s = await rules()
    row('the edit continues, and the rule’s live state follows the line', s.line.value === `${HALF} 1` && s.states[0] === 'true' && s.rowRed === false, `${s.line.value}; state ${s.states[0]}`)
    await step('after the press back in the line')

    // The live state follows the condition's field as it is typed, before anything is saved.
    const condition = tab.locator('.sheet-rules__field').first()
    await condition.click()
    await tab.keyboard.press('ControlOrMeta+a')
    await tab.keyboard.type('v > 100 m/s')
    await tab.waitForTimeout(200)
    s = await rules()
    const typedFalse = s.states[0]
    await tab.keyboard.press('ControlOrMeta+a')
    await tab.keyboard.type('v > 3 kg')
    await tab.waitForTimeout(200)
    s = await rules()
    const typedWarning = s.states[0]
    await tab.keyboard.press('ControlOrMeta+a')
    await tab.keyboard.press('Backspace')
    await tab.waitForTimeout(200)
    s = await rules()
    const typedEmpty = s.states[0]
    await tab.keyboard.type('v > 5 m/s')
    await tab.waitForTimeout(200)
    s = await rules()
    row(
      'the live state follows the field as it is typed',
      typedFalse === 'false' && typedWarning.startsWith('⚠') && typedWarning.includes('Units do not match') && typedEmpty === '⚠ a rule needs a condition' && s.states[0] === 'true',
      `${typedFalse} / ${typedWarning} / ${typedEmpty} / ${s.states[0]}`,
    )
    await tab.keyboard.press('Enter')
    await tab.waitForTimeout(300)
    s = await rules()
    file = await calc()
    row(
      'Enter saves the condition, and the line is still open with its text and its caret',
      file.formats === '\n@text-red if v > 5 m/s\n' && s.conditions[0].focused && s.line?.value === `${HALF} 1` && s.line.caret === `${HALF} 1`.length,
      `${JSON.stringify(file.formats)}; line ${JSON.stringify(s.line)}`,
    )

    // A long condition scrolls sideways inside its field, which stays in the panel.
    await tab.keyboard.press('End')
    await tab.keyboard.type(' and v < 1000000 m/s and v_max > 0.000001 m/s and v_max < 1000000 m/s')
    await tab.waitForTimeout(200)
    s = await rules()
    row('a long condition scrolls sideways inside its field', s.conditions[0].scrolls && s.conditions[0].box.right <= s.panel.right && s.conditions[0].box.left >= s.panel.left, `field ${px(s.conditions[0].box.left)}–${px(s.conditions[0].box.right)}, panel to ${px(s.panel.right)}`)
    await tab.keyboard.press('Enter')

    // Back in the line: its own Ctrl+Z still takes its typing back, since the field was never rewritten.
    await tab.mouse.click(fieldBox.x + 20, fieldBox.y + fieldBox.height / 2)
    await tab.keyboard.press('ControlOrMeta+z')
    await tab.waitForTimeout(200)
    s = await rules()
    row('the line’s own Ctrl+Z still takes its typing back', s.line?.focused === true && s.line.value !== `${HALF} 1` && s.line.value.startsWith('v = 4 m/s'), `line: ${s.line?.value}; active ${s.active}`)
    await tab.keyboard.press('ControlOrMeta+Shift+z')
    await tab.waitForTimeout(200)

    // The condition's own Ctrl+Z, with nothing typed in it, doesn't go on to the line's typing.
    await condition.click()
    await tab.keyboard.press('ControlOrMeta+z')
    await tab.waitForTimeout(200)
    s = await rules()
    row('with nothing typed in it, the condition’s Ctrl+Z leaves the line’s text alone', s.conditions[0].focused && s.line?.value === `${HALF} 1`, `line: ${s.line?.value}; active ${s.active}`)
    await tab.mouse.click(fieldBox.x + 20, fieldBox.y + fieldBox.height / 2)

    // Esc leaves the line, which was written with the condition; one Ctrl+Z takes the condition back.
    await tab.keyboard.press('Escape')
    await step('Esc', { open: false })
    const saved = (await calc()).formats
    await tab.keyboard.press('ControlOrMeta+z')
    await tab.waitForTimeout(400)
    file = await calc()
    row(
      'one Ctrl+Z takes the condition back',
      saved.startsWith('\n@text-red if v > 5 m/s and v < 1000000 m/s') && file.formats === '\n@text-red if v > 5 m/s\n',
      `${JSON.stringify(saved.slice(0, 40))}… → ${JSON.stringify(file.formats)}`,
    )
  })

  // The condition's field going away, its rule removed or the tab changed, doesn't leave the line.
  await run('condition, gone', { width: 1366, height: 768 }, sheetAt(300, 200, 'v = 4 m/s\nw = v'), async ({ tab, row, lineBox }) => {
    const read = () =>
      tab.evaluate(() => ({
        line: document.querySelector('.math-element__field')?.value ?? null,
        conditions: [...document.querySelectorAll('.sheet-rules__field')].map((field) => field.value),
        focused: document.activeElement?.classList.contains('sheet-rules__field') ?? false,
        scrolled: [...document.querySelectorAll('.excalidraw, .app-shell__stage, .app-shell__overlay, body, html')].filter((e) => e.scrollTop || e.scrollLeft).map((e) => e.className || e.tagName),
      }))
    const pressPanel = async (selector) => {
      const button = tab.locator(`.sheet-sidebar ${selector}`)
      await button.scrollIntoViewIfNeeded()
      const box = await button.boundingBox()
      await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await tab.waitForTimeout(300)
    }
    const line = await lineBox(0)
    await tab.mouse.dblclick(line.x + 30, line.y + line.height / 2)
    await tab.waitForTimeout(600)
    await pressPanel('[aria-label="+ Add rule"]')
    await tab.keyboard.type('> 3 m/s')
    await pressPanel('[aria-label="+ Add rule"]')
    let s = await read()
    row('a second rule is added while the first is being typed, which saves it', s.conditions.join(' | ') === 'v > 3 m/s | v ' && s.focused && s.line === 'v = 4 m/s', s.conditions.join(' | '))
    await pressPanel('[aria-label="Remove rule 2"]')
    s = await read()
    row('removing the rule whose condition has the keyboard keeps the line open', s.line === 'v = 4 m/s' && s.conditions.join(' | ') === 'v > 3 m/s', `line: ${s.line}; ${s.conditions.join(' | ')}`)
    await tab.locator('.sheet-rules__field').first().click()
    await pressPanel('.sheet-tab[title="Symbols"]')
    s = await read()
    row('changing the tab while a condition has the keyboard keeps the line open', s.line === 'v = 4 m/s' && s.conditions.length === 0, `line: ${s.line}`)
    row('nothing around the sheet was scrolled by the browser', s.scrolled.length === 0, s.scrolled.join(', '))
    // A press on the canvas leaves the line, as it always does.
    await tab.mouse.click(500, 600)
    await tab.waitForTimeout(400)
    s = await read()
    row('a press on the canvas leaves the line', s.line === null)
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
