import { CONSTANT_GROUPS } from './constants.ts'

/**
 * The Symbols catalogue (docs/spec-v1.md section 4, Symbols tab, M4d): every
 * button of the Sheet panel's Symbols tab, in its group and order, with what
 * it shows, what it types and how it goes in. Pure data, with no math.js:
 * every insert is text the engine already reads, so the tab adds no grammar.
 *
 * It is the one list: the tab draws it, the typing suggestions' functions and
 * line forms are built from it (`FUNCTION_SUGGESTIONS`), and a test puts every
 * insert into a minimal line and runs it.
 */

export type SymbolGroupId = 'greek' | 'operators' | 'functions' | 'logic' | 'forms'

export const SYMBOL_GROUPS: readonly { id: SymbolGroupId; label: string }[] = [
  { id: 'greek', label: 'Greek' },
  { id: 'operators', label: 'Operators' },
  { id: 'functions', label: 'Functions' },
  { id: 'logic', label: 'Logic' },
  { id: 'forms', label: 'Sheet forms' },
]

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
}

export interface SymbolEntry {
  group: SymbolGroupId
  /** What the button shows: ρ, √, `sin`, `if()`. */
  label: string
  /** The text a line reads, as the hover and the filter give it: `rho`, `sqrt`, `<=`. */
  spelling: string
  /** What it is, in a few words: the hover's second half, and matched by the filter. */
  hint: string
  insert: SymbolInsert
  /** The Greek group's rows: 1 the letters, 2 the variants, 3 the capitals. */
  row?: 1 | 2 | 3
  /** A Greek letter that is also a constant: what that constant is. */
  constant?: string
  /** A sheet form's hover: the whole form, as lines that run. */
  example?: readonly string[]
  /** Not a button: a typing suggestion only (`guess`, which the spec leaves out of the tab). */
  hidden?: true
}

/** A constant's name or short name → what it is, to mark the Greek letters that are both. */
const CONSTANT_LABELS: ReadonlyMap<string, string> = new Map(
  CONSTANT_GROUPS.flatMap((group) => group.constants).flatMap(({ name, short, label }) => [
    [name, label] as const,
    ...(short ? [[short, label] as const] : []),
  ]),
)

const greek = (row: 1 | 2 | 3, pairs: string): SymbolEntry[] =>
  pairs.split(' ').map((pair) => {
    const [label, spelling] = pair.split(':')
    const constant = CONSTANT_LABELS.get(spelling)
    return {
      group: 'greek',
      label,
      spelling,
      hint: 'type _ for a subscript',
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
  hint: string,
  insert: SymbolInsert,
  example?: readonly string[],
): SymbolEntry => ({ group, label, spelling, hint, insert, ...(example ? { example } : {}) })

const spaced = (group: SymbolGroupId, label: string, spelling: string, hint: string, example?: readonly string[]) =>
  op(group, label, spelling, hint, { mode: 'spaced', text: spelling }, example)

const call = (group: SymbolGroupId, label: string, name: string, hint: string, example?: readonly string[]) =>
  op(group, label, name, hint, { mode: 'wrap', text: `${name}(`, close: ')' }, example)

const OPERATORS: readonly SymbolEntry[] = [
  spaced('operators', '+', '+', 'plus'),
  spaced('operators', '−', '-', 'minus'),
  spaced('operators', '·', '*', 'times'),
  spaced('operators', '÷', '/', 'divided by'),
  op('operators', 'x²', '^2', 'squared', { mode: 'tight', text: '^2' }),
  op('operators', 'xⁿ', '^', 'to the power', { mode: 'tight', text: '^' }),
  call('operators', '√', 'sqrt', 'square root'),
  call('operators', '∛', 'cbrt', 'cube root'),
  call('operators', 'ⁿ√', 'nthRoot', 'nthRoot(x, n)'),
  call('operators', '|x|', 'abs', 'absolute value'),
  op('operators', 'n!', '!', 'factorial', { mode: 'tight', text: '!' }),
  op('operators', '( )', '( )', 'brackets', { mode: 'wrap', text: '(', close: ')' }),
  op('operators', '[ ]', '[ ]', 'a matrix, or an index', { mode: 'tight', text: '[', close: ']' }),
  spaced('operators', '<', '<', 'less than'),
  spaced('operators', '>', '>', 'greater than'),
  spaced('operators', '≤', '<=', 'less than or equal to'),
  spaced('operators', '≥', '>=', 'greater than or equal to'),
]

/** Today's function suggestions, in their order, less those another group holds (√, `if`, `table`…). */
const FUNCTIONS: readonly SymbolEntry[] = (
  [
    ['exp', 'e to the power x'],
    ['log', 'natural logarithm, or log(x, base)'],
    ['log10', 'base-10 logarithm'],
    ['log2', 'base-2 logarithm'],
    ['pow', 'pow(x, y)'],
    ['sin', 'sine'],
    ['cos', 'cosine'],
    ['tan', 'tangent'],
    ['asin', 'inverse sine'],
    ['acos', 'inverse cosine'],
    ['atan', 'inverse tangent'],
    ['atan2', 'atan2(y, x)'],
    ['sinh', 'hyperbolic sine'],
    ['cosh', 'hyperbolic cosine'],
    ['tanh', 'hyperbolic tangent'],
    ['min', 'smallest value'],
    ['max', 'largest value'],
    ['sum', 'sum of a list'],
    ['mean', 'mean of a list'],
    ['count', 'number of values in a list'],
    ['round', 'round(x) or round(x, digits)'],
    ['floor', 'round down'],
    ['ceil', 'round up'],
    ['sign', 'sign: -1, 0 or 1'],
    ['mod', 'mod(x, y)'],
    ['hypot', 'hypot(a, b)'],
    ['factorial', 'n!'],
  ] as const
).map(([name, hint]) => call('functions', name, name, hint))

const LOGIC: readonly SymbolEntry[] = [
  call('logic', 'if()', 'if', 'if(cond, a, b)'),
  op('logic', '? :', '? :', 'cond ? a : b', { mode: 'spaced', text: '?', close: ':' }),
  spaced('logic', '==', '==', 'equal to'),
  spaced('logic', '!=', '!=', 'not equal to'),
  spaced('logic', 'and', 'and', 'both true'),
  spaced('logic', 'or', 'or', 'either true'),
  op('logic', 'not', 'not', 'not true', { mode: 'prefix', text: 'not' }),
  op('logic', 'true', 'true', 'a condition that holds', { mode: 'word', text: 'true' }),
  op('logic', 'false', 'false', 'a condition that fails', { mode: 'word', text: 'false' }),
  op('logic', '" "', '" "', 'a text: "OK"', { mode: 'wrap', text: '"', close: '"' }),
]

/** Each inserts its keyword only; its hover shows the whole form, as lines that run. */
const FORMS: readonly SymbolEntry[] = [
  op('forms', 'solve', 'solve', 'a solved value', { mode: 'prefix', text: 'solve' }, [
    'x = solve x^2 = 2, for x = 0 .. 10',
  ]),
  spaced('forms', 'for', 'for', 'a solve’s search range', ['x = solve x^2 = 2, for x = 0 .. 10']),
  spaced('forms', '..', '..', 'a range', ['r = 1 .. 10']),
  spaced('forms', 'step', 'step', 'a range’s step', ['r = 1 .. 10 step 0.5']),
  call('forms', 'table()', 'table', 'table(a, b, …)', ['r = 1 .. 3', 'table(r, r^2)']),
  call('forms', 'plot()', 'plot', 'plot(x, y1, …)', ['r = 1 .. 3', 'plot(r, r^2)']),
  spaced('forms', 'in', 'in', 'the result in a unit', ['v = 3 m/s in km/h']),
  op('forms', '[ ]', '[ ]', 'a value out of a list', { mode: 'tight', text: '[', close: ']' }, [
    'r = 1 .. 10',
    'x = r[2]',
  ]),
  {
    ...spaced('forms', 'guess', 'guess', 'a solve function’s starting value', [
      'f(a) = solve x^2 = a, guess x = 1',
      'y = f(2)',
    ]),
    hidden: true,
  },
]

export const SYMBOLS: readonly SymbolEntry[] = [...GREEK, ...OPERATORS, ...FUNCTIONS, ...LOGIC, ...FORMS]

/** The entries whose filter text holds `filter`: the spelling, the letter's name and the hint. */
export function filterSymbols(filter: string, entries: readonly SymbolEntry[] = SYMBOLS): SymbolEntry[] {
  const wanted = filter.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      !entry.hidden &&
      [entry.spelling, entry.label, entry.hint, entry.constant ?? ''].some((text) => text.toLowerCase().includes(wanted)),
  )
}

/** A button's hover: the spelling, then what it is (and for a sheet form, the form that runs). */
export function symbolHover(entry: SymbolEntry): string {
  if (entry.group === 'greek') {
    const subscript = `type _ for a subscript: ${entry.spelling}_w`
    return entry.constant
      ? `${entry.spelling} — also the constant ${entry.constant}; a sheet may take the name\n${subscript}`
      : `${entry.spelling} — ${subscript}`
  }
  const head = `${entry.spelling} — ${entry.hint}`
  return entry.example ? `${head}\n${entry.example.join('\n')}` : head
}
