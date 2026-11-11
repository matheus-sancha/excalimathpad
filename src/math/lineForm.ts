/**
 * How a sheet line reads before math.js sees it (ADR 0005, docs/spec-v1.md
 * section 3): the comment, then the format clause. Pure, with no math.js.
 *
 * - A **blank** line is empty, only spaces, or a bare `#`: a spacer row.
 * - A **comment line** starts with `#`: one text cell spans the row, and it is
 *   never evaluated.
 * - Any other line is **code**, with an optional **note**: the text after the
 *   first `#` outside a string. Only the code goes to math.js, so a note never
 *   changes a result.
 * - Code can end with a **format clause**: `@` words after everything else and
 *   before the note, `U = I * R in V @bold @yellow # check`. math.js rejects
 *   `@`, so a clause can never be read as code, and it is taken off before
 *   math.js sees the line.
 * - Code can then end with a **display unit**: a trailing top-level `in` or
 *   `to` and its target, `dP = ... in kPa`. It is taken off the code here as
 *   text, because math.js would read `3 in L/minute` as `(3 in L) / minute`.
 *   Whether the target is a pure unit is the engine's to check: when it isn't,
 *   the engine puts the conversion back and leaves it to math.js.
 */
export type LineForm =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | {
      kind: 'code'
      code: string
      note: string | null
      format: LineFormat
      /** A clause word that isn't a format, with its `@`: an error on the line. */
      unknownFormat: string | null
      /** The target of a trailing top-level `in` or `to`, as typed, or null. */
      displayUnit: string | null
      /** The code before that `in` or `to`; the whole code when there is none. */
      expression: string
    }

/** The highlight colours, by the names the clause stores (section 4). */
export const FORMAT_COLORS = ['yellow', 'green', 'blue', 'red', 'gray'] as const
export type FormatColor = (typeof FORMAT_COLORS)[number]

/** A line's format: it applies to the whole row, equation, result and note. */
export interface LineFormat {
  bold: boolean
  underline: boolean
  color: FormatColor | null
}

export const NO_FORMAT: LineFormat = { bold: false, underline: false, color: null }

export function readLine(line: string): LineForm {
  const at = commentStart(line)
  const code = at === -1 ? line : line.slice(0, at)
  const after = at === -1 ? null : line.slice(at + 1).trim()
  if (code.trim() === '') {
    return after ? { kind: 'comment', text: after } : { kind: 'blank' }
  }
  const { rest, words } = splitClause(code)
  let format = NO_FORMAT
  let unknownFormat: string | null = null
  for (const word of words) {
    if (word === 'bold') format = { ...format, bold: true }
    else if (word === 'underline') format = { ...format, underline: true }
    // A colour named twice keeps the last.
    else if (isFormatColor(word)) format = { ...format, color: word }
    else unknownFormat ??= `@${word}`
  }
  return {
    kind: 'code',
    code: rest,
    note: after || null,
    format,
    unknownFormat,
    ...splitDisplayUnit(rest),
  }
}

/**
 * The code's trailing top-level `in` or `to` (outside brackets and strings),
 * split from the expression before it. The last one wins:
 * `a to m in cm` is `a to m`, shown in cm. The engine checks that the target
 * is a pure unit.
 */
export function splitDisplayUnit(code: string): { expression: string; displayUnit: string | null } {
  let depth = 0
  let quote: string | null = null
  const found: number[] = []
  for (let i = 0; i < code.length; i++) {
    const char = code[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"' || (char === "'" && !endsValue(code, i))) {
      quote = char
    } else if ('([{'.includes(char)) {
      depth++
    } else if (')]}'.includes(char)) {
      depth--
    } else if (depth === 0 && /^(?:in|to)(?![\w.])/.test(code.slice(i, i + 3)) && /[^\w.]$/.test(code.slice(0, i))) {
      found.push(i)
    }
  }
  // The last one with something on both sides: in `D = 102.3 mm in in`, the
  // target is the unit `in`.
  for (const at of found.reverse()) {
    const expression = code.slice(0, at).trimEnd()
    const displayUnit = code.slice(at + 2).trim()
    if (expression !== '' && displayUnit !== '') return { expression, displayUnit }
  }
  return { expression: code, displayUnit: null }
}

/**
 * The line with its format clause replaced by `format`'s, for the format bar.
 * The code and the note stay exactly as typed; the clause goes after the code
 * and before the `#`. A line with no code takes no format and comes back
 * unchanged. Unknown clause words are dropped: the bar writes a clean clause.
 */
export function writeFormat(line: string, format: LineFormat): string {
  const at = commentStart(line)
  const code = at === -1 ? line : line.slice(0, at)
  if (code.trim() === '') return line
  const words = [
    format.bold ? '@bold' : null,
    format.underline ? '@underline' : null,
    format.color ? `@${format.color}` : null,
  ].filter((word) => word !== null)
  const head = [splitClause(code).rest, ...words].join(' ')
  return at === -1 ? head : `${head} ${line.slice(at)}`
}

/**
 * The line with its display unit set to `unit`, or taken off for null (the
 * unit slot, section 5): `in <unit>` goes at the end of the code, before the
 * format clause and the note (section 3, Rules for what the app writes). The
 * rest of the line stays as typed. A line with no code comes back unchanged.
 */
export function writeDisplayUnit(line: string, unit: string | null): string {
  const at = commentStart(line)
  const head = at === -1 ? line : line.slice(0, at)
  if (head.trim() === '') return line
  const tail = at === -1 ? '' : line.slice(at)
  const clause = CLAUSE.exec(head)
  const code = (clause ? head.slice(0, clause.index) : head).trimEnd()
  const { expression } = splitDisplayUnit(code)
  const written = unit ? `${expression} in ${unit.trim()}` : expression
  return `${written}${clause ? clause[0].trimEnd() : ''}${tail ? ` ${tail}` : ''}`
}

/** Where the code part of a line ends: before its clause and its note. */
export function codeLength(line: string): number {
  const at = commentStart(line)
  return splitClause(at === -1 ? line : line.slice(0, at)).rest.length
}

function isFormatColor(word: string): word is FormatColor {
  return (FORMAT_COLORS as readonly string[]).includes(word)
}

/** The trailing `@word`s of a line's code, and the code before them. */
const CLAUSE = /(?:\s+@\w*)+\s*$/

function splitClause(code: string): { rest: string; words: string[] } {
  const match = CLAUSE.exec(code)
  if (!match) return { rest: code.trimEnd(), words: [] }
  return {
    rest: code.slice(0, match.index),
    words: match[0].trim().split(/\s+/).map((word) => word.slice(1)),
  }
}

/**
 * Where the comment starts: the first `#` outside a string, or -1. math.js
 * strings take double or single quotes, but `'` after a value is its transpose
 * (`A'`), so a `'` opens a string only where a value can't end.
 */
function commentStart(line: string): number {
  let quote: string | null = null
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '#') {
      return i
    } else if (char === '"' || (char === "'" && !endsValue(line, i))) {
      quote = char
    }
  }
  return -1
}

/** True when the text before `index` ends a value: a name, number, `)`, `]` or `'`. */
function endsValue(line: string, index: number): boolean {
  const before = line.slice(0, index).trimEnd()
  return /[\w)\]'.]$/.test(before)
}
