import { cleanup } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { report, sheetChecker } from './test/sheetStates.tsx'

/**
 * The odd-values probe (docs/spec-v1.md section 14, M4e): values of kinds no
 * guide example uses (complex, complex with a unit, matrices, strings, `1/0`,
 * odd ranges) sent through every use a line has for a value, each bare,
 * bracketed and assigned to a name a later line, a table and a plot read.
 * About 40,000 sheets through the engine and the view, about 8 minutes: too
 * slow for `npm run check`, so it is run by hand before a release,
 * `npm run test:probe` (the release checklist, `CONTRIBUTING.md`). It fails as
 * the typing test does: on any throw, and on any line that reaches the
 * per-line guard.
 */

const VALUES = [
  '2', '2 m', 'i', '2 i', '2 i m', 'sqrt(-4)', 'sqrt(-4 m^2)', '[1, 2, 3]', '[1, 2] m', '[[1, 2], [3, 4]]', '[]', '"text"', 'true',
  '1/0', '-1/0', '0/0', '1e400', '1e-400', '1e308 m', 'null', 'undefined', 'NaN', 'Infinity', 'pi', 'e', '50%', '3 degC', '3 degF',
  '0 .. 5', '0 .. 5 step 1', '0 m .. 5 m step 1 m', '0 .. 0', '5 .. 0', '0 .. 5 step 0', '0 .. 5 step -1', '0 .. 1e9', '0 .. 5 step i',
  'i .. 5', '0 .. 2 pi step pi / 90', '0 m .. 1 mm step 1 m', '0 .. 5 step 1e-9', '"a" .. "b"', '[1,2] .. [3,4]', '0 .. 5 m',
  '1:5', 'x', 'sin', 'f', '2 m + 3 s', 'bignumber(2)', 'fraction(1, 3)', 'complex(1, 2) m', '1 m / 0', 'unit("5 cm")', '{a: 1}', '2 kg m / s^2', '-0', '1 mol', '2 USD',
]

// `v` is the value above, `w` a list (0 .. 4), `u` a unit quantity.
const USES = [
  'v', 'v in mm', 'v in %', 'v to mm', 'v * i', 'v i', 'v * w', 'w * v', 'v * u', 'v + w', 'v ^ w', 'w ^ v', 'sqrt(v)', 'sqrt(w - v)', 'log(w - 2) * v', 'cos(w) v', 'v[1]', 'v[0]', 'v[99]', 'w[v]',
  'if(v > 1, "a", "b")', 'if(w > v, v, w)', 'v == v', 'v > w', 'min(v)', 'max(v, w)', 'sum(v)', 'abs(v)', 'round(v)', 'number(v)', 'string(v)', 'format(v)',
  'g(a) = v * a', 'g(a) = a + v', 'h(a) = a\nh(v)', 'h(a) = a\nh(w) * v', 'h(a) = sqrt(a)\nh(w - v)',
  'table(v)', 'table(w, v)', 'table(w, w * v)', 'table(v, w)', 'table(w in mm, v in mm)', 'table(v, v) @bold if v > 1',
  'plot(v)', 'plot(w, v)', 'plot(w, w * v)', 'plot(v, w)', 'plot(w, w), mark v', 'plot(w, w), x v .. 5', 'plot(w, w), y 0 .. v', 'plot(w, w * v), log y', 'plot(w, w - v), log x, log y', 'plot(w, w), title v', 'plot(w, w), size v', 'plot(w * v, w * v in mm)',
  'solve v = a', 'solve a^2 = v', 'solve a^2 = v, guess a = v', 'solve a = 1, guess a = v', 'solve a^2 = 4 for a in v', 'solve a * v = w',
  'v @bold', 'v @text-red if result > 1', 'v @bold if result == "text"', 'v @bold if v', 'v @bold if result > w', 'v @bold if', 'v @text-green if result == v @bold', 'v # note', 'v "note"',
  'k = v', 'k = v in mm', 'k = v\nk in mm', 'k = v\nk * w in mm', 'k = v\ntable(w, k)', 'k = v\nplot(w, k w)', 'v = 2', 'v .. 5', '0 .. v', '0 .. 5 step v', 'v .. v step v', 'k = 0 .. v\nk in mm', 'k = 0 .. 5 step v\ntable(k)', 'k = v .. 5\nplot(k, k)',
]

/** The lines above every probed text. */
const ABOVE = ['w = 0 .. 4', 'u = 3 mm', 'f(a) = a^2']

/** A use that can be given a name: the throw of #179 needed one, in the Variables tab's summary. */
const named = (text: string) =>
  /^[\w(), ]+=|\n|^(table|plot|solve)\b|@|#|"note"/.test(text)
    ? []
    : [`k = ${text}`, `k = ${text}\nk`, `k = ${text}\ntable(w, k)`, `k = ${text}\nplot(w, k)`, `k = ${text} in mm`, `k(a) = ${text}\nk(w)`, `k(a) = ${text}\nq = k(w)`]

it('sends odd values through every use of a value, in the engine and the view', { timeout: 3_600_000 }, async () => {
  const checker = await sheetChecker()
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
  for (const value of VALUES) {
    for (const use of USES) {
      const bracketed = use.replace(/\bv\b/g, `(${value})`)
      const bare = use.replace(/\bv\b/g, value)
      for (const text of new Set([bracketed, bare, ...named(bracketed), ...named(bare)])) {
        checker.check(`${value} in ${JSON.stringify(use)}`, [...ABOVE, ...text.split('\n')], null, ABOVE.length)
      }
    }
    cleanup()
  }
  errors.mockRestore()

  expect(checker.states()).toBeGreaterThan(30_000)
  expect(report(checker.findings), `${checker.findings.length} findings`).toBe('')
})
