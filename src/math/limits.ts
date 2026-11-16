import type { MathJsInstance, MathNode } from 'mathjs'
import { SheetError } from './functions.ts'
import { MAX_POINTS } from './lists.ts'

/**
 * The limit on math.js's own range and builders (docs/spec-v1.md section 10,
 * Ranges and lists, M4e): `a:b`, every function that takes a size or a count,
 * and every function whose result can pass the limit from legal arguments, are
 * checked on their arguments before math.js runs. No `try` can stop a call
 * that freezes the sheet or runs it out of memory, so the check comes first.
 * `MAX_POINTS` is the one number, shared with the sheet's own range.
 *
 * The engine hands in its math.js instance; this module never imports math.js
 * at run time. Only what a line can call is wrapped (`mathWithTransform`):
 * math.js's own code keeps calling the functions it was built with.
 */

/** `10,000`, as the messages write it. */
const LIMIT_TEXT = MAX_POINTS.toLocaleString('en-US')

/**
 * A call refused by the limit. `message` words it from the argument values
 * (`zeros(1e8) has more than 10,000 values`); the line that knows the code
 * that ran words it as typed (`wordLimit`).
 */
export class LimitError extends SheetError {
  /** The function refused, as a line calls it: `zeros`, `range` for `a:b`, `multiply` for `*`. */
  readonly fn: string
  /** What follows the call's text: ` has more than 10,000 values`, ` is too large to compute`. */
  readonly rest: string
  /** A range's end that isn't finite: which argument (0 start, 1 end, 2 step), how it reads, its value. */
  readonly end: { index: number; text: string; value: number } | null

  constructor(fn: string, call: string, rest: string, end: LimitError['end'] = null) {
    super(end ? `${NOT_FINITE}: ${end.text}` : `${call}${rest}`)
    this.fn = fn
    this.rest = rest
    this.end = end
  }
}

const NOT_FINITE = "a range's ends must be finite numbers"
const POINTS = ` has more than ${LIMIT_TEXT} points`
const VALUES = ` has more than ${LIMIT_TEXT} values`
const TOO_LARGE = ' is too large to compute'

/** A list line whose points would hold more than the limit between them (a list times a matrix). */
export function tooManyValues(text: string): SheetError {
  return new SheetError(`${text}${VALUES}`)
}

/**
 * The bounds on calls that are slow without building anything large (section
 * 14, M4e), found by the sweep: each keeps the call well inside its 1 s.
 * Past its bound a call is refused with "is too large to compute".
 *
 * - `SLOW_ARGUMENTS`: the largest size (absolute value) each numeric argument
 *   may have; an argument that isn't finite is past every bound.
 * - `SLOW_BIG`: the same, for a BigNumber argument only: with a plain number
 *   these answer `∞` at once.
 * - `SLOW_VALUES`: the most values a matrix argument may hold.
 * - `SLOW_PAIRS`: the largest product of the first two arguments' counts, for
 *   functions that compare or multiply every value with every other.
 */
export const SLOW_ARGUMENTS: Readonly<Record<string, number>> = {
  bellNumbers: 1000,
  bernoulli: 10_000,
  catalan: 1_000_000,
  combinations: 1_000_000,
  combinationsWithRep: 1_000_000,
  composition: 1_000_000,
  permutations: 1_000_000,
  stirlingS2: 1000,
  isPrime: Number.MAX_VALUE,
}
export const SLOW_BIG: Readonly<Record<string, number>> = {
  cosh: 10_000,
  sinh: 10_000,
  tanh: 10_000,
  coth: 10_000,
  csch: 10_000,
  sech: 10_000,
}
export const SLOW_VALUES: Readonly<Record<string, number>> = {
  fft: 4096,
  ifft: 4096,
  lyap: 900,
  mad: 2500,
  // math.js selects the middle value in quadratic time when many values are
  // equal: 10,000 zeros took 0.3 s here and over 1 s on a loaded CI runner.
  median: 5000,
  qr: 2500,
  quantileSeq: 5000,
  schur: 2500,
}
export const SLOW_PAIRS: Readonly<Record<string, number>> = {
  setUnion: 1_000_000,
  setIntersect: 1_000_000,
  setDifference: 1_000_000,
  setSymDifference: 1_000_000,
  setIsSubset: 1_000_000,
  freqz: 10_000,
  zpk2tf: 10_000,
}
/** A count, a precision or a number of digits past which a text or a set of quantiles is too long to build. */
const SLOW_COUNTS: Readonly<Record<string, { argument: number; most: number }>> = {
  format: { argument: 1, most: 1000 },
  print: { argument: 2, most: 1000 },
  bin: { argument: 1, most: 1000 },
  oct: { argument: 1, most: 1000 },
  hex: { argument: 1, most: 1000 },
  quantileSeq: { argument: 1, most: 100 },
  freqz: { argument: 2, most: 10_000 },
}

type Fn = (...args: unknown[]) => unknown

export function guardEngine(math: MathJsInstance): void {
  const visible = (math as unknown as { expression: { mathWithTransform: Record<string, unknown> } }).expression.mathWithTransform

  const isMatrix = (value: unknown): boolean => Array.isArray(value) || math.isMatrix(value)
  /** A matrix's dimensions; empty for a single value. */
  const dims = (value: unknown): number[] => (isMatrix(value) ? (math.size(value as never).valueOf() as number[]) : [])
  /** How many values a value holds: 1 for a single value. */
  const count = (value: unknown): number => dims(value).reduce((product, n) => product * n, 1)
  /** A number from a number, a BigNumber, a fraction or a bigint; NaN for anything else. */
  const numberOf = (value: unknown): number => {
    if (typeof value === 'number') return value
    if (typeof value === 'bigint') return Number(value)
    if (math.isBigNumber(value) || math.isFraction(value)) return Number((value as { toString: () => string }).toString())
    return NaN
  }
  /** The sizes a builder was asked for: its numeric arguments, a size list flattened; texts set aside. */
  const sizes = (args: readonly unknown[]): number[] =>
    args.flatMap((arg) =>
      typeof arg === 'string' ? [] : isMatrix(arg) ? ((math.flatten(arg as never) as { valueOf: () => unknown }).valueOf() as unknown[]).map(numberOf) : [numberOf(arg)],
    )
  const product = (numbers: readonly number[]) => numbers.reduce((total, n) => total * Math.abs(n), 1)

  /** An argument as a line would write it: a matrix too large to write is `…`. */
  const write = (value: unknown): string => {
    if (typeof value === 'string') return `"${value}"`
    if (typeof value === 'number') return numberText(value)
    if (isMatrix(value) && count(value) > 4) return '…'
    try {
      return compact(math.format(value))
    } catch {
      return '…'
    }
  }
  const callText = (name: string, args: readonly unknown[]) => `${name}(${args.map(write).join(', ')})`
  const refuse = (name: string, args: readonly unknown[], rest: string) => new LimitError(name, callText(name, args), rest)

  /** What each builder would build, read from its arguments. A size that isn't a number is math.js's own error. */
  const builds: Record<string, (args: readonly unknown[]) => number> = {
    zeros: (args) => product(sizes(args)),
    ones: (args) => product(sizes(args)),
    identity: (args) => {
      const asked = sizes(args)
      return asked.length === 1 ? asked[0] * asked[0] : product(asked)
    },
    // `random([m, n])` builds; `random(max)` is one number.
    random: (args) => (isMatrix(args[0]) ? product(sizes([args[0]])) : 1),
    randomInt: (args) => (isMatrix(args[0]) ? product(sizes([args[0]])) : 1),
    matrixFromFunction: (args) => (isMatrix(args[0]) ? product(sizes([args[0]])) : 1),
    nthRoots: (args) => numberOf(args[1] ?? 2),
    pickRandom: (args) => (args.length > 1 && !isMatrix(args[1]) ? numberOf(args[1]) : 1),
    resize: (args) => product(sizes([args[1]])),
    // A vector becomes a square matrix, wider by the offset.
    diag: (args) => {
      const size = dims(args[0])
      if (size.length !== 1) return 1
      const offset = numberOf(args[1])
      const side = size[0] + (Number.isNaN(offset) ? 0 : Math.abs(offset))
      return side * side
    },
    kron: (args) => count(args[0]) * count(args[1]),
    concat: (args) => args.reduce<number>((total, arg) => total + (isMatrix(arg) ? count(arg) : 0), 0),
    setCartesian: (args) => count(args[0]) * count(args[1]) * 2,
    // Every subset, each half the set long on average.
    setPowerset: (args) => 2 ** count(args[0]) * Math.max(1, count(args[0]) / 2),
    multiply: (args) => {
      // A column times a row, and the like: rows of the first by columns of the last.
      let size = dims(args[0])
      for (const arg of args.slice(1)) {
        const next = dims(arg)
        if (next.length === 0) continue
        if (size.length === 0) size = next
        else if (size.length === 2 && next.length === 2) size = [size[0], next[1]]
        else if (size.length === 2 && next.length === 1) size = [size[0]]
        else if (size.length === 1 && next.length === 2) size = [next[1]]
        else size = []
      }
      return product(size)
    },
  }

  /** `a:b`, and `range(start, end[, step])` or `range("a:b")`: in a line both count their end. */
  const range = (args: readonly unknown[]) => {
    let parts = args.filter((arg) => typeof arg !== 'boolean')
    const asText = typeof parts[0] === 'string'
    if (asText) {
      parts = (parts[0] as string).split(':').map((part) => Number(part))
      if (parts.length === 3) parts = [parts[0], parts[2], parts[1]]
    }
    const numbers = [numberOf(parts[0]), numberOf(parts[1]), parts.length > 2 ? numberOf(parts[2]) : 1]
    const text = asText ? callText('range', args) : (parts.length > 2 ? [parts[0], parts[2], parts[1]] : parts).map(write).join(':')
    numbers.forEach((value, index) => {
      const given = index < parts.length ? parts[index] : 1
      if (value === Infinity || value === -Infinity || (Number.isNaN(value) && typeof given === 'number')) {
        const which = index === 2 ? 'the step' : index === 1 ? 'the end' : 'the start'
        throw new LimitError('range', text, '', { index, text: `${which} is ${infinite(value)}`, value })
      }
    })
    const [start, end, step] = numbers
    // Anything else that isn't a number (a text, a matrix) is math.js's own error.
    if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(step) || step === 0) return
    if (Math.floor((end - start) / step + 1e-9) + 1 > MAX_POINTS) throw new LimitError('range', text, POINTS)
  }

  for (const name of Object.keys(visible)) {
    const real = visible[name]
    if (typeof real !== 'function') continue
    const build = Object.hasOwn(builds, name) ? builds[name] : null
    const most = Object.hasOwn(SLOW_ARGUMENTS, name) ? SLOW_ARGUMENTS[name] : null
    const mostBig = Object.hasOwn(SLOW_BIG, name) ? SLOW_BIG[name] : null
    const mostValues = Object.hasOwn(SLOW_VALUES, name) ? SLOW_VALUES[name] : null
    const mostPairs = Object.hasOwn(SLOW_PAIRS, name) ? SLOW_PAIRS[name] : null
    const counted = Object.hasOwn(SLOW_COUNTS, name) ? SLOW_COUNTS[name] : null
    if (name !== 'range' && !build && most === null && mostBig === null && mostValues === null && mostPairs === null && !counted) continue
    const guarded = function (this: unknown, ...args: unknown[]) {
      if (name === 'range') range(args)
      if (build && build(args) > MAX_POINTS) throw refuse(name, args, VALUES)
      const slow =
        (most !== null && args.some((arg) => !isMatrix(arg) && tooBig(numberOf(arg), most))) ||
        (mostBig !== null && args.some((arg) => math.isBigNumber(arg) && tooBig(numberOf(arg), mostBig))) ||
        (mostValues !== null && args.some((arg) => count(arg) > mostValues)) ||
        (mostPairs !== null && count(args[0]) * count(args[1]) > mostPairs) ||
        (counted !== null && tooLong(args[counted.argument], counted.most))
      if (slow) throw refuse(name, args, TOO_LARGE)
      return (real as Fn).apply(this, args)
    }
    // math.js reads its markers (raw arguments, the signatures) off the function.
    Object.assign(guarded, real)
    Object.defineProperty(guarded, 'name', { value: name })
    visible[name] = guarded
  }

  /** Past the bound, or not finite. A value that isn't a number at all is math.js's own error. */
  function tooBig(value: number, most: number): boolean {
    return !Number.isNaN(value) && !(Math.abs(value) <= most)
  }
  /** A count or a precision past `most`, as a number or inside options (`{precision: 1e8}`). */
  function tooLong(value: unknown, most: number): boolean {
    if (value !== null && typeof value === 'object' && !isMatrix(value) && !math.isBigNumber(value) && !math.isFraction(value)) {
      return Object.values(value as Record<string, unknown>).some((inner) => typeof inner === 'number' && tooBig(inner, most))
    }
    return !isMatrix(value) && tooBig(numberOf(value), most) && numberOf(value) > 1
  }
}

/**
 * How many values a value holds, for the summary of a large matrix and for a
 * list line's total: its dimensions, or null for a single value.
 */
export function matrixSize(math: MathJsInstance, value: unknown): number[] | null {
  return Array.isArray(value) || math.isMatrix(value) ? (math.size(value as never).valueOf() as number[]) : null
}

/**
 * A refused call in the words of the line that ran it (section 13): the call
 * as typed, `kron(m, m) has more than 10,000 values`, and a range's end that
 * isn't finite by its own code, `log(0) is -∞`. It finds the call by running
 * each candidate again, innermost first: a refused call stops at its check,
 * so this costs little, and only on the error's path. Where the code can't
 * be run again here (inside a function, at one point of a list), the error's
 * own message stands, worded from the values.
 */
export function wordLimit(error: LimitError, node: MathNode, scope: object): string {
  const candidates: MathNode[] = []
  const visit = (inner: MathNode) => {
    inner.forEach((child) => visit(child))
    const shape = inner as unknown as { type: string; fn?: unknown; name?: string }
    const called = shape.type === 'FunctionNode' ? (shape.fn as { name?: string }).name : shape.type === 'RangeNode' ? 'range' : shape.type === 'OperatorNode' ? shape.fn : undefined
    if (called === error.fn) candidates.push(inner)
  }
  visit(node)
  for (const candidate of candidates) {
    try {
      candidate.evaluate(scope)
    } catch (again) {
      if (!(again instanceof LimitError) || again.fn !== error.fn) continue
      if (again.end === null) return `${codeText(candidate)}${again.rest}`
      const range = candidate as unknown as { type: string; start?: MathNode; end?: MathNode; step?: MathNode | null }
      const end = range.type === 'RangeNode' ? [range.start, range.end, range.step][again.end.index] : undefined
      return end ? `${NOT_FINITE}: ${codeText(end)} is ${infinite(again.end.value)}` : again.message
    }
  }
  return error.message
}

/** `1e+7` as a line writes it, `1e7`; and `Infinity` as the sheet shows it. */
function compact(text: string): string {
  return text.replace(/e\+/g, 'e').replace(/-?Infinity/g, (match) => infinite(match.startsWith('-') ? -Infinity : Infinity))
}

/** A number as it is most likely typed: `3000`, `1000001`, and from a million up `1e7` where that is shorter. */
function numberText(value: number): string {
  if (!Number.isFinite(value)) return infinite(value)
  const plain = String(value).replace(/e\+/, 'e')
  const short = value.toExponential().replace(/e\+/, 'e')
  return Math.abs(value) >= 1e6 && short.length < plain.length ? short : plain
}

function infinite(value: number): string {
  return Number.isNaN(value) ? 'not a number' : value < 0 ? '-∞' : '∞'
}

/** Code as a line writes it, close up: `1:1e7`, `1/0`, `zeros(1e8)`. */
export function codeText(node: MathNode): string {
  return compact(
    node.toString({
      handler: (inner: MathNode, options: object): string | undefined => {
        const constant = inner as unknown as { type: string; value?: unknown }
        if (constant.type === 'ConstantNode' && typeof constant.value === 'number') return numberText(constant.value)
        const operator = inner as unknown as { type: string; op?: string; args?: MathNode[]; fn?: string }
        if (operator.type === 'OperatorNode' && operator.args?.length === 2 && (operator.op === '/' || operator.op === '^')) {
          return `${operator.args[0].toString(options)}${operator.op}${operator.args[1].toString(options)}`
        }
        return undefined
      },
    }),
  )
}
