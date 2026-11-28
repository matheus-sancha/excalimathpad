// PROTOTYPE — throwaway. Wayfinder ticket #347:
// "How does a line ask for a symbolic result: on request, automatically, or with declared symbols?"
//
// Pure logic: a sheet (lines of `name = expr`) evaluated under one of three triggers.
//   request  — a line ending in `->` may show a formula; elsewhere an unknown name is an error.
//   auto     — any line whose names have no value shows a formula; nothing is an "undefined" error.
//   declared — `symbols F, d` names symbols from that line down; any other unknown name is an error.
// In every mode a formula whose names all have values by the line that uses it gives a number.
// No I/O here; tui.mjs drives it.

import { create, all } from 'mathjs'

const math = create(all)

export const MODES = ['request', 'auto', 'declared']

const SYMBOLS_LINE = /^\s*symbols?\s+(.+)$/

function isConstantOrFunction(name) {
  return name in math && typeof math[name] !== 'undefined'
}

function isUnitName(name) {
  try {
    return math.Unit.isValuelessUnit(name)
  } catch {
    return false
  }
}

// Names written straight after a number (`250 MPa`, `2 kN m`) are unit literals, never symbols.
function unitLiterals(node) {
  const out = new Set()
  const leftmost = (n) => (n.isOperatorNode && n.implicit ? leftmost(n.args[0]) : n)
  node.traverse((n) => {
    if (n.isOperatorNode && n.implicit && leftmost(n).isConstantNode) {
      const walk = (k) => {
        if (k.isSymbolNode) out.add(k)
        else if (k.isOperatorNode && k.implicit) k.args.forEach(walk)
      }
      n.args.forEach(walk)
    }
  })
  return out
}

function freeNames(node) {
  const lits = unitLiterals(node)
  const out = new Set()
  node.traverse((n, path, parent) => {
    if (n.isSymbolNode && !(parent && parent.isFunctionNode && path === 'fn') && !lits.has(n)) out.add(n.name)
  })
  return [...out]
}

// scope: name -> { kind: 'value', value } | { kind: 'formula', node, symbols:Set } | { kind: 'symbol' }
export function evaluateSheet(lines, mode, { tidy = false } = {}) {
  const scope = new Map()
  return lines.map((raw) => {
    const text = raw.replace(/#.*$/, '').trim()
    if (!text) return { raw, kind: 'blank' }

    if (mode === 'declared') {
      const m = SYMBOLS_LINE.exec(text)
      if (m) {
        const names = m[1].split(/[\s,]+/).filter(Boolean)
        for (const n of names) scope.set(n, { kind: 'symbol' })
        return { raw, kind: 'declare', text: `symbols: ${names.join(', ')}` }
      }
    }

    let src = text
    let requested = false
    if (src.endsWith('->')) {
      requested = true
      src = src.slice(0, -2).trim()
    }
    if (requested && mode !== 'request') return fail(raw, null, '`->` is only read in the "request" mode')

    let node
    try {
      node = math.parse(src)
    } catch (e) {
      return fail(raw, null, e.message)
    }
    let name = null
    let expr = node
    if (node.isAssignmentNode && node.object.isSymbolNode) {
      name = node.object.name
      expr = node.value
    }
    const fail2 = (msg) => {
      if (name) scope.delete(name)
      return fail(raw, name, msg)
    }

    // Classify every bare name the line uses.
    const symbols = new Set() // this line's own symbols
    const asUnits = [] // bare names read as math.js units (today's behaviour)
    const asConstants = [] // bare names read as math.js constants (E, e, i, pi...)
    const unknown = []
    const formulas = []
    for (const n of freeNames(expr)) {
      const entry = scope.get(n)
      if (entry?.kind === 'value') continue
      if (entry?.kind === 'formula') formulas.push(n)
      else if (entry?.kind === 'symbol') symbols.add(n)
      else if (mode === 'request' && requested && !isConstantOrFunction(n)) symbols.add(n) // a `->` line: every bare name with no value is a symbol, unit names included
      else if (isConstantOrFunction(n)) asConstants.push(n)
      else if (isUnitName(n)) asUnits.push(n)
      else unknown.push(n)
    }

    if (unknown.length || formulas.length) {
      if (mode === 'request' && !requested) {
        if (unknown.length) return fail2(`Undefined symbol ${unknown[0]}`)
        return fail2(`${formulas[0]} is a formula: end this line with -> to combine it`)
      }
      if (mode === 'declared' && unknown.length) return fail2(`Undefined symbol ${unknown[0]}`)
      if (mode === 'auto') unknown.forEach((n) => symbols.add(n))
    }

    // Substitute formulas; their symbols come along.
    const formulaScope = new Map()
    for (const [k, v] of scope) if (v.kind === 'formula') formulaScope.set(k, v.node)
    let combined = math.resolve(expr, formulaScope)
    for (const f of formulas) for (const s of scope.get(f).symbols) symbols.add(s)

    // A symbol that got a value since (assigned later on the sheet) is a value now.
    const left = [...symbols].filter((n) => scope.get(n)?.kind !== 'value')
    const notes = []
    if (asUnits.length) notes.push(`read as units: ${asUnits.join(', ')}`)
    if (asConstants.length) notes.push(`read as constants: ${asConstants.join(', ')}`)

    if (left.length === 0) {
      const values = {}
      for (const [k, v] of scope) if (v.kind === 'value') values[k] = v.value
      try {
        const value = combined.compile().evaluate(values)
        if (name) scope.set(name, { kind: 'value', value })
        if (formulas.length) notes.unshift('from a formula')
        return { raw, kind: 'value', name, text: math.format(value, { precision: 4 }), notes }
      } catch (e) {
        return fail2(e.message)
      }
    }

    if (tidy) {
      try {
        combined = math.simplify(combined)
      } catch {
        /* keep the plain substitution */
      }
    }
    if (name) scope.set(name, { kind: 'formula', node: combined, symbols: new Set(left) })
    const keptValues = freeNames(combined).filter((n) => scope.get(n)?.kind === 'value')
    if (keptValues.length) notes.push(`has values: ${keptValues.join(', ')}`)
    return { raw, kind: 'formula', name, text: combined.toString({ parenthesis: 'auto' }), symbols: left, notes }
  })
}

function fail(raw, name, message) {
  return { raw, kind: 'error', name, text: message }
}
