/**
 * The root finder behind a solve line (docs/spec-v1.md section 9): a bracket
 * found by stepping out from the guess, then Brent's method. Pure numbers
 * only: the engine hands it the residual in SI numbers, with NaN where the
 * equation has no value (outside its domain), and keeps everything about units
 * to itself (research: docs/research/solver-and-plot-libraries.md).
 *
 * - **Bracket:** points at the guess ± 0.1·s·1.6ⁿ, where s is the guess's size
 *   (1 for a zero guess), tried right then left for each n. A sign change
 *   between two neighbouring finite points on one side is a bracket. A NaN
 *   point is skipped, so the search never needs a value outside the domain
 *   (Colebrook at f ≤ 0).
 * - **Brent** (Brent 1973, ch. 4; Numerical Recipes' `zbrent`): stops when the
 *   bracket is within 1e-12 relative of the root, or the residual is exactly
 *   zero. More than 100 iterations is a failure, never a value.
 *
 * Deterministic: the same residual and guess give the same steps.
 */

/** Brent stops when the bracket is within this, relative to the root. */
export const RELATIVE_TOLERANCE = 1e-12
/** Brent iterations before the solve fails (section 9). */
export const MAX_ITERATIONS = 100
/** Steps out from the guess on each side: 1.6⁶⁰ is about 10¹², far past any sheet's range. */
const MAX_STEPS = 60

export type SolveOutcome =
  | {
      kind: 'root'
      x: number
      /** The residual at `x`. */
      residual: number
      /** The final bracket, low end first: `x` is one of its ends. */
      bracket: readonly [number, number]
      iterations: number
      /** Residual evaluations, the bracket search's included. */
      evaluations: number
    }
  /** No sign change was found. `searched` is the span of finite points tried, or null if none was. */
  | { kind: 'no-root'; searched: readonly [number, number] | null }
  | { kind: 'no-convergence'; iterations: number }

/**
 * Finds a root of `f` near `guess`. `f` returns NaN (or ±∞) where it has no
 * value; anything it throws is the caller's and passes through.
 */
export function solveNear(f: (x: number) => number, guess: number): SolveOutcome {
  let evaluations = 0
  const value = (x: number) => {
    evaluations++
    const y = f(x)
    return Number.isFinite(y) ? y : Number.NaN
  }

  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  const seen = (x: number) => {
    low = Math.min(low, x)
    high = Math.max(high, x)
  }

  const y0 = value(guess)
  if (y0 === 0) return { kind: 'root', x: guess, residual: 0, bracket: [guess, guess], iterations: 0, evaluations }
  if (!Number.isNaN(y0)) seen(guess)

  // The last finite point on each side, starting from the guess.
  const last = {
    right: Number.isNaN(y0) ? null : { x: guess, y: y0 },
    left: Number.isNaN(y0) ? null : { x: guess, y: y0 },
  }
  const scale = guess === 0 ? 1 : Math.abs(guess)
  for (let n = 0; n < MAX_STEPS; n++) {
    const step = 0.1 * scale * 1.6 ** n
    for (const side of ['right', 'left'] as const) {
      const x = side === 'right' ? guess + step : guess - step
      const y = value(x)
      if (Number.isNaN(y)) continue
      seen(x)
      if (y === 0) return { kind: 'root', x, residual: 0, bracket: [x, x], iterations: 0, evaluations }
      const before = last[side]
      last[side] = { x, y }
      if (before !== null && Math.sign(before.y) !== Math.sign(y)) {
        const outcome = brent(value, before.x, before.y, x, y)
        return outcome.kind === 'root' ? { ...outcome, evaluations } : outcome
      }
    }
  }
  return { kind: 'no-root', searched: low <= high ? [low, high] : null }
}

/** Brent's method on a bracket whose ends have opposite signs. */
function brent(
  f: (x: number) => number,
  a0: number,
  fa0: number,
  b0: number,
  fb0: number,
): SolveOutcome {
  let a = a0
  let b = b0
  let fa = fa0
  let fb = fb0
  let c = b
  let fc = fb
  let d = b - a
  let e = d
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    if (Math.sign(fb) === Math.sign(fc)) {
      c = a
      fc = fa
      d = b - a
      e = d
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b
      b = c
      c = a
      fa = fb
      fb = fc
      fc = fa
    }
    const tol = 2 * Number.EPSILON * Math.abs(b) + 0.5 * RELATIVE_TOLERANCE * Math.abs(b)
    const middle = 0.5 * (c - b)
    if (Math.abs(middle) <= tol || fb === 0) {
      const bracket: [number, number] = fb === 0 ? [b, b] : b < c ? [b, c] : [c, b]
      return { kind: 'root', x: b, residual: fb, bracket, iterations: iteration, evaluations: 0 }
    }
    if (Math.abs(e) >= tol && Math.abs(fa) > Math.abs(fb)) {
      // Inverse quadratic interpolation, or the secant when only two points differ.
      const s = fb / fa
      let p: number
      let q: number
      if (a === c) {
        p = 2 * middle * s
        q = 1 - s
      } else {
        const qa = fa / fc
        const r = fb / fc
        p = s * (2 * middle * qa * (qa - r) - (b - a) * (r - 1))
        q = (qa - 1) * (r - 1) * (s - 1)
      }
      if (p > 0) q = -q
      p = Math.abs(p)
      if (2 * p < Math.min(3 * middle * q - Math.abs(tol * q), Math.abs(e * q))) {
        e = d
        d = p / q
      } else {
        d = middle
        e = d
      }
    } else {
      d = middle
      e = d
    }
    a = b
    fa = fb
    b += Math.abs(d) > tol ? d : middle > 0 ? tol : -tol
    fb = f(b)
    // A hole in the domain inside the bracket: give up rather than guess.
    if (Number.isNaN(fb)) return { kind: 'no-root', searched: a0 < b0 ? [a0, b0] : [b0, a0] }
  }
  return { kind: 'no-convergence', iterations: MAX_ITERATIONS }
}
