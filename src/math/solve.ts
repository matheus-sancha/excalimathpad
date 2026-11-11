import type { EvalFunction, MathJsInstance, MathNode, Unit } from 'mathjs'
import { SheetError, messageOf } from './functions.ts'
import { leadingNumber } from './numbers.ts'
import { solveNear } from './solver.ts'

/**
 * A solve line run against the sheet (docs/spec-v1.md section 9). The engine
 * hands in its math.js instance and the parts of the line, already parsed with
 * its captured `parse` (ADR 0005); this module never imports math.js at
 * runtime.
 *
 * - **Residual:** `lhs - rhs`, each side evaluated by math.js in a scope where
 *   the unknown wins over every other meaning: a variable above, a unit, or
 *   the function being defined. The two sides are reduced to SI numbers here,
 *   so a dimension mismatch is the app's own message.
 * - **Unknown:** takes the guess's dimension. The solver sees SI numbers; the
 *   unknown is that number in the guess's SI unit.
 * - **Guess:** evaluated each time the solve runs, in the scope at that point,
 *   where the unknown is hidden: the guess can't use it.
 * - **Failure** throws a `SheetError`. No root and no convergence are marked
 *   `outsideDomain`, so an outer solve treats a trial point where an inner
 *   solve fails as having no value there (section 9, Nested solves). Every
 *   other error, a units error included, fails the outer line at once.
 */

/** A scope as math.js reads it. */
export interface Scope {
  get(name: string): unknown
  set(name: string, value: unknown): unknown
  has(name: string): boolean
  keys(): IterableIterator<string>
}

/** Names of this layer win over the parent's; writes stay in the layer. */
export class LayeredScope implements Scope {
  private readonly own: Map<string, unknown>
  private readonly parent: Scope
  private readonly hidden: ReadonlySet<string>

  constructor(parent: Scope, own: Map<string, unknown>, hidden: readonly string[] = []) {
    this.parent = parent
    this.own = own
    this.hidden = new Set(hidden)
  }

  get(name: string): unknown {
    if (this.own.has(name)) return this.own.get(name)
    return this.hidden.has(name) ? undefined : this.parent.get(name)
  }

  set(name: string, value: unknown) {
    this.own.set(name, value)
    return this
  }

  has(name: string): boolean {
    return this.own.has(name) || (!this.hidden.has(name) && this.parent.has(name))
  }

  delete(name: string): boolean {
    return this.own.delete(name)
  }

  clear() {
    this.own.clear()
  }

  forEach(callback: (value: unknown, key: string) => void) {
    for (const key of this.keys()) callback(this.get(key), key)
  }

  *keys(): IterableIterator<string> {
    const seen = new Set<string>()
    for (const key of this.own.keys()) {
      seen.add(key)
      yield key
    }
    for (const key of this.parent.keys()) {
      if (!seen.has(key) && !this.hidden.has(key)) yield key
    }
  }
}

/** A solve line's parts, parsed. */
export interface SolveParts {
  unknown: string
  lhs: MathNode
  rhs: MathNode
  guess: MathNode
  /** As typed, for messages. */
  lhsText: string
  rhsText: string
  guessText: string
}

/**
 * How a converged solve went (section 4, Solve details). Plain text in the
 * section 5 form, except the residual and the bracket, which read as they fall.
 */
export interface SolveDetails {
  method: 'Brent'
  iterations: number
  /** Residual evaluations, the bracket search's included. */
  evaluations: number
  /** The residual at the root, in SI units: `3.6·10⁻¹⁵ m`. */
  residual: string
  /** The final bracket, in the guess's unit: `18.80720968133 .. 18.80720968134 L / s`. */
  bracket: string
}

/** How values read in messages and details: the engine's `display.show`. */
export interface SolveText {
  /** A value in the sheet's number form, in `unit` (a valueless unit) if given. */
  show(value: unknown, unit: Unit | null): string
  /** A value as it falls: 13 significant digits, in `unit` if given. */
  exact(value: unknown, unit: Unit | null): string
}

export interface CompiledSolve {
  readonly unknown: string
  /** Runs the solve against `scope`. Throws a `SheetError` when it fails. */
  run(scope: Scope, text: SolveText): { value: unknown; details: SolveDetails }
}

interface Reduced {
  number: number
  dimensions: readonly number[] | null
  /** The SI unit of a quantity, as text; null for a number. */
  unit: string | null
}

const NO_VALUE: Reduced = { number: Number.NaN, dimensions: null, unit: null }

export function createSolver(math: MathJsInstance) {
  const isUnit = (value: unknown): value is Unit => math.isUnit(value)

  /** A side's value as an SI number and its dimensions; NaN where it has none. */
  function reduce(value: unknown): Reduced {
    if (typeof value === 'number') return { number: value, dimensions: null, unit: null }
    if (isUnit(value) && value.value !== null) {
      if (value.dimensions.every((d) => d === 0)) return { number: value.value, dimensions: null, unit: null }
      return { number: value.value, dimensions: value.dimensions, unit: value.toSI().formatUnits() }
    }
    // A complex number (sqrt of a negative) has no value on the real line.
    if (math.isComplex(value)) return NO_VALUE
    throw new SheetError('a side of the equation is not a number or a quantity')
  }

  return {
    compile(parts: SolveParts): CompiledSolve {
      const lhs = parts.lhs.compile()
      const rhs = parts.rhs.compile()
      const guess = parts.guess.compile()
      const { unknown } = parts
      const equation = `${parts.lhsText} - ${wrap(parts.rhsText)}`

      return {
        unknown,
        run(scope, text) {
          const start = guessValue(guess, scope)
          const si = isUnit(start) ? start.toSI() : null
          const guessUnit = isUnit(start) ? valueless(start) : null
          const trial = (x: number): unknown => {
            if (si === null) return x
            const value = si.clone()
            value.value = x
            return value
          }
          const own = new Map<string, unknown>()
          const local = new LayeredScope(scope, own)
          let lastInner: string | null = null
          // The residual's SI unit, from the left side at the latest point with a value.
          const residualUnit: { text: string | null } = { text: null }
          const side = (code: EvalFunction) => {
            try {
              return reduce(code.evaluate(local))
            } catch (error) {
              if (error instanceof SheetError && error.outsideDomain) {
                lastInner = error.message
                return NO_VALUE
              }
              if (error instanceof SheetError) throw error
              throw new SheetError(messageOf(error, parts.lhs, (name) => local.get(name)))
            }
          }
          const residual = (x: number): number => {
            own.set(unknown, trial(x))
            const left = side(lhs)
            const right = side(rhs)
            if (Number.isNaN(left.number) || Number.isNaN(right.number)) return Number.NaN
            if (!sameDimensions(left.dimensions, right.dimensions)) {
              throw new SheetError(`guess ${unknown} = ${parts.guessText}: ${equation} units do not match`)
            }
            residualUnit.text = left.unit
            return left.number - right.number
          }

          const x0 = si === null ? (start as number) : (si.value as number)
          const outcome = solveNear(residual, x0)
          const near = () => `${unknown} = ${text.show(start, guessUnit)}`
          const inner = () => (lastInner === null ? '' : `; last inner error: ${lastInner}`)
          if (outcome.kind === 'no-convergence') {
            throw new SheetError(`no convergence for ${unknown} after ${outcome.iterations} iterations`, false, true)
          }
          if (outcome.kind === 'no-root') {
            const where =
              outcome.searched === null
                ? 'the equation has no value near the guess'
                : `searched ${range(outcome.searched, (x) => text.show(trial(x), guessUnit))}`
            throw new SheetError(`no root near ${near()} (${where})${inner()}`, false, true)
          }
          const value = trial(outcome.x)
          const unitText = residualUnit.text
          const residualIn = unitText === null ? null : math.unit(unitText)
          return {
            value: guessUnit === null ? value : (value as Unit).to(guessUnit),
            details: {
              method: 'Brent',
              iterations: outcome.iterations,
              evaluations: outcome.evaluations,
              residual: text.exact(unitText === null ? outcome.residual : math.unit(outcome.residual, unitText), residualIn),
              bracket: range(outcome.bracket, (x) => text.exact(trial(x), guessUnit)),
            },
          }

          function guessValue(code: EvalFunction, at: Scope): unknown {
            let value: unknown
            try {
              value = code.evaluate(new LayeredScope(at, new Map(), [unknown]))
            } catch (error) {
              const message = messageOf(error, parts.guess, (name) => at.get(name))
              throw new SheetError(`guess ${unknown}: ${message}`)
            }
            if (typeof value === 'number' && Number.isFinite(value)) return value
            if (isUnit(value) && value.value !== null && Number.isFinite(value.value)) return value
            throw new SheetError(`guess ${unknown}: not a number or a quantity`)
          }
        },
      }
    },
  }

  function valueless(value: Unit): Unit {
    return math.unit(value.formatUnits())
  }
}

/** `0.9 .. 240 L / s`: the unit once, after the high end. */
function range([low, high]: readonly [number, number], show: (x: number) => string): string {
  const from = show(low)
  const to = show(high)
  return `${leadingNumber(from)?.number ?? from} .. ${to}`
}

/** `Hs(Q)` stays as it is; `a + b` is bracketed after a minus. */
function wrap(text: string): string {
  return /^[\w.()\s^*/]+$/.test(text) && !/^\s*-/.test(text) ? text : `(${text})`
}

function sameDimensions(a: readonly number[] | null, b: readonly number[] | null): boolean {
  if (a === null || b === null) return a === b
  return a.every((d, i) => Math.abs(d - b[i]) < 1e-12)
}
