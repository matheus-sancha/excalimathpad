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
import { APP_UNITS } from './appUnits.ts'
import {
  createDisplay,
  type DisplaySettings,
  type DisplayUnit,
  type UnitSlot,
} from './display.ts'
import { createCalls, isSheetFunction, messageOf } from './functions.ts'
import { readLine, type LineFormat } from './lineForm.ts'
import { DEFAULT_DIGITS } from './numbers.ts'
import { lineTex, resultTex, textTex, unitTex, type Names } from './typeset.ts'
import { lineWarnings } from './warnings.ts'

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

/**
 * The app units, registered once here (docs/spec-v1.md section 14, setup
 * order: SI, then `createUnit`, then undo what that did to the unit systems,
 * then disable `createUnit` below). A plain `createUnit` makes the new unit a
 * display unit: it adds its own dimension to every system and, in `auto`,
 * takes over existing ones, so a flow would show in `gpm`. Every system is
 * put back exactly as it was, so the app units show only where they are
 * written (a test pins that results match an engine without them).
 */
function registerAppUnits() {
  const systems = math.Unit.UNIT_SYSTEMS as Record<string, Record<string, unknown>>
  const before = Object.fromEntries(
    Object.entries(systems).map(([name, system]) => [name, { ...system }]),
  )
  for (const { name, definition } of APP_UNITS) {
    math.createUnit(name, { definition, prefixes: 'none' })
  }
  for (const [name, system] of Object.entries(systems)) {
    const kept = before[name] ?? {}
    for (const key of Object.keys(system)) if (!(key in kept)) delete system[key]
    Object.assign(system, kept)
  }
}
registerAppUnits()

// Keep our own reference before hardening: the `parse` that expressions can
// see is disabled below; this one stays usable. The sheet parses each line
// once with it (to learn which names the line defines) and evaluates the
// parsed Node, which is what math.js's `evaluate(expr, scope)` does inside.
// App code must only ever evaluate through `evaluateSheet`: after the
// override below, math.js functions built later that depend on the disabled
// names (`help`, `rationalize`, `symbolicEqual`, a `parser()`'s methods)
// fail with "... is not supported" messages.
const parse = math.parse

/** The shown result's formatter (docs/spec-v1.md section 5), on the captured parser. */
const display = createDisplay(math, parse)

/** How results show when the sheet sets nothing: SI with prefixes, 4 digits. */
export const DEFAULT_DISPLAY: DisplaySettings = {
  units: { system: 'si-prefixed', custom: {} },
  digits: DEFAULT_DIGITS,
}

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

/**
 * A line as the grid shows it (docs/spec-v1.md section 4), with its cells' TeX.
 * A blank line or a bare `#` is a spacer row; a comment line is one text cell;
 * a line that doesn't parse shows its raw source, its `#` part included.
 */
export type TypesetLine =
  | { kind: 'blank' }
  | { kind: 'comment'; text: string }
  | {
      kind: 'math'
      name: string | null
      expression: string
      note: string | null
      /** Bold, underline and highlight colour, for the whole row. */
      format: LineFormat
    }
  | { kind: 'unparsed'; source: string }

/** One line of the sheet: what it computes and how it shows. */
export interface SheetLine {
  result: LineResult
  typeset: TypesetLine
  /**
   * The line's warnings (section 5, Warnings), in the wording of section 13.
   * They never change the result, and an error line keeps them too.
   */
  warnings: readonly string[]
  /**
   * What the line defines, for the Variables tab (section 8): each name with
   * its value in the sheet's system and Digits, even where the result cell
   * stays empty (a plain input), a function's parameters, or `error`.
   */
  variables: readonly SheetVariable[]
  /**
   * The result's unit slot (section 5): the chosen unit as typed after `in`,
   * and what the list offers. Null where the line has no value to show a
   * unit for: a function, an error, a matrix, a string.
   */
  unitSlot: (UnitSlot & { chosen: string | null }) | null
}

export type SheetVariable =
  | { name: string; kind: 'value'; text: string }
  | { name: string; kind: 'function'; params: readonly string[] }
  | { name: string; kind: 'error' }

/** One math element's source, as the sheet sees it. */
export interface SheetBlock {
  id: string
  source: string
}

/** A line of the sheet, parsed once before anything is evaluated. */
type ParsedLine =
  /** A blank line or a comment line: never evaluated, so its result is empty. */
  | { kind: 'blank'; comment: string | null }
  /** `defines` is a best guess from the raw text: the line did not parse. */
  | { kind: 'syntax-error'; message: string; defines: readonly string[]; source: string }
  | {
      kind: 'parsed'
      node: MathNode
      defines: readonly string[]
      /** The unit names of a plain input, or null for any other line. */
      plainInputUnits: readonly string[] | null
      note: string | null
      format: LineFormat
      unknownFormat: string | null
      /** The line's trailing `in <unit>`, read outside the sheet's scope, or null. */
      display: DisplayUnit | null
      /** That unit as typed. */
      displayText: string | null
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
 * Each line also gets its typeset form (docs/spec-v1.md section 4), from the
 * same parse. A name shows as a sheet name from the line that assigns it down,
 * so a variable `L` above isn't typeset as the litre, and `5 L` above it still
 * is.
 *
 * Returns exactly one `SheetLine` (result and typeset form) per line of each
 * block's source, keyed by block id. Ids are expected to be unique.
 */
export function evaluateSheet(
  blocks: readonly SheetBlock[],
  settings: DisplaySettings = DEFAULT_DISPLAY,
): ReadonlyMap<string, SheetLine[]> {
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
  // Each function the sheet defines is wrapped, to word its errors (section 13).
  const calls = createCalls(
    (value) => display.show(value, null, settings),
    (name) => scope.get(name),
  )
  // Names whose latest assignment so far failed.
  const failed = new Set<string>()
  // Names assigned on or above the line being read, for typesetting.
  const assigned = new Set<string>()
  const names: Names = { ...ENGINE_NAMES, isSheetName: (name) => assigned.has(name) }
  const results = new Map<string, SheetLine[]>()
  // The slot of the line being evaluated, set by `evaluateLine`.
  let slot: SheetLine['unitSlot'] = null
  position = 0
  for (const { id, lines } of sheet) {
    results.set(
      id,
      lines.map((line): SheetLine => {
        // Read before the line runs: what the scope holds above it.
        const warnings = line.kind === 'parsed' ? warningsAt(line.node, position) : []
        if (line.kind !== 'blank') line.defines.forEach((name) => assigned.add(name))
        slot = null
        const result = evaluateLine(line)
        return {
          result,
          typeset: typesetLine(line, names),
          warnings,
          variables: variablesOf(line),
          unitSlot: slot,
        }
      }),
    )
  }
  return results

  /** Read right after the line ran: a failed line has removed its names. */
  function variablesOf(line: ParsedLine): SheetVariable[] {
    if (line.kind === 'blank') return []
    return line.defines.map((name): SheetVariable => {
      if (line.kind === 'syntax-error' || failed.has(name) || !scope.has(name)) {
        return { name, kind: 'error' }
      }
      const value = scope.get(name)
      if (isSheetFunction(value)) return { name, kind: 'function', params: value.sheetFunction.params }
      if (typeof value === 'function') return { name, kind: 'function', params: [] }
      try {
        return { name, kind: 'value', text: display.show(value, null, settings) }
      } catch {
        return { name, kind: 'error' }
      }
    })
  }

  function warningsAt(node: MathNode, here: number): string[] {
    const at = (name: string) => definedAt.get(name) ?? []
    return lineWarnings(node, {
      isUnit: (name) => math.Unit.isValuelessUnit(name),
      isBuiltIn: (name) => name in math,
      inScope: (name) => scope.has(name),
      isSheetFunction: (name) => typeof scope.get(name) === 'function',
      definedAbove: (name) => at(name).some((position) => position < here),
      definedBelow: (name) => at(name).some((position) => position > here),
      failed: (name) => failed.has(name),
    })
  }

  function evaluateLine(line: ParsedLine): LineResult {
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
    const reserved = line.defines.find((name) => RESERVED.includes(name))
    if (reserved !== undefined) return fail(`${reserved} is a line form: choose another name`)
    // `in <unit>` belongs on the line that calls a function (section 3).
    if (line.display !== null && isFunctionAssignmentNode(line.node)) {
      return fail("Set a function's display unit on the line that calls it")
    }
    try {
      // Asked before the line runs: the line itself may assign one of these names.
      const isPlain = line.plainInputUnits?.every((name) => !scope.has(name)) ?? false
      const value: unknown = line.node.compile().evaluate(scope)
      for (const definition of functionDefinitions(line.node)) {
        const { name, params, expr } = definition
        const fn = scope.get(name) as (...args: unknown[]) => unknown
        scope.set(name, calls.wrap({ name, params }, expr, fn))
      }
      line.defines.forEach((name) => failed.delete(name))
      // Reported after the line ran, so its value still reaches the lines
      // below, as for an unknown display unit (section 3).
      if (line.unknownFormat !== null) {
        return { kind: 'error', message: `Unknown format ${line.unknownFormat}` }
      }
      if (line.display?.kind === 'unknown') {
        return { kind: 'error', message: `Unknown unit ${line.display.name}` }
      }
      // Comment-only lines evaluate to nothing. A plain input without a display
      // unit and a line whose value is a function leave the result cell empty,
      // though the value still reaches the lines below (section 3).
      if (value === undefined || typeof value === 'function') return { kind: 'empty' }
      try {
        const shown = line.display
        const unit = shown?.kind === 'unit' ? shown.unit : shown?.kind === 'percent' ? 'percent' : null
        const text = display.show(value, unit, settings)
        const offered = display.slot(value, settings)
        slot = offered && { ...offered, chosen: line.displayText }
        if (isPlain && line.display === null) return { kind: 'empty' }
        return { kind: 'value', text }
      } catch (error) {
        // The value is assigned: only its showing failed.
        return { kind: 'error', message: error instanceof Error ? error.message : String(error) }
      }
    } catch (error) {
      const message = messageOf(error, line.node, (name) => scope.get(name))
      return fail(explain(message, here, definedAt, failed))
    }
  }
}

function typesetLine(line: ParsedLine, names: Names): TypesetLine {
  switch (line.kind) {
    case 'blank':
      return line.comment === null ? { kind: 'blank' } : { kind: 'comment', text: line.comment }
    case 'syntax-error':
      return { kind: 'unparsed', source: line.source }
    case 'parsed':
      try {
        return { kind: 'math', ...lineTex(line.node, names), note: line.note, format: line.format }
      } catch {
        // A typesetting bug must not hide the line: show its code as text.
        return {
          kind: 'math',
          name: null,
          expression: textTex(line.node.toString()),
          note: line.note,
          format: line.format,
        }
      }
  }
}

/** What math.js itself knows about a name, for typesetting. */
const ENGINE_NAMES: Omit<Names, 'isSheetName'> = {
  // math.js resolves a name in its namespace before trying it as a unit.
  isUnit: (name) => math.Unit.isValuelessUnit(name) && !(name in math),
  isMicro: (name) => {
    try {
      // Typed as a string, but math.js gives the prefix object here.
      const prefix: unknown = math.Unit.parse(name).units[0]?.prefix
      return (prefix as { name?: string } | undefined)?.name === 'u'
    } catch {
      return false
    }
  },
  isBuiltIn: (name) => name in math,
}

/**
 * A result's text (`LineResult.text`) as TeX: the number, then the unit typeset
 * (docs/spec-v1.md section 4). Not a value's? Plain text.
 */
export function typesetResult(text: string): string {
  return resultTex(text, (unit) => parse(unit), { ...ENGINE_NAMES, isSheetName: () => false })
}

/**
 * Whether text typed in the unit slot is a unit a line can show in: a pure
 * unit expression math.js knows (`bar`, `kN/m^2`, `L/minute`), or `%`.
 */
export function isDisplayUnit(text: string): boolean {
  const target = display.readTarget(text)
  return target?.kind === 'unit' || target?.kind === 'percent'
}

/** A unit's text, as a result writes it (`kohm`, `m^3 / s`), typeset (`k\Omega`); plain text if it isn't one. */
export function typesetUnit(unit: string): string {
  try {
    return unitTex(parse(unit), { ...ENGINE_NAMES, isSheetName: () => false }) ?? textTex(unit)
  } catch {
    return textTex(unit)
  }
}

/**
 * A block's source split into lines, exactly as `evaluateSheet` splits it:
 * there is one result per element of this array.
 */
export function splitLines(source: string): string[] {
  return source.split(/\r?\n/)
}

/**
 * Reads the line's comment and format clause first (ADR 0005), then parses only
 * its code: a note or a format never reaches math.js, so neither changes a result.
 */
function parseLine(text: string): ParsedLine {
  const form = readLine(text)
  if (form.kind === 'blank') return { kind: 'blank', comment: null }
  if (form.kind === 'comment') return { kind: 'blank', comment: form.text }
  // A trailing `in <unit>` comes off only when its target is a pure unit
  // expression; otherwise the conversion stays math.js's own (ADR 0005).
  const target = form.displayUnit === null ? null : display.readTarget(form.displayUnit)
  const line = target === null ? form.code : form.expression
  try {
    const node = parse(line)
    return {
      kind: 'parsed',
      node,
      defines: definedNames(node),
      plainInputUnits: plainInputUnits(node),
      note: form.note,
      format: form.format,
      unknownFormat: form.unknownFormat,
      display: target,
      displayText: target === null ? null : form.displayUnit,
    }
  } catch (error) {
    const target = ASSIGNMENT_TARGET.exec(line)?.[1]
    return {
      kind: 'syntax-error',
      message: error instanceof Error ? error.message : String(error),
      defines: target === undefined ? [] : [target],
      source: text,
    }
  }
}

// `name = ...` or `name(args) = ...` (not `==`), for lines that do not parse.
const ASSIGNMENT_TARGET = /^\s*([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*=(?!=)/

/** Names that start a line form (ADR 0005): assigning to one is an error. */
const RESERVED = ['table', 'plot', 'solve']

/** The function definitions of a line: one, or several `;`-separated. */
function functionDefinitions(node: MathNode) {
  if (isBlockNode(node)) return node.blocks.map((block) => block.node).filter(isFunctionAssignmentNode)
  return isFunctionAssignmentNode(node) ? [node] : []
}

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
  if (isParenthesisNode(node)) return literalUnits(node.content)
  if (!isOperatorNode(node)) return null
  if (node.fn === 'unaryMinus' || node.fn === 'unaryPlus') return literalUnits(node.args[0])
  if (node.fn !== 'multiply' && node.fn !== 'divide') return null
  const left = literalUnits(node.args[0])
  const right = unitNames(node.args[1])
  return left && right && [...left, ...right]
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
