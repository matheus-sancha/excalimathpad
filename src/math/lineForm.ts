/**
 * How a sheet line reads before math.js sees it (ADR 0005, docs/spec-v1.md
 * section 3): step 1, the comment. Pure, with no math.js.
 *
 * - A **blank** line is empty, only spaces, or a bare `#`: a spacer row.
 * - A **comment line** starts with `#`: one text cell spans the row, and it is
 *   never evaluated.
 * - Any other line is **code**, with an optional **note**: the text after the
 *   first `#` outside a string. Only the code goes to math.js, so a note never
 *   changes a result.
 */
export type LineForm =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | { kind: 'code'; code: string; note: string | null }

export function readLine(line: string): LineForm {
  const at = commentStart(line)
  const code = at === -1 ? line : line.slice(0, at)
  const after = at === -1 ? null : line.slice(at + 1).trim()
  if (code.trim() === '') {
    return after ? { kind: 'comment', text: after } : { kind: 'blank' }
  }
  return { kind: 'code', code: code.trimEnd(), note: after || null }
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
