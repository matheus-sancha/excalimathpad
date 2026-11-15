import { describe, expect, it } from 'vitest'
import { evaluateSheet } from '../math/evaluate.ts'
import { SYMBOLS, type SymbolEntry, type SymbolInsert } from '../math/symbols.ts'
import { QUICK_KEYS } from '../panel/quickKeys.ts'
import { isPlainAt, planInsert } from './symbolInsert.ts'

/**
 * Types an insert into `line` as the field would: `|` marks the caret, or
 * `«…»` the selection. Gives the line after it, with `|` at the new caret.
 */
function typed(line: string, insert: SymbolInsert, plain = false): string {
  const marked = line.includes('«')
  const start = marked ? line.indexOf('«') : line.indexOf('|')
  const end = marked ? line.indexOf('»') - 1 : start
  const value = line.replace(/[|«»]/g, '')
  const { from, to, text, caret } = planInsert(value, start, end, insert, plain)
  const next = value.slice(0, from) + text + value.slice(to)
  return `${next.slice(0, caret)}|${next.slice(caret)}`
}

const entry = (group: SymbolEntry['group'], spelling: string) =>
  SYMBOLS.find((each) => each.group === group && each.spelling === spelling)!.insert
const greek = (spelling: string) => entry('greek', spelling)

describe('what a click inserts (docs/spec-v1.md section 4, Symbols tab)', () => {
  it('Greek joins a name only right after _', () => {
    expect(typed('T_|', greek('alpha'))).toBe('T_alpha|')
    expect(typed('x = a|', greek('rho'))).toBe('x = a rho|')
    expect(typed('x = 2|', greek('rho'))).toBe('x = 2 rho|')
    expect(typed('x = |', greek('rho'))).toBe('x = rho|')
    expect(typed('x = (|)', greek('rho'))).toBe('x = (rho|)')
    // A name after the caret is kept apart too: a click never makes a different name.
    expect(typed('x = |b', greek('rho'))).toBe('x = rho| b')
    expect(typed('x = «a»', greek('rho'))).toBe('x = rho|')
  })

  it('a call puts the caret between its brackets, or wraps a selection', () => {
    expect(typed('x = |', entry('operators', 'sqrt'))).toBe('x = sqrt(|)')
    expect(typed('x = «a + b»', entry('operators', 'sqrt'))).toBe('x = sqrt(a + b)|')
    expect(typed('x = 2 «a»', entry('functions', 'sin'))).toBe('x = 2 sin(a)|')
    // Right after a name, a call is kept apart from it.
    expect(typed('x = a|', entry('functions', 'sin'))).toBe('x = a sin(|)')
    expect(typed('x = «a»', entry('operators', '( )'))).toBe('x = (a)|')
    expect(typed('s = «OK»', entry('logic', '" "'))).toBe('s = "OK"|')
    expect(typed('s = |', entry('logic', '" "'))).toBe('s = "|"')
  })

  it('binary operators and comparisons take one space each side, never doubling one', () => {
    expect(typed('x = a|', entry('operators', '+'))).toBe('x = a + |')
    expect(typed('x = a |', entry('operators', '+'))).toBe('x = a + |')
    expect(typed('x = a| b', entry('operators', '<='))).toBe('x = a <= |b')
    expect(typed('x = a «-» b', entry('operators', '*'))).toBe('x = a * |b')
    expect(typed('x = a > b|', entry('logic', 'and'))).toBe('x = a > b and |')
    expect(typed('x = a > b| 2', entry('logic', '? :'))).toBe('x = a > b ? | : 2')
    expect(typed('x = a > b|', entry('logic', '? :'))).toBe('x = a > b ? | : ')
    expect(typed('r = 1|', entry('forms', '..'))).toBe('r = 1 .. |')
    // At the start of the line there is nothing to keep apart.
    expect(typed('|', entry('operators', '-'))).toBe('- |')
  })

  it('^, ^2, ! and [ ] go in tight; any other symbol replaces a selection', () => {
    expect(typed('x = a|', entry('operators', '^2'))).toBe('x = a^2|')
    expect(typed('x = a|', entry('operators', '^'))).toBe('x = a^|')
    expect(typed('x = 3|', entry('operators', '!'))).toBe('x = 3!|')
    expect(typed('x = x_r|', entry('forms', '[ ]'))).toBe('x = x_r[|]')
    expect(typed('x = «b»', entry('operators', '^2'))).toBe('x = ^2|')
  })

  it('keywords: a prefix is followed by a space, a word kept apart from names', () => {
    expect(typed('x = |', entry('forms', 'solve'))).toBe('x = solve |')
    expect(typed('x = |true', entry('logic', 'not'))).toBe('x = not |true')
    expect(typed('x = a|', entry('logic', 'not'))).toBe('x = a not |')
    expect(typed('x = |', entry('logic', 'true'))).toBe('x = true|')
    expect(typed('x = a|', entry('logic', 'false'))).toBe('x = a false|')
  })

  it('an open title or comment line takes the insert as plain text, like any typing', () => {
    expect(typed('Pump |', greek('rho'), true)).toBe('Pump rho|')
    expect(typed('Pump|', greek('rho'), true)).toBe('Pumprho|')
    expect(typed('# «a»', entry('operators', 'sqrt'), true)).toBe('# sqrt()|')
    expect(typed('# a|', entry('operators', '+'), true)).toBe('# a+|')
  })

  it('knows when the caret is in text: a comment line, or a line’s note', () => {
    expect(isPlainAt('# Pumps', 3)).toBe(true)
    expect(isPlainAt('@L # Pumps', 0)).toBe(true)
    expect(isPlainAt('x = 2 # note', 10)).toBe(true)
    expect(isPlainAt('x = 2 # note', 4)).toBe(false)
    expect(isPlainAt('s = "#1" + t', 11)).toBe(false)
    expect(isPlainAt('x = 2', 5)).toBe(false)
  })
})

/**
 * Every entry, typed by the planner into a minimal line, runs with no error
 * (section 4: every button types text the engine already reads). `|` is the
 * caret and `«…»` a selection; `fill` is typed at the caret after the insert,
 * where a form wants its operand. A new entry needs no case here when its
 * mode's default runs; one that doesn't fails until it gets one.
 */
const PRELUDE = ['a = 2', 'b = 3', 'l = 1 .. 3']
const BY_MODE: Record<SymbolInsert['mode'], { line: string; fill?: string }> = {
  name: { line: '| = 2' },
  word: { line: 'x = |' },
  prefix: { line: 'x = |true' },
  spaced: { line: 'x = a|b' },
  tight: { line: 'x = a|' },
  wrap: { line: 'x = «4»' },
}
const CASES: Record<string, { line: string; fill?: string }> = {
  '? :': { line: 'x = true| 2', fill: '1' },
  'and': { line: 'x = true|false' },
  'or': { line: 'x = true|false' },
  '..': { line: 'r = 1|10' },
  'step': { line: 'r = 1 .. 10|0.5' },
  'for': { line: 'x = solve x^2 = 2,|x = 0 .. 10' },
  'in': { line: 'v = 3 m/s|km/h' },
  'guess': { line: 'f(c) = solve x^2 = c,|x = 1' },
  'solve': { line: 'x = |x^2 = 2, for x = 0 .. 10' },
  '^': { line: 'x = a|3' },
  '[ ]': { line: 'x = l|', fill: '2' },
  'nthRoot': { line: 'x = «8, 3»' },
  'pow': { line: 'x = «2, 3»' },
  'atan2': { line: 'x = «1, 2»' },
  'mod': { line: 'x = «7, 3»' },
  'hypot': { line: 'x = «3, 4»' },
  'if': { line: 'x = «true, 1, 2»' },
  'table': { line: '«l, l^2»' },
  'plot': { line: '«l, l^2»' },
  'sum': { line: 'x = «l»' },
  'mean': { line: 'x = «l»' },
  'count': { line: 'x = «l»' },
  '" "': { line: 'x = «OK»' },
}

const quick = (label: string) => QUICK_KEYS.find((key) => key.label === label)!.insert

describe('what a quick key types (docs/spec-v1.md section 4, Touch, M4d)', () => {
  it('has the keys in their order', () => {
    expect(QUICK_KEYS.map(({ label }) => label)).toEqual(['_', '^', '=', '(', ')', '*', '/', ',', '..', '" "'])
  })

  it('types by the Symbols tab’s rules: _ ^ ( ) , tight, = * / .. spaced', () => {
    expect(typed('T|', quick('_'))).toBe('T_|')
    expect(typed('x = a|', quick('^'))).toBe('x = a^|')
    expect(typed('x|', quick('='))).toBe('x = |')
    expect(typed('x = a|', quick('*'))).toBe('x = a * |')
    expect(typed('x = a |', quick('/'))).toBe('x = a / |')
    expect(typed('f(a|', quick(','))).toBe('f(a,|')
    expect(typed('x = 1|', quick('..'))).toBe('x = 1 .. |')
    expect(typed('f(a|', quick(')'))).toBe('f(a)|')
  })

  it('( types alone, since ) is its own key, but wraps a selection; the quotes type a pair', () => {
    expect(typed('x = |', quick('('))).toBe('x = (|')
    expect(typed('x = «a + b» * 2', quick('('))).toBe('x = (a + b)| * 2')
    expect(typed('s = |', quick('" "'))).toBe('s = "|"')
    expect(typed('s = «OK»', quick('" "'))).toBe('s = "OK"|')
  })

  it('goes in as typed on a title or a comment line', () => {
    expect(typed('# Pumps|', quick('='), true)).toBe('# Pumps=|')
  })
})

describe('every catalogue entry runs in a minimal line (section 4, Symbols tab)', () => {
  it.each(SYMBOLS.map((each) => [`${each.group} ${each.spelling}`, each] as const))('%s', (_, each) => {
    const { line, fill = '' } = CASES[each.spelling] ?? BY_MODE[each.insert.mode]
    const [head, tail] = typed(line, each.insert).split('|')
    const source = [...PRELUDE, head + fill + tail].join('\n')
    const lines = evaluateSheet([{ id: 'a', source }]).get('a')!
    const last = lines.at(-1)!
    expect(last.result.kind === 'error' ? last.result.message : 'ok', head + fill + tail).toBe('ok')
  })
})
