import {
  all,
  create,
  isAssignmentNode,
  isBlockNode,
  isConstantNode,
  isFunctionAssignmentNode,
  isFunctionNode,
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
  type ShownUnit,
  type UnitSlot,
} from './display.ts'
import { createCalls, isSheetFunction, messageOf, SheetError } from './functions.ts'
import { readLine, type LineFormat } from './lineForm.ts'
import { DEFAULT_DIGITS, leadingNumber, tableColumn } from './numbers.ts'
import { createSolver, LayeredScope, type CompiledSolve, type SolveDetails, type SolveParts, type SolveText } from './solve.ts'
import { readSolve } from './solveLine.ts'
import { readRange } from './rangeLine.ts'
import { readTable } from './tableLine.ts'
import { AGGREGATES, createRanges, isSheetList, listSummary, SheetList, type Point } from './lists.ts'
import { lineTex, rangeTex, resultTex, solveTex, textTex, unitTex, type Names } from './typeset.ts'
import { bodyNames, lineWarnings, solveWarnings, usedNames } from './warnings.ts'

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

/** Solve lines' residuals and runs (docs/spec-v1.md section 9), on the same engine. */
const solver = createSolver(math)

/** Ranges (docs/spec-v1.md section 10), on the same engine. */
const ranges = createRanges(math)

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
   * A list (section 10): its one-row summary, `30 values, 12.04 … 33.18 m`.
   * `failed` is the line's problem when points failed, `1 of 30 points
   * failed. At Q_s = 0 L/s: …`; the other points keep their values.
   */
  | { kind: 'list'; text: string; failed: string | null }

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
      /** A solve line's guess or a range's step (section 4), set small and grey after the expression. */
      aside?: string
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
  /**
   * How the solve behind the result went, for the hover (section 4, Solve
   * details): on a solve line's value, and on a line that is just one call to
   * a solve function. Null everywhere else. Never saved.
   */
  solveDetails: SolveDetails | null
  /**
   * A list result's hover (section 10): the first and last few points, each
   * with its index, `1: 12.04 m`, a gap marked `…`. Null on any other line.
   */
  listPreview: string | null
  /** A table line's table (section 10), drawn under the line. Null on any other line. */
  table: TableView | null
}

/** A table as the grid draws it: its columns, then every row, one cell per column. */
export interface TableView {
  columns: readonly TableColumn[]
  rows: readonly (readonly TableCell[])[]
}

export interface TableColumn {
  /** The argument's expression, typeset. */
  header: string
  /** The column's unit as a result writes it (`L / s`); empty for plain numbers. */
  unit: string
  /** The header's unit slot: the column's chosen unit and the list it offers. Null for a column of plain numbers. */
  slot: (UnitSlot & { chosen: string | null }) | null
}

/** A cell: its number in the column's unit and the table's form, or a failed point's message. */
export type TableCell = { ok: true; text: string } | { ok: false; message: string }

export type { SolveDetails } from './solve.ts'

export type SheetVariable =
  | { name: string; kind: 'value'; text: string }
  | { name: string; kind: 'function'; params: readonly string[]; solve: boolean }
  | { name: string; kind: 'error' }
  /** A list, by its summary (section 8). */
  | { name: string; kind: 'list'; text: string }

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
  /** A range line (section 10): `[name =] start .. end [step s]`. */
  | {
      kind: 'range'
      name: string | null
      start: MathNode
      end: MathNode
      step: MathNode | null
      defines: readonly string[]
      note: string | null
      format: LineFormat
      unknownFormat: string | null
      display: DisplayUnit | null
      displayText: string | null
      source: string
    }
  /** A table line (section 10): `table(arg, …)`, display only. */
  | {
      kind: 'table'
      args: readonly {
        node: MathNode
        display: DisplayUnit | null
        displayText: string | null
      }[]
      defines: readonly string[]
      note: string | null
      format: LineFormat
      unknownFormat: string | null
      display: DisplayUnit | null
      displayText: string | null
    }
  /** A solve line (section 9): it defines one name, a value or a solve function. */
  | {
      kind: 'solve'
      name: string
      params: readonly string[] | null
      parts: SolveParts
      solve: CompiledSolve
      defines: readonly string[]
      note: string | null
      format: LineFormat
      unknownFormat: string | null
      display: DisplayUnit | null
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
  // How a solve writes values in its messages and details.
  const solveText: SolveText = {
    show: (value, unit) => display.show(value, unit, settings),
    exact: (value, unit) => display.show(value, unit, { ...settings, digits: 13 }),
  }
  // The latest solve to converge, for the hover of a line that calls a solve function.
  let lastSolve: SolveDetails | null = null
  // Names whose latest assignment so far failed.
  const failed = new Set<string>()
  // Names assigned on or above the line being read, for typesetting.
  const assigned = new Set<string>()
  const names: Names = { ...ENGINE_NAMES, isSheetName: (name) => assigned.has(name) }
  const results = new Map<string, SheetLine[]>()
  // The slot and solve details of the line being evaluated, set by `evaluateLine`.
  let slot: SheetLine['unitSlot'] = null
  let details: SolveDetails | null = null
  let preview: string | null = null
  let table: TableView | null = null
  // The display unit each list was given on the line that defined it, for table columns.
  const listUnits = new Map<string, { unit: ShownUnit; text: string }>()
  position = 0
  for (const { id, lines } of sheet) {
    results.set(
      id,
      lines.map((line): SheetLine => {
        // Read before the line runs: what the scope holds above it.
        const warnings = warningsOf(line, position)
        if (line.kind !== 'blank') line.defines.forEach((name) => assigned.add(name))
        slot = null
        details = null
        preview = null
        table = null
        const result = evaluateLine(line)
        return {
          result,
          typeset: typesetLine(line, names),
          warnings,
          variables: variablesOf(line),
          unitSlot: slot,
          solveDetails: result.kind === 'value' ? details : null,
          listPreview: result.kind === 'list' ? preview : null,
          table,
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
      if (isSheetList(value)) return { name, kind: 'list', text: summaryOf(value, null) }
      if (isSheetFunction(value)) {
        const { params, solve } = value.sheetFunction
        return { name, kind: 'function', params, solve: solve === true }
      }
      if (typeof value === 'function') return { name, kind: 'function', params: [], solve: false }
      try {
        return { name, kind: 'value', text: display.show(value, null, settings) }
      } catch {
        return { name, kind: 'error' }
      }
    })
  }

  function warningsOf(line: ParsedLine, here: number): string[] {
    const at = (name: string) => definedAt.get(name) ?? []
    const facts = {
      isUnit: (name: string) => math.Unit.isValuelessUnit(name),
      isBuiltIn: (name: string) => name in math,
      inScope: (name: string) => scope.has(name),
      isSheetFunction: (name: string) => typeof scope.get(name) === 'function',
      definedAbove: (name: string) => at(name).some((position) => position < here),
      definedBelow: (name: string) => at(name).some((position) => position > here),
      failed: (name: string) => failed.has(name),
    }
    if (line.kind === 'parsed') return lineWarnings(line.node, facts)
    if (line.kind === 'solve') {
      const { name, params, parts } = line
      return solveWarnings({ name, params, ...parts }, facts)
    }
    return []
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
    const definesFunction =
      line.kind === 'solve' ? line.params !== null : line.kind === 'parsed' && isFunctionAssignmentNode(line.node)
    if (line.display !== null && definesFunction) {
      return fail("Set a function's display unit on the line that calls it")
    }
    try {
      // Asked before the line runs: the line itself may assign one of these names.
      const isPlain = (line.kind === 'parsed' && line.plainInputUnits?.every((name) => !scope.has(name))) || false
      lastSolve = null
      if (line.kind === 'table') {
        if (line.display !== null) throw new SheetError('a table takes its units on its arguments: table(Q_s in L/s)')
        const built = runTable(line)
        table = built.view
        if (line.unknownFormat !== null) return { kind: 'error', message: `Unknown format ${line.unknownFormat}` }
        // Points that failed in a column the table worked out itself are its line's error;
        // a list named from above already shows its own.
        return built.failed === null ? { kind: 'empty' } : { kind: 'error', message: built.failed }
      }
      const value: unknown =
        line.kind === 'solve' ? runSolve(line) : line.kind === 'range' ? runRange(line) : runCode(line.node)
      if (line.kind === 'solve' || (line.kind === 'parsed' && isSolveCall(line.node))) details = lastSolve
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
        for (const name of line.defines) {
          if (isSheetList(scope.get(name)) && unit !== null && line.displayText !== null) {
            listUnits.set(name, { unit, text: line.displayText })
          } else listUnits.delete(name)
        }
        if (isSheetList(value)) {
          preview = previewOf(value, unit)
          return { kind: 'list', text: summaryOf(value, unit), failed: failureOf(value) }
        }
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
      const node =
        line.kind === 'solve'
          ? line.parts.lhs
          : line.kind === 'range'
            ? line.start
            : line.kind === 'table'
              ? (line.args[0]?.node ?? new math.ConstantNode(0))
              : line.node
      const message = messageOf(error, node, (name) => scope.get(name))
      return fail(explain(message, here, definedAt, failed))
    }
  }

  function runCode(node: MathNode): unknown {
    // Section 10: a function body can't reach a list from outside.
    for (const { params, expr } of functionDefinitions(node)) {
      const outside = bodyNames(expr).find((name) => !params.includes(name) && isSheetList(scope.get(name)))
      if (outside !== undefined) throw new SheetError(`pass ${outside} as an argument`)
    }
    const bound = new Map<string, unknown>()
    const folded = foldAggregates(node, bound)
    const assigned = isAssignmentNode(folded) && !folded.index ? folded : null
    const expression = assigned ? assigned.value : folded
    if (listsIn(expression).length > 0 && !isBlockNode(folded) && !isFunctionAssignmentNode(folded)) {
      const list = iterate(expression, bound)
      if (assigned) scope.set(assigned.name, list)
      return list
    }
    let value: unknown
    if (bound.size === 0) value = folded.compile().evaluate(scope)
    else {
      const local = new LayeredScope(scope, bound)
      value = folded.compile().evaluate(local)
      for (const name of definedNames(folded)) scope.set(name, local.get(name))
    }
    for (const definition of functionDefinitions(node)) {
      const { name, params, expr } = definition
      const fn = scope.get(name) as (...args: unknown[]) => unknown
      scope.set(name, calls.wrap({ name, params }, expr, fn))
    }
    return value
  }

  /**
   * A solve line (section 9). The value form solves here, once per run. The
   * function form defines a function that solves at each call, with its
   * parameters over the scope as it is at the call (late binding); its errors
   * land on the calling line, through the wrapper.
   */
  function runSolve(line: Extract<ParsedLine, { kind: 'solve' }>): unknown {
    const { name, params, solve } = line
    if (params === null) {
      const { value, details } = solve.run(scope, solveText)
      lastSolve = details
      scope.set(name, value)
      return value
    }
    const fn = (...args: unknown[]) => {
      const own = new Map(params.map((param, i) => [param, args[i]]))
      const { value, details } = solve.run(new LayeredScope(scope, own), solveText)
      lastSolve = details
      return value
    }
    const wrapped = calls.wrap({ name, params, solve: true }, line.parts.lhs, fn)
    scope.set(name, wrapped)
    return wrapped
  }

  /** A range line (section 10): its list, assigned to its name if it has one. */
  function runRange(line: Extract<ParsedLine, { kind: 'range' }>): SheetList {
    const at = (node: MathNode): unknown => {
      const value: unknown = node.compile().evaluate(scope)
      if (isSheetList(value)) throw new SheetError('a range takes single values, not a list')
      return value
    }
    const list = ranges.range(at(line.start), at(line.end), line.step === null ? null : at(line.step), line.name)
    if (line.name !== null) scope.set(line.name, list)
    return list
  }

  /**
   * A table line (section 10): each argument a column, a list run point by
   * point, a single value filling its column. Lists must have one length, and
   * at least one argument must be a list.
   */
  function runTable(line: Extract<ParsedLine, { kind: 'table' }>): { view: TableView; failed: string | null } {
    if (line.args.length === 0) throw new SheetError('a table needs a list, such as table(Q_s)')
    const columns = line.args.map((arg) => {
      const lists = listsIn(arg.node)
      const value: SheetList | unknown = lists.length > 0 ? iterate(arg.node, new Map()) : arg.node.compile().evaluate(scope)
      return { arg, value, name: isSymbolNode(arg.node) ? arg.node.name : arg.node.toString() }
    })
    const listed = columns.filter((column) => isSheetList(column.value))
    if (listed.length === 0) throw new SheetError('a table needs a list, such as table(Q_s)')
    const length = (listed[0].value as SheetList).length
    const other = listed.find((column) => (column.value as SheetList).length !== length)
    if (other) {
      throw new SheetError(`${listed[0].name} has ${length} values, ${other.name} has ${(other.value as SheetList).length}`)
    }
    const built = columns.map(({ arg, value }) => {
      const points: Point[] = isSheetList(value)
        ? [...value.points]
        : Array.from({ length }, () => ({ ok: true as const, value }))
      return buildColumn(arg, points)
    })
    const own = columns.find(
      ({ arg, value }) => isSheetList(value) && !isSymbolNode(arg.node) && failureOf(value) !== null,
    )
    return {
      view: {
        columns: built.map(({ column }) => column),
        rows: Array.from({ length }, (_, i) => built.map(({ cells }) => cells[i])),
      },
      failed: own ? failureOf(own.value as SheetList) : null,
    }
  }

  /** A column's unit, header and cells, in its argument's unit, else its list's, else the sheet's system. */
  function buildColumn(
    arg: Extract<ParsedLine, { kind: 'table' }>['args'][number],
    points: readonly Point[],
  ): { column: TableColumn; cells: TableCell[] } {
    const header = tableHeaderTex(arg.node, names)
    const ok = points.filter((point): point is Extract<Point, { ok: true }> => point.ok)
    const named = isSymbolNode(arg.node) ? listUnits.get(arg.node.name) : undefined
    let unit: ShownUnit | null =
      arg.display?.kind === 'unit' ? arg.display.unit : arg.display?.kind === 'percent' ? 'percent' : (named?.unit ?? null)
    if (unit === null && ok.length > 0) {
      // One unit for the whole column: the one the system picks for its largest value.
      const largest = ok.reduce((a, b) => (magnitude(b.value) > magnitude(a.value) ? b : a))
      const rest = leadingNumber(display.show(largest.value, null, settings))?.rest.trim() ?? ''
      const target = rest === '' ? null : display.readTarget(rest)
      unit = target?.kind === 'unit' ? target.unit : null
    }
    const texts = points.map((point) => (point.ok ? display.show(point.value, unit, settings) : null))
    const first = texts.find((text) => text !== null) ?? ''
    const unitText = leadingNumber(first)?.rest.trim() ?? ''
    const numbers = tableColumn(
      texts.filter((text): text is string => text !== null).map((text) => leadingNumber(text)?.number ?? text),
      settings.digits,
    )
    let k = 0
    const cells = points.map((point): TableCell => (point.ok ? { ok: true, text: numbers[k++] } : point))
    // The header's slot offers the first value in each unit; only an `in` on the argument counts as chosen.
    const offered = ok.length > 0 && unitText !== '' ? display.slot(ok[0].value, settings) : null
    return { column: { header, unit: unitText, slot: offered && { ...offered, chosen: arg.displayText } }, cells }
  }

  function magnitude(value: unknown): number {
    if (typeof value === 'number') return Math.abs(value)
    if (math.isUnit(value) && value.value !== null) return Math.abs(value.value)
    return 0
  }

  /** The names in a node that hold a list here, in order, each once. */
  function listsIn(node: MathNode, bound?: ReadonlyMap<string, unknown>): string[] {
    return [...new Set(usedNames(node))].filter((name) => !bound?.has(name) && isSheetList(scope.get(name)))
  }

  /**
   * An expression run once per point (section 10, iterating line): each list
   * name bound to its i-th value, lists paired point by point. A point whose
   * input failed, or whose run throws, fails alone.
   */
  function iterate(expression: MathNode, bound: ReadonlyMap<string, unknown>): SheetList {
    const names = listsIn(expression, bound)
    const lists = names.map((name) => scope.get(name) as SheetList)
    const length = lists[0].length
    const other = lists.findIndex((list) => list.length !== length)
    if (other !== -1) {
      throw new SheetError(`${names[0]} has ${length} values, ${names[other]} has ${lists[other].length}`)
    }
    const code = expression.compile()
    const points: Point[] = []
    for (let i = 0; i < length; i++) {
      const own = new Map(bound)
      let input: Point | null = null
      lists.forEach((list, k) => {
        const point = list.points[i]
        if (!point.ok) input ??= point
        else own.set(names[k], point.value)
      })
      if (input !== null) {
        points.push(input)
        continue
      }
      const local = new LayeredScope(scope, own)
      try {
        points.push({ ok: true, value: code.evaluate(local) })
      } catch (error) {
        points.push({ ok: false, message: messageOf(error, expression, (name) => local.get(name)) })
      }
    }
    return new SheetList(points, { name: names[0], list: lists[0] })
  }

  /**
   * Aggregates over a list (section 10): `max(H_s)` takes the whole list. Each
   * such call is worked out first and stands in the node as a bound name, so
   * the rest of the line sees one value. A failed point fails the aggregate.
   */
  function foldAggregates(node: MathNode, bound: Map<string, unknown>): MathNode {
    return node.transform((child) => {
      if (!isFunctionNode(child) || !isSymbolNode(child.fn)) return child
      const name = child.fn.name
      if (!(AGGREGATES as readonly string[]).includes(name) || scope.has(name)) return child
      if (!child.args.some((arg) => listsIn(arg).length > 0)) return child
      const values = child.args.flatMap((arg) => {
        if (listsIn(arg).length === 0) return [arg.compile().evaluate(scope) as unknown]
        const items = iterate(arg, new Map()).values()
        if (items === null) throw new SheetError(`${isSymbolNode(arg) ? arg.name : arg.toString()} has a failed point`)
        return items
      })
      const key = `__aggregate${bound.size}`
      const aggregate = (math as unknown as Record<string, (...args: unknown[]) => unknown>)[name]
      bound.set(key, name === 'count' ? values.length : aggregate(...values))
      return new math.SymbolNode(key)
    })
  }

  /** A list's summary in the sheet's number form, in `unit` if the line chose one. */
  function summaryOf(list: SheetList, unit: ShownUnit | null): string {
    return listSummary(
      list,
      (value) => display.show(value, unit, settings),
      (value, like) => {
        const target = like === '' ? null : display.readTarget(like)
        return display.show(value, target?.kind === 'unit' ? target.unit : unit, settings)
      },
    )
  }

  /** The hover of a list's summary: three points from each end, with their index. */
  function previewOf(list: SheetList, unit: ShownUnit | null): string {
    const row = (i: number) => {
      const point = list.points[i]
      return `${i + 1}: ${point.ok ? display.show(point.value, unit, settings) : `failed: ${point.message}`}`
    }
    const n = list.length
    if (n <= 7) return list.points.map((_, i) => row(i)).join('\n')
    return [row(0), row(1), row(2), '…', row(n - 3), row(n - 2), row(n - 1)].join('\n')
  }

  /** One value of a list in the unit its summary ends with, so `0 L/s` reads as the list does. */
  function likeList(list: SheetList, value: unknown): string {
    const last = [...list.points].reverse().find((point) => point.ok)
    if (!last?.ok) return display.show(value, null, settings)
    const unit = leadingNumber(display.show(last.value, null, settings))?.rest.trim() ?? ''
    const target = unit === '' ? null : display.readTarget(unit)
    return display.show(value, target?.kind === 'unit' ? target.unit : null, settings)
  }

  /** `1 of 30 points failed. At Q_s = 0 L/s: …`, or null when none did. */
  function failureOf(list: SheetList): string | null {
    const failed = list.points.filter((point) => !point.ok).length
    if (failed === 0) return null
    const i = list.points.findIndex((point) => !point.ok)
    const point = list.points[i] as Extract<Point, { ok: false }>
    const origin = list.origin
    const input = origin?.list.points[i]
    const where = origin && input?.ok ? `At ${origin.name} = ${likeList(origin.list, input.value)}` : `At point ${i + 1}`
    return `${failed} of ${list.length} points failed. ${where}: ${point.message}`
  }

  /** `f_d = f(Re_d, eps/D)` or `f(…)`: the line is just one call to a solve function. */
  function isSolveCall(node: MathNode): boolean {
    const call = isAssignmentNode(node) && !node.index ? node.value : node
    if (!isFunctionNode(call) || !isSymbolNode(call.fn)) return false
    const fn = scope.get(call.fn.name)
    return isSheetFunction(fn) && fn.sheetFunction.solve === true
  }
}

function typesetLine(line: ParsedLine, names: Names): TypesetLine {
  switch (line.kind) {
    case 'blank':
      return line.comment === null ? { kind: 'blank' } : { kind: 'comment', text: line.comment }
    case 'syntax-error':
      return { kind: 'unparsed', source: line.source }
    case 'table':
      return {
        kind: 'math',
        name: null,
        expression: `\\mathrm{table}\\left(${line.args.map((arg) => tableHeaderTex(arg.node, names)).join(',\\;')}\\right)`,
        note: line.note,
        format: line.format,
      }
    case 'range':
      try {
        return { kind: 'math', ...rangeTex(line.name, line, names), note: line.note, format: line.format }
      } catch {
        return { kind: 'math', name: null, expression: textTex(line.source), note: line.note, format: line.format }
      }
    case 'solve': {
      const inLine: Names = {
        ...names,
        isSheetName: (n) => n === line.parts.unknown || (line.params ?? []).includes(n) || names.isSheetName(n),
      }
      try {
        return { kind: 'math', ...solveTex(line.name, line.params, line.parts, inLine), note: line.note, format: line.format }
      } catch {
        return { kind: 'math', name: null, expression: textTex(line.parts.lhsText), note: line.note, format: line.format }
      }
    }
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

function tableHeaderTex(node: MathNode, names: Names): string {
  try {
    return lineTex(node, names).expression
  } catch {
    return textTex(node.toString())
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
  const tableForm = readTable(line)
  if (tableForm) {
    try {
      return {
        kind: 'table',
        args: tableForm.args.map(({ expression, displayUnit }) => {
          const target = displayUnit === null ? null : display.readTarget(displayUnit)
          return {
            node: parse(target === null && displayUnit !== null ? `${expression} in ${displayUnit}` : expression),
            display: target,
            displayText: target === null ? null : displayUnit,
          }
        }),
        defines: [],
        note: form.note,
        format: form.format,
        unknownFormat: form.unknownFormat,
        display: target,
        displayText: target === null ? null : form.displayUnit,
      }
    } catch (error) {
      return { kind: 'syntax-error', message: error instanceof Error ? error.message : String(error), defines: [], source: text }
    }
  }
  const range = readSolve(line) === null ? readRange(line) : null
  if (range) {
    try {
      return {
        kind: 'range',
        name: range.name,
        start: parse(range.start),
        end: parse(range.end),
        step: range.step === null ? null : parse(range.step),
        defines: range.name === null ? [] : [range.name],
        note: form.note,
        format: form.format,
        unknownFormat: form.unknownFormat,
        display: target,
        displayText: target === null ? null : form.displayUnit,
        source: line,
      }
    } catch (error) {
      return {
        kind: 'syntax-error',
        message: error instanceof Error ? error.message : String(error),
        defines: range.name === null ? [] : [range.name],
        source: text,
      }
    }
  }
  const solve = readSolve(line)
  if (solve?.kind === 'malformed') {
    return { kind: 'syntax-error', message: solve.message, defines: [solve.name], source: text }
  }
  if (solve) {
    try {
      const parts: SolveParts = {
        unknown: solve.unknown,
        lhs: parse(solve.lhs),
        rhs: parse(solve.rhs),
        guess: parse(solve.guess),
        lhsText: solve.lhs,
        rhsText: solve.rhs,
        guessText: solve.guess,
      }
      return {
        kind: 'solve',
        name: solve.name,
        params: solve.params,
        parts,
        solve: solver.compile(parts),
        defines: [solve.name],
        note: form.note,
        format: form.format,
        unknownFormat: form.unknownFormat,
        display: target,
        displayText: target === null ? null : form.displayUnit,
      }
    } catch (error) {
      return {
        kind: 'syntax-error',
        message: error instanceof Error ? error.message : String(error),
        defines: [solve.name],
        source: text,
      }
    }
  }
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
