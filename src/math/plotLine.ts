import { codeLength, splitDisplayUnit } from './lineForm.ts'
import { callSpans } from './tableLine.ts'

/**
 * How a plot line reads (docs/spec-v1.md sections 3 and 10; ADR 0005, step 4):
 * `plot(x, y1, …)`, then its settings as comma-separated clauses, `, mark Q_op,
 * x log, size L`. Each argument can carry its own `in <unit>`, as in a table.
 * Pure text, with no math.js: the engine parses the expressions.
 */
export interface PlotForm {
  args: readonly { expression: string; displayUnit: string | null }[]
  clauses: readonly PlotClause[]
}

export type PlotSize = 'S' | 'M' | 'L'

export type PlotClause =
  | { kind: 'mark'; expression: string }
  /** `point (x, y)`: the text after `point`, as written (M4e). */
  | { kind: 'point'; expression: string }
  /** `circle r` or `circle (x0, y0) r`: the text after `circle`, as written (M4e). */
  | { kind: 'circle'; expression: string }
  | { kind: 'labels-direct' }
  | { kind: 'points' }
  | { kind: 'log'; axis: 'x' | 'y' }
  | { kind: 'range'; axis: 'x' | 'y'; start: string; end: string }
  /** Equal scales (M4e). */
  | { kind: 'equal' }
  | { kind: 'size'; size: PlotSize }
  | { kind: 'title'; text: string }
  /** A clause that isn't a setting: an error on the line. */
  | { kind: 'unknown'; text: string }

/** The line's plot form, or null when it isn't a plot line. */
export function readPlot(code: string): PlotForm | null {
  const call = callSpans(code, 'plot')
  if (call === null) return null
  const rest = call.rest.trim()
  if (rest !== '' && !rest.startsWith(',')) return null
  return {
    args: call.spans.map(([start, end]) => splitDisplayUnit(code.slice(start, end).trim())),
    clauses: splitClauses(rest.slice(1)).map(readClause),
  }
}

/** The text of each clause, split at top-level commas. */
export function splitClauses(text: string): string[] {
  const parts: string[] = []
  let depth = 0
  let quote: string | null = null
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
    } else if (char === '"') quote = char
    else if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((part) => part.trim()).filter((part) => part !== '')
}

function readClause(text: string): PlotClause {
  const mark = /^mark\s+(.+)$/s.exec(text)
  if (mark) return { kind: 'mark', expression: mark[1].trim() }
  if (/^labels\s+direct$/.test(text)) return { kind: 'labels-direct' }
  if (text === 'points') return { kind: 'points' }
  if (text === 'equal') return { kind: 'equal' }
  const point = /^point(?:\s+|(?=\())(.+)$/s.exec(text)
  if (point) return { kind: 'point', expression: point[1].trim() }
  const circle = /^circle(?:\s+|(?=\())(.+)$/s.exec(text)
  if (circle) return { kind: 'circle', expression: circle[1].trim() }
  const log = /^([xy])\s+log$/.exec(text)
  if (log) return { kind: 'log', axis: log[1] as 'x' | 'y' }
  const range = /^([xy])\s+(.+?)\s*\.\.\s*(.+)$/s.exec(text)
  if (range) return { kind: 'range', axis: range[1] as 'x' | 'y', start: range[2], end: range[3] }
  const size = /^size\s+([SML])$/.exec(text)
  if (size) return { kind: 'size', size: size[1] as PlotSize }
  const title = /^title\s+"((?:[^"\\]|\\.)*)"$/s.exec(text)
  if (title) return { kind: 'title', text: title[1].replace(/\\(.)/g, '$1') }
  return { kind: 'unknown', text }
}

/** A plot's size in scene units (section 10). */
export const PLOT_SIZES: Record<PlotSize, { width: number; height: number }> = {
  S: { width: 360, height: 220 },
  M: { width: 480, height: 280 },
  L: { width: 640, height: 360 },
}

/** A chart with equal scales is square: its side in scene units (section 10, M4e). */
export const SQUARE_SIZES: Record<PlotSize, number> = { S: 220, M: 280, L: 360 }

/**
 * A bracketed pair, `(x, y)`, as its two expressions; null when the text isn't
 * one (a `point`'s value, a circle's centre; section 10, M4e).
 */
export function readPair(text: string): [string, string] | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('(') || closingBracket(trimmed) !== trimmed.length - 1) return null
  const parts = splitClauses(trimmed.slice(1, -1))
  return parts.length === 2 ? [parts[0], parts[1]] : null
}

/**
 * A circle clause's text as its centre and radius: `(x0, y0) r` has a centre,
 * and anything else is the radius alone, centred on the origin. A leading
 * bracket that isn't a pair (`(T_p) / 2`) is part of the radius.
 */
export function readCircle(text: string): { centre: [string, string] | null; radius: string } {
  const trimmed = text.trim()
  if (trimmed.startsWith('(')) {
    const close = closingBracket(trimmed)
    const centre = close === -1 ? null : readPair(trimmed.slice(0, close + 1))
    const radius = close === -1 ? '' : trimmed.slice(close + 1).trim()
    if (centre && radius !== '') return { centre, radius }
  }
  return { centre: null, radius: trimmed }
}

/** The index of the bracket that closes the one at 0, outside quotes; -1 if none. */
function closingBracket(text: string): number {
  let depth = 0
  let quote = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === '"') quote = false
    } else if (char === '"') quote = true
    else if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char) && --depth === 0) return i
  }
  return -1
}

/** A clause as the source writes it. */
export function clauseText(clause: PlotClause): string {
  switch (clause.kind) {
    case 'mark':
      return `mark ${clause.expression}`
    case 'point':
      return `point ${clause.expression}`
    case 'circle':
      return `circle ${clause.expression}`
    case 'equal':
      return 'equal'
    case 'labels-direct':
      return 'labels direct'
    case 'points':
      return 'points'
    case 'log':
      return `${clause.axis} log`
    case 'range':
      return `${clause.axis} ${clause.start} .. ${clause.end}`
    case 'size':
      return `size ${clause.size}`
    case 'title':
      return `title "${clause.text.replace(/["\\]/g, (c) => `\\${c}`)}"`
    case 'unknown':
      return clause.text
  }
}

/**
 * The line with its plot clauses replaced by `clauses` (the ⚙ popover, section
 * 10). The call, the format clause and the note stay exactly as typed; the
 * clauses go after the call, before the format and the `#` (section 3). A line
 * that isn't a plot line comes back unchanged.
 */
export function writePlotClauses(line: string, clauses: readonly PlotClause[]): string {
  const end = codeLength(line)
  const code = line.slice(0, end)
  const call = callSpans(code, 'plot')
  if (call === null) return line
  const head = code.slice(0, code.length - call.rest.length)
  return `${head}${clauses.map((clause) => `, ${clauseText(clause)}`).join('')}${line.slice(end)}`
}
