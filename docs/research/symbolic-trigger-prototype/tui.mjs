// PROTOTYPE — throwaway. Run: node docs/research/symbolic-trigger-prototype/tui.mjs
// Each sample sheet is written the way a user would type it in each mode.
// Commands (type, then Enter):
//   1 2 3        switch mode (request, auto, declared)
//   s            next sample sheet
//   t            tidy on/off (math.js simplify after substitution)
//   e N text     replace line N    a text   add a line    i N text  insert before line N
//   d N          delete line N     r        reset this sheet for this mode
//   q            quit

import readline from 'node:readline'
import { evaluateSheet, MODES } from './trigger.mjs'

const SAMPLES = [
  {
    title: 'Rod in tension, with a typo on the last line',
    request: [
      '# Rod in tension',
      'A = pi * d^2 / 4 ->',
      'sigma = F / A ->',
      's_y = 250 MPa',
      'n = s_y / sigam ->      # typo: sigam',
    ],
    auto: [
      '# Rod in tension',
      'A = pi * d^2 / 4',
      'sigma = F / A',
      's_y = 250 MPa',
      'n = s_y / sigam         # typo: sigam',
    ],
    declared: [
      '# Rod in tension',
      'symbols F, d',
      'A = pi * d^2 / 4',
      'sigma = F / A',
      's_y = 250 MPa',
      'n = s_y / sigam         # typo: sigam',
    ],
  },
  {
    title: 'Formula first, values later: does it turn into a number?',
    request: [
      'I = b * h^3 / 12 ->',
      'sigma = M * c / I ->',
      'b = 40 mm',
      'h = 80 mm',
      'c = h / 2',
      'M = 2 kN m',
      'sigma_num = sigma ->',
    ],
    auto: [
      'I = b * h^3 / 12',
      'sigma = M * c / I',
      'b = 40 mm',
      'h = 80 mm',
      'c = h / 2',
      'M = 2 kN m',
      'sigma_num = sigma',
    ],
    declared: [
      'symbols b, h, M, c',
      'I = b * h^3 / 12',
      'sigma = M * c / I',
      'b = 40 mm',
      'h = 80 mm',
      'c = h / 2',
      'M = 2 kN m',
      'sigma_num = sigma',
    ],
  },
  {
    title: 'A numeric sheet where a value was forgotten (no symbols wanted)',
    request: ['P = 15 kW', 'eta = 0.7', 'Q = P * eta / (rho * g * H)'],
    auto: ['P = 15 kW', 'eta = 0.7', 'Q = P * eta / (rho * g * H)'],
    declared: ['P = 15 kW', 'eta = 0.7', 'Q = P * eta / (rho * g * H)'],
  },
]

const B = '\x1b[1m', D = '\x1b[2m', R = '\x1b[0m'
const RED = '\x1b[31m', CYAN = '\x1b[36m', GREEN = '\x1b[32m'

const state = { mode: 'request', sample: 0, tidy: false, sheets: SAMPLES.map(cloneSample), msg: '' }

function cloneSample(s) {
  return Object.fromEntries(MODES.map((m) => [m, [...s[m]]]))
}

function lines() {
  return state.sheets[state.sample][state.mode]
}

function render() {
  console.clear()
  const s = SAMPLES[state.sample]
  console.log(`${B}mode${R}    ${MODES.map((m, i) => (m === state.mode ? `${B}[${i + 1}] ${m}${R}` : `${D}[${i + 1}] ${m}${R}`)).join('   ')}`)
  console.log(`${B}sheet${R}   ${state.sample + 1}/${SAMPLES.length}  ${s.title}`)
  console.log(`${B}tidy${R}    ${state.tidy ? 'on (math.js simplify)' : 'off (plain substitution)'}`)
  console.log('')
  const results = evaluateSheet(lines(), state.mode, { tidy: state.tidy })
  const w = Math.max(...lines().map((l) => l.length), 10)
  results.forEach((r, i) => {
    const n = `${D}${String(i + 1).padStart(2)}${R}`
    const src = r.raw.padEnd(w)
    let out = ''
    const notes = r.notes?.length ? `${D}  (${r.notes.join('; ')})${R}` : ''
    if (r.kind === 'value') out = `${GREEN}= ${r.text}${R}${notes}`
    else if (r.kind === 'formula') {
      out = `${CYAN}→ ${r.name ? r.name + ' = ' : ''}${r.text}${R}${D}  symbols: ${r.symbols.join(', ')}${R}${notes}`
    } else if (r.kind === 'error') out = `${RED}✗ ${r.text}${R}`
    else if (r.kind === 'declare') out = `${D}${r.text}${R}`
    console.log(`${n}  ${src}   ${out}`)
  })
  console.log('')
  if (state.msg) console.log(`${D}${state.msg}${R}\n`)
  console.log(
    `${B}1/2/3${R}${D} mode${R}  ${B}s${R}${D} sheet${R}  ${B}t${R}${D} tidy${R}  ${B}e N text${R}${D} edit${R}  ${B}a text${R}${D} add${R}  ${B}i N text${R}${D} insert${R}  ${B}d N${R}${D} delete${R}  ${B}r${R}${D} reset${R}  ${B}q${R}${D} quit${R}`,
  )
}

function handle(input) {
  state.msg = ''
  const cmd = input.trim()
  const m = /^(\w)\s*(\d+)?\s?(.*)$/.exec(cmd)
  if (!m) return
  const [, c, nStr, rest] = m
  const n = nStr ? Number(nStr) - 1 : -1
  const ls = lines()
  if (c >= '1' && c <= '3' && !nStr) state.mode = MODES[Number(c) - 1]
  else if (c === 's') state.sample = (state.sample + 1) % SAMPLES.length
  else if (c === 't') state.tidy = !state.tidy
  else if (c === 'e' && n >= 0 && n < ls.length) ls[n] = rest
  else if (c === 'a') ls.push([nStr, rest].filter(Boolean).join(' '))
  else if (c === 'i' && n >= 0) ls.splice(n, 0, rest)
  else if (c === 'd' && n >= 0) ls.splice(n, 1)
  else if (c === 'r') state.sheets[state.sample][state.mode] = [...SAMPLES[state.sample][state.mode]]
  else if (c === 'q') process.exit(0)
  else state.msg = `not understood: ${cmd}`
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
render()
rl.setPrompt('> ')
rl.prompt()
rl.on('line', (l) => {
  handle(l)
  render()
  rl.prompt()
})
