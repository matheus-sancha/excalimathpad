import { all, create } from 'mathjs'

/**
 * The math engine: math.js with units, fully client-side.
 * This is the only module that imports `mathjs`.
 */
const math = create(all)

/** The outcome of evaluating one line of a math element. */
export type LineResult =
  | { kind: 'empty' }
  | { kind: 'value'; text: string }
  | { kind: 'error'; message: string }

/**
 * Evaluates a math element's source: one math.js statement per line, top to
 * bottom, in a scope shared by the lines of this block only (a sheet-wide
 * scope is issue #3). Assignment is plain math.js `=`.
 *
 * Never throws: a line that fails becomes an `error` result, and later lines
 * still evaluate (without whatever the failed line would have assigned).
 * Always returns exactly one result per line of `source`.
 */
export function evaluateBlock(source: string): LineResult[] {
  const scope = new Map<string, unknown>()
  return source.split(/\r?\n/).map((line): LineResult => {
    if (line.trim() === '') return { kind: 'empty' }
    try {
      const value: unknown = math.evaluate(line, scope)
      // Comment-only lines evaluate to nothing.
      if (value === undefined) return { kind: 'empty' }
      return { kind: 'value', text: math.format(value, { precision: 14 }) }
    } catch (error) {
      return {
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })
}
