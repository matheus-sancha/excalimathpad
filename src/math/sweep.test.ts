import { fork } from 'node:child_process'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { engineFunctionNames } from './evaluate.ts'
import { ARGUMENTS, calls } from '../test/sweepCalls.ts'

/**
 * The sweep test (docs/spec-v1.md section 14, M4e): every function math.js
 * exposes to a line is called through the sheet with huge arguments (`1e8`,
 * `(3000, 3000)`, an end that isn't finite) and with arguments at the limit
 * (a 10,000-point range, a 100 × 100 matrix), and each call must answer or
 * refuse within 1 s. A math.js update that adds a builder, or a function that
 * is slow for another reason, fails here until `limits.ts` bounds it.
 *
 * A call that freezes can't be stopped from inside its own thread, so the
 * calls run in a child process (`src/test/sweepChild.ts`): it says which call
 * it starts, and one still running after the limit is stopped with its
 * process, noted, and the sweep goes on from the next call. A call that only
 * reported a long time is run once more alone, so a pause of the machine
 * isn't taken for a slow call.
 */

const LIMIT_MS = 1000
// From the repository's root, where the tests run.
const CHILD = resolve('src/test/sweepChild.ts')

interface Message {
  start?: number
  done?: number
  ms?: number
  end?: boolean
}

/** Runs the calls from `from` on (or that one `only`) until the end or a call past the limit. */
function run(from: number, only: boolean): Promise<{ next: number; slow: number[]; stopped: number | null }> {
  return new Promise((resolve) => {
    const child = fork(CHILD, [String(from), ...(only ? ['only'] : [])], {
      execArgv: ['--max-old-space-size=1024'],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    })
    const slow: number[] = []
    let current = from
    let ended = false
    let stopped: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      // The process takes a moment to start before its first call.
      timer = setTimeout(() => {
        stopped = current
        child.kill('SIGKILL')
      }, LIMIT_MS + (current === from ? 5000 : 0))
    }
    arm()
    child.on('message', (message: Message) => {
      if (message.start !== undefined) {
        current = message.start
        arm()
      }
      if (message.done !== undefined && (message.ms ?? 0) > LIMIT_MS) slow.push(message.done)
      if (message.end) ended = true
    })
    child.on('exit', () => {
      clearTimeout(timer)
      // Gone without finishing and without being stopped: the call ran it out of memory.
      if (!ended && stopped === null) stopped = current
      resolve({ next: ended ? Infinity : current + 1, slow, stopped })
    })
  })
}

it('every function a line can call answers or refuses within 1 s, at huge arguments and at the limit', { timeout: 900_000 }, async () => {
  const all = calls()
  // math.js exposes about 250 functions to a line; each is called with every argument list.
  expect(engineFunctionNames().length).toBeGreaterThan(200)
  expect(all).toHaveLength(engineFunctionNames().length * ARGUMENTS.length)

  const failed: string[] = []
  const again: number[] = []
  for (let from = 0; from < all.length; ) {
    const { next, slow, stopped } = await run(from, false)
    again.push(...slow)
    if (stopped !== null) failed.push(`${all[stopped]}: no answer within ${LIMIT_MS} ms, or the process died`)
    from = next
  }
  for (const index of again) {
    const { slow, stopped } = await run(index, true)
    if (slow.length > 0 || stopped !== null) failed.push(`${all[index]}: over ${LIMIT_MS} ms`)
  }

  expect(failed).toEqual([])
})
