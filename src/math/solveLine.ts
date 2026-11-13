/**
 * How a solve line reads (docs/spec-v1.md sections 3 and 9; ADR 0005, step 4),
 * after the comment, the format clause and the display unit are off:
 *
 * ```
 * <name> = solve <lhs> = <rhs>, for <unknown> = <from> .. <to>
 * <name>(<params>) = solve <lhs> = <rhs>, guess <unknown> = <guess expr>
 * ```
 *
 * From M4c a solved value takes a search range and a solve function a guess;
 * either one with the other's clause, or with none, can't be read.
 *
 * Pure text, with no math.js: the engine parses the parts it returns. A line
 * is a solve line when its first `=` is followed by the word `solve` and a
 * space, so `x = solve_rate * 2` and `x = solve(3)` stay ordinary lines.
 */
export type SolveForm =
  | {
      kind: 'solve'
      name: string
      /** The parameters of the function form; null for the value form. */
      params: readonly string[] | null
      lhs: string
      rhs: string
      unknown: string
      /** A solve function's guess; null for a solved value. */
      guess: string | null
      /** A solved value's search range, as typed; null for a solve function. */
      range: { from: string; to: string } | null
    }
  /** A solve line that can't be read: its message, and the name it would define. */
  | { kind: 'malformed'; name: string; message: string }

const HEAD = /^\s*([A-Za-z_]\w*)\s*(?:\(([^()]*)\))?\s*=(?!=)\s*solve\s+(.*)$/s
const NAME = /^[A-Za-z_]\w*$/
const GUESS = /^guess\s+([A-Za-z_]\w*)\s*=(?!=)(.*)$/s
const FOR = /^for\s+([A-Za-z_]\w*)\s*=(?!=)(.*)$/s

/** The line's solve form, or null when it isn't a solve line. */
export function readSolve(code: string): SolveForm | null {
  const head = HEAD.exec(code)
  if (!head) return null
  const [, name, paramText, rest] = head
  const params = paramText === undefined ? null : paramText.split(',').map((p) => p.trim())
  if (params?.some((p) => !NAME.test(p))) {
    return { kind: 'malformed', name, message: `${name}: a parameter isn't a name` }
  }
  const cut = clauseComma(rest)
  const equation = cut === -1 ? rest : rest.slice(0, cut)
  const sides = splitEquation(equation)
  const clause = cut === -1 ? '' : rest.slice(cut + 1).trim()
  const guess = GUESS.exec(clause)
  const range = FOR.exec(clause)
  const unknown = (guess ?? range)?.[1] ?? (sides ? firstFreeName(`${sides[0]} ${sides[1]}`, [name, ...(params ?? [])]) : null) ?? 'x'
  if (params === null && !range) {
    return { kind: 'malformed', name, message: `solve needs a range: ", for ${unknown} = <from> .. <to>"` }
  }
  if (params !== null && range) {
    return { kind: 'malformed', name, message: `a solve function takes a guess: ", guess ${unknown} = <value>"` }
  }
  if (params !== null && (!guess || guess[2].trim() === '')) {
    return { kind: 'malformed', name, message: `solve needs a guess: ", guess ${unknown} = <value>"` }
  }
  if (!sides) {
    return { kind: 'malformed', name, message: 'solve needs one equation: "<left side> = <right side>"' }
  }
  if (range) {
    const ends = splitRange(range[2])
    if (ends === null) {
      return { kind: 'malformed', name, message: `for ${unknown} needs two ends and no step: "for ${unknown} = <from> .. <to>"` }
    }
    return { kind: 'solve', name, params, lhs: sides[0], rhs: sides[1], unknown, guess: null, range: ends }
  }
  return {
    kind: 'solve',
    name,
    params,
    lhs: sides[0],
    rhs: sides[1],
    unknown,
    guess: (guess as RegExpExecArray)[2].trim(),
    range: null,
  }
}

/** A search range's two ends: one top-level `..`, both ends there, and no `step`. */
function splitRange(text: string): { from: string; to: string } | null {
  const at: number[] = []
  scan(text, (char, i, depth) => {
    if (depth === 0 && char === '.' && text[i + 1] === '.' && text[i - 1] !== '.') at.push(i)
  })
  if (at.length !== 1) return null
  const from = text.slice(0, at[0]).trim()
  const to = text.slice(at[0] + 2).trim()
  if (from === '' || to === '' || /\bstep\b/.test(to)) return null
  return { from, to }
}

/** Where the clause starts: the last top-level comma followed by `guess` or `for`, or -1. */
function clauseComma(text: string): number {
  let found = -1
  scan(text, (char, i, depth) => {
    if (depth === 0 && char === ',' && /^\s*(?:guess|for)\b/.test(text.slice(i + 1))) found = i
  })
  return found
}

/** The two sides of the one top-level `=` (not `==`, `<=`, `>=`, `!=`), or null. */
function splitEquation(text: string): [string, string] | null {
  const at: number[] = []
  scan(text, (char, i, depth) => {
    if (depth !== 0 || char !== '=') return
    if (text[i + 1] === '=' || '=<>!'.includes(text[i - 1] ?? '')) return
    at.push(i)
  })
  if (at.length !== 1) return null
  const lhs = text.slice(0, at[0]).trim()
  const rhs = text.slice(at[0] + 1).trim()
  return lhs === '' || rhs === '' ? null : [lhs, rhs]
}

/** Calls `visit` for each character outside a string, with its bracket depth. */
function scan(text: string, visit: (char: string, index: number, depth: number) => void) {
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
    else visit(char, i, depth)
  }
}

/**
 * For the missing-guess message: the first name in the equation that isn't
 * called, doesn't follow a number (a unit), and isn't the line's own name or a
 * parameter. A best guess at the unknown, for the message only.
 */
export function firstFreeName(text: string, skip: readonly string[]): string | null {
  for (const match of text.matchAll(/[A-Za-z_]\w*/g)) {
    const word = match[0]
    const after = text.slice((match.index ?? 0) + word.length)
    const before = text.slice(0, match.index)
    if (/^\s*\(/.test(after) || /[\d.]\s*$/.test(before) || skip.includes(word)) continue
    return word
  }
  return null
}
