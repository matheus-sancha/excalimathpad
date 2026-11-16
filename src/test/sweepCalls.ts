import { engineFunctionNames } from '../math/evaluate.ts'

/**
 * The sweep's calls (docs/spec-v1.md section 14, M4e): every function math.js
 * exposes to a line, with each argument list below. The test
 * (`src/math/sweep.test.ts`) and its child process (`sweepChild.ts`) both
 * read them here.
 */

/** Above every probed call: a range and a matrix at the limit. */
export const ABOVE = ['v = 1:10000', 'm = identity(100)', 'w = 1:100']

/** Huge arguments, and arguments at the limit. */
export const ARGUMENTS = [
  '1e8',
  '1e8, 1e8',
  '3000, 3000',
  '[3000, 3000]',
  '2, 1e7',
  '1e7, 2',
  '1e9, 5e8',
  '1/0',
  '0, 1/0',
  '-1/0, 5',
  '0, 1e8, 1e-8',
  '"0:1e8"',
  '1e8, "sparse"',
  'bignumber(1e8)',
  'v',
  'v, v',
  "v', v",
  'v, 1e8',
  'v, 3000, 3000',
  'm',
  'm, m',
  'm, 1e8',
  'm, 3000',
  'm, [3000, 3000]',
  'm, m, m',
  'w, w',
  'w, 10000',
]

/** Every call of the sweep, in a fixed order. */
export function calls(): string[] {
  return engineFunctionNames().flatMap((name) => ARGUMENTS.map((args) => `${name}(${args})`))
}
