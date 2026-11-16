import { evaluateSheet } from '../math/evaluate.ts'
import { ABOVE, calls } from './sweepCalls.ts'

/**
 * The sweep's child process (docs/spec-v1.md section 14, M4e).
 * `src/math/sweep.test.ts` starts it with Node, which runs TypeScript as it
 * is, so this file and what it imports keep to syntax Node can strip. It runs
 * each call through the sheet and tells its parent before and after: a call
 * that freezes can't be stopped from inside, so the parent stops the process
 * and starts another after that call. Never imported: importing it runs it.
 *
 * `from` is the first call to run; `only` runs that one alone.
 */
const send = (message: object) => process.send?.(message)
const all = calls()
const from = Number(process.argv[2] ?? 0)
const until = process.argv[3] === 'only' ? from + 1 : all.length
for (let i = from; i < until; i++) {
  send({ start: i })
  const began = performance.now()
  evaluateSheet([{ id: 'a', source: [...ABOVE, all[i]].join('\n') }])
  send({ done: i, ms: performance.now() - began })
}
send({ end: true })
process.disconnect?.()
