// PROTOTYPE, throwaway. Ticket #355: the bridge's own path (plain parse, numerator, denominator,
// lcm of monomial denominators) on adversarial lines, timed. Run after bridge.mjs's install step:
// node docs/research/symbolic-nerdamer-bridge/bridge-stress.mjs
import { runSheet } from './bridge.mjs'

const names = (k, p) => Array.from({ length: k }, (_, j) => `${p}${j}`)
const sum = (k) => names(k, 'a').map((a, j) => `${a} / b${j}`).join(' + ')
const binomSum = (k) => names(k, 'a').map((a, j) => `${a} / (b${j} + c${j})`).join(' + ')
const nested = (k) => { let s = 'x'; for (let j = 0; j < k; j++) s = `a${j} / (${s})`; return s }
const CASES = [
  ['sum of 40 fractions', ['symbols ' + [...names(40, 'a'), ...names(40, 'b')].join(', '), `s = ${sum(40)}`]],
  ['sum of 12 fractions over binomials', ['symbols ' + [...names(12, 'a'), ...names(12, 'b'), ...names(12, 'c')].join(', '), `s = ${binomSum(12)}`]],
  ['nested fraction, 100 deep', ['symbols x, ' + names(100, 'a').join(', '), `s = ${nested(100)}`]],
  ['(a + b)^30 / (a + b)^29', ['symbols a, b', 's = (a + b)^30 / (a + b)^29']],
  ['2 / x^2 - x^(2 z)', ['symbols x, z', 's = 2 / x^2 - x^(2 z)']],
  ['(a + b)^200 * (a - b)^200 / (a^2 - b^2)', ['symbols a, b', 's = (a + b)^200 * (a - b)^200 / (a^2 - b^2)']],
  ['10^100000 * x', ['symbols x', 's = 10^100000 * x']],
  ['10^1000000 * x', ['symbols x', 's = 10^1000000 * x']],
  ['chain of 30 formulas, each the one above squared over 2', ['symbols x', 'f0 = x / 2', ...Array.from({ length: 30 }, (_, j) => `f${j + 1} = f${j}^2 / 2`)]],
]
for (const [label, lines] of CASES) {
  const t = performance.now()
  const rows = runSheet(lines)
  const last = rows.at(-1)
  const ms = Math.round(performance.now() - t)
  console.log(`${label}: ${ms} ms; ${last.error ? 'error: ' + last.error : (last.B.length > 100 ? last.B.slice(0, 100) + '... (' + last.B.length + ' chars)' : last.B)}`)
}
