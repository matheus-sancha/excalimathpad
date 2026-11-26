// PROTOTYPE — throwaway. Run: node docs/research/formula-block-prototype/tui.mjs
// Inserts a formula block into a sample sheet and shows what changes.
// Keys (type, then Enter):
//   1 2 3  block (rectangle I, von Mises, Euler)    s  next sample sheet
//   p      move the insert point (before element 1, 2, ... or at the end)
//   c      collision strategy     m  example-value marking     x  source line on/off
//   q      quit

import readline from 'node:readline'
import { BLOCKS, MARKINGS, STRATEGIES, evaluateSheet, insert, changedUserRows } from './blocks.mjs'

const SHEETS = [
  {
    title: 'Beam check: the user already has b, h and I',
    elements: [
      { title: 'Section', lines: ['b = 50 mm', 'h = 100 mm'] },
      { title: 'Bending', lines: ['M = 3 kN m', 'I = b * h^3 / 12', 'sigma = M * (h / 2) / I'] },
      { title: 'Deflection', lines: ['E = 210 GPa', 'L = 2 m', 'F = 4 kN', 'delta = F * L^3 / (48 * E * I)'] },
    ],
  },
  {
    title: 'Shaft: the user wants sigma_vm, which is not on the sheet yet',
    elements: [
      { title: 'Material', lines: ['s_y = 250 MPa'] },
      { title: 'Check', lines: ['n = s_y / sigma_vm'] },
    ],
  },
  {
    title: 'Column: E, I and L are the user\'s, defined below the usual insert point',
    elements: [
      { title: 'Notes', lines: ['# Column of a press frame'] },
      { title: 'Data', lines: ['E = 70 GPa  # aluminium', 'L = 0.8 m', 'I = 5e4 mm^4'] },
      { title: 'Load', lines: ['F = 20 kN', 'n = P_cr / F'] },
    ],
  },
]

const strategies = Object.keys(STRATEGIES)
const markings = Object.keys(MARKINGS)
const st = { sheet: 0, block: 0, at: 1, strategy: 0, marking: 0, withSource: true }

const B = (s) => `\x1b[1m${s}\x1b[0m`
const D = (s) => `\x1b[2m${s}\x1b[0m`
const Y = (s) => `\x1b[33m${s}\x1b[0m`
const R = (s) => `\x1b[31m${s}\x1b[0m`
const G = (s) => `\x1b[32m${s}\x1b[0m`

function render() {
  console.clear()
  const sample = SHEETS[st.sheet]
  const block = BLOCKS[st.block]
  st.at = Math.min(st.at, sample.elements.length)
  const before = evaluateSheet(sample.elements)
  const opts = { marking: markings[st.marking], withSource: st.withSource, strategy: strategies[st.strategy] }
  const res = insert(sample.elements, block, st.at, opts)
  const after = evaluateSheet(res.sheet)

  console.log(B(`Sheet: ${sample.title}`))
  console.log(`${B('Block')} ${block.title}   ${B('insert')} ${st.at === sample.elements.length ? 'at the end' : `before element ${st.at + 1}`}`)
  console.log(`${B('Collisions')} ${STRATEGIES[opts.strategy]}`)
  console.log(`${B('Marking')} ${MARKINGS[opts.marking]}   ${B('source line')} ${st.withSource ? 'on' : 'off'}`)
  console.log('')

  let last = -1
  for (const r of after) {
    if (r.el !== last) {
      const el = res.sheet[r.el]
      console.log(el.owner === 'block' ? Y(B(`┌ ${el.title}  (inserted)`)) : B(`┌ ${el.title}`))
      last = r.el
    }
    const warn = res.warnings.find((w) => r.owner === 'block' && r.text.trim().startsWith(w.name + ' ='))
    const gutter = warn ? Y('⚠') : ' '
    const text = r.owner === 'block' ? Y(r.text.padEnd(58)) : r.text.padEnd(58)
    const out = r.error ? R(`error: ${r.error}`) : r.result ? `= ${r.result}` : ''
    console.log(`${gutter}│ ${text} ${out}`)
  }
  console.log('')

  if (res.adopted?.length) console.log(`${B('Uses your values')} ${res.adopted.join(', ')}`)
  if (res.renamed.length) console.log(`${B('Renamed in the block')} ${res.renamed.map(([a, b]) => `${a} -> ${b}`).join(', ')}`)
  if (res.warnings.length) {
    console.log(B('Warnings'))
    for (const w of res.warnings) console.log(Y(`  ⚠ ${w.name} is already assigned ${w.where} the block (element ${w.el < st.at ? w.el + 1 : w.el + 2}, line ${w.line + 1})`))
  }
  const changed = changedUserRows(before, after)
  console.log(B(`Your lines whose result changed: ${changed.length}`))
  for (const c of changed) console.log(`  ${c.text.padEnd(36)} ${D(c.was || '(empty)')} -> ${c.now.startsWith('error') ? R(c.now) : G(c.now)}`)
  console.log('')
  console.log(D('[1-3] block  [s] sheet  [p] insert point  [c] collisions  [m] marking  [x] source  [q] quit'))
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
render()
rl.on('line', (key) => {
  const k = key.trim()
  if (k === 'q') return rl.close()
  if (['1', '2', '3'].includes(k)) st.block = Number(k) - 1
  if (k === 's') { st.sheet = (st.sheet + 1) % SHEETS.length; st.at = 1 }
  if (k === 'p') st.at = (st.at + 1) % (SHEETS[st.sheet].elements.length + 1)
  if (k === 'c') st.strategy = (st.strategy + 1) % strategies.length
  if (k === 'm') st.marking = (st.marking + 1) % markings.length
  if (k === 'x') st.withSource = !st.withSource
  render()
})
