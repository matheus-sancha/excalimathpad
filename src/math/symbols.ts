import { words, type Words } from '../text/words.ts'
import { CONSTANT_GROUPS } from './constants.ts'

/**
 * The Symbols catalogue (docs/spec-v1.md section 4, Symbols tab, M4d): every
 * button of the Sheet panel's Symbols tab, in its group and order, with what
 * it shows, what it types and how it goes in. Pure data, with no math.js:
 * every insert is text the engine already reads, so the tab adds no grammar.
 * Its words, each group's name and each button's hint, are the text tables'
 * (`symbols`), read when they show (0.6.0): `symbolHint`, `symbolHover`.
 *
 * It is the one list: the tab draws it, the typing suggestions' functions and
 * line forms are built from it (`functionSuggestions`), and a test puts every
 * insert into a minimal line and runs it.
 */

export type SymbolGroupId = 'greek' | 'operators' | 'functions' | 'logic' | 'forms'

/** The tab's groups, top to bottom; the text tables name each (`symbols.groups`). */
export const SYMBOL_GROUPS: readonly SymbolGroupId[] = ['greek', 'operators', 'functions', 'logic', 'forms']

/**
 * How an insert goes in at the caret (section 4, What a click inserts):
 * - `name`: a Greek letter or a constant. Joins a name only right after `_`
 *   (`T_` + α gives `T_alpha`); right after another name character a space
 *   comes first (`a` + ρ gives `a rho`), so a click never quietly makes a
 *   different name.
 * - `word`: `true`, `false`. Kept apart from a name on either side.
 * - `prefix`: `not`, `solve`. Kept apart before, a space after.
 * - `spaced`: a binary operator or a comparison. One space each side, never
 *   doubling one already there. With `close` (`? :`), the caret goes between.
 * - `tight`: `^`, `^2`, `!`, `[ ]`. As it is; with `close`, the caret between.
 * - `wrap`: a call, `( )` or the quote pair. The caret between the brackets,
 *   or around a selection: select `a + b`, click √, get `sqrt(a + b)|`.
 * Every mode but `wrap` replaces a selection.
 */
export type InsertMode = 'name' | 'word' | 'prefix' | 'spaced' | 'tight' | 'wrap'

export interface SymbolInsert {
  mode: InsertMode
  /** What goes in before the caret (or the selection, for `wrap`). */
  text: string
  /** What goes in after it: a closing bracket, a quote, the `:` of `? :`. */
  close?: string
  /**
   * A `wrap` that, with nothing selected, types only `text`: the quick keys'
   * `(`, since `)` is a key of its own (section 4, Touch, M4d).
   */
  alone?: boolean
}

export interface SymbolEntry {
  group: SymbolGroupId
  /** What the button shows: ρ, √, `sin`, `if()`. */
  label: string
  /**
   * The text a line reads, as the hover and the filter give it: `rho`,
   * `sqrt`, `<=`. With the group, it is the key of the entry's hint in the
   * text tables (`symbols.hints`); a Greek letter's hint is one for all.
   */
  spelling: string
  insert: SymbolInsert
  /** The Greek group's rows: 1 the letters, 2 the variants, 3 the capitals. */
  row?: 1 | 2 | 3
  /** A Greek letter that is also a constant: that constant's math.js name, which the tables describe. */
  constant?: string
  /** A sheet form's hover: the whole form, as lines that run. */
  example?: readonly string[]
  /** Not a button: a typing suggestion only (`guess`, which the spec leaves out of the tab). */
  hidden?: true
}

/** A constant's name or short name → its math.js name, to mark the Greek letters that are both. */
const CONSTANT_NAMES: ReadonlyMap<string, string> = new Map(
  CONSTANT_GROUPS.flatMap((group) => group.constants).flatMap(({ name, short }) => [
    [name, name] as const,
    ...(short ? [[short, name] as const] : []),
  ]),
)

const greek = (row: 1 | 2 | 3, pairs: string): SymbolEntry[] =>
  pairs.split(' ').map((pair) => {
    const [label, spelling] = pair.split(':')
    const constant = CONSTANT_NAMES.get(spelling)
    return {
      group: 'greek',
      label,
      spelling,
      insert: { mode: 'name', text: spelling },
      row,
      ...(constant ? { constant } : {}),
    }
  })

// The glyphs are the ones KaTeX draws for each spelling: `\epsilon` is ϵ and
// `\varepsilon` is ε, `\phi` is ϕ and `\varphi` is φ.
const GREEK: readonly SymbolEntry[] = [
  ...greek(
    1,
    'α:alpha β:beta γ:gamma δ:delta ϵ:epsilon ζ:zeta η:eta θ:theta ι:iota κ:kappa λ:lambda μ:mu ' +
      'ν:nu ξ:xi π:pi ρ:rho σ:sigma τ:tau υ:upsilon ϕ:phi χ:chi ψ:psi ω:omega',
  ),
  ...greek(2, 'ε:varepsilon ϑ:vartheta ϖ:varpi ϱ:varrho ς:varsigma φ:varphi'),
  ...greek(3, 'Γ:Gamma Δ:Delta Θ:Theta Λ:Lambda Ξ:Xi Π:Pi Σ:Sigma Υ:Upsilon Φ:Phi Ψ:Psi Ω:Omega'),
]

const op = (
  group: SymbolGroupId,
  label: string,
  spelling: string,
  insert: SymbolInsert,
  example?: readonly string[],
): SymbolEntry => ({ group, label, spelling, insert, ...(example ? { example } : {}) })

const spaced = (group: SymbolGroupId, label: string, spelling: string, example?: readonly string[]) =>
  op(group, label, spelling, { mode: 'spaced', text: spelling }, example)

const call = (group: SymbolGroupId, label: string, name: string, example?: readonly string[]) =>
  op(group, label, name, { mode: 'wrap', text: `${name}(`, close: ')' }, example)

const OPERATORS: readonly SymbolEntry[] = [
  spaced('operators', '+', '+'),
  spaced('operators', '−', '-'),
  spaced('operators', '·', '*'),
  spaced('operators', '÷', '/'),
  op('operators', 'x²', '^2', { mode: 'tight', text: '^2' }),
  op('operators', 'xⁿ', '^', { mode: 'tight', text: '^' }),
  call('operators', '√', 'sqrt'),
  call('operators', '∛', 'cbrt'),
  call('operators', 'ⁿ√', 'nthRoot'),
  call('operators', '|x|', 'abs'),
  op('operators', 'n!', '!', { mode: 'tight', text: '!' }),
  op('operators', '( )', '( )', { mode: 'wrap', text: '(', close: ')' }),
  op('operators', '[ ]', '[ ]', { mode: 'tight', text: '[', close: ']' }),
  spaced('operators', '<', '<'),
  spaced('operators', '>', '>'),
  spaced('operators', '≤', '<='),
  spaced('operators', '≥', '>='),
]

/** Today's function suggestions, in their order, less those another group holds (√, `if`, `table`…). */
const FUNCTIONS: readonly SymbolEntry[] = (
  [
    'exp', 'log', 'log10', 'log2', 'pow', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh',
    'cosh', 'tanh', 'min', 'max', 'sum', 'mean', 'count', 'round', 'floor', 'ceil', 'sign', 'mod',
    'hypot', 'factorial',
  ] as const
).map((name) => call('functions', name, name))

const LOGIC: readonly SymbolEntry[] = [
  call('logic', 'if()', 'if'),
  op('logic', '? :', '? :', { mode: 'spaced', text: '?', close: ':' }),
  spaced('logic', '==', '=='),
  spaced('logic', '!=', '!='),
  spaced('logic', 'and', 'and'),
  spaced('logic', 'or', 'or'),
  op('logic', 'not', 'not', { mode: 'prefix', text: 'not' }),
  op('logic', 'true', 'true', { mode: 'word', text: 'true' }),
  op('logic', 'false', 'false', { mode: 'word', text: 'false' }),
  op('logic', '" "', '" "', { mode: 'wrap', text: '"', close: '"' }),
]

/** Each inserts its keyword only; its hover shows the whole form, as lines that run. */
const FORMS: readonly SymbolEntry[] = [
  op('forms', 'solve', 'solve', { mode: 'prefix', text: 'solve' }, [
    'x = solve x^2 = 2, for x = 0 .. 10',
  ]),
  spaced('forms', 'for', 'for', ['x = solve x^2 = 2, for x = 0 .. 10']),
  spaced('forms', '..', '..', ['r = 1 .. 10']),
  spaced('forms', 'step', 'step', ['r = 1 .. 10 step 0.5']),
  call('forms', 'table()', 'table', ['r = 1 .. 3', 'table(r, r^2)']),
  call('forms', 'plot()', 'plot', ['r = 1 .. 3', 'plot(r, r^2)']),
  spaced('forms', 'in', 'in', ['v = 3 m/s in km/h']),
  op('forms', '[ ]', '[ ]', { mode: 'tight', text: '[', close: ']' }, [
    'r = 1 .. 10',
    'x = r[2]',
  ]),
  {
    ...spaced('forms', 'guess', 'guess', [
      'f(a) = solve x^2 = a, guess x = 1',
      'y = f(2)',
    ]),
    hidden: true,
  },
]

export const SYMBOLS: readonly SymbolEntry[] = [...GREEK, ...OPERATORS, ...FUNCTIONS, ...LOGIC, ...FORMS]

/** What an entry is, in a few words, in the language shown: the hover's second half, and matched by the filter. */
export function symbolHint(entry: SymbolEntry, w: Words = words()): string {
  if (entry.group === 'greek') return w.symbols.greek
  return (w.symbols.hints[entry.group] as Readonly<Record<string, string>>)[entry.spelling] ?? ''
}

/** What a Greek letter that is also a constant is, in the language shown. */
function constantOf(entry: SymbolEntry, w: Words): string {
  return entry.constant ? ((w.constants.description as Readonly<Record<string, string>>)[entry.constant] ?? '') : ''
}

/** The entries whose filter text holds `filter`: the spelling, the letter's name and the hint, in the language shown. */
export function filterSymbols(filter: string, entries: readonly SymbolEntry[] = SYMBOLS, w: Words = words()): SymbolEntry[] {
  const wanted = filter.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      !entry.hidden &&
      [entry.spelling, entry.label, symbolHint(entry, w), constantOf(entry, w)].some((text) =>
        text.toLowerCase().includes(wanted),
      ),
  )
}

/** A button's hover: the spelling, then what it is (and for a sheet form, the form that runs). */
export function symbolHover(entry: SymbolEntry, w: Words = words()): string {
  if (entry.group === 'greek') {
    return entry.constant
      ? w.symbols.greekConstantHover(entry.spelling, constantOf(entry, w))
      : w.symbols.greekHover(entry.spelling)
  }
  const head = `${entry.spelling} — ${symbolHint(entry, w)}`
  return entry.example ? `${head}\n${entry.example.join('\n')}` : head
}
