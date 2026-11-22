import type { MathJsInstance, Unit } from 'mathjs'
import { SheetError } from './functions.ts'
import type { EngineMessage, RangePart } from './messages.ts'
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

export type Point = { ok: true; value: unknown } | { ok: false; message: EngineMessage }

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
  function reduce(value: unknown, part: RangePart): { number: number; dimensions: readonly number[] | null } {
    if (typeof value === 'number') return { number: value, dimensions: null }
    if (isUnit(value) && value.value !== null) {
      const dimensionless = value.dimensions.every((d) => d === 0)
      return { number: value.value, dimensions: dimensionless ? null : value.dimensions }
    }
    throw new SheetError({ code: 'rangePartNotNumber', part })
  }

  return {
    /**
     * The list `start .. end step step`. `name` names the range in messages;
     * `stepText` is how a missing step is suggested.
     */
    range(start: unknown, end: unknown, step: unknown, name: string | null): SheetList {
      const a = reduce(start, 'start')
      const b = reduce(end, 'end')
      if (step === null && (a.dimensions !== null || b.dimensions !== null || isUnit(start) || isUnit(end))) {
        const unit = isUnit(start) ? start.formatUnits().replace(/ \/ /g, '/') : ''
        throw new SheetError({ code: 'rangeNeedsStep', unit })
      }
      const s = step === null ? { number: 1, dimensions: null } : reduce(step, 'step')
      if (!same(a.dimensions, b.dimensions) || !same(a.dimensions, s.dimensions)) {
        throw new SheetError({ code: 'rangeSameKind' })
      }
      const span = b.number - a.number
      const steps = span / s.number
      if (s.number === 0 || !Number.isFinite(steps) || steps < 0) {
        throw new SheetError({ code: 'stepNeverReaches', step: showStep(step) })
      }
      // The end counts when the steps land on it, to rounding.
      const count = Math.floor(steps + 1e-9) + 1
      if (count > MAX_POINTS) {
        throw new SheetError({ code: 'tooManyPoints', what: name, limit: MAX_POINTS })
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
    // `reduce` has taken it, so it is a unit or a plain number.
    return isUnit(step) ? step.toString() : `${step as number}`
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
 * A solved value's roots count as roots (section 9, Roots): `13 roots, …`.
 */
export function listSummary(
  list: SheetList,
  show: (value: unknown) => string,
  showLike: (value: unknown, like: string) => string,
  noun: 'values' | 'roots' = 'values',
): string {
  const ok = list.points.filter((point) => point.ok)
  if (ok.length > 0 && ok.every((point) => typeof point.value === 'string')) return textSummary(list, ok.length)
  const count = ok.length === list.length ? `${list.length} ${noun}` : `${ok.length} of ${list.length} ${noun}`
  if (ok.length === 0) return count
  const last = show(ok[ok.length - 1].value)
  if (ok.length === 1) return `${count}, ${last}`
  const lastUnit = leadingNumber(last)?.rest.trim() ?? ''
  const first = showLike(ok[0].value, lastUnit)
  const firstNumber = leadingNumber(first)
  const sameUnit = firstNumber !== null && firstNumber.rest.trim() === lastUnit
  return `${count}, ${sameUnit ? firstNumber.number : first} … ${last}`
}

/**
 * A list of texts' summary (section 10, M4d): each distinct text counted,
 * most frequent first, ties in the order first seen: `3 OK, 1 NOT OK`.
 * Failed points come last, as `1 failed`.
 */
function textSummary(list: SheetList, ok: number): string {
  const counts = new Map<string, number>()
  for (const point of list.points) {
    if (point.ok) counts.set(point.value as string, (counts.get(point.value as string) ?? 0) + 1)
  }
  // `sort` is stable, so equal counts keep the order first seen.
  const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([text, n]) => `${n} ${text}`)
  const failed = list.length - ok
  return [...parts, ...(failed > 0 ? [`${failed} failed`] : [])].join(', ')
}
