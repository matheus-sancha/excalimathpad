/**
 * How a range line reads (docs/spec-v1.md sections 3 and 10; ADR 0005, step 4),
 * after the comment, the format clause and the display unit are off:
 *
 * ```
 * [<name> =] <start> .. <end> [step <step>]
 * ```
 *
 * Pure text, with no math.js: the engine parses the parts. A line is a range
 * line when it has a `..` outside brackets and strings.
 */
export interface RangeForm {
  /** The name it defines; null for a bare range. */
  name: string | null
  start: string
  end: string
  /** Null when the line has no `step`. */
  step: string | null
}

const ASSIGNED = /^\s*([A-Za-z_]\w*)\s*=(?!=)(.*)$/s

/** The line's range form, or null when it isn't a range line. */
export function readRange(code: string): RangeForm | null {
  const assigned = ASSIGNED.exec(code)
  const name = assigned ? assigned[1] : null
  const body = assigned ? assigned[2] : code
  const dots = topLevel(body, (text, i) => text.startsWith('..', i))
  if (dots.length === 0) return null
  const start = body.slice(0, dots[0]).trim()
  const rest = body.slice(dots[0] + 2)
  const steps = topLevel(rest, (text, i) => /^step\b/.test(text.slice(i)) && /(^|[^\w.])$/.test(text.slice(0, i)))
  const end = (steps.length === 0 ? rest : rest.slice(0, steps[0])).trim()
  const step = steps.length === 0 ? null : rest.slice(steps[0] + 4).trim()
  return { name, start, end, step }
}

/** Where `matches` holds outside brackets and strings. */
function topLevel(text: string, matches: (text: string, index: number) => boolean): number[] {
  const found: number[] = []
  let depth = 0
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"') quote = char
    else if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char)) depth--
    else if (depth === 0 && matches(text, i)) {
      found.push(i)
      i++
    }
  }
  return found
}
