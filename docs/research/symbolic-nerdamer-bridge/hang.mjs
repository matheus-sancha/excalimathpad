// PROTOTYPE, throwaway. Ticket #355: can nerdamer 2.1.0 run without bound on a sheet's input?
// Each case runs in its own worker thread with a wall-clock limit; the main thread
// terminates a worker that is still running, which is the test of "killable".
// Run (from the repo root): npm i --no-save nerdamer@2.1.0 && node docs/research/symbolic-nerdamer-bridge/hang.mjs [limitMs]
import { Worker } from 'node:worker_threads'

const LIMIT = Number(process.argv[2] ?? 5000)

const sumOfFractions = (k) => Array.from({ length: k }, (_, j) => `a${j}/b${j}`).join('+')
const nested = (k) => { let s = 'x'; for (let j = 0; j < k; j++) s = `a${j}/(${s})`; return s }
const nestedSqrt = (k) => { let s = 'x'; for (let j = 0; j < k; j++) s = `sqrt(${s}+a${j})`; return s }
const product = (k) => Array.from({ length: k }, (_, j) => `(x${j}+y${j})`).join('*')

export const CASES = [
  ['(a+b)^30', '(a+b)^30'],
  ['(a+b)^30 / (a+b)^29', '(a+b)^30/(a+b)^29'],
  ['(a+b+c+d)^12', '(a+b+c+d)^12'],
  ['(a+b)^200', '(a+b)^200'],
  ['2/x^2 - x^(2*z) (hangs math.js simplify)', '2/x^2 - x^(2*z)'],
  ['sum of 10 fractions', sumOfFractions(10)],
  ['sum of 20 fractions', sumOfFractions(20)],
  ['sum of 40 fractions', sumOfFractions(40)],
  ['nested fraction, 20 deep', nested(20)],
  ['nested fraction, 100 deep', nested(100)],
  ['nested sqrt, 20 deep', nestedSqrt(20)],
  ['product of 20 binomials', product(20)],
  ['product of 20 binomials / its first factor', `${product(20)}/(x0+y0)`],
  ['von Mises with 0.5 coefficients', 'sqrt(0.5*((s1-s2)^2+(s2-s3)^2+(s3-s1)^2))'],
  ['long decimal', '0.12345678912345678912345*x/0.987654321987654321'],
  ['2^(10^6)*x', '2^(10^6)*x'],
  ['10^100000*x', '10^100000*x'],
  ['9^9^9', '9^9^9'],
  ['x^(10^9)/x', 'x^(10^9)/x'],
  ['1e308*x*1e308', '1e308*x*1e308'],
  ['(x^2-1)/(x-1)', '(x^2-1)/(x-1)'],
  ['(a^10-b^10)/(a-b)', '(a^10-b^10)/(a-b)'],
]

const MODES = ['plain', 'simplify']

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads')
const nerdamer = require(workerData.path)
const t0 = performance.now()
try {
  const r = workerData.mode === 'simplify' ? nerdamer.simplify(workerData.input) : nerdamer(workerData.input)
  const num = r.numerator().toString(), den = r.denominator().toString()
  parentPort.postMessage({ ok: true, ms: performance.now() - t0, len: r.toString().length, num: num.slice(0, 60), den: den.slice(0, 60) })
} catch (e) {
  parentPort.postMessage({ ok: false, ms: performance.now() - t0, error: String(e.message).slice(0, 90) })
}`

function run(input, mode, path) {
  return new Promise((resolve) => {
    const started = performance.now()
    const w = new Worker(workerSource, { eval: true, workerData: { input, mode, path } })
    const timer = setTimeout(() => {
      w.terminate().then(() => resolve({ timeout: true, killedAfter: performance.now() - started }))
    }, LIMIT)
    w.once('message', (m) => { clearTimeout(timer); w.terminate(); resolve(m) })
    w.once('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: 'worker error: ' + e.message }) })
  })
}

const { createRequire } = await import('node:module')
const path = createRequire(import.meta.url).resolve('nerdamer')
console.log(`limit ${LIMIT} ms per case; nerdamer from ${path}`)
for (const [label, input] of CASES) {
  for (const mode of MODES) {
    const r = await run(input, mode, path)
    const what = r.timeout
      ? `TIMEOUT, worker killed after ${Math.round(r.killedAfter)} ms`
      : r.ok
        ? `${Math.round(r.ms)} ms, ${r.len} chars; num ${r.num} | den ${r.den}`
        : `error after ${Math.round(r.ms ?? 0)} ms: ${r.error}`
    console.log(`${label} [${mode}]: ${what}`)
  }
}
