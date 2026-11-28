// PROTOTYPE, throwaway. Ticket #355: a sheet line as a math.js node, to nerdamer 2.1.0 text,
// back to a math.js node, then the app's own `lineTex`.
// Run (from the repo root): npm i --no-save nerdamer@2.1.0 && node docs/research/symbolic-nerdamer-bridge/bridge.mjs
// (Node 22.18 or newer runs the app's TypeScript `typeset.ts` as it is.)
//
// The bridge:
// 1. A sheet of `symbols ...` and `name = expr` lines. Formulas above are substituted with
//    math.js `resolve`, as in docs/research/symbolic-trigger-prototype/trigger.mjs.
// 2. To nerdamer: every name (declared symbol, unit literal, constant), every decimal literal and
//    every function call other than sqrt and abs becomes a placeholder atom `v1`, `v2`, ...; integers,
//    + - * / ^ and parentheses go through. So nerdamer never sees a sheet name, a unit or a decimal.
// 3. One fraction, two ways, both with nerdamer's plain parse (no `simplify`, see hang.mjs):
//    A "whole": nerdamer(text), then numerator() and denominator().
//    B "flatten": the bridge splits the math.js tree into numerator and denominator itself
//      (a sum gets the least common multiple of its terms' denominators when they are monomials,
//      else their product), then nerdamer(`(num)/(den)`) cancels, then numerator()/denominator().
// 4. Back: math.js parses nerdamer's numerator and denominator text, the placeholders become the
//    original nodes again, `x^(1/2)` becomes sqrt(x), and `num / den` goes to `lineTex`.
import { createRequire } from 'node:module'
import { all, create } from 'mathjs'
import { lineTex } from '../../../src/math/typeset.ts'

const nerdamer = createRequire(import.meta.url)('nerdamer')
const math = create(all)

const OPAQUE_OK = new Set(['sqrt', 'abs'])

class Atoms {
  constructor() {
    this.byKey = new Map()
    this.nodes = new Map()
  }
  get(key, node, kind) {
    let name = this.byKey.get(key)
    if (!name) {
      name = `v${this.byKey.size + 1}`
      this.byKey.set(key, name)
      this.nodes.set(name, { node, kind, key })
    }
    return name
  }
}

function unitLiterals(node) {
  const out = new Set()
  const leftmost = (n) => (n.isOperatorNode && n.implicit ? leftmost(n.args[0]) : n)
  node.traverse((n) => {
    if (n.isOperatorNode && n.implicit && leftmost(n).isConstantNode) {
      const walk = (k) => {
        if (k.isSymbolNode) out.add(k)
        else if (k.isOperatorNode && (k.implicit || k.fn === 'pow')) k.args.forEach(walk)
      }
      n.args.slice(1).forEach(walk)
    }
  })
  return out
}

/** math.js node -> nerdamer text, with every name, decimal and opaque call as an atom. */
function toNerdamer(node, atoms, ctx) {
  const go = (n) => toNerdamer(n, atoms, ctx)
  if (n0(node, 'ConstantNode')) {
    const v = node.value
    if (typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 1e15) return String(v)
    return atoms.get(`#${node.toString()}`, node, 'decimal')
  }
  if (node.isSymbolNode) {
    // A declared name is a symbol even straight after a number (`3 t_xy^2`); else a name after a
    // number is a unit literal (`250 MPa`); else it is a math.js constant (`pi`, `e`, `E`, `i`).
    const kind = ctx.symbols.has(node.name) ? 'symbol' : ctx.units.has(node) ? 'unit' : 'constant'
    return atoms.get(`${kind}:${node.name}`, node, kind)
  }
  if (node.isParenthesisNode) return `(${go(node.content)})`
  if (node.isOperatorNode) {
    const [a, b] = node.args
    if (node.fn === 'unaryMinus') return `(-(${go(a)}))`
    if (node.fn === 'unaryPlus') return `(${go(a)})`
    const op = { add: '+', subtract: '-', multiply: '*', divide: '/', pow: '^' }[node.fn]
    if (!op || node.args.length !== 2) throw new Error(`not in the subset: operator ${node.op}`)
    return `(${go(a)})${op}(${go(b)})`
  }
  if (node.isFunctionNode) {
    const fn = node.fn.name
    // math.js reads `M (h / 2)` as a call of M. The sheet errors on that for a value today
    // ("M is a value, not a function"); this prototype reads a declared symbol's call as a product.
    if (ctx.symbols.has(fn) && node.args.length === 1) return `(${go(new math.SymbolNode(fn))})*(${go(node.args[0])})`
    if (OPAQUE_OK.has(fn) && node.args.length === 1) return `${fn}(${go(node.args[0])})`
    return atoms.get(`call:${node.toString()}`, node, 'call')
  }
  throw new Error(`not in the subset: ${node.type}`)
}

const n0 = (node, type) => node.type === type

// --- B: the bridge flattens the tree into one numerator and one denominator ---------------
const nd = (s) => nerdamer(s)
const isOne = (s) => nd(s).toString() === '1'
const isMonomial = (s) => !/[+-]/.test(nd(s).toString().replace(/^-/, '').replace(/\^\(-?[\d/]+\)|\^-\d+/g, ''))

function frac(node, atoms, ctx) {
  const go = (n) => frac(n, atoms, ctx)
  if (node.isParenthesisNode) return go(node.content)
  if (node.isOperatorNode && node.args.length === 2) {
    const [a, b] = node.args
    if (node.fn === 'multiply') {
      const x = go(a), y = go(b)
      return { num: `(${x.num})*(${y.num})`, den: `(${x.den})*(${y.den})` }
    }
    if (node.fn === 'divide') {
      const x = go(a), y = go(b)
      return { num: `(${x.num})*(${y.den})`, den: `(${x.den})*(${y.num})` }
    }
    if (node.fn === 'add' || node.fn === 'subtract') {
      // Each term is reduced first (nerdamer's plain parse cancels a product), so the
      // least common multiple is taken of reduced denominators.
      const x = reduce(go(a)), y = reduce(go(b))
      const sign = node.fn === 'add' ? '+' : '-'
      if (isOne(x.den) && isOne(y.den)) return { num: `(${x.num})${sign}(${y.num})`, den: '1' }
      const den = isMonomial(x.den) && isMonomial(y.den) ? nd(nd(`lcm(${x.den},${y.den})`).toString()).toString() : `(${x.den})*(${y.den})`
      const scale = (t) => nd(`(${den})/(${t.den})`).toString()
      return { num: `(${x.num})*(${scale(x)})${sign}(${y.num})*(${scale(y)})`, den }
    }
    if (node.fn === 'pow' && isIntegerNode(b)) {
      const k = integerOf(b), x = go(a)
      return k >= 0 ? { num: `(${x.num})^${k}`, den: `(${x.den})^${k}` } : { num: `(${x.den})^${-k}`, den: `(${x.num})^${-k}` }
    }
  }
  if (node.isFunctionNode && ctx.symbols.has(node.fn.name) && node.args.length === 1) {
    const x = go(node.args[0])
    return { num: `(${toNerdamer(new math.SymbolNode(node.fn.name), atoms, ctx)})*(${x.num})`, den: x.den }
  }
  if (node.isOperatorNode && node.fn === 'unaryMinus') {
    const x = go(node.args[0])
    return { num: `-(${x.num})`, den: x.den }
  }
  // Anything else (an atom, an integer, sqrt(...), a power with a symbolic exponent) is one factor.
  return { num: toNerdamer(node, atoms, ctx), den: '1' }
}

function reduce({ num, den }) {
  const r = nerdamer(`(${num})/(${den})`)
  return { num: r.numerator().toString(), den: r.denominator().toString() }
}

const isIntegerNode = (n) =>
  (n.isConstantNode && Number.isInteger(n.value)) || (n.isOperatorNode && n.fn === 'unaryMinus' && isIntegerNode(n.args[0]))
const integerOf = (n) => (n.isConstantNode ? n.value : -integerOf(n.args[0]))

// --- back to math.js -----------------------------------------------------------------------
function back(text, atoms) {
  const isHalf = (e) => {
    const k = e.isParenthesisNode ? e.content : e
    return k.isOperatorNode && k.fn === 'divide' && k.args.every((a) => a.isConstantNode) && k.args[0].value === 1 && k.args[1].value === 2
  }
  // nerdamer writes a square root as `(...)^(1/2)`: back to sqrt, then the atoms back to their nodes.
  const roots = (node) =>
    node.transform((n) => (n.isOperatorNode && n.fn === 'pow' && isHalf(n.args[1]) ? new math.FunctionNode('sqrt', [unwrap(roots(n.args[0]))]) : n))
  const unwrap = (n) => (n.isParenthesisNode ? n.content : n)
  return roots(math.parse(text)).transform((n) =>
    n.isSymbolNode && atoms.nodes.has(n.name) ? atoms.nodes.get(n.name).node.cloneDeep() : n,
  )
}

function oneFraction(numText, denText, atoms) {
  const num = back(numText, atoms)
  if (denText === '1') return num
  const wrap = (n) => (n.isOperatorNode && ['add', 'subtract'].includes(n.fn) ? new math.ParenthesisNode(n) : n)
  return new math.OperatorNode('/', 'divide', [wrap(num), wrap(back(denText, atoms))])
}

// --- a sheet -------------------------------------------------------------------------------
export function runSheet(lines) {
  const symbols = new Set()
  const formulas = new Map()
  const out = []
  for (const raw of lines) {
    const m = /^\s*symbols\s+(.+)$/.exec(raw)
    if (m) {
      for (const s of m[1].split(/[\s,]+/).filter(Boolean)) symbols.add(s)
      out.push({ raw, kind: 'declare' })
      continue
    }
    const node = math.parse(raw)
    const name = node.isAssignmentNode ? node.object.name : null
    const expr = node.isAssignmentNode ? node.value : node
    const resolved = math.resolve(expr, formulas)
    const ctx = { symbols, units: unitLiterals(resolved) }
    const row = { raw, name, resolved: resolved.toString() }
    try {
      // A: the whole text, plain parse.
      const atomsA = new Atoms()
      const textA = toNerdamer(resolved, atomsA, ctx)
      const t0 = performance.now()
      const rA = nerdamer(textA)
      const nA = rA.numerator().toString(), dA = rA.denominator().toString()
      row.msA = performance.now() - t0
      row.nerdamerText = rA.toString()
      row.A = oneFraction(nA, dA, atomsA).toString()
      // B: the bridge flattens, nerdamer cancels.
      const atomsB = new Atoms()
      const t1 = performance.now()
      const f = frac(resolved, atomsB, ctx)
      const rB = nerdamer(`(${f.num})/(${f.den})`)
      const nB = rB.numerator().toString(), dB = rB.denominator().toString()
      row.msB = performance.now() - t1
      row.numB = nB
      row.denB = dB
      const result = oneFraction(nB, dB, atomsB)
      row.B = result.toString()
      row.atoms = [...atomsB.nodes].map(([k, v]) => `${k}=${v.node.toString()} (${v.kind})`).join(', ')
      const sheetNames = new Set([...symbols, ...formulas.keys(), ...(name ? [name] : [])])
      const names = {
        isSheetName: (n) => sheetNames.has(n),
        isUnit: (n) => !sheetNames.has(n) && safeUnit(n),
        isMicro: () => false,
        isBuiltIn: (n) => !sheetNames.has(n) && n in math,
      }
      const assigned = name ? new math.AssignmentNode(new math.SymbolNode(name), result) : result
      const tex = lineTex(assigned, names)
      row.tex = `${tex.name ? tex.name + ' := ' : ''}${tex.expression}`
      if (name) formulas.set(name, result)
    } catch (e) {
      row.error = e.message
      if (name) formulas.set(name, resolved)
    }
    out.push(row)
  }
  return out
}

function safeUnit(n) {
  try {
    return math.Unit.isValuelessUnit(n)
  } catch {
    return false
  }
}

const tenFractions = Array.from({ length: 10 }, (_, j) => `a${j} / b${j}`).join(' + ')

export const SHEETS = {
  'stress (the agreed example)': ['symbols F, d', 'A = pi * d^2 / 4', 'sigma = F / A'],
  'bending stress': ['symbols M, b, h', 'I = b h^3 / 12', 'c = h / 2', 'sigma = M c / I'],
  'axial plus bending (a sum)': ['symbols F, M, b, h', 'A = b h', 'I = b h^3 / 12', 'sigma = F / A + M * (h / 2) / I'],
  'Euler buckling (E, I declared)': ['symbols E, I, K, L', 'P_cr = pi^2 E I / (K L)^2'],
  'Euler buckling, round bar': ['symbols E, d, K, L', 'I = pi d^4 / 64', 'P_cr = pi^2 E I / (K L)^2'],
  'von Mises': ['symbols s_x, s_y, t_xy', 's_vm = sqrt(s_x^2 - s_x s_y + s_y^2 + 3 t_xy^2)'],
  'von Mises, principal, 0.5': ['symbols s_1, s_2, s_3', 's_vm = sqrt(0.5 ((s_1 - s_2)^2 + (s_2 - s_3)^2 + (s_3 - s_1)^2))'],
  'radius of gyration (sqrt)': ['symbols d', 'A = pi d^2 / 4', 'I = pi d^4 / 64', 'r = sqrt(I / A)'],
  'decimals': ['symbols f_ck, D', 'f_cd = 0.85 f_ck / 1.5', 'x = 1.2 * D / 2', 'y = 2.5e-3 * D'],
  'constants not declared (e, i, E, pi)': ['symbols x', 'y = e^x + i x', 'z = E x / E', 'w = pi x / pi'],
  'units in implicit products': ['symbols F, b', 'sigma = F / (25 mm^2)', 'q = 250 MPa * b / F', 'w = 2 kN m / b * b'],
  'functions': ['symbols x, L', 'y = sin(pi x / L) / L', 'z = log10(x) / log10(x)', 'u = exp(x) / e^x', 'v = abs(x) / x'],
  'powers': ['symbols a, b', 'p = (a b)^2 / a^3', 'q = a^(1/3) * a^(2/3)', 'r = sqrt(a^2)', 's = a^-2 * b'],
  'nested fraction': ['symbols a, b, c, d', 'n = a / (b / (c / d))', 'm = 1 / (1 / a + 1 / b)'],
  'ten fractions (simplify takes minutes)': ['symbols ' + Array.from({ length: 10 }, (_, j) => `a${j}, b${j}`).join(', '), `s = ${tenFractions}`],
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [title, lines] of Object.entries(SHEETS)) {
    console.log(`\n## ${title}`)
    for (const r of runSheet(lines)) {
      if (r.kind === 'declare') { console.log(`  ${r.raw}`); continue }
      console.log(`  ${r.raw}`)
      if (r.error) { console.log(`    error: ${r.error}`); continue }
      console.log(`    substituted: ${r.resolved}`)
      console.log(`    nerdamer(text):  ${r.nerdamerText}`)
      console.log(`    A whole:   ${r.A}   (${r.msA.toFixed(1)} ms)`)
      console.log(`    B flatten: ${r.B}   (${r.msB.toFixed(1)} ms)`)
      console.log(`    atoms: ${r.atoms}`)
      console.log(`    lineTex(B): ${r.tex}`)
    }
  }
}
