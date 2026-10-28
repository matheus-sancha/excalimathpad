import { all, create } from 'mathjs'

/**
 * The math engine: math.js with units, fully client-side.
 * This is the only module that imports `mathjs`.
 */
const math = create(all)

// Keep our own reference before hardening: the `evaluate` that expressions
// can see is disabled below; this one stays usable. App code must only ever
// evaluate through this captured function: after the override below, math.js
// functions built later that depend on the disabled names (`help`,
// `rationalize`, `symbolicEqual`, a `parser()`'s methods) fail with
// "... is not supported" messages.
const evaluate = math.evaluate

const disabled = (name: string) => () => {
  throw new Error(`${name} is not supported in a math element`)
}

/**
 * Functions disabled in the shared math.js namespace, following math.js's
 * documented hardening ("Security" > "Less vulnerable expression parser").
 * They would let one line change the shared engine (`createUnit`, `config`,
 * `import`), which leaks into every other block and breaks re-evaluation on
 * each keystroke, or reach the parser from inside an expression. Defining
 * units, if wanted, belongs with the sheet scope (#3).
 *
 * They are overridden in the namespace, not just shadowed per block like
 * `typed` below: a scope-only stub is bypassed by `parser()`, whose own
 * `evaluate` resolves names in the namespace (probed: a scope-only
 * `createUnit` stub let `p = parser()`, `p.evaluate("createUnit(...)")`
 * define a unit visible to every block).
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
  Object.fromEntries(DISABLED_IN_EXPRESSIONS.map((name) => [name, disabled(name)])),
  { override: true },
)

/**
 * The registry mutators on the real `math.typed`, disabled in place. The
 * per-block stub below does not cover them: `simplifyCore`,
 * `simplifyConstant` and `leafCount` parse with the real parser, and the
 * Node they return evaluates against the shared namespace, where `typed` is
 * the real registry (`simplifyCore("typed.clear()").evaluate()`). math.js
 * itself only reads the registry after setup, so this changes no results.
 */
const TYPED_MUTATORS = [
  'clear',
  'clearConversions',
  'addType',
  'addTypes',
  'addConversion',
  'addConversions',
  'removeConversion',
] as const
for (const name of TYPED_MUTATORS) {
  Object.assign(math.typed, { [name]: disabled(`typed.${name}`) })
}

/**
 * `typed` is math.js's type registry, and expressions can call its methods:
 * `typed.clear()` breaks every function not yet built (in all blocks, until
 * reload) and `typed.addConversion()` leaks conversions into other blocks.
 * It cannot be overridden in the namespace (math.js's own lazily built
 * functions resolve it there, so `sqrt` and unit conversion would break), so
 * each block's scope starts with a stub that shadows it. Calling a method on
 * the stub fails with math.js's own 'No access to method "..."'. A user's own
 * `typed = ...` only replaces the stub in that block.
 */
function newBlockScope(): Map<string, unknown> {
  return new Map<string, unknown>([['typed', disabled('typed')]])
}

/** The outcome of evaluating one line of a math element. */
export type LineResult =
  | { kind: 'empty' }
  | { kind: 'value'; text: string }
  | { kind: 'error'; message: string }

/**
 * Evaluates a math element's source: one math.js statement per line, top to
 * bottom. Variables live in a scope shared by the lines of this block only (a
 * sheet-wide scope is issue #3). Assignment is plain `=`.
 *
 * Every route we know of for a line to change the shared engine is closed
 * (math.js 15.2, probed by review; each route has a test):
 * - `createUnit`, `config`, `import` and the parser functions are disabled
 *   in the namespace;
 * - `typed` is shadowed in each block's scope;
 * - parsed Nodes (`simplifyCore` / `simplifyConstant`) evaluate against the
 *   namespace, not the block scope, so the real `typed`'s mutators are
 *   disabled too.
 * So the same source gives the same results however often it is evaluated,
 * whatever other blocks contain.
 *
 * Never throws: a line that fails becomes an `error` result, and later lines
 * still evaluate (without whatever the failed line would have assigned).
 * Always returns exactly one result per line of `source`.
 */
export function evaluateBlock(source: string): LineResult[] {
  const scope = newBlockScope()
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
