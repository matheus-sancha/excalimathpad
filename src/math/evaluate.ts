import {
  all,
  create,
  isAssignmentNode,
  isBlockNode,
  isConstantNode,
  isFunctionAssignmentNode,
  isOperatorNode,
  isParenthesisNode,
  isSymbolNode,
  type MathNode,
} from 'mathjs'

/**
 * The math engine: math.js with units, fully client-side.
 * This is the only module that imports `mathjs`.
 */
const math = create(all)

/**
 * Results format in one fixed unit system, SI (#25). math.js's default,
 * `auto`, is global state on the instance: every unit an expression reads
 * becomes the unit its dimension formats in, for every later line and run
 * (after `1 psi`, `(2 kg) / (3 m * s^2)` showed `9.67e-5 psi` instead of
 * `0.667 Pa`; after `h`, speeds showed `m / h`). With `si`, a result's unit
 * depends only on its value. Units read still update `auto`, which is no
 * longer used. Expressions cannot switch it back: `Unit` is not a symbol in
 * expressions (a test pins this). The sheet-level unit system of the v1 spec
 * will build on this.
 */
math.Unit.setUnitSystem('si')

// Keep our own reference before hardening: the `parse` that expressions can
// see is disabled below; this one stays usable. The sheet parses each line
// once with it (to learn which names the line defines) and evaluates the
// parsed Node, which is what math.js's `evaluate(expr, scope)` does inside.
// App code must only ever evaluate through `evaluateSheet`: after the
// override below, math.js functions built later that depend on the disabled
// names (`help`, `rationalize`, `symbolicEqual`, a `parser()`'s methods)
// fail with "... is not supported" messages.
const parse = math.parse

const disabled = (name: string) => () => {
  throw new Error(`${name} is not supported in a math element`)
}

/**
 * Functions disabled in the shared math.js namespace, following math.js's
 * documented hardening ("Security" > "Less vulnerable expression parser").
 * They would let one line change the shared engine (`createUnit`, `config`,
 * `import`), which leaks into every other block and breaks re-evaluation on
 * each keystroke, or reach the parser from inside an expression. Defining
 * units, if wanted, is a follow-up on the sheet scope.
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
 * each run's sheet scope starts with a stub that shadows it. Calling a method
 * on the stub fails with math.js's own 'No access to method "..."'. A user's
 * own `typed = ...` replaces the stub for the lines below it in that run,
 * which is harmless: it is a scope value, never the registry. If that
 * assignment fails, the stub comes back (see `forget`), never the registry.
 */
const TYPED_STUB = disabled('typed')

function newSheetScope(): Map<string, unknown> {
  return new Map<string, unknown>([['typed', TYPED_STUB]])
}

/**
 * Drops a name whose assignment just failed, so the lines below do not
 * silently use its previous value. `typed` falls back to the stub instead:
 * deleting it would expose the real registry to the lines below.
 */
function forget(scope: Map<string, unknown>, name: string) {
  if (name === 'typed') scope.set('typed', TYPED_STUB)
  else scope.delete(name)
}

/** The outcome of evaluating one line of a math element. */
export type LineResult =
  | { kind: 'empty' }
  | { kind: 'value'; text: string }
  | { kind: 'error'; message: string }

/** One math element's source, as the sheet sees it. */
export interface SheetBlock {
  id: string
  source: string
}

/** A line of the sheet, parsed once before anything is evaluated. */
type ParsedLine =
  | { kind: 'blank' }
  /** `defines` is a best guess from the raw text: the line did not parse. */
  | { kind: 'syntax-error'; message: string; defines: readonly string[] }
  | {
      kind: 'parsed'
      node: MathNode
      defines: readonly string[]
      /** The unit names of a plain input, or null for any other line. */
      plainInputUnits: readonly string[] | null
    }

/**
 * Evaluates the whole sheet: every block's lines, one math.js statement per
 * line, in the order the blocks are given (the caller passes them in reading
 * order). All lines share one scope, so a line sees every name assigned above
 * it, in its own block or an earlier one, and nothing below it. A later
 * assignment silently redefines a name for the lines after it. Assignment is
 * plain `=`.
 *
 * Each call starts from a fresh scope: the results are a pure function of
 * the ordered sources, and nothing a line does outlives the call.
 *
 * Every route we know of for a line to change the shared engine is closed
 * (math.js 15.2, probed by review; each route has a test):
 * - `createUnit`, `config`, `import` and the parser functions are disabled
 *   in the namespace;
 * - `typed` is shadowed in each run's scope;
 * - parsed Nodes (`simplifyCore` / `simplifyConstant`) evaluate against the
 *   namespace, not the sheet scope, so the real `typed`'s mutators are
 *   disabled too;
 * - the unit system results format in is fixed to SI, so units a line reads
 *   do not change how other results are shown (#25).
 *
 * Never throws: a line that fails becomes an `error` result, and later lines
 * still evaluate without whatever the failed line would have assigned. A
 * failed redefinition removes the name's earlier value too, so nothing below
 * silently uses a stale one.
 * Using a name that is only assigned further down, or whose own assignment
 * failed, says so instead of math.js's bare "Undefined symbol".
 *
 * Returns exactly one result per line of each block's source, keyed by block
 * id. Ids are expected to be unique.
 */
export function evaluateSheet(
  blocks: readonly SheetBlock[],
): ReadonlyMap<string, LineResult[]> {
  const sheet = blocks.map(({ id, source }) => ({
    id,
    lines: splitLines(source).map(parseLine),
  }))

  // Where each name is assigned, as positions in reading order.
  const definedAt = new Map<string, number[]>()
  let position = 0
  for (const { lines } of sheet) {
    for (const line of lines) {
      if (line.kind !== 'blank') {
        for (const name of line.defines) {
          definedAt.set(name, [...(definedAt.get(name) ?? []), position])
        }
      }
      position++
    }
  }

  const scope = newSheetScope()
  // Names whose latest assignment so far failed.
  const failed = new Set<string>()
  const results = new Map<string, LineResult[]>()
  position = 0
  for (const { id, lines } of sheet) {
    results.set(
      id,
      lines.map((line): LineResult => {
        const here = position++
        if (line.kind === 'blank') return { kind: 'empty' }
        const fail = (message: string): LineResult => {
          for (const name of line.defines) {
            failed.add(name)
            forget(scope, name)
          }
          return { kind: 'error', message }
        }
        if (line.kind === 'syntax-error') return fail(line.message)
        try {
          // Asked before the line runs: the line itself may assign one of these names.
          const isPlain = line.plainInputUnits?.every((name) => !scope.has(name)) ?? false
          const value: unknown = line.node.compile().evaluate(scope)
          line.defines.forEach((name) => failed.delete(name))
          // Comment-only lines evaluate to nothing. A plain input and a line
          // whose value is a function leave the result cell empty, though the
          // value still reaches the lines below (docs/spec-v1.md section 3).
          if (value === undefined || typeof value === 'function' || isPlain) {
            return { kind: 'empty' }
          }
          return { kind: 'value', text: math.format(value, { precision: 14 }) }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return fail(explain(message, here, definedAt, failed))
        }
      }),
    )
  }
  return results
}

/**
 * A block's source split into lines, exactly as `evaluateSheet` splits it:
 * there is one result per element of this array.
 */
export function splitLines(source: string): string[] {
  return source.split(/\r?\n/)
}

function parseLine(line: string): ParsedLine {
  if (line.trim() === '') return { kind: 'blank' }
  try {
    const node = parse(line)
    return {
      kind: 'parsed',
      node,
      defines: definedNames(node),
      plainInputUnits: plainInputUnits(node),
    }
  } catch (error) {
    const target = ASSIGNMENT_TARGET.exec(line)?.[1]
    return {
      kind: 'syntax-error',
      message: error instanceof Error ? error.message : String(error),
      defines: target === undefined ? [] : [target],
    }
  }
}

// `name = ...` or `name(args) = ...` (not `==`), for lines that do not parse.
const ASSIGNMENT_TARGET = /^\s*([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*=(?!=)/

/** The names a statement assigns: `x = ...`, `f(x) = ...`, or several `;`-separated. */
function definedNames(node: MathNode): string[] {
  if (isBlockNode(node)) return node.blocks.flatMap((block) => definedNames(block.node))
  if (isFunctionAssignmentNode(node)) return [node.name]
  // `A[1] = 5` and `a.b = 2` change an existing value; they define nothing.
  if (isAssignmentNode(node)) return node.index ? [] : [node.name]
  return []
}

/**
 * The unit names on the right of a plain input (`D = 102.3 mm`): a literal
 * number with an optional sign and unit. Null for any other line. A name that a
 * line above assigned isn't a unit on that line, so the caller checks the scope.
 */
function plainInputUnits(node: MathNode): readonly string[] | null {
  return isAssignmentNode(node) && !node.index ? literalUnits(node.value) : null
}

function literalUnits(node: MathNode): readonly string[] | null {
  if (isConstantNode(node)) return []
  if (!isOperatorNode(node)) return null
  if (node.fn === 'unaryMinus' || node.fn === 'unaryPlus') return literalUnits(node.args[0])
  if (node.fn !== 'multiply' && node.fn !== 'divide') return null
  const number = literalUnits(node.args[0])
  const units = unitNames(node.args[1])
  return number && units && [...number, ...units]
}

/** The names in a pure unit expression (`m`, `kg/m^3`), or null if it isn't one. */
function unitNames(node: MathNode): readonly string[] | null {
  if (isSymbolNode(node)) {
    // math.js resolves a name in its namespace before trying it as a unit.
    return math.Unit.isValuelessUnit(node.name) && !(node.name in math) ? [node.name] : null
  }
  if (isParenthesisNode(node)) return unitNames(node.content)
  if (!isOperatorNode(node)) return null
  if (node.fn === 'pow') {
    return isUnitExponent(node.args[1]) ? unitNames(node.args[0]) : null
  }
  if (node.fn !== 'multiply' && node.fn !== 'divide') return null
  const left = unitNames(node.args[0])
  const right = unitNames(node.args[1])
  return left && right && [...left, ...right]
}

function isUnitExponent(node: MathNode): boolean {
  if (isConstantNode(node)) return true
  return isOperatorNode(node) && node.fn === 'unaryMinus' && isConstantNode(node.args[0])
}

// math.js's own wording (pinned by a test, so an upgrade that rewords it fails CI).
const UNDEFINED_NAME = /^Undefined (?:symbol|function) (\S+)$/

/** Turns a bare "Undefined symbol x" into why it is undefined, when we know. */
function explain(
  message: string,
  position: number,
  definedAt: ReadonlyMap<string, readonly number[]>,
  failed: ReadonlySet<string>,
): string {
  const name = UNDEFINED_NAME.exec(message)?.[1]
  if (name === undefined) return message
  if (failed.has(name)) return `${name} has an error above`
  if (definedAt.get(name)?.some((at) => at > position)) {
    return `${name} is defined below`
  }
  return message
}
