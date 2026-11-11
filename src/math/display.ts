import type { MathJsInstance, MathNode, Unit } from 'mathjs'
import { formatOptions, leadingNumber, plainNumbers } from './numbers.ts'
import {
  BASE_UNITS,
  baseSystem,
  KIND_REFERENCE,
  KINDS,
  NAMED_SI_UNITS,
  namedUnitsFor,
  SLOT_UNITS,
  unitsFor,
  type Kind,
  type UnitSettings,
} from './unitSystems.ts'

/**
 * The shown result (docs/spec-v1.md section 5): a line's value in its display
 * unit, balanced if the kinds differ; else in the unit system for its kind;
 * else in composed base units of the system. math.js's own unit system stays
 * fixed at SI (section 14): this formatter is the app's, and the engine hands
 * it its math.js instance, so this module never imports math.js at runtime.
 */

/** How results show: the unit settings and the significant digits. */
export interface DisplaySettings {
  units: UnitSettings
  digits: number
}

/** What a line's trailing `in <unit>` turned out to be. */
export type DisplayUnit =
  | { kind: 'unit'; unit: Unit; text: string }
  /** `in %`, offered for a dimensionless result (section 5, Unit slot). */
  | { kind: 'percent' }
  | { kind: 'unknown'; name: string }

/** A unit to show a value in: a math.js unit, or percent. */
export type ShownUnit = Unit | 'percent'

/**
 * A result's unit slot (section 5): what the list under it offers. The kind is
 * null for a dimension off the kinds list, which offers only Sheet units.
 */
export interface UnitSlot {
  kind: Kind | 'dimensionless' | null
  /** The value in the sheet's system: the list's Sheet units entry. */
  system: string
  /** The units of the same kind, each with the value in it. */
  options: readonly { unit: string; text: string }[]
}

export interface Display {
  /** The target of an `in`, read outside the sheet's scope; null when not a pure unit expression. */
  readTarget(target: string): DisplayUnit | null
  /** A value's plain text, in `unit` if given, else in the settings' system. */
  show(value: unknown, unit: ShownUnit | null, settings: DisplaySettings): string
  /** The slot's list for a value, or null for a value with no unit to choose (a matrix, a string). */
  slot(value: unknown, settings: DisplaySettings): UnitSlot | null
}

/**
 * `parse` is the engine's captured parser: the namespace's own is disabled in
 * expressions (ADR 0003).
 */
export function createDisplay(math: MathJsInstance, parse: (text: string) => MathNode): Display {
  const isUnit = (value: unknown): value is Unit => math.isUnit(value)
  const slotUnits = new Map<string, Unit>()

  const kinds = KINDS.map((kind) => ({ kind, dimensions: math.unit(KIND_REFERENCE[kind]).dimensions }))

  function kindOf(dimensions: readonly number[]): Kind | null {
    return kinds.find((entry) => sameDimensions(entry.dimensions, dimensions))?.kind ?? null
  }

  const named = NAMED_SI_UNITS.map((name) => ({ name, dimensions: math.unit(name).dimensions }))

  /** The unit choices for a value's dimensions, from small to large, and the unprefixed one. */
  function choices(dimensions: readonly number[], settings: DisplaySettings) {
    const kind = kindOf(dimensions)
    if (kind !== null) return { units: unitsFor(settings.units, kind), plain: KIND_REFERENCE[kind] }
    const name = named.find((entry) => sameDimensions(entry.dimensions, dimensions))?.name
    if (name !== undefined) return { units: namedUnitsFor(settings.units, name), plain: name }
    const base = composed(dimensions, settings)
    return { units: [base], plain: base }
  }

  function format(value: unknown, digits: number): string {
    return plainNumbers(math.format(value, formatOptions(digits)))
  }

  /** `kg / (m s^2)`: base units of the system, composed from the dimensions. */
  function composed(dimensions: readonly number[], settings: DisplaySettings): string {
    const base = BASE_UNITS[baseSystem(settings.units)]
    const power = (name: string, exponent: number) => (exponent === 1 ? name : `${name}^${exponent}`)
    const up = dimensions.flatMap((d, i) => (d > 0 ? [power(base[i], d)] : []))
    const down = dimensions.flatMap((d, i) => (d < 0 ? [power(base[i], -d)] : []))
    if (down.length === 0) return up.join(' ')
    if (up.length === 0) return dimensions.flatMap((d, i) => (d < 0 ? [power(base[i], d)] : [])).join(' ')
    return `${up.join(' ')} / ${down.length === 1 ? down[0] : `(${down.join(' ')})`}`
  }

  /** The unit a system shows a value in. */
  function systemUnit(value: Unit, settings: DisplaySettings): string {
    const { units, plain } = choices(value.dimensions, settings)
    if (units.length === 1) return units[0]
    const size = Math.abs(value.toNumber(plain))
    if (size === 0 || !Number.isFinite(size)) return plain
    // The largest unit that keeps the number at 1 or above.
    let chosen = units[0]
    for (const unit of units) {
      if (Math.abs(value.toNumber(unit)) >= 1) chosen = unit
    }
    return chosen
  }

  function inSystem(value: Unit, settings: DisplaySettings): string {
    if (value.value === null) return format(value, settings.digits)
    if (value.dimensions.every((d) => d === 0)) return format(value.toNumber(''), settings.digits)
    return format(value.to(systemUnit(value, settings)), settings.digits)
  }

  /**
   * A value in a chosen unit. A unit of the wrong kind is balanced, as in
   * Mathcad: the value divided by the unit, the leftover dimension in base
   * units of the system, then the unit (`4.543·10⁴ m kg / (m^2 s^2)`).
   */
  function inUnit(value: unknown, unit: Unit, settings: DisplaySettings): string {
    if (isUnit(value) && sameDimensions(value.dimensions, unit.dimensions)) {
      return format(value.to(unit), settings.digits)
    }
    // A matrix, a string and the like: math.js's own conversion, or its error.
    if (!isUnit(value) && typeof value !== 'number') {
      return format(math.to(value as never, unit), settings.digits)
    }
    const leftover = math.divide(value as never, unit) as unknown
    const unitText = unit.formatUnits()
    const shown = unitText.includes(' ') ? `(${unitText})` : unitText
    if (!isUnit(leftover)) return `${format(leftover, settings.digits)} ${shown}`
    const rest = format(leftover.to(composed(leftover.dimensions, settings)), settings.digits)
    const split = leadingNumber(rest)
    return split ? `${split.number} ${shown}${split.rest}` : `${rest} ${shown}`
  }

  return {
    readTarget(target) {
      if (target.trim() === '%') return { kind: 'percent' }
      let node: MathNode
      try {
        node = parse(target)
      } catch {
        return null
      }
      const names = unitShape(node, math)
      if (names === null) return null
      const unknown = names.find((name) => !math.Unit.isValuelessUnit(name))
      if (unknown !== undefined) return { kind: 'unknown', name: unknown }
      const unit = buildUnit(node, math)
      return { kind: 'unit', unit, text: unit.formatUnits() }
    },
    show(value, unit, settings) {
      return show(value, unit, settings)
    },
    slot(value, settings) {
      const dimensions = isUnit(value) ? value.dimensions : typeof value === 'number' ? null : undefined
      if (dimensions === undefined || (isUnit(value) && value.value === null)) return null
      const system = show(value, null, settings)
      if (dimensions === null || dimensions.every((d) => d === 0)) {
        return { kind: 'dimensionless', system, options: [{ unit: '%', text: show(value, 'percent', settings) }] }
      }
      const kind = kindOf(dimensions)
      if (kind === null) return { kind: null, system, options: [] }
      return {
        kind,
        system,
        options: SLOT_UNITS[kind].map((unit) => ({ unit, text: show(value, slotUnit(unit), settings) })),
      }
    },
  }

  function show(value: unknown, unit: ShownUnit | null, settings: DisplaySettings): string {
    if (unit === 'percent') {
      const hundredfold = math.multiply(value as never, 100) as unknown
      const shown = isUnit(hundredfold) ? inSystem(hundredfold, settings) : format(hundredfold, settings.digits)
      return `${shown} %`
    }
    if (unit !== null) return inUnit(value, unit, settings)
    if (isUnit(value)) return inSystem(value, settings)
    return format(value, settings.digits)
  }

  /** The slot lists' units, read once per engine. */
  function slotUnit(text: string): Unit {
    let unit = slotUnits.get(text)
    if (!unit) {
      unit = buildUnit(parse(text), math)
      slotUnits.set(text, unit)
    }
    return unit
  }
}

function sameDimensions(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((d, i) => Math.abs(d - b[i]) < 1e-12)
}

/**
 * The names in a pure unit expression (`kPa`, `kN/m^2`, `L/minute`, `m^-1`),
 * whether or not math.js knows them, or null if the expression isn't one: only
 * names, `*`, `/`, parentheses, a numeric power and a leading `1` (`1/s`).
 */
function unitShape(node: MathNode, math: MathJsInstance): readonly string[] | null {
  if (math.isSymbolNode(node)) return [node.name]
  if (math.isParenthesisNode(node)) return unitShape(node.content, math)
  if (!math.isOperatorNode(node)) return null
  if (node.fn === 'pow') return isPower(node.args[1], math) ? unitShape(node.args[0], math) : null
  if (node.fn !== 'multiply' && node.fn !== 'divide') return null
  const [left, right] = node.args
  const leftNames =
    node.fn === 'divide' && math.isConstantNode(left) && left.value === 1 ? [] : unitShape(left, math)
  const rightNames = unitShape(right, math)
  return leftNames && rightNames && [...leftNames, ...rightNames]
}

function isPower(node: MathNode, math: MathJsInstance): boolean {
  if (math.isConstantNode(node)) return typeof node.value === 'number'
  if (math.isParenthesisNode(node)) return isPower(node.content, math)
  return math.isOperatorNode(node) && node.fn === 'unaryMinus' && isPower(node.args[0], math)
}

/** The unit a pure unit expression names, built from math.js's own units, outside any scope. */
function buildUnit(node: MathNode, math: MathJsInstance): Unit {
  if (math.isSymbolNode(node)) return math.unit(node.name)
  if (math.isParenthesisNode(node)) return buildUnit(node.content, math)
  if (math.isOperatorNode(node)) {
    const [left, right] = node.args
    if (node.fn === 'pow') return math.pow(buildUnit(left, math), power(right, math)) as Unit
    if (node.fn === 'divide' && math.isConstantNode(left)) {
      return math.pow(buildUnit(right, math), -1) as Unit
    }
    const a = buildUnit(left, math)
    const b = buildUnit(right, math)
    return (node.fn === 'multiply' ? math.multiply(a, b) : math.divide(a, b)) as Unit
  }
  throw new Error('not a unit expression')
}

function power(node: MathNode, math: MathJsInstance): number {
  if (math.isConstantNode(node)) return Number(node.value)
  if (math.isParenthesisNode(node)) return power(node.content, math)
  if (math.isOperatorNode(node)) return -power(node.args[0], math)
  return 1
}
