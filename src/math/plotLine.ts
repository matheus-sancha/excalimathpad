import { splitDisplayUnit } from './lineForm.ts'
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
  | { kind: 'labels-direct' }
  | { kind: 'points' }
  | { kind: 'log'; axis: 'x' | 'y' }
  | { kind: 'range'; axis: 'x' | 'y'; start: string; end: string }
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
