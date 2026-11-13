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
 *   before the note, `U = I * R in V @bold @text-red @yellow # check`. It
 *   starts at the first `@` outside a string. math.js rejects `@`, so a clause
 *   can never be read as code, and it is taken off before math.js sees the
 *   line. From M4c a word can carry a **rule**, `@text-red if v > 3 m/s`: its
 *   condition runs from `if` to the next `@` or the end of the code.
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
      /** The clause's rules, in the order typed (section 3, A rule). */
      rules: readonly FormatRule[]
      /** The target of a trailing top-level `in` or `to`, as typed, or null. */
      displayUnit: string | null
      /** The code before that `in` or `to`; the whole code when there is none. */
      expression: string
    }

/** The highlight colours, by the names the clause stores (section 4). */
export const FORMAT_COLORS = ['yellow', 'green', 'blue', 'red', 'gray'] as const
export type FormatColor = (typeof FORMAT_COLORS)[number]

/** The text colours (section 4, Colours and rules), written `@text-<name>`. */
export const TEXT_COLORS = ['black', 'blue', 'red', 'green', 'orange', 'gray'] as const
export type TextColor = (typeof TEXT_COLORS)[number]

/** A line's format: bold and underline on the whole row, a highlight band, a text colour. */
export interface LineFormat {
  bold: boolean
  underline: boolean
  /** The highlight. */
  color: FormatColor | null
  /** The equation's and the result's text colour. */
  textColor: TextColor | null
}

export const NO_FORMAT: LineFormat = { bold: false, underline: false, color: null, textColor: null }

/** One format word, as it sets a format: null for a word that isn't one. */
export type FormatWord =
  | { kind: 'bold' }
  | { kind: 'underline' }
  | { kind: 'highlight'; color: FormatColor }
  | { kind: 'text'; color: TextColor }

/** A rule (section 3): a format word that applies while its condition is true. */
export interface FormatRule {
  word: FormatWord
  /** The condition as typed, trimmed; empty if nothing follows `if`. */
  condition: string
  /** The rule exactly as typed, `@text-red if v > 3 m/s`, for the bar to keep. */
  text: string
}

/** What a format word sets, or null when it isn't a format word. */
export function readFormatWord(word: string): FormatWord | null {
  if (word === 'bold') return { kind: 'bold' }
  if (word === 'underline') return { kind: 'underline' }
  if (isFormatColor(word)) return { kind: 'highlight', color: word }
  const text = /^text-(.+)$/.exec(word)
  if (text && (TEXT_COLORS as readonly string[]).includes(text[1])) return { kind: 'text', color: text[1] as TextColor }
  return null
}

/** A format with `word` applied: a colour named twice keeps the last. */
export function applyFormatWord(format: LineFormat, word: FormatWord): LineFormat {
  switch (word.kind) {
    case 'bold':
      return { ...format, bold: true }
    case 'underline':
      return { ...format, underline: true }
    case 'highlight':
      return { ...format, color: word.color }
    case 'text':
      return { ...format, textColor: word.color }
  }
}

export function readLine(line: string): LineForm {
  const at = commentStart(line)
  const code = at === -1 ? line : line.slice(0, at)
  const after = at === -1 ? null : line.slice(at + 1).trim()
  if (code.trim() === '') {
    return after ? { kind: 'comment', text: after } : { kind: 'blank' }
  }
  const { rest, segments } = splitClause(code)
  let format = NO_FORMAT
  let unknownFormat: string | null = null
  const rules: FormatRule[] = []
  for (const segment of segments) {
    const read = readSegment(segment)
    if (read === null) unknownFormat ??= segment.split(/\s+/)[0]
    else if (read.condition === null) format = applyFormatWord(format, read.word)
    else rules.push({ word: read.word, condition: read.condition, text: segment })
  }
  return {
    kind: 'code',
    code: rest,
    note: after || null,
    format,
    unknownFormat,
    rules,
    ...splitDisplayUnit(rest),
  }
}

/** One clause segment, `@word` or `@word if <condition>`; null when the word isn't a format. */
function readSegment(segment: string): { word: FormatWord; condition: string | null } | null {
  const match = /^@([A-Za-z][\w-]*)(.*)$/s.exec(segment)
  if (!match) return null
  const word = readFormatWord(match[1])
  if (word === null) return null
  const rest = match[2].trim()
  if (rest === '') return { word, condition: null }
  const rule = /^if(?![\w.])(.*)$/s.exec(rest)
  return rule ? { word, condition: rule[1].trim() } : null
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
 * The line with its plain format replaced by `format`'s, for the format bar.
 * The code and the note stay exactly as typed; the clause goes after the code
 * and before the `#`: the plain words in a fixed order, `@bold @underline
 * @text-<name> @<highlight>`, then every rule exactly as it was typed (section
 * 3, Rules for what the app writes). Unknown words are dropped. A line with no
 * code takes no format and comes back unchanged.
 */
export function writeFormat(line: string, format: LineFormat): string {
  const at = commentStart(line)
  const code = at === -1 ? line : line.slice(0, at)
  if (code.trim() === '') return line
  const { rest, segments } = splitClause(code)
  const rules = segments.filter((segment) => readSegment(segment)?.condition != null)
  const words = [
    format.bold ? '@bold' : null,
    format.underline ? '@underline' : null,
    format.textColor ? `@text-${format.textColor}` : null,
    format.color ? `@${format.color}` : null,
    ...rules,
  ].filter((word) => word !== null)
  const head = [rest, ...words].join(' ')
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
  const start = clauseStart(head)
  const code = (start === -1 ? head : head.slice(0, start)).trimEnd()
  const clause = start === -1 ? '' : ` ${head.slice(start).trim()}`
  const { expression } = splitDisplayUnit(code)
  const written = unit ? `${expression} in ${unit.trim()}` : expression
  return `${written}${clause}${tail ? ` ${tail}` : ''}`
}

/** Where the code part of a line ends: before its clause and its note. */
export function codeLength(line: string): number {
  const at = commentStart(line)
  return splitClause(at === -1 ? line : line.slice(0, at)).rest.length
}

function isFormatColor(word: string): word is FormatColor {
  return (FORMAT_COLORS as readonly string[]).includes(word)
}

/**
 * The clause's segments, each `@word` or `@word if <condition>`, and the code
 * before the clause. The clause starts at the first `@` outside a string, and
 * a segment runs to the next `@` outside a string.
 */
function splitClause(code: string): { rest: string; segments: string[] } {
  const start = clauseStart(code)
  if (start === -1) return { rest: code.trimEnd(), segments: [] }
  const clause = code.slice(start)
  const cuts = outsideStrings(clause, '@')
  const segments = cuts.map((cut, i) => clause.slice(cut, cuts[i + 1] ?? clause.length).trim())
  return { rest: code.slice(0, start).trimEnd(), segments }
}

/** Where the format clause starts: the first `@` outside a string, or -1. */
function clauseStart(code: string): number {
  return outsideStrings(code, '@')[0] ?? -1
}

/** Every index of `target` outside a string, by the same quote rule as the comment. */
function outsideStrings(text: string, target: string): number[] {
  const found: number[] = []
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === target) {
      found.push(i)
    } else if (char === '"' || (char === "'" && !endsValue(text, i))) {
      quote = char
    }
  }
  return found
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
