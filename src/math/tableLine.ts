import { splitDisplayUnit, writeDisplayUnit } from './lineForm.ts'

/**
 * How a table line reads (docs/spec-v1.md sections 3 and 10; ADR 0005, step 4):
 * `table(arg, …)` and nothing else in the code. Each argument can end with its
 * own display unit, `table(Q_s in L/s, H_s in m)`. Pure text, with no math.js.
 */
export interface TableForm {
  args: readonly { expression: string; displayUnit: string | null }[]
}

/** The line's table form, or null when it isn't a table line. */
export function readTable(code: string): TableForm | null {
  const call = callSpans(code, 'table')
  if (call === null || !/^\s*(?:@\w*\s*)*(?:#.*)?$/s.test(call.rest)) return null
  const spans = call.spans
  return {
    args: spans.map(([start, end]) => splitDisplayUnit(code.slice(start, end).trim())),
  }
}

/**
 * The line with column `column`'s display unit set to `unit`, or taken off for
 * null (a column header's unit slot, section 10). Only that argument changes;
 * the rest of the line, its format clause and note included, stays as typed.
 */
export function writeArgumentUnit(line: string, column: number, unit: string | null): string {
  const call = callSpans(line, line.trimStart().startsWith('plot') ? 'plot' : 'table')
  if (call === null) return line
  const { spans } = call
  if (column >= spans.length) return line
  const [start, end] = spans[column]
  const raw = line.slice(start, end)
  const lead = /^\s*/.exec(raw)![0]
  const trail = /\s*$/.exec(raw)![0]
  const written = writeDisplayUnit(raw.trim(), unit)
  return `${line.slice(0, start)}${lead}${written}${trail}${line.slice(end)}`
}

/**
 * Where each argument of a leading `name(…)` call sits in the text, and what
 * follows the call's closing bracket. Null when the text doesn't start with
 * that call or the bracket never closes.
 */
export function callSpans(text: string, name: string): { spans: [number, number][]; rest: string } | null {
  const head = new RegExp(`^\\s*${name}\\s*\\(`).exec(text)
  if (!head) return null
  const spans: [number, number][] = []
  let depth = 0
  let quote: string | null = null
  let start = head[0].length
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"') quote = char
    else if ('([{'.includes(char)) depth++
    else if (char === ',' && depth === 0) {
      spans.push([start, i])
      start = i + 1
    } else if (')]}'.includes(char)) {
      if (depth > 0) {
        depth--
        continue
      }
      spans.push([start, i])
      const empty = spans.length === 1 && text.slice(spans[0][0], spans[0][1]).trim() === ''
      return { spans: empty ? [] : spans, rest: text.slice(i + 1) }
    }
  }
  return null
}
