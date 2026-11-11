import type { MathJsInstance, Unit } from 'mathjs'
import { SheetError } from './functions.ts'
import { leadingNumber } from './numbers.ts'

/**
 * Lists (docs/spec-v1.md section 10, Ranges and lists): what a range gives and
 * what an iterating line gives back. The engine hands in its math.js instance;
 * this module never imports math.js at runtime.
 *
 * - A **list** is an ordered sequence of point results, each a value or an
 *   error, all of one kind. Its length is fixed by its range, and a failed
 *   point never removes or shifts the others.
 * - A **range** `a .. b step s` steps from the start towards the end. The end
 *   is included when the steps land on it; otherwise the list stops at the last
 *   point before it.
 */

export type Point = { ok: true; value: unknown } | { ok: false; message: string }

export class SheetList {
  readonly points: readonly Point[]
  /** The first list the line ran over, to name a failed point (`At Q_s = 0 L/s`); null for a range. */
  readonly origin: { name: string; list: SheetList } | null

  constructor(points: readonly Point[], origin: { name: string; list: SheetList } | null = null) {
    this.points = points
    this.origin = origin
  }

  get length(): number {
    return this.points.length
  }

  /** The values, or null if any point failed. */
  values(): unknown[] | null {
    const values: unknown[] = []
    for (const point of this.points) {
      if (!point.ok) return null
      values.push(point.value)
    }
    return values
  }
}

export function isSheetList(value: unknown): value is SheetList {
  return value instanceof SheetList
}

/** The names a list line may call to take a whole list (section 2, Aggregate). */
export const AGGREGATES = ['min', 'max', 'sum', 'mean', 'count'] as const

/** More points than this is an error (section 10). */
export const MAX_POINTS = 10_000

export function createRanges(math: MathJsInstance) {
  const isUnit = (value: unknown): value is Unit => math.isUnit(value)

  /** A value as an SI number and its dimensions (null for a plain number). */
  function reduce(value: unknown, what: string): { number: number; dimensions: readonly number[] | null } {
    if (typeof value === 'number') return { number: value, dimensions: null }
    if (isUnit(value) && value.value !== null) {
      const dimensionless = value.dimensions.every((d) => d === 0)
      return { number: value.value, dimensions: dimensionless ? null : value.dimensions }
    }
    throw new SheetError(`the range's ${what} must be a number or a quantity`)
  }

  return {
    /**
     * The list `start .. end step step`. `name` names the range in messages;
     * `stepText` is how a missing step is suggested.
     */
    range(start: unknown, end: unknown, step: unknown | null, name: string | null): SheetList {
      const a = reduce(start, 'start')
      const b = reduce(end, 'end')
      if (step === null && (a.dimensions !== null || b.dimensions !== null || isUnit(start) || isUnit(end))) {
        const unit = isUnit(start) ? start.formatUnits().replace(/ \/ /g, '/') : ''
        throw new SheetError(`a range with units needs a step, such as "step 1${unit ? ` ${unit}` : ''}"`)
      }
      const s = step === null ? { number: 1, dimensions: null } : reduce(step, 'step')
      if (!same(a.dimensions, b.dimensions) || !same(a.dimensions, s.dimensions)) {
        throw new SheetError('start, end and step must be the same kind')
      }
      const span = b.number - a.number
      const steps = span / s.number
      if (s.number === 0 || !Number.isFinite(steps) || steps < 0) {
        throw new SheetError(`step ${showStep(step)} never reaches the end`)
      }
      // The end counts when the steps land on it, to rounding.
      const count = Math.floor(steps + 1e-9) + 1
      if (count > MAX_POINTS) {
        throw new SheetError(`${name ?? 'the range'} has more than 10,000 points`)
      }
      const template = isUnit(start) ? start.toSI() : null
      const points: Point[] = []
      for (let i = 0; i < count; i++) {
        const x = i === count - 1 && Math.abs(steps - (count - 1)) < 1e-9 ? b.number : a.number + i * s.number
        if (template === null) points.push({ ok: true, value: x })
        else {
          const value = template.clone()
          value.value = x
          points.push({ ok: true, value: value.to((start as Unit).formatUnits()) })
        }
      }
      return new SheetList(points)
    },
  }

  function showStep(step: unknown): string {
    if (step === null) return '1'
    return isUnit(step) ? step.toString() : String(step)
  }
}

function same(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b
  return a.every((d, i) => Math.abs(d - b[i]) < 1e-12)
}

/**
 * A list's one-row summary (section 10): `30 values, 12.04 … 33.18 m`, the
 * count, the first and last values, then the unit once. A list with failed
 * points counts what it has: `29 of 30 values, …`. `show` writes one value in
 * the sheet's form; `showIn` writes one in the unit of another value's text.
 */
export function listSummary(
  list: SheetList,
  show: (value: unknown) => string,
  showLike: (value: unknown, like: string) => string,
): string {
  const ok = list.points.filter((point) => point.ok)
  const count = ok.length === list.length ? `${list.length} values` : `${ok.length} of ${list.length} values`
  if (ok.length === 0) return count
  const last = show(ok[ok.length - 1].value)
  if (ok.length === 1) return `${count}, ${last}`
  const lastUnit = leadingNumber(last)?.rest.trim() ?? ''
  const first = showLike(ok[0].value, lastUnit)
  const firstNumber = leadingNumber(first)
  const sameUnit = firstNumber !== null && firstNumber.rest.trim() === lastUnit
  return `${count}, ${sameUnit ? firstNumber.number : first} … ${last}`
}
