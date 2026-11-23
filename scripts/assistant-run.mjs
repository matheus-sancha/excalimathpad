// The assistant run (docs/spec-v1.md section 12a, Data protection, "Checked on every pull
// request"; 0.7.0, #312): the seventh Playwright run. It proves the Math assistant's rule line
// by line, over the built plugin (`dist-plugin/main.js` against the fake `obsidian`) and the
// built web app (`dist/`), against a stand-in provider. Nothing leaves the machine:
// Playwright answers the built-in host itself, from the fixtures in
// `src/assistant/fixtures/`, and a local server on 127.0.0.1 stands for a typed address.
//
// Four passes: each home, first with a built-in (Anthropic, the Messages adapter) and then
// with the typed address (Chat Completions), the setup entered in the card. Each pass walks
// the spec's table:
//
//   1. Open a sheet, open the tab, save the setup, type a message: 0 requests.
//   2. Send: the confirm names the host; Cancel: 0 requests, and the host isn't confirmed.
//   3. Send, and accept the confirm: 1 request, to that host only. Its body holds only the
//      model, the instructions, the Math guide, the sheet's listing, the conversation and
//      the message; the key is in its header. The file's name, element ids and image
//      bytes are absent.
//   4. Show models, then Check key: `GET <address>/models` with the key and nothing else.
//   5. Stop during an answer: the request is aborted.
//   6. An answer holding an image, a link and a bare address: 0 more requests.
//   7. A second Send: no confirm. A request to any other host fails the run.
//
// Stop: Playwright 1.63's `route.fulfill` hands Chromium a body whole, never in pieces, so
// with the built-in Stop is pressed while the answer is awaited (the stand-in holds it) and
// the run sees Chromium abort the request; with the typed address the local server streams
// the answer a piece at a time, Stop is pressed once the first piece shows, and the server
// sees the connection closed before its end.
//
// The canary key: it may show nowhere but a request's Authorization header (and the store
// that keeps it). The run looks for it in every request's address, body and other headers,
// in `data.json` and the sheet file (the vault's text and every write in the plugin; the
// recovery copy, the saved file and the browser's other entries on the web), in Copy
// details and Report this error (an element made to fail as it draws, by a lookup of its
// ρ row's TeX that throws; and the tab's failure text, by a `navigator.onLine` that throws
// while the chat draws), in everything the console said, in the page's text and fields,
// and in a provider's quoted error (a 401 whose message echoes the key).
//
// What may pass: in the web home the page's own origin and a GET of a font file from
// esm.sh (answered by Playwright from the installed package, counted); in the plugin home
// nothing but the stand-in once the page has loaded. Anything else fails the run. The web
// app's More tools is also read: no Text to diagram and no Magic frame, Mermaid to
// Excalidraw still there (`aiEnabled` is false).
//
// Two deliberate failing cases, as the blocked run has: `--probe-background` makes the page
// request the built-in host with no press (in step 1), and `--probe-host` makes it request
// another host (in step 3). Each fails the run.
//
// Run: `node scripts/assistant-run.mjs` (`npm run test:assistant`), after `npm run build`.
// ASSISTANT_RUN_ONLY=<name> runs only the passes whose name starts with it (`plugin`, `web
// typed`). ASSISTANT_RUN_SHOTS=<dir> saves a screenshot where a pass stops, and
// ASSISTANT_RUN_STEPS=1 prints when each step began.

import { build } from 'esbuild'
import { createServer } from 'node:http'
import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INSTRUCTIONS } from '../src/assistant/instructions.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist-plugin')
const web = join(root, 'dist')
const args = process.argv.slice(2)
const probeBackground = args.includes('--probe-background')
const probeHost = args.includes('--probe-host')
const ONLY = process.env.ASSISTANT_RUN_ONLY
const SHOTS = process.env.ASSISTANT_RUN_SHOTS

/** The canary key: shaped like a key, unlike any fixture, its last four `a1B2`. */
const CANARY = 'sk-canary-run-5d1e8f0b37c94a26e8-a1B2'
/** What a provider's quoted message shows in its place (section 12a, Storage). */
const HIDDEN = '…a1B2'
const BUILT_IN = { id: 'anthropic', host: 'api.anthropic.com', address: 'https://api.anthropic.com' }
/** The file's name, which no request may carry. */
const BASENAME = 'Pump sizing for Acme Offshore'
const SHEET_PATH = `Calcs/${BASENAME}.excalimathpad`
const SHEET = await readFile(join(root, 'plugin/test/pump-sizing.excalimathpad'), 'utf8')
const SHEET_JSON = JSON.parse(SHEET)
/** Every element's id, and the picture's file id. */
const IDS = [...SHEET_JSON.elements.map((element) => element.id), ...Object.keys(SHEET_JSON.files)]
/** A run of the picture's bytes, from the middle of its base64. */
const IMAGE = Object.values(SHEET_JSON.files).map((file) => file.dataURL.slice(3000, 3060))
const GUIDE = await readFile(join(root, 'docs/math-guide.md'), 'utf8')

const MESSAGES = ['Check this sheet', 'Is the pump big enough?', 'Show me a picture of it', 'One more', 'With a key it refuses']
/** The answer of step 6: Markdown's and raw HTML's image, link and frame, and a bare address. */
const HOSTILE = [
  'Here is a chart: ![chart](https://images.example.com/chart.png)',
  'See [the pump curve](https://docs.example.com/pumps) or https://bare.example.com/x for more.',
  '<img src="https://raw.example.com/i.png"> <iframe src="https://frame.example.com/"></iframe>',
  '<a href="https://link.example.com/">link</a> <link rel="stylesheet" href="https://css.example.com/a.css">',
].join('\n\n')

// --- The stand-in provider -------------------------------------------------------------------

/** A fixture under `src/assistant/fixtures/`: its status, headers and body, as the files are read. */
async function fixture(path) {
  const lines = (await readFile(join(root, 'src/assistant/fixtures', path), 'utf8')).split('\n')
  while (lines[0]?.startsWith('#')) lines.shift()
  const status = Number(/^HTTP (\d+)$/.exec(lines.shift())[1])
  const headers = {}
  for (let line = lines.shift(); line; line = lines.shift()) {
    const colon = line.indexOf(':')
    headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim()
  }
  return { status, headers, body: lines.join('\n') }
}

const event = (name, data) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
/** A Messages stream that says `text`, ended by its mark. */
const messagesStream = (text) =>
  event('message_start', { type: 'message_start', message: { id: 'msg_run', type: 'message', role: 'assistant', content: [], model: 'stand-in', stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } }) +
  event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }) +
  event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }) +
  event('content_block_stop', { type: 'content_block_stop', index: 0 }) +
  event('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }) +
  event('message_stop', { type: 'message_stop' })
const chunk = (content, finish = null) =>
  `data: ${JSON.stringify({ id: 'chatcmpl-run', object: 'chat.completion.chunk', model: 'stand-in', choices: [{ index: 0, delta: content === null ? {} : { content }, finish_reason: finish }] })}\n\n`
/** A Chat Completions stream that says `text`, ended by `[DONE]`. */
const chatStream = (text) => chunk(text) + chunk(null, 'stop') + 'data: [DONE]\n\n'

/** Each answer the stand-in gives, by what the run asks for next, for each adapter. */
const ANSWERS = {
  messages: {
    models: await fixture('messages/models.http'),
    answer: await fixture('messages/answer.http'),
    hostile: { status: 200, headers: { 'content-type': 'text/event-stream' }, body: messagesStream(HOSTILE) },
    refused: { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: `invalid x-api-key: ${CANARY}` } }) },
  },
  chat: {
    models: await fixture('chat/models.http'),
    answer: await fixture('chat/answer.http'),
    hostile: { status: 200, headers: { 'content-type': 'text/event-stream' }, body: chatStream(HOSTILE) },
    refused: { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: { message: `Incorrect API key provided: ${CANARY}.`, type: 'invalid_request_error', code: 'invalid_api_key' } }) },
  },
}
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, anthropic-version, anthropic-dangerous-direct-browser-access',
}

/** What the stand-in does with the next Send: `answer`, `hostile`, `refused`, or `hold` (Stop). */
const plan = { next: 'answer' }

// The typed address: a provider on this machine, Chat Completions at `/v1`.
const typed = { aborted: 0, finished: 0 }
const provider = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS)
    return response.end()
  }
  const send = ({ status, headers, body }) => {
    response.writeHead(status, { ...headers, ...CORS })
    response.end(body)
  }
  if (request.method === 'GET' && path === '/v1/models') return send(ANSWERS.chat.models)
  if (request.method !== 'POST' || path !== '/v1/chat/completions') return send({ status: 404, headers: {}, body: '' })
  request.resume()
  if (plan.next !== 'hold') return send(ANSWERS.chat[plan.next])
  // Stop: the answer as it is written, a piece every 400 ms, never quick enough to end first.
  response.writeHead(200, { 'content-type': 'text/event-stream', ...CORS })
  response.write(chunk('The pump '))
  let pieces = 0
  const timer = setInterval(() => {
    pieces += 1
    if (pieces < 40) return void response.write(chunk('runs '))
    clearInterval(timer)
    typed.finished += 1
    response.end(chunk(null, 'stop') + 'data: [DONE]\n\n')
  }, 400)
  response.on('close', () => {
    if (!response.writableFinished) {
      clearInterval(timer)
      typed.aborted += 1
    }
  })
})
await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve))
const TYPED = { id: 'other', host: `127.0.0.1:${provider.address().port}`, address: `http://127.0.0.1:${provider.address().port}/v1`, model: 'local-model' }

// --- The pages ---------------------------------------------------------------------------------

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

const pluginPage = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="/styles.css">
<style>html,body{margin:0;height:100%}.workspace,.workspace-leaf,.workspace-leaf-content{height:100%}
.view-content{height:100%;box-sizing:border-box}</style>
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
  window.__open = async (sheet, manifest) => {
    const app = new FakeObsidian.App()
    app.vault.add(${JSON.stringify(SHEET_PATH)}, sheet)
    const plugin = new module.exports.default(app, manifest)
    await plugin.onload()
    const leaf = app.workspace.getLeaf()
    await leaf.openFile(new FakeObsidian.TFile(${JSON.stringify(SHEET_PATH)}))
    window.__app = app
    window.__plugin = plugin
  }
  // Where the plugin may keep anything: data.json, the sheet as the vault holds it and every write.
  window.__kept = async () => ({
    dataJson: JSON.stringify(window.__plugin.dataJson ?? null),
    sheet: await window.__app.vault.read(new FakeObsidian.TFile(${JSON.stringify(SHEET_PATH)})),
    writes: JSON.stringify(window.__app.vault.writes),
  })
  window.__setup = () => window.__app.secretStorage.secrets.get('excalimathpad-assistant') ?? null
</script>
</body></html>`

const types = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }
const pages = createServer(async (request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  try {
    let body
    if (path === '/') body = pluginPage
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
await new Promise((resolve) => pages.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${pages.address().port}`

// Every page: the clipboard Copy details writes to, kept; a `navigator.onLine` the run can
// make throw, so the chat's next draw fails into its tab's notice; and, on the web, a save
// dialog whose file the run reads back.
const INIT = () => {
  window.__copied = []
  window.__saved = []
  window.__breakChat = false
  window.__breakTex = false
  // The overlay's KaTeX cache is a Map keyed by TeX: its lookup of the ρ row throws on demand.
  const get = Map.prototype.get
  Map.prototype.get = function (key) {
    if (window.__breakTex && typeof key === 'string' && key.includes('\\rho')) throw new Error('The element failed')
    return get.call(this, key)
  }
  Object.defineProperty(Navigator.prototype, 'clipboard', {
    configurable: true,
    get: () => ({ writeText: (text) => Promise.resolve(void window.__copied.push(text)), write: () => Promise.resolve() }),
  })
  Object.defineProperty(Navigator.prototype, 'onLine', {
    configurable: true,
    get() {
      if (window.__breakChat) throw new Error('The assistant tab failed')
      return true
    },
  })
  // A file handle whose methods are on its prototype: IndexedDB keeps the recovery copy's
  // handle as a plain object (methods aren't cloned), and what Ctrl+S writes goes to __saved.
  // No real file system: with the browser's own (OPFS) here, CI's runners lost the browser
  // while the run read the saved file and the recovery copy back (#342).
  const methods = {
    async getFile() {
      return new File([window.__saved.at(-1) ?? ''], this.name)
    },
    async createWritable() {
      return { write: async (data) => void window.__saved.push(String(data)), close: async () => {} }
    },
    async queryPermission() {
      return 'granted'
    },
  }
  window.showSaveFilePicker = async ({ suggestedName }) => Object.assign(Object.create(methods), { kind: 'file', name: suggestedName })
}

// --- The run -------------------------------------------------------------------------------------

const { chromium } = createRequire(import.meta.url)('playwright')
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'))
const results = []
const errors = []
const timings = []
if (SHOTS) await mkdir(SHOTS, { recursive: true })

const hostOf = (url) => new URL(url).host
const fontFile = (url) => {
  const { host, pathname } = new URL(url)
  return host === 'esm.sh' && /\/dist\/prod\/fonts\/.+\.woff2$/.test(pathname) ? pathname.slice(pathname.indexOf('/fonts/') + 1) : null
}

/** One pass: a home (`plugin` or `web`) and a target (the built-in or the typed address). */
async function pass(home, target) {
  const where = `${home} ${target === BUILT_IN ? 'built-in' : 'typed'}`
  if (ONLY && !where.startsWith(ONLY)) return
  const began = Date.now()
  const row = (check, ok, detail = '') => results.push({ where, check, ok: !!ok, detail })
  // A browser of its own: a browser that goes away fails this pass, by name, and not the next.
  const phase = { now: 'starting' }
  const browser = await chromium.launch()
  browser.on('disconnected', () => {
    if (phase.now !== 'done') errors.push(`${where}: the browser went away while ${phase.now}`)
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await context.addInitScript(INIT)
  /** The step the requests that arrive now belong to. */
  const now = { step: 0 }
  /** Every request the app made, in order: the stand-in's, and anything else (which fails). */
  const log = []
  const fonts = []
  const said = []
  let loaded = false
  /** Each held Send's route, released (with a late answer) if Stop never comes. */
  const held = new Map()
  context.on('requestfailed', (request) => {
    const entry = log.find((e) => e.request === request)
    if (entry) entry.failed = request.failure()?.errorText ?? 'failed'
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = request.url()
    if (url.startsWith(`${origin}/`)) {
      // The harness's own files; on the web, the page's own origin, which the app loads from.
      if (home === 'web' || !loaded) return route.continue()
      log.push({ step: now.step, method: request.method(), url, other: 'the page’s server, after the plugin loaded' })
      return route.abort('blockedbyclient')
    }
    const font = home === 'web' && request.method() === 'GET' ? fontFile(url) : null
    if (font) {
      fonts.push(url)
      const body = await readFile(join(root, 'node_modules/@excalidraw/excalidraw/dist/prod', font)).catch(() => null)
      return body ? route.fulfill({ status: 200, headers: { 'content-type': 'font/woff2', ...CORS }, body }) : route.abort('blockedbyclient')
    }
    const host = hostOf(url)
    if (request.method() === 'OPTIONS') {
      // A browser's own preflight, never the app's request: counted apart, and only to the setup's host.
      log.push({ step: now.step, method: 'OPTIONS', url, preflight: true, other: host === target.host ? null : 'a preflight to another host' })
      return route.fulfill({ status: 204, headers: CORS })
    }
    const entry = {
      step: now.step,
      method: request.method(),
      url,
      host,
      headers: await request.allHeaders(),
      body: request.postData(),
      request,
      other: host === target.host ? null : 'another host',
    }
    log.push(entry)
    if (entry.other) return route.abort('blockedbyclient')
    if (target === TYPED) return route.continue()
    const answers = ANSWERS.messages
    if (entry.method === 'GET') return route.fulfill({ ...answers.models, headers: { ...answers.models.headers, ...CORS } })
    if (plan.next === 'hold') {
      // Stop: the answer is held until Chromium aborts the request; a late answer if it never does.
      await new Promise((resolve) => {
        held.set(request, resolve)
        setTimeout(resolve, 15_000)
      })
      if (entry.failed) return undefined
      return route.fulfill({ ...answers.answer, headers: { ...answers.answer.headers, ...CORS } }).catch(() => {})
    }
    const answer = answers[plan.next]
    return route.fulfill({ ...answer, headers: { ...answer.headers, ...CORS } })
  })
  context.on('requestfailed', (request) => held.get(request)?.())
  context.on('websocket', (socket) => log.push({ step: now.step, method: 'WS', url: socket.url(), other: 'a WebSocket' }))

  const tab = await context.newPage()
  tab.on('pageerror', (error) => errors.push(`${where}: ${error.message}`))
  tab.on('crash', () => errors.push(`${where}: the page crashed while ${phase.now}`))
  tab.on('console', (message) => said.push(message.text()))
  /** The requests of `step` the app made: no preflight. */
  const made = (step) => log.filter((e) => e.step === step && !e.preflight)
  const settle = (ms = 600) => tab.waitForTimeout(ms)
  const answers = () => tab.locator('[data-testid="assistant-answer"]')
  const lastState = () => answers().last().getAttribute('data-state')
  const until = async (test, ms = 15_000) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (await test()) return true
      await tab.waitForTimeout(100)
    }
    return false
  }
  const confirm = () => tab.locator('[data-testid="assistant-first-request"]')
  const sendButton = () => tab.locator('.assistant-chat__compose .assistant-card__button.is-primary')
  const stopButton = () => tab.locator('.assistant-chat__compose .assistant-card__button:not(.is-primary)')
  const field = () => tab.locator('.assistant-chat__field')
  const card = (name) => tab.locator('.assistant-card .assistant-card__button', { hasText: name })
  const keyButton = () => tab.locator('.assistant-chat__header [aria-label="Provider and key"]')
  const setupHosts = async () => {
    const text = await tab.evaluate((h) => (h === 'plugin' ? window.__setup() : localStorage.getItem('excalimathpad.assistant')), home)
    try {
      return JSON.parse(text).hosts
    } catch {
      return null
    }
  }
  const ask = async (message) => {
    await field().fill(message)
    await sendButton().click()
  }

  try {
    // Step 1: open a sheet, open the tab, save the setup, type a message.
    const stepTimes = []
    const mark = (step) => {
      stepTimes.push(`${now.step}: ${((Date.now() - began) / 1000).toFixed(1)} s`)
      now.step = step
      phase.now = `in step ${step}`
    }
    phase.now = 'in step 1'
    now.step = 1
    if (home === 'plugin') {
      await tab.goto(`${origin}/`)
      await tab.evaluate(([text, m]) => window.__open(text, m), [SHEET, manifest])
      loaded = true
    } else {
      await tab.goto(`${origin}/web/`)
      await tab.waitForSelector('.excalidraw .main-menu-trigger', { timeout: 30_000 })
      // A sheet dropped on the canvas opens with its file's name, which no request may carry.
      await tab.evaluate(([name, text]) => {
        const transfer = new DataTransfer()
        transfer.items.add(new File([text], name, { type: 'application/json' }))
        document.querySelector('.excalidraw canvas').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }))
      }, [`${BASENAME}.excalimathpad`, SHEET])
      await tab.waitForFunction((name) => document.querySelector('[data-testid="file-name"]')?.textContent?.includes(name), BASENAME, { timeout: 30_000 })
    }
    await tab.waitForSelector('.math-element .katex', { timeout: 30_000 })
    await tab.click('.App-toolbar__extra-tools-trigger')
    if (home === 'web') {
      // aiEnabled is false: no Text to diagram and no Magic frame; Mermaid to Excalidraw stays.
      const tools = await tab.evaluate(() => [...document.querySelectorAll('.App-toolbar__extra-tools-dropdown .dropdown-menu-item__text')].map((item) => item.childNodes[0]?.textContent.trim()))
      row('More tools has no Text to diagram and no Magic frame; Mermaid to Excalidraw and the Math assistant are there', tools.includes('Mermaid to Excalidraw') && tools.includes('Math assistant') && !tools.some((t) => /text to diagram|magic frame/i.test(t)), tools.join(', '))
    }
    await tab.click('.App-toolbar__extra-tools-dropdown .dropdown-menu-item:has-text("Math assistant")')
    await tab.waitForSelector('[data-testid="assistant-tab"] .assistant-card', { timeout: 10_000 })
    if (target === TYPED) {
      await tab.locator('.assistant-card select').first().selectOption('other')
      await tab.locator('.assistant-card__field input[type="text"]').first().fill(TYPED.address)
    }
    await tab.locator('.assistant-card input[type="password"]').fill(CANARY)
    if (target === TYPED) await tab.locator('.assistant-card__row.is-wrapping input').fill(TYPED.model)
    await card('Save').click()
    await field().waitFor({ timeout: 10_000 })
    await field().fill(MESSAGES[0])
    if (probeBackground) await tab.evaluate((address) => window.fetch(`${address}/v1/models`).catch(() => {}), target.address)
    await settle()
    row('1. open the sheet and the tab, save the setup, type a message: 0 requests', made(1).length === 0, `${made(1).length} requests`)

    // Step 2: Send; the confirm names the host; Cancel sends nothing and confirms nothing.
    mark(2)
    await sendButton().click()
    await confirm().waitFor({ timeout: 10_000 })
    const label = await confirm().getAttribute('aria-label')
    row('2. Send: the confirm names the host', label?.includes(target.host), label)
    await confirm().locator('.assistant-card__button:not(.is-primary)').click()
    await settle()
    const hosts = await setupHosts()
    row('2. Cancel: 0 requests, and the host isn’t confirmed', made(2).length === 0 && Array.isArray(hosts) && !hosts.includes(target.host), `${made(2).length} requests; confirmed hosts ${JSON.stringify(hosts)}`)

    // Step 3: Send, accept: one request, to that host only, holding only what a Send carries.
    mark(3)
    await sendButton().click()
    await confirm().waitFor({ timeout: 10_000 })
    await confirm().locator('.assistant-card__button.is-primary').click()
    if (probeHost) await tab.evaluate(() => window.fetch('https://api.example.net/collect').catch(() => {}))
    await until(async () => (await lastState()) === 'answer')
    await settle()
    const sent = made(3)
    const send = sent[0]
    row('3. Send, accepted: 1 request, a POST to that host only', sent.length === 1 && send.method === 'POST' && !send.other && (await lastState()) === 'answer', sent.map((e) => `${e.method} ${e.url}`).join(', '))
    row('3. the host is confirmed', (await setupHosts())?.includes(target.host), JSON.stringify(await setupHosts()))
    if (send) {
      const carried = carriedBy(send, target, [MESSAGES[0]])
      row('3. its body holds only the model, the instructions, the Math guide, the listing, the conversation and the message', carried.ok, carried.detail)
      row('3. the key is in its Authorization header', send.headers.authorization === `Bearer ${CANARY}`, send.headers.authorization ? 'Bearer …a1B2' : 'none')
      // The fixed text (the instructions and the guide) is the release's own: the sheet's part is the rest.
      const sheetPart = [INSTRUCTIONS, GUIDE].reduce((text, fixed) => text.split(JSON.stringify(fixed).slice(1, -1)).join(''), send.body)
      const absent = [BASENAME, 'Acme', ...IDS, ...IMAGE].filter((text) => sheetPart.includes(text) || sheetPart.includes(JSON.stringify(text).slice(1, -1)))
      row('3. the file’s name, the element ids and the image’s bytes are absent', absent.length === 0, absent.length ? `found ${absent.map((a) => a.slice(0, 20)).join(', ')}` : `${IDS.length} ids, ${IMAGE.length} image`)
    }

    // Step 4: Show models, then Check key: the model list, with the key and nothing else.
    mark(4)
    await keyButton().click()
    await card('Show models').click()
    await tab.locator('.assistant-card select[aria-label="Show models"]').waitFor({ timeout: 10_000 })
    await card('Check key').click()
    const accepted = await until(async () => (await tab.locator('.assistant-card__note').textContent().catch(() => ''))?.includes('accepted this key'))
    await settle()
    const listed = made(4)
    const models = `${target.address}${target === BUILT_IN ? '/v1' : ''}/models`
    row(
      `4. Show models, then Check key: two GET ${models.replace(/^https?:\/\//, '')}, with the key and nothing else`,
      accepted && listed.length === 2 && listed.every((e) => e.method === 'GET' && e.url === models && !e.body && e.headers.authorization === `Bearer ${CANARY}` && keyOnlyIn(e)),
      listed.map((e) => `${e.method} ${e.url}${e.body ? ' with a body' : ''}`).join(', '),
    )
    await keyButton().click()
    await field().waitFor({ timeout: 10_000 })

    // Step 5: Stop during an answer: the request is aborted.
    mark(5)
    plan.next = 'hold'
    const typedBefore = { ...typed }
    await ask(MESSAGES[1])
    if (target === TYPED) await until(async () => (await lastState()) === 'arriving' && /The pump/.test((await answers().last().textContent()) ?? ''))
    else await until(async () => made(5).length === 1 && (await stopButton().isVisible()))
    const before = await lastState()
    await stopButton().click()
    const stopped = await until(async () => (await lastState()) === 'stopped')
    const aborted = target === TYPED ? await until(async () => typed.aborted > typedBefore.aborted, 5000) : await until(async () => !!made(5)[0]?.failed, 5000)
    plan.next = 'answer'
    await settle()
    row(
      `5. Stop during an answer (${before}): the request is aborted`,
      made(5).length === 1 && stopped && aborted && typed.finished === typedBefore.finished,
      target === TYPED ? `the server saw the connection closed before its end: ${typed.aborted - typedBefore.aborted}` : `Chromium: ${made(5)[0]?.failed ?? 'not aborted'}`,
    )

    // Step 6: an answer holding an image, a link and a bare address: nothing more is asked for.
    mark(6)
    plan.next = 'hostile'
    await ask(MESSAGES[2])
    await until(async () => (await lastState()) === 'answer')
    await settle(1500)
    plan.next = 'answer'
    const drawn = await answers().last().evaluate((answer) => answer.querySelectorAll('img, a, iframe, object, embed, link, style, script, video, audio').length)
    row('6. an answer holding an image, a link and a bare address: 0 more requests, and none drawn as one', made(6).length === 1 && drawn === 0, `${made(6).length} request (the Send), ${drawn} drawn`)

    // Step 7: a second Send: no confirm, to that host only.
    mark(7)
    await ask(MESSAGES[3])
    const asked = await confirm().isVisible()
    await until(async () => (await lastState()) === 'answer')
    await settle()
    row('7. a second Send: no confirm, 1 request to that host', !asked && made(7).length === 1 && !made(7)[0].other, `${made(7).length} request, confirm ${asked}`)

    // A provider's quoted error: the key it echoes shows as …a1B2.
    mark(8)
    plan.next = 'refused'
    await ask(MESSAGES[4])
    await until(async () => (await lastState()) === 'failed')
    plan.next = 'answer'
    const quoted = (await answers().last().textContent()) ?? ''
    row('a provider’s quoted error shows the key as …a1B2, never whole', quoted.includes(HIDDEN) && !quoted.includes(CANARY), quoted.slice(0, 120))

    // The sheet written: a nudge, then the vault's autosave or the web's Ctrl+S.
    const box = await tab.locator('.math-element').first().boundingBox()
    await tab.mouse.click(box.x + 4, box.y + 4)
    await tab.keyboard.press('ArrowRight')
    if (home === 'web') await tab.keyboard.press('Control+s')
    await until(() => tab.evaluate((h) => (h === 'plugin' ? window.__app.vault.writes.length > 0 : window.__saved.length > 0), home), 10_000)

    // A failure's text: the chat made to fail as it draws, into its tab's notice.
    await tab.evaluate(() => (window.__breakChat = true))
    await tab.click('.sheet-sidebar .sheet-tab >> nth=4')
    await tab.click('.sheet-sidebar .sheet-tab >> nth=6')
    const failedTab = await tab.locator('.sheet-panel__failed').first().getAttribute('title', { timeout: 5000 }).catch(() => null)
    row('the tab fails: its failure’s text carries no key', failedTab?.includes('The assistant tab failed') && !failedTab.includes(CANARY), failedTab)
    await tab.evaluate(() => (window.__breakChat = false))
    // Copy details and Report this error: an element made to fail as it draws (its ρ row's TeX).
    await tab.evaluate(() => (window.__breakTex = true))
    await tab.keyboard.press('ArrowRight')
    const failedElement = tab.locator('.math-element.is-failed').first()
    await failedElement.waitFor({ timeout: 10_000 }).catch(() => {})
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where.replaceAll(' ', '-')}-failed.png`) })
    await failedElement.locator('button', { hasText: 'Copy details' }).click({ timeout: 5000 }).catch(() => {})
    await settle()
    const report = await failedElement.locator('a', { hasText: 'Report this error' }).getAttribute('href', { timeout: 5000 }).catch(() => null)
    const copied = await tab.evaluate(() => window.__copied.join('\n'))
    row(
      'an element fails: Copy details and Report this error carry no key',
      copied.includes('The element failed') && !!report && !copied.includes(CANARY) && !report.includes(CANARY),
      `${copied.length} characters copied; Report this error ${report}`,
    )
    await tab.evaluate(() => (window.__breakTex = false))

    // The canary, everywhere but the Authorization header.
    const kept =
      home === 'plugin'
        ? await tab.evaluate(() => window.__kept())
        : await tab.evaluate(async () => ({
            saved: window.__saved.join('\n'),
            others: JSON.stringify(Object.entries(localStorage).filter(([name]) => name !== 'excalimathpad.assistant')),
            recovery: await new Promise((resolve) => {
              const open = indexedDB.open('excalimathpad', 1)
              open.onsuccess = () => {
                const get = open.result.transaction('recovery', 'readonly').objectStore('recovery').get('current')
                get.onsuccess = () => resolve(get.result?.text ?? '')
                get.onerror = () => resolve('')
              }
              open.onerror = () => resolve('')
            }),
          }))
    const written = Object.values(kept).join('')
    row(
      home === 'plugin' ? 'no key in data.json, the sheet file or any vault write' : 'no key in the saved sheet file, the recovery copy or the browser’s other entries',
      written.length > 1000 && !written.includes(CANARY) && (home === 'web' ? kept.saved.length > 1000 : kept.writes.length > 10),
      Object.entries(kept).map(([name, text]) => `${name} ${text.length}`).join(', '),
    )
    const page = await tab.evaluate(() => document.documentElement.outerHTML + [...document.querySelectorAll('input, textarea')].map((field) => field.value).join('\n'))
    row('no key in the page’s text, its attributes or any field', !page.includes(CANARY))
    row('no key in anything the console said', !said.join('\n').includes(CANARY), `${said.length} messages`)
    const leaks = log.filter((e) => e.headers && !keyOnlyIn(e))
    row('in every request the key is in the Authorization header only', leaks.length === 0, leaks.map((e) => e.url).join(', '))
    const keyed = log.filter((e) => e.headers?.authorization === `Bearer ${CANARY}`)
    row('every request to the host carries the key', keyed.length === log.filter((e) => e.headers && !e.other).length, `${keyed.length} requests`)

    // Nothing else: no request to another host, the page's server or a WebSocket.
    const others = log.filter((e) => e.other)
    row(
      home === 'web' ? 'nothing else: the page’s own origin and esm.sh’s font files only' : 'nothing else: the stand-in only, once the plugin loaded',
      others.length === 0 && (home === 'plugin' ? fonts.length === 0 : fonts.every((url) => fontFile(url))),
      [...others.map((e) => `${e.other}: ${e.method} ${e.url}`), home === 'web' ? `${fonts.length} font files from esm.sh` : ''].filter(Boolean).join('; '),
    )
    mark(9)
    if (process.env.ASSISTANT_RUN_STEPS) console.log(`${where}: ${stepTimes.join(', ')}`)
    const total = log.filter((e) => !e.preflight)
    console.log(`${where}: ${total.length} requests to ${target.host} (${log.length - total.length} preflights)${home === 'web' ? `, ${fonts.length} font files from esm.sh` : ''}`)
  } catch (error) {
    errors.push(`${where}: the run didn't finish: ${error.message.split('\n')[0]}`)
    for (const e of log.filter((e) => e.other)) errors.push(`${where}: ${e.other}: ${e.method} ${e.url}`)
    if (SHOTS) await tab.screenshot({ path: join(SHOTS, `${where.replaceAll(' ', '-')}.png`) }).catch(() => {})
  } finally {
    plan.next = 'answer'
    for (const release of held.values()) release()
    phase.now = 'closing its context'
    const closing = Date.now()
    await context.close().catch((error) => errors.push(`${where}: closing its context: ${error.message.split('\n')[0]}`))
    if (Date.now() - closing > 3000) console.log(`${where}: closing its context took ${((Date.now() - closing) / 1000).toFixed(1)} s`)
    phase.now = 'done'
    await browser.close().catch(() => {})
    timings.push({ where, ms: Date.now() - began })
  }
}

/** Whether a request carries the canary only in its Authorization header. */
function keyOnlyIn(entry) {
  const { authorization: _key, ...headers } = entry.headers ?? {}
  return ![entry.url, entry.body ?? '', JSON.stringify(headers)].some((text) => text.includes(CANARY))
}

/** What a Send's body holds, against what it may: `messages` in the order the turns went. */
function carriedBy(entry, target, messages) {
  let body
  try {
    body = JSON.parse(entry.body)
  } catch {
    return { ok: false, detail: 'the body isn’t JSON' }
  }
  const problems = []
  const listed = (text) => typeof text === 'string' && /\bE1\b/.test(text) && /18\.81 L \/ s/.test(text)
  if (target === BUILT_IN) {
    if (Object.keys(body).sort().join() !== 'max_tokens,messages,model,stream,system') problems.push(`fields ${Object.keys(body).join(', ')}`)
    const [instructions, guide, listing, ...more] = body.system ?? []
    if (instructions?.text !== INSTRUCTIONS) problems.push('the instructions aren’t the spec’s')
    if (guide?.text !== GUIDE) problems.push('the guide isn’t docs/math-guide.md')
    if (!listed(listing?.text)) problems.push('no listing')
    if (more.length) problems.push(`${more.length} more system blocks`)
    if (body.model !== 'claude-sonnet-5-5') problems.push(`model ${body.model}`)
  } else {
    if (Object.keys(body).sort().join() !== 'messages,model,stream') problems.push(`fields ${Object.keys(body).join(', ')}`)
    const system = body.messages?.[0]
    if (system?.role !== 'system' || !system.content.startsWith(`${INSTRUCTIONS}\n\n${GUIDE}\n\n`) || !listed(system.content.slice(INSTRUCTIONS.length + GUIDE.length))) {
      problems.push('the system message isn’t the instructions, the guide and the listing')
    }
    if (body.model !== TYPED.model) problems.push(`model ${body.model}`)
  }
  const turns = target === BUILT_IN ? body.messages : body.messages?.slice(1)
  const said = (turns ?? []).map((turn) => (typeof turn.content === 'string' ? turn.content : JSON.stringify(turn.content)))
  if (JSON.stringify(said) !== JSON.stringify(messages) || turns.some((turn) => turn.role !== 'user')) problems.push(`turns ${JSON.stringify(said)}`)
  return { ok: problems.length === 0, detail: problems.join('; ') || `${entry.body.length.toLocaleString('en')} bytes` }
}

const began = Date.now()
try {
  for (const home of ['plugin', 'web']) {
    for (const target of [BUILT_IN, TYPED]) {
      const where = `${home} ${target === BUILT_IN ? 'built-in' : 'typed'}`
      await pass(home, target).catch((error) => errors.push(`${where}: the pass didn't start: ${error.message.split('\n')[0]}`))
    }
  }
} finally {
  pages.close()
  provider.close()
}

for (const { where, check, ok, detail } of results) {
  console.log(`${where.padEnd(16)} ${ok ? 'yes' : 'NO '}  ${check}${detail ? `  (${detail})` : ''}`)
}
for (const { where, ms } of timings) console.log(`${where}: the pass took ${(ms / 1000).toFixed(1)} s`)
console.log(`The assistant run took ${((Date.now() - began) / 1000).toFixed(1)} s`)
const failed = results.filter((result) => !result.ok)
const passes = new Set(results.map((result) => result.where)).size
const expected = ONLY ? passes : 4
if (failed.length || errors.length || passes !== expected) {
  console.error('\nAssistant run failed (docs/spec-v1.md section 12a, Data protection):')
  for (const { where, check } of failed) console.error(`  - ${where}: ${check}`)
  for (const error of errors) console.error(`  - ${error}`)
  if (passes !== expected) console.error(`  - ${passes} of ${expected} passes ran`)
  process.exit(1)
}
console.log(
  'Assistant run passed: in the plugin and the web app, with a built-in and a typed address, no request until a press, ' +
    'the confirm, one request to the one host, Show models and Check key, Stop, no request from an answer, no confirm twice, ' +
    'and the canary key nowhere but the Authorization header.',
)
