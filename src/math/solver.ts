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
  absolute = 0,
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
    const tol = 2 * Number.EPSILON * Math.abs(b) + 0.5 * RELATIVE_TOLERANCE * Math.abs(b) + absolute
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

/** Points sampled over a search range (section 9, Search range). */
export const RANGE_POINTS = 200
/** A crossing is a root only if its residual is at most this times its samples' larger one. */
export const CROSSING_CHECK = 1e-6
/** A dip touches zero when its minimum is within this of its neighbouring samples' size. */
export const TOUCH_THRESHOLD = 1e-9
/** More roots than this is an error (section 9, Roots). */
export const MAX_ROOTS = 100

export interface RangeRoot {
  x: number
  /** The residual at `x`. */
  residual: number
  /** Found by the dip pass: the residual only touches zero here. */
  touching: boolean
}

export type RangeOutcome =
  | {
      kind: 'roots'
      /** Ascending, at least one. */
      roots: readonly RangeRoot[]
      /** Sign changes rejected by the crossing check: poles and jumps. */
      rejected: number
      evaluations: number
    }
  /** No root. `hadValue` is false when no sample had a value. */
  | { kind: 'no-root'; hadValue: boolean; rejected: number }
  | { kind: 'too-many'; count: number }
  | { kind: 'no-convergence'; iterations: number }

/**
 * The roots of `f` found in `low .. high` (section 9, Search range): the
 * residual at 200 evenly spaced points, Brent on every sign change between two
 * neighbours that have a value, a crossing kept only if its residual is small
 * against its samples' (a pole or a jump isn't a root), and a dip pass where
 * three neighbours share a sign and the middle is closest to zero (golden
 * section): a minimum across zero is two roots, one within the threshold is a
 * touching root. Deterministic; anything `f` throws passes through.
 */
export function solveRange(f: (x: number) => number, low: number, high: number): RangeOutcome {
  let evaluations = 0
  const value = (x: number) => {
    evaluations++
    const y = f(x)
    return Number.isFinite(y) ? y : Number.NaN
  }
  const n = RANGE_POINTS
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const x = i === n - 1 ? high : low + ((high - low) * i) / (n - 1)
    xs.push(x)
    ys.push(value(x))
  }
  const roots: RangeRoot[] = []
  let rejected = 0
  // A root at 0 has no size to be relative to: the range's width gives a floor.
  const floor = (high - low) * 1e-15

  // Brent on [a, b], kept if it passes the crossing check. Null when rejected or lost in a hole.
  const cross = (a: number, fa: number, b: number, fb: number): RangeRoot | 'no-convergence' | null => {
    const outcome = brent(value, a, fa, b, fb, floor)
    if (outcome.kind === 'no-convergence') return 'no-convergence'
    if (outcome.kind !== 'root') return null
    if (Math.abs(outcome.residual) > CROSSING_CHECK * Math.max(Math.abs(fa), Math.abs(fb))) {
      rejected++
      return null
    }
    return { x: outcome.x, residual: outcome.residual, touching: false }
  }

  for (let i = 0; i < n; i++) {
    const y = ys[i]
    if (Number.isNaN(y)) continue
    if (y === 0) {
      roots.push({ x: xs[i], residual: 0, touching: false })
      continue
    }
    if (i === n - 1) continue
    const next = ys[i + 1]
    if (Number.isNaN(next) || next === 0 || Math.sign(next) === Math.sign(y)) continue
    const root = cross(xs[i], y, xs[i + 1], next)
    if (root === 'no-convergence') return { kind: 'no-convergence', iterations: MAX_ITERATIONS }
    if (root !== null) roots.push(root)
  }

  // The dip pass: a residual that turns back toward zero without changing sign.
  for (let i = 1; i < n - 1; i++) {
    const [a, y, b] = [ys[i - 1], ys[i], ys[i + 1]]
    if ([a, y, b].some((v) => Number.isNaN(v) || v === 0)) continue
    if (Math.sign(a) !== Math.sign(y) || Math.sign(b) !== Math.sign(y)) continue
    if (!(Math.abs(y) < Math.abs(a) && Math.abs(y) <= Math.abs(b))) continue
    const s = Math.sign(y)
    const bottom = goldenMinimum((x) => s * value(x), xs[i - 1], xs[i + 1])
    const fm = s * bottom.y
    if (Number.isNaN(fm)) continue
    if (fm === 0) {
      roots.push({ x: bottom.x, residual: 0, touching: true })
    } else if (Math.sign(fm) !== s) {
      for (const [p, fp, q, fq] of [
        [xs[i - 1], a, bottom.x, fm],
        [bottom.x, fm, xs[i + 1], b],
      ]) {
        const root = cross(p, fp, q, fq)
        if (root === 'no-convergence') return { kind: 'no-convergence', iterations: MAX_ITERATIONS }
        if (root !== null) roots.push(root)
      }
    } else if (Math.abs(fm) <= TOUCH_THRESHOLD * Math.max(Math.abs(a), Math.abs(b))) {
      roots.push({ x: bottom.x, residual: fm, touching: true })
    }
  }

  const sorted = distinct(roots.sort((p, q) => p.x - q.x), (high - low) * 1e-12)
  if (sorted.length > MAX_ROOTS) return { kind: 'too-many', count: sorted.length }
  if (sorted.length === 0) return { kind: 'no-root', hadValue: ys.some((y) => !Number.isNaN(y)), rejected }
  return { kind: 'roots', roots: sorted, rejected, evaluations }
}

/** Roots closer than `gap`, or within the solve's tolerance, are one root. */
function distinct(roots: RangeRoot[], gap: number): RangeRoot[] {
  const kept: RangeRoot[] = []
  for (const root of roots) {
    const last = kept[kept.length - 1]
    const near = last !== undefined && Math.abs(root.x - last.x) <= Math.max(gap, 4 * RELATIVE_TOLERANCE * Math.abs(root.x))
    if (!near) kept.push(root)
    else if (Math.abs(root.residual) < Math.abs(last.residual)) kept[kept.length - 1] = root
  }
  return kept
}

/** Golden-section search for the minimum of `g` on `[a, b]`; NaN counts as no minimum. */
function goldenMinimum(g: (x: number) => number, a0: number, b0: number): { x: number; y: number } {
  const ratio = (Math.sqrt(5) - 1) / 2
  const at = (x: number) => {
    const y = g(x)
    return Number.isNaN(y) ? Number.POSITIVE_INFINITY : y
  }
  let a = a0
  let b = b0
  let c = b - ratio * (b - a)
  let d = a + ratio * (b - a)
  let fc = at(c)
  let fd = at(d)
  for (let k = 0; k < 200 && Math.abs(b - a) > RELATIVE_TOLERANCE * (Math.abs(c) + Math.abs(d)) + 1e-300; k++) {
    if (fc < fd) {
      b = d
      d = c
      fd = fc
      c = b - ratio * (b - a)
      fc = at(c)
    } else {
      a = c
      c = d
      fc = fd
      d = a + ratio * (b - a)
      fd = at(d)
    }
    if (fc <= 0 || fd <= 0) break
  }
  const best = fc < fd ? { x: c, y: fc } : { x: d, y: fd }
  return { x: best.x, y: Number.isFinite(best.y) ? best.y : Number.NaN }
}
