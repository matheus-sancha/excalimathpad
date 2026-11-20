/**
 * How a sheet line reads before math.js sees it (ADR 0005, docs/spec-v1.md
 * section 3): the comment, then the format clause. Pure, with no math.js.
 *
 * - A **blank** line is empty, only spaces, or a bare `#`: a spacer row.
 * - A **comment line** starts with `#`: one text cell spans the row, and it is
 *   never evaluated. From M4d a line whose code is only a format clause, with
 *   comment text after the `#`, is a **formatted comment line**,
 *   `@bold @L @text-blue # Pumps`: the clause is the comment's format. The
 *   comment split stays first, so nothing after a `#` is read: `# call me
 *   @home` stays plain. A clause with no comment text after it formats
 *   nothing, and the line stays blank.
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
  | {
      kind: 'comment'
      text: string
      /** The clause before the `#` (section 3, A comment line's format, M4d). */
      format: CommentFormat
      /** The clause's first problem, in section 13's words: an error on the line. */
      formatError: string | null
    }
  | {
      kind: 'code'
      code: string
      note: string | null
      format: LineFormat
      /**
       * The clause's first problem, in section 13's words: a word that isn't a
       * format (`Unknown format @bolt`) or a comment word (`@L is for comment
       * lines`). An error on the line, reported after it ran.
       */
      formatError: string | null
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

/** A comment line's sizes (section 3, M4d): S, L and XL are words; M, 15 px, is the default. */
export const COMMENT_SIZES = ['S', 'M', 'L', 'XL'] as const
export type CommentSize = (typeof COMMENT_SIZES)[number]

/**
 * A comment line's format (section 3, A comment line's format, M4d): a line's
 * format, and italic taken off (`@upright`) and a size. There is no alignment,
 * and a comment line takes no rules.
 */
export interface CommentFormat extends LineFormat {
  /** Not italic: a comment is italic without `@upright`. */
  upright: boolean
  size: CommentSize
}

export const NO_COMMENT_FORMAT: CommentFormat = { ...NO_FORMAT, upright: false, size: 'M' }

/** The words only a comment line takes; on a math line each is the line's error. */
const COMMENT_ONLY_WORDS: readonly string[] = ['upright', 'S', 'L', 'XL']

/** A word a comment line's clause takes: a line's format word, `@upright` or a size. */
export type CommentWord = FormatWord | { kind: 'upright' } | { kind: 'size'; size: Exclude<CommentSize, 'M'> }

/** One format word, as it sets a format: null for a word that isn't one. */
export type FormatWord =
  | { kind: 'bold' }
  | { kind: 'underline' }
  | { kind: 'highlight'; color: FormatColor }
  | { kind: 'text'; color: TextColor }

/**
 * A rule (section 3): a format word that applies while its condition is true.
 * From M4d the word can be joined, `@text-red+red+bold if v > 3 m/s`: one
 * rule setting each of its words, a property named twice keeping the last.
 */
export interface FormatRule {
  /** The word's parts, in the order typed: one for a word that isn't joined. */
  words: readonly FormatWord[]
  /** The condition as typed, trimmed; empty if nothing follows `if`. */
  condition: string
  /** The rule exactly as typed, `@text-red if v > 3 m/s`, for the Format tab to keep. */
  text: string
  /** Where the rule starts in the line, at its `@`. */
  start: number
  /** Where it ends in the line, after its condition: the Rules list puts the caret here. */
  end: number
}

/**
 * A rule as the Rules list writes it (section 4, Rules list, M4d): its words
 * and condition, and its exact text while the list hasn't changed it. A row
 * with no text is written as one joined word and one condition.
 */
export interface RuleRow {
  words: readonly FormatWord[]
  condition: string
  /** The rule as typed, kept exactly; null once the list changed it. */
  text: string | null
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

/** What a word sets on a comment line, or null when a comment line doesn't take it. */
export function readCommentWord(word: string): CommentWord | null {
  if (word === 'upright') return { kind: 'upright' }
  if (word === 'S' || word === 'L' || word === 'XL') return { kind: 'size', size: word }
  return readFormatWord(word)
}

/** A comment's format with `word` applied: a size or a colour named twice keeps the last. */
export function applyCommentWord(format: CommentFormat, word: CommentWord): CommentFormat {
  if (word.kind === 'upright') return { ...format, upright: true }
  if (word.kind === 'size') return { ...format, size: word.size }
  return { ...format, ...applyFormatWord(format, word) }
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
    return after ? { kind: 'comment', text: after, format: NO_COMMENT_FORMAT, formatError: null } : { kind: 'blank' }
  }
  const { rest, segments, spans } = splitClause(code)
  // Code that is only a clause: a formatted comment line, or a blank line
  // when no comment text follows (section 3, A comment line's format).
  if (rest === '') return after ? { kind: 'comment', text: after, ...readCommentClause(segments) } : { kind: 'blank' }
  let format = NO_FORMAT
  let formatError: string | null = null
  const rules: FormatRule[] = []
  segments.forEach((segment, i) => {
    const read = readSegment(segment)
    if (read === null) formatError ??= clauseError(segment)
    else if (read.condition === null) format = read.words.reduce(applyFormatWord, format)
    else rules.push({ words: read.words, condition: read.condition, text: segment, ...spans[i] })
  })
  return {
    kind: 'code',
    code: rest,
    note: after || null,
    format,
    formatError,
    rules,
    ...splitDisplayUnit(rest),
  }
}

/**
 * A comment line's clause: its words, applied in order, and its first problem.
 * A word followed by `if` is a rule, which needs a math line; the comment
 * still takes the clause's other words.
 */
function readCommentClause(segments: readonly string[]): { format: CommentFormat; formatError: string | null } {
  let format = NO_COMMENT_FORMAT
  let formatError: string | null = null
  for (const segment of segments) {
    const parts = segmentParts(segment)
    const words = parts && readWords(parts.names, readCommentWord)
    if (!parts || !words) formatError ??= clauseError(segment, readCommentWord)
    else if (parts.rest === '') format = words.reduce(applyCommentWord, format)
    else formatError ??= isRule(parts.rest) ? 'rules need a math line' : clauseError(segment, readCommentWord)
  }
  return { format, formatError }
}

/**
 * Why a segment of a clause isn't a format, in section 13's words. In a joined
 * word, the first part that isn't one is named with the word it's in:
 * `Unknown format @blod in @text-red+blod` (M4d).
 */
function clauseError(segment: string, read: (word: string) => unknown = readFormatWord): string {
  const parts = segmentParts(segment)
  const bad = parts?.names.find((name) => read(name) === null)
  if (parts && bad !== undefined) {
    if (COMMENT_ONLY_WORDS.includes(bad)) return `@${bad} is for comment lines`
    if (parts.names.length > 1) return `Unknown format @${bad} in @${parts.name}`
  }
  return `Unknown format ${segment.split(/\s+/)[0]}`
}

/**
 * A segment's word, without its `@`, its parts when joined by `+` with no
 * spaces (M4d), and what follows it, trimmed; null for a bare `@`.
 */
function segmentParts(segment: string): { name: string; names: string[]; rest: string } | null {
  const match = /^@([A-Za-z][\w-]*(?:\+[A-Za-z][\w-]*)*)(.*)$/s.exec(segment)
  return match ? { name: match[1], names: match[1].split('+'), rest: match[2].trim() } : null
}

/** Every part of a word read, or null when one isn't a word `read` takes. */
function readWords<W>(names: readonly string[], read: (name: string) => W | null): W[] | null {
  const words = names.map(read)
  return words.every((word): word is W => word !== null) ? words : null
}

/** Whether what follows a word makes it a rule: `if`, as a whole word. */
function isRule(rest: string): boolean {
  return /^if(?![\w.])/.test(rest)
}

/**
 * One clause segment, `@word` or `@word if <condition>`, its word joined or
 * not; null when a part of the word isn't a format.
 */
function readSegment(segment: string): { words: FormatWord[]; condition: string | null } | null {
  const parts = segmentParts(segment)
  const words = parts && readWords(parts.names, readFormatWord)
  if (!parts || !words) return null
  if (parts.rest === '') return { words, condition: null }
  return isRule(parts.rest) ? { words, condition: parts.rest.slice(2).trim() } : null
}

/**
 * The code's trailing top-level `in` or `to` (outside brackets and strings),
 * split from the expression before it. The last one wins:
 * `a to m in cm` is `a to m`, shown in cm. The engine checks that the target
 * is a pure unit.
 *
 * An `in` with `^`, `*` or `/` after it is the inch, part of a target or of the
 * expression, since the word needs a value after it: `A = L^2 in in^2` is `A =
 * L^2`, shown in in² (section 3, step 3; #229).
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
    } else if (
      depth === 0 &&
      /^(?:in|to)(?![\w.])/.test(code.slice(i, i + 3)) &&
      /[^\w.]$/.test(code.slice(0, i)) &&
      !/^\s*\.?[\^*/]/.test(code.slice(i + 2))
    ) {
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
 * Whether the code holds a `;` at its top level, outside brackets and strings
 * (section 3: one statement per line; ADR 0005, step 6). A `;` inside brackets
 * is a matrix row, `[1, 2; 3, 4]`.
 */
export function hasTopLevelSemicolon(code: string): boolean {
  let depth = 0
  let quote: string | null = null
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
    } else if (char === ';' && depth <= 0) {
      return true
    }
  }
  return false
}

/**
 * The line with its plain format replaced by `format`'s, for the Format tab (M4d).
 * The code and the note stay exactly as typed; the clause goes after the code
 * and before the `#`: the plain words in a fixed order, `@bold @underline
 * @text-<name> @<highlight>`, then every rule exactly as it was typed (section
 * 3, Rules for what the app writes). Unknown words are dropped. A line with no
 * code, a formatted comment line among them, takes no format here and comes
 * back unchanged.
 */
export function writeFormat(line: string, format: LineFormat): string {
  const at = commentStart(line)
  const { segments } = splitClause(at === -1 ? line : line.slice(0, at))
  return writeClause(line, format, segments.filter((segment) => readSegment(segment)?.condition != null))
}

/**
 * The line with its rules replaced by `rows`, in order, for the Rules list
 * (section 4, Rules list, M4d): a row the list didn't change keeps its exact
 * text; one it changed is one joined word and one condition,
 * `@text-red+red+bold if v > 3 m/s`. The plain words are written as
 * `writeFormat` writes them. A line with no code comes back unchanged.
 */
export function writeRules(line: string, rows: readonly RuleRow[]): string {
  const form = readLine(line)
  if (form.kind !== 'code') return line
  return writeClause(line, form.format, rows.map((row) => row.text ?? ruleText(row.words, row.condition)))
}

/**
 * The row + Add rule adds (section 4, Rules list, M4e): the format `text-red`
 * and the condition `<name>`, or none on a table line, which names nothing.
 */
export function newRule(name: string | null): RuleRow {
  return { words: [{ kind: 'text', color: 'red' }], condition: name ?? '', text: null }
}

/**
 * What a condition's field takes of `text` (section 4, Rules list, M4e): up to
 * the first `@` or `#` outside a string, since an `@` starts the next word of
 * the clause and a `#` ends it.
 */
export function conditionText(text: string): string {
  const cut = [commentStart(text), clauseStart(text)].filter((at) => at !== -1)
  return cut.length === 0 ? text : text.slice(0, Math.min(...cut))
}

/**
 * A rule as one joined word and one condition: its words in the order text,
 * highlight, bold, underline. The condition is written so the rule reads back
 * as one rule wherever it stands in a clause: cut where `conditionText` cuts
 * it, and a text left open (`result == "Pa`, as it is being typed) closed.
 */
export function ruleText(words: readonly FormatWord[], condition: string): string {
  const joined = formatWords(words.reduce(applyFormatWord, NO_FORMAT)).map(wordName).join('+')
  const written = closeString(conditionText(condition).trim())
  return `@${joined} if${written ? ` ${written}` : ''}`
}

/**
 * `text` with a string it leaves open closed, by the quote rule of the
 * comment: an open string would take in every word of the clause after it.
 */
function closeString(text: string): string {
  let quote: string | null = null
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') escaped = ++i >= text.length
      else if (char === quote) quote = null
    } else if (char === '"' || (char === "'" && !endsValue(text, i))) {
      quote = char
    }
  }
  return quote === null ? text : `${text}${escaped ? '\\' : ''}${quote}`
}

/** A format's words, in the order a rule writes them: text colour, highlight, bold, underline. */
export function formatWords(format: LineFormat): FormatWord[] {
  return [
    format.textColor ? ({ kind: 'text', color: format.textColor } as const) : null,
    format.color ? ({ kind: 'highlight', color: format.color } as const) : null,
    format.bold ? ({ kind: 'bold' } as const) : null,
    format.underline ? ({ kind: 'underline' } as const) : null,
  ].filter((word) => word !== null)
}

/** A word as a clause writes it, without its `@`. */
function wordName(word: FormatWord): string {
  switch (word.kind) {
    case 'bold':
    case 'underline':
      return word.kind
    case 'highlight':
      return word.color
    case 'text':
      return `text-${word.color}`
  }
}

/** The line's clause rewritten: its plain words in the fixed order, then `rules` as given. */
function writeClause(line: string, format: LineFormat, rules: readonly string[]): string {
  const at = commentStart(line)
  const code = at === -1 ? line : line.slice(0, at)
  const { rest } = splitClause(code)
  if (rest.trim() === '') return line
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
 * A comment line with its clause replaced by `format`'s, for the Format tab
 * (section 3, Rules for what the app writes, M4d): the words in the order
 * `@bold @upright @underline @<size> @text-<name> @<highlight>`, before the `#`.
 * The comment text after the `#` stays exactly as typed; words the clause had
 * that a comment doesn't take are dropped. A line that isn't a comment line
 * comes back unchanged.
 */
export function writeCommentFormat(line: string, format: CommentFormat): string {
  if (readLine(line).kind !== 'comment') return line
  const at = commentStart(line)
  const words = [
    format.bold ? '@bold' : null,
    format.upright ? '@upright' : null,
    format.underline ? '@underline' : null,
    format.size === 'M' ? null : `@${format.size}`,
    format.textColor ? `@text-${format.textColor}` : null,
    format.color ? `@${format.color}` : null,
  ].filter((word) => word !== null)
  const comment = line.slice(at)
  return words.length === 0 ? comment : `${words.join(' ')} ${comment}`
}

/**
 * Where the caret goes when a format press rewrites `before` as `after`
 * (section 6, a press in the Format tab): on a math line, where it was in the
 * code, `min(caret, codeLength)`, since the clause after it moved. On a comment
 * line the comment text keeps its place after the `#`, so a caret in it moves
 * with the `#`; one in the clause goes to its end, before the `#`.
 */
export function caretAfterFormat(before: string, after: string, caret: number): number {
  if (readLine(after).kind !== 'comment') return Math.min(caret, codeLength(after))
  const was = commentStart(before)
  const now = commentStart(after)
  return caret > was ? caret - was + now : Math.min(caret, Math.max(now - 1, 0))
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
  // Only a clause: a formatted comment line, or a blank one, has no value.
  if (code.trim() === '') return line
  const clause = start === -1 ? '' : ` ${head.slice(start).trim()}`
  const { expression } = splitDisplayUnit(code)
  const written = unit ? `${expression} in ${unit.trim()}` : expression
  return `${written}${clause}${tail ? ` ${tail}` : ''}`
}

/**
 * Where a line's format lives (section 3, M4e): beside the line, in the
 * anchor's `customData.formats`, one **stored clause** per line (section 7).
 * The functions below move a clause between a line's text and its stored
 * clause. They keep the text's math and note exactly as typed.
 */

/** A line's text with its clause taken out, and that clause, trimmed: from the first `@` outside a string up to the note. */
export function splitFormat(line: string): { text: string; clause: string } {
  const { rest, clause, tail, found } = lineParts(line)
  return found ? { text: placeClause(rest, '', tail), clause } : { text: line, clause: '' }
}

/**
 * The line as the engine reads it: its text with the stored clause joined
 * after any clause typed in it, before the note (ADR 0005, step 2). A line
 * with no stored clause comes back as it is.
 */
export function withFormat(line: string, stored: string): string {
  if (stored === '') return line
  const { rest, clause, tail } = lineParts(line)
  return placeClause(rest, joinClauses(clause, stored), tail)
}

/**
 * A typed clause in front of a stored one. A plain word typed replaces what
 * the stored clause says of the same property (a second colour, a second
 * size); rules are never dropped, and the typed ones come first, so they win.
 */
export function joinClauses(typed: string, stored: string): string {
  if (typed === '' || stored === '') return typed || stored
  const set = new Set<string>()
  for (const segment of splitClause(typed).segments) {
    const parts = segmentParts(segment)
    if (parts?.rest === '') parts.names.forEach((name) => set.add(propertyOf(name) ?? ''))
  }
  const kept = splitClause(stored).segments.flatMap((segment) => {
    const parts = segmentParts(segment)
    if (!parts || parts.rest !== '') return [segment]
    const names = parts.names.filter((name) => !set.has(propertyOf(name) ?? '?'))
    if (names.length === parts.names.length) return [segment]
    return names.length === 0 ? [] : [`@${names.join('+')}`]
  })
  return [typed, ...kept].join(' ')
}

/** What a line commit writes (section 3): the typed clause moves out of the text, in front of the stored one. */
export function commitFormat(line: string, stored: string): { text: string; stored: string } {
  const { text, clause } = splitFormat(line)
  return { text, stored: joinClauses(clause, stored) }
}

/**
 * The stored clauses of an element's lines, from `customData.formats`: one
 * entry per line, padded or cut to `count` (section 7). An entry that isn't a
 * clause (a hand-edited file) is none, and a `#` ends one.
 */
export function lineFormats(formats: string, count: number): string[] {
  const entries = formats === '' ? [] : formats.split(/\r?\n/).map(storedClause)
  return Array.from({ length: count }, (_, i) => entries[i] ?? '')
}

/** The entries as `customData.formats` holds them; empty when no line has a format, which stores no key. */
export function storeFormats(entries: readonly string[]): string {
  return entries.every((entry) => entry === '') ? '' : entries.join('\n')
}

function storedClause(entry: string): string {
  const at = commentStart(entry)
  const clause = (at === -1 ? entry : entry.slice(0, at)).trim()
  return clause.startsWith('@') ? clause : ''
}

/**
 * A Format tab press on a math line (section 4, Format tab, Writes): the
 * stored clause takes `format` as its plain words, its rules kept. Plain words
 * typed in the open line move out with the press; rules still being typed
 * stay in the text, which is otherwise left exactly as it is.
 */
export function pressFormat(line: string, stored: string, format: LineFormat): { text: string; stored: string } {
  const { text: bare, clause } = splitFormat(line)
  if (readLine(bare).kind !== 'code') return { text: line, stored }
  const typed = splitClause(clause).segments
  const typedRules = typed.filter(isRuleSegment)
  return {
    text: typedRules.length === typed.length ? line : withFormat(bare, typedRules.join(' ')),
    stored: splitFormat(writeFormat(withFormat(bare, stored), format)).clause,
  }
}

/** The same press on a comment line: the stored clause becomes `format`'s words, and a typed clause goes. */
export function pressCommentFormat(line: string, stored: string, format: CommentFormat): { text: string; stored: string } {
  const read = withFormat(line, stored)
  if (readLine(read).kind !== 'comment') return { text: line, stored }
  return { text: splitFormat(line).text, stored: splitFormat(writeCommentFormat(read, format)).clause }
}

/**
 * A Rules list write (section 4, Rules list, M4e): `rows` are the line's rules
 * as they should be, and all of them go to the stored clause, after its plain
 * words. Rules typed in the open line move out of its text with the write, as
 * plain words do with a Format tab press; plain words typed there stay, and the
 * text is otherwise left exactly as it is.
 */
export function pressRules(line: string, stored: string, rows: readonly RuleRow[]): { text: string; stored: string } {
  const { text: bare, clause } = splitFormat(line)
  if (readLine(bare).kind !== 'code') return { text: line, stored }
  const typed = splitClause(clause).segments
  const typedPlain = typed.filter((segment) => !isRuleSegment(segment))
  const storedPlain = splitClause(stored).segments.filter((segment) => !isRuleSegment(segment))
  return {
    text: typedPlain.length === typed.length ? line : withFormat(bare, typedPlain.join(' ')),
    // A rule kept as typed may end in an open text, which would take in the rows after it.
    stored: [...storedPlain, ...rows.map((row) => closeString(row.text ?? ruleText(row.words, row.condition)))].join(' '),
  }
}

function isRuleSegment(segment: string): boolean {
  return readSegment(segment)?.condition != null
}

/** The property a plain word sets (`text`, `highlight`, `size`, ...), or null when it isn't a word. */
function propertyOf(name: string): string | null {
  return readCommentWord(name)?.kind ?? null
}

/** A line as the code before its clause, its clause and its `#` tail. */
function lineParts(line: string): { rest: string; clause: string; tail: string; found: boolean } {
  const at = commentStart(line)
  const head = at === -1 ? line : line.slice(0, at)
  const tail = at === -1 ? '' : line.slice(at)
  const start = clauseStart(head)
  if (start === -1) return { rest: head.trimEnd(), clause: '', tail, found: false }
  return { rest: head.slice(0, start).trimEnd(), clause: head.slice(start).trim(), tail, found: true }
}

function placeClause(rest: string, clause: string, tail: string): string {
  const head = [rest, clause].filter((part) => part !== '').join(' ')
  return tail === '' ? head : head === '' ? tail : `${head} ${tail}`
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
function splitClause(code: string): {
  rest: string
  segments: string[]
  /** Where each segment starts and ends in `code`, trimmed. */
  spans: { start: number; end: number }[]
} {
  const start = clauseStart(code)
  if (start === -1) return { rest: code.trimEnd(), segments: [], spans: [] }
  const clause = code.slice(start)
  const cuts = outsideStrings(clause, '@')
  const raws = cuts.map((cut, i) => clause.slice(cut, cuts[i + 1] ?? clause.length))
  return {
    rest: code.slice(0, start).trimEnd(),
    segments: raws.map((raw) => raw.trim()),
    spans: raws.map((raw, i) => ({ start: start + cuts[i], end: start + cuts[i] + raw.trimEnd().length })),
  }
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
