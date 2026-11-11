import { describe, expect, it } from 'vitest'
import { MAX_ITERATIONS, RELATIVE_TOLERANCE, solveNear } from './solver.ts'

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
