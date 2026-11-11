import type { MathNode } from 'mathjs'
import { usedNames } from './warnings.ts'

/**
 * Sheet functions and their messages (docs/spec-v1.md section 3, Function
 * definitions; wording in section 13, Functions). Pure: math.js errors come in
 * as thrown values, and how a value reads (for `in k(1 s): …`) as `show`.
 *
 * A function the sheet defines is wrapped once its definition has run, so a
 * call can say what went wrong in the sheet's words:
 * - the wrong number of arguments: `h needs 2 arguments, got 1`;
 * - recursion with no end: `loop calls itself without end`, at a fixed depth,
 *   before the browser's stack runs out (recursion with an end still works);
 * - an error inside the body, named on the calling line: `in k(1 s): …`.
 *
 * The wrapper is an ordinary function, so late binding, recursion and
 * functions as values (`r = q`) work as math.js's own.
 */

/** A message already in the sheet's words, so outer calls don't reword it. */
export class SheetError extends Error {
  /** Final: the message goes to the line as it is, with no `in f(…):` around it. */
  readonly final: boolean

  constructor(message: string, final = false) {
    super(message)
    this.final = final
  }
}

/** What the app knows about a sheet function, kept on its wrapper. */
export interface SheetFunctionInfo {
  name: string
  params: readonly string[]
}

export type SheetFunction = ((...args: unknown[]) => unknown) & { sheetFunction: SheetFunctionInfo }

export function isSheetFunction(value: unknown): value is SheetFunction {
  return typeof value === 'function' && 'sheetFunction' in value
}

/** Deeper than any sheet needs, and well inside the browser's stack. */
const MAX_DEPTH = 200

/**
 * Wraps the sheet's functions for one run. `show` writes an argument in the
 * plain-text form of section 5; `lookup` reads the sheet's scope at call time.
 */
export function createCalls(show: (value: unknown) => string, lookup: (name: string) => unknown) {
  let depth = 0

  return {
    wrap(info: SheetFunctionInfo, body: MathNode, fn: (...args: unknown[]) => unknown): SheetFunction {
      const { name, params } = info
      const wrapped = (...args: unknown[]): unknown => {
        if (args.length !== params.length) {
          const noun = params.length === 1 ? 'argument' : 'arguments'
          throw new SheetError(`${name} needs ${params.length} ${noun}, got ${args.length}`)
        }
        if (depth >= MAX_DEPTH) throw new SheetError(`${name} calls itself without end`, true)
        depth++
        try {
          return fn(...args)
        } catch (error) {
          if (error instanceof SheetError && error.final) throw error
          if (error instanceof RangeError && /call stack/i.test(error.message)) {
            throw new SheetError(`${name} calls itself without end`, true)
          }
          const local = (n: string) => {
            const at = params.indexOf(n)
            return at === -1 ? lookup(n) : args[at]
          }
          const message = messageOf(error, body, local)
          throw new SheetError(`in ${name}(${args.map(argText).join(', ')}): ${message}`)
        } finally {
          depth--
        }
      }
      return Object.assign(wrapped, { sheetFunction: info })
    },
  }

  function argText(value: unknown): string {
    if (isSheetFunction(value)) return value.sheetFunction.name
    if (typeof value === 'function') return 'function'
    try {
      return show(value)
    } catch {
      return String(value)
    }
  }
}

/**
 * A thrown value in the sheet's words. `node` is the code that ran, and
 * `lookup` gives the value a name has there, to name a function used as a
 * number. Anything else keeps math.js's own message.
 */
export function messageOf(
  error: unknown,
  node: MathNode,
  lookup: (name: string) => unknown,
): string {
  if (error instanceof SheetError) return error.message
  const message = error instanceof Error ? error.message : String(error)
  const called = /^'(.+?)' is not a function/.exec(message)
  if (called) return `${called[1]} is a value, not a function: write ${called[1]} * (...) to multiply`
  const data = (error as { data?: { category?: string; actual?: unknown } }).data
  if (data?.category === 'wrongType' && Array.isArray(data.actual) && data.actual.includes('function')) {
    const name = usedNames(node).find((n) => typeof lookup(n) === 'function')
    if (name !== undefined) return `${name} is a function: call it with ${name}(...)`
  }
  return message
}
