// PROTOTYPE — throwaway. The logic behind tui.mjs: build an inserted formula
// block, place it in a sheet, and show what its names do to the user's results.
// Question (issue #352): what does an inserted formula block look like, and what
// happens when its names are already on the sheet, above or below?
//
// A sheet is a list of elements in reading order. An element is { title, lines }.
// The whole sheet is one scope, top to bottom (CONTEXT.md, Domain), so this
// evaluates it the same way with plain math.js: a line sees names assigned
// above it, a later assignment redefines a name for the lines below.

import { evaluate, format } from 'mathjs'

// --- The three entries --------------------------------------------------------

export const BLOCKS = [
  {
    id: 'rect',
    title: 'Second moment of area, rectangle',
    source: 'Beer & Johnston, Mechanics of Materials, App. B',
    inputs: [['b', '40 mm', 'width'], ['h', '80 mm', 'height']],
    formulas: [['I', 'b * h^3 / 12', 'about the centroid, axis parallel to b']],
  },
  {
    id: 'vm',
    title: 'Von Mises stress, plane stress',
    source: 'Beer & Johnston, Mechanics of Materials, sec. 7.7',
    inputs: [['sigma_x', '120 MPa', ''], ['sigma_y', '40 MPa', ''], ['tau_xy', '30 MPa', '']],
    formulas: [['sigma_vm', 'sqrt(sigma_x^2 - sigma_x * sigma_y + sigma_y^2 + 3 * tau_xy^2)', '']],
  },
  {
    id: 'euler',
    title: 'Euler buckling load',
    source: 'Shigley, Mechanical Engineering Design, sec. 4.14',
    inputs: [
      ['E', '200 GPa', "Young's modulus"],
      ['I', '2e5 mm^4', 'second moment of area'],
      ['L', '1.5 m', 'length'],
      ['K', '1', 'effective-length factor, pinned-pinned'],
    ],
    formulas: [['P_cr', 'pi^2 * E * I / (K * L)^2', '']],
  },
]

// How the block shows which lines are example values to replace.
export const MARKINGS = {
  note: 'a note on each input line',
  headers: 'comment lines: Inputs / Result',
  highlight: 'inputs highlighted @yellow, one comment above',
}

export function blockLines(block, marking, withSource) {
  const out = []
  if (marking === 'headers') out.push('# Inputs (example values: replace them)')
  if (marking === 'highlight') out.push('# Replace the highlighted example values')
  for (const [name, value, what] of block.inputs) {
    let line = `${name} = ${value}`
    if (marking === 'highlight') line += ' @yellow'
    if (marking === 'note') line += `  # example${what ? ': ' + what : ''}`
    else if (what) line += `  # ${what}`
    out.push(line)
  }
  if (marking === 'headers') out.push('# Result')
  for (const [name, expr, what] of block.formulas) out.push(`${name} = ${expr}${what ? '  # ' + what : ''}`)
  if (withSource) out.push(`# Source: ${block.source}`)
  return out
}

export function blockNames(block) {
  return [...block.inputs, ...block.formulas].map(([n]) => n)
}

// --- Evaluation ---------------------------------------------------------------

function codeOf(line) {
  const t = line.trim()
  if (t === '' || t.startsWith('#')) return null
  let code = line.split('#')[0]
  code = code.replace(/(\s@[a-z-]+)+\s*$/i, '') // a format clause after the code
  return code.trim() || null
}

function assignedName(line) {
  const c = codeOf(line)
  const m = c && c.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/)
  return m ? m[1] : null
}

function show(v) {
  if (v === undefined) return ''
  if (typeof v === 'function') return '(function)'
  try { return format(v, { precision: 4 }) } catch { return String(v) }
}

// Evaluates the sheet; returns rows { el, line, text, result, error, owner }.
export function evaluateSheet(elements) {
  const scope = new Map()
  const rows = []
  elements.forEach((el, e) => {
    el.lines.forEach((text, i) => {
      const code = codeOf(text)
      const row = { el: e, line: i, text, owner: el.owner ?? 'user', result: '', error: '' }
      if (code) {
        try { row.result = show(evaluate(code, scope)) }
        catch (err) {
          row.error = err.message
          const n = assignedName(text)
          if (n) scope.delete(n) // a failed assignment removes the name
        }
      }
      rows.push(row)
    })
  })
  return rows
}

// --- Placing and collisions --------------------------------------------------

// Every user name assigned on the sheet, with where it is relative to `at`
// (the index the block is inserted before).
export function collisions(sheet, block, at) {
  const mine = new Set(blockNames(block))
  const found = []
  sheet.forEach((el, e) => el.lines.forEach((text, i) => {
    const n = assignedName(text)
    if (n && mine.has(n)) found.push({ name: n, el: e, line: i, where: e < at ? 'above' : 'below' })
  }))
  return found
}

function freeName(name, taken) {
  for (let k = 2; ; k++) if (!taken.has(`${name}_${k}`)) return `${name}_${k}`
}

function renameIn(line, from, to) {
  const [code, ...rest] = line.split('#')
  const re = new RegExp(`(?<![\\w.])${from}(?![\\w])`, 'g')
  return [code.replace(re, to), ...rest].join('#')
}

// Strategies for a name the sheet already assigns.
export const STRATEGIES = {
  asis: 'insert as is: the block redefines the name',
  warn: 'insert as is, and warn on the colliding names',
  suffix: 'rename the block\'s colliding names (b -> b_2)',
  adopt: 'inputs assigned above: use yours; result names taken: rename; names below: warn',
}

export function insert(sheet, block, at, { marking, withSource, strategy }) {
  let lines = blockLines(block, marking, withSource)
  const hits = collisions(sheet, block, at)
  const renamed = []
  if (strategy === 'suffix' && hits.length) {
    const taken = new Set()
    sheet.forEach((el) => el.lines.forEach((t) => { const n = assignedName(t); if (n) taken.add(n) }))
    blockNames(block).forEach((n) => taken.add(n))
    for (const n of new Set(hits.map((h) => h.name))) {
      const to = freeName(n, taken)
      taken.add(to)
      renamed.push([n, to])
      lines = lines.map((l) => renameIn(l, n, to))
    }
  }
  let warnings = strategy === 'warn' ? hits : []
  const adopted = []
  if (strategy === 'adopt' && hits.length) {
    const inputs = new Set(block.inputs.map(([n]) => n))
    const above = new Set(hits.filter((h) => h.where === 'above').map((h) => h.name))
    const taken = new Set()
    sheet.forEach((el) => el.lines.forEach((t) => { const n = assignedName(t); if (n) taken.add(n) }))
    blockNames(block).forEach((n) => taken.add(n))
    // An input that already has a value above: the block uses it.
    lines = lines.map((l) => {
      const n = assignedName(l)
      if (n && inputs.has(n) && above.has(n)) { adopted.push(n); return `# ${n}: uses yours, from above` }
      return l
    })
    // A result name already taken anywhere, or an input taken only below: rename it.
    for (const n of new Set(hits.map((h) => h.name))) {
      if (adopted.includes(n)) continue
      const to = freeName(n, taken)
      taken.add(to)
      renamed.push([n, to])
      lines = lines.map((l) => renameIn(l, n, to))
    }
    // An input of the user's that sits below the block: the block cannot use it.
    warnings = hits.filter((h) => h.where === 'below' && inputs.has(h.name) && !above.has(h.name))
  }
  const el = { title: block.title, lines, owner: 'block' }
  const after = [...sheet.slice(0, at), el, ...sheet.slice(at)]
  return { sheet: after, hits, renamed, adopted, warnings }
}

// The user's rows whose result or error changed when the block went in.
export function changedUserRows(before, after) {
  const key = (r) => `${r.text}`
  const userBefore = before.filter((r) => r.owner === 'user')
  const userAfter = after.filter((r) => r.owner === 'user')
  const out = []
  userBefore.forEach((b, i) => {
    const a = userAfter[i]
    const was = b.error ? `error: ${b.error}` : b.result
    const now = a.error ? `error: ${a.error}` : a.result
    if (was !== now) out.push({ text: key(b), was, now })
  })
  return out
}
