import { all, create } from 'mathjs'

/**
 * The math engine: math.js with units, fully client-side.
 * This is the only module that imports `mathjs`.
 */
const math = create(all)

// Keep our own reference before hardening: the `evaluate` that expressions
// can see is disabled below; this one stays usable.
const evaluate = math.evaluate

/**
 * Functions disabled inside expressions, following math.js's documented
 * hardening ("Security" > "Less vulnerable expression parser"). They would
 * let one line change the shared engine (`createUnit`, `config`, `import`),
 * which leaks into every other block and breaks re-evaluation on each
 * keystroke, or reach the parser from inside an expression. Defining units,
 * if wanted, belongs with the sheet scope (#3).
 */
const DISABLED_IN_EXPRESSIONS = [
  'import',
  'createUnit',
  'config',
  'evaluate',
  'parse',
  'compile',
  'simplify',
  'derivative',
  'resolve',
] as const

math.import(
  Object.fromEntries(
    DISABLED_IN_EXPRESSIONS.map((name) => [
      name,
      () => {
        throw new Error(`${name} is not supported in a math element`)
      },
    ]),
  ),
  { override: true },
)

/** The outcome of evaluating one line of a math element. */
export type LineResult =
  | { kind: 'empty' }
  | { kind: 'value'; text: string }
  | { kind: 'error'; message: string }

/**
 * Evaluates a math element's source: one math.js statement per line, top to
 * bottom. Variables live in a scope shared by the lines of this block only (a
 * sheet-wide scope is issue #3), and no line can change the engine itself, so
 * the same source always gives the same results. Assignment is plain `=`.
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
      const value: unknown = evaluate(line, scope)
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
