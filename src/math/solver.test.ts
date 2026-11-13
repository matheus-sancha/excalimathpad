import { describe, expect, it } from 'vitest'
import { MAX_ITERATIONS, RELATIVE_TOLERANCE, solveNear , solveRange, type RangeOutcome } from './solver.ts'

/** Colebrook's residual in f, NaN where sqrt(f) has no real value. */
const colebrook = (re: number, r: number) => (f: number) =>
  f <= 0 ? Number.NaN : 1 / Math.sqrt(f) + 2 * Math.log10(r / 3.7 + 2.51 / (re * Math.sqrt(f)))

describe('solveNear (docs/spec-v1.md section 9)', () => {
  it('solves Colebrook from 0.02, stepping around its domain edge', () => {
    const outcome = solveNear(colebrook(29_600, 0.045 / 101.6), 0.02)
    if (outcome.kind !== 'root') throw new Error(outcome.kind)
    // The research probe's value (docs/research/solver-and-plot-libraries.md).
    expect(outcome.x).toBeCloseTo(0.02470670028, 10)
    expect(outcome.iterations).toBeLessThan(15)
  })

  it('ends inside a bracket no wider than the tolerance, with the root at one end', () => {
    const outcome = solveNear((x) => x * x - 2, 1)
    if (outcome.kind !== 'root') throw new Error(outcome.kind)
    const [low, high] = outcome.bracket
    expect(high - low).toBeLessThanOrEqual(RELATIVE_TOLERANCE * Math.SQRT2 * 1.01)
    expect([low, high]).toContain(outcome.x)
    expect(low <= Math.SQRT2 && Math.SQRT2 <= high).toBe(true)
  })

  it('returns the guess when it is the root', () => {
    expect(solveNear((x) => x - 3, 3)).toMatchObject({ kind: 'root', x: 3, iterations: 0 })
  })

  it('steps out from a zero guess with a unit step', () => {
    const outcome = solveNear((x) => x - 1e3, 0)
    expect(outcome).toMatchObject({ kind: 'root' })
    if (outcome.kind === 'root') expect(outcome.x).toBeCloseTo(1e3, 9)
  })

  it('reports no root with the span it searched', () => {
    const outcome = solveNear((x) => x * x + 2, 1)
    expect(outcome.kind).toBe('no-root')
    if (outcome.kind === 'no-root') {
      expect(outcome.searched?.[0]).toBeLessThan(-1e9)
      expect(outcome.searched?.[1]).toBeGreaterThan(1e9)
    }
  })

  it('reports no root and nothing searched when the equation has no value anywhere tried', () => {
    expect(solveNear(() => Number.NaN, 1)).toEqual({ kind: 'no-root', searched: null })
  })

  it('fails after the iteration cap rather than returning a value', () => {
    // A jump at 0: the relative tolerance shrinks with the bracket, so it never closes.
    expect(solveNear((x) => (x > 0 ? 1 : -1), 0.05)).toEqual({
      kind: 'no-convergence',
      iterations: MAX_ITERATIONS,
    })
  })

  it('passes through what the residual throws', () => {
    expect(() =>
      solveNear(() => {
        throw new Error('Units do not match')
      }, 1),
    ).toThrow('Units do not match')
  })

  it('is deterministic', () => {
    expect(solveNear((x) => Math.cos(x) - x, 1)).toEqual(solveNear((x) => Math.cos(x) - x, 1))
  })
})

describe('solveRange (docs/spec-v1.md section 9, Search range; #105)', () => {
  const xs = (outcome: RangeOutcome) => (outcome.kind === 'roots' ? outcome.roots.map((root) => root.x) : outcome.kind)
  const close = (actual: number[] | string, expected: number[]) => {
    expect(Array.isArray(actual) ? actual.length : actual).toBe(expected.length)
    ;(actual as number[]).forEach((x, i) => expect(x).toBeCloseTo(expected[i], 6))
  }

  it('finds every root it can see, ascending', () => {
    close(xs(solveRange((x) => x * x - 4, -10.07, 10.3)), [-2, 2])
    close(xs(solveRange((x) => (x - 1) * (x - 2) * (x - 3), -10.07, 10.3)), [1, 2, 3])
    close(xs(solveRange((x) => Math.sin(x) - 0.5, 0, 10)), [Math.PI / 6, (5 * Math.PI) / 6, Math.PI / 6 + 2 * Math.PI, (5 * Math.PI) / 6 + 2 * Math.PI])
  })

  it('rejects poles and jumps: tan x = 1 has 3 roots on 0 .. 10, 1/x = 0 and a step have none', () => {
    const tan = solveRange((x) => Math.tan(x) - 1, 0, 10)
    close(xs(tan), [Math.PI / 4, Math.PI / 4 + Math.PI, Math.PI / 4 + 2 * Math.PI])
    expect(tan.kind === 'roots' && tan.rejected).toBe(3)
    expect(solveRange((x) => 1 / x, -10.07, 10.3)).toMatchObject({ kind: 'no-root', hadValue: true })
    expect(solveRange((x) => (x < 0.3 ? -1 : 1), -10.07, 10.3)).toMatchObject({ kind: 'no-root' })
  })

  it('finds a double root as one touching root, and two roots closer than the spacing', () => {
    const double = solveRange((x) => (x - 1) ** 2, -10.07, 10.3)
    expect(double.kind === 'roots' && double.roots.length).toBe(1)
    expect(double.kind === 'roots' && double.roots[0].touching).toBe(true)
    expect(double.kind === 'roots' && double.roots[0].x).toBeCloseTo(1, 4)
    const quadruple = solveRange((x) => (x - 1) ** 4, -10.07, 10.3)
    expect(quadruple.kind === 'roots' && quadruple.roots.length).toBe(1)
    close(xs(solveRange((x) => (x - 1) * (x - 1.001), -10.07, 10.3)), [1, 1.001])
    expect(solveRange((x) => x * x + 1e-6, -10.07, 10.3).kind).toBe('no-root')
  })

  it('skips points with no value, and says when none had one', () => {
    close(xs(solveRange((x) => Math.sqrt(x) - (x - 2), -10.07, 10.3)), [4])
    expect(solveRange(() => Number.NaN, 0, 1)).toEqual({ kind: 'no-root', hadValue: false, rejected: 0 })
  })

  it('finds the three van der Waals roots for CO2 at 280 K and 5.5 MPa', () => {
    const [R, T, P, a, b] = [0.08314, 280, 55, 3.64, 0.04267]
    const roots = xs(solveRange((V) => (R * T) / (V - b) - a / V ** 2 - P, 0.05, 5))
    expect(Array.isArray(roots) && roots.length).toBe(3)
  })

  it('finds roots far apart in size, and refuses more than 100', () => {
    close(xs(solveRange((x) => (x - 1e-3) * (x - 1) * (x - 1e3), -2000, 2000)), [1e-3, 1, 1e3])
    expect(solveRange((x) => Math.sin(x), 0.5, 340).kind).toBe('too-many')
  })

  it('gives the same roots in the same order every time', () => {
    const f = (x: number) => Math.tan(x) - 1
    expect(solveRange(f, 0, 10)).toEqual(solveRange(f, 0, 10))
  })
})
