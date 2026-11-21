import { describe, expect, it } from 'vitest'
import { evaluateSheet, type EnglishLine as SheetLine } from '../test/english.ts'
import { MAX_POINTS } from './lists.ts'
import { SLOW_ARGUMENTS, SLOW_BIG, SLOW_PAIRS, SLOW_VALUES } from './limits.ts'

/**
 * math.js's own range and builders take the sheet's limit (docs/spec-v1.md
 * section 10, Ranges and lists, M4e): one test per message row of section 13
 * and per shown form of a matrix. That every function answers in time is the
 * sweep's (`sweep.test.ts`).
 */

const run = (...lines: string[]): SheetLine[] => evaluateSheet([{ id: 'a', source: lines.join('\n') }]).get('a')!
/** The last line's result. */
const last = (...lines: string[]) => run(...lines).at(-1)!.result
const errorOf = (...lines: string[]) => {
  const result = last(...lines)
  return result.kind === 'error' ? result.message : `no error: ${JSON.stringify(result)}`
}

describe('the messages (section 13, Ranges, tables, plots)', () => {
  it.each([
    ['1:1e7', '1:1e7 has more than 10,000 points'],
    ['0:1e-7:1', '0:1e-7:1 has more than 10,000 points'],
  ])('`a:b` with too many points: %s', (line, message) => {
    expect(errorOf(line)).toBe(message)
  })

  it.each([
    ['zeros(1e8)', 'zeros(1e8) has more than 10,000 values'],
    ['ones(3000, 3000)', 'ones(3000, 3000) has more than 10,000 values'],
    ['nthRoots(2, 1e7)', 'nthRoots(2, 1e7) has more than 10,000 values'],
  ])('a builder with too many values: %s', (line, message) => {
    expect(errorOf(line)).toBe(message)
  })

  it.each([
    ['log(0):5', "a range's ends must be finite numbers: log(0) is -∞"],
    ['1:1/0', "a range's ends must be finite numbers: 1/0 is ∞"],
    ['0:1/0:5', "a range's ends must be finite numbers: 1/0 is ∞"],
    ['0:0/0', "a range's ends must be finite numbers: 0/0 is not a number"],
  ])('an end of `a:b` that isn’t a finite number: %s', (line, message) => {
    expect(errorOf(line)).toBe(message)
  })

  it('a call that is slow without building anything large', () => {
    expect(errorOf('combinations(1e9, 5e8)')).toBe('combinations(1e9, 5e8) is too large to compute')
  })

  it('the sheet’s own range keeps its words', () => {
    expect(errorOf('Q_s = 0 .. 1e9')).toBe('Q_s has more than 10,000 points')
  })
})

describe('the limit', () => {
  it('is one number, shared with the sheet’s own range: 10,000 is allowed, one more refused', () => {
    expect(MAX_POINTS).toBe(10_000)
    expect(last('identity(100)').kind).toBe('list')
    expect(errorOf('identity(101)')).toBe('identity(101) has more than 10,000 values')
    expect(last('1:10000').kind).toBe('list')
    expect(errorOf('1:10001')).toBe('1:10001 has more than 10,000 points')
    expect(last('zeros(100, 100)').kind).toBe('list')
    expect(errorOf('zeros(100, 101)')).toBe('zeros(100, 101) has more than 10,000 values')
  })

  it('names the call as typed, inside a longer line and with names for its arguments', () => {
    expect(errorOf('n = 1e8', 'x = zeros(n) + 1')).toBe('zeros(n) has more than 10,000 values')
    expect(errorOf('zeros(2) + zeros(1e8)')).toBe('zeros(1e8) has more than 10,000 values')
    expect(errorOf('n = 1e7', 'sum(1:n)')).toBe('1:n has more than 10,000 points')
    expect(errorOf('a = 0', 'log(a):5')).toBe("a range's ends must be finite numbers: log(a) is -∞")
  })

  it('leaves the names below a refused line with an error above', () => {
    const lines = run('x = 1:1e7', 'x + 1')
    expect(lines[0].variables).toEqual([{ name: 'x', kind: 'error' }])
    expect(lines[1].result).toEqual({ kind: 'error', message: 'x has an error above' })
  })

  it.each([
    ['range(0, 1e8)', 'range(0, 1e8) has more than 10,000 points'],
    ['range("0:1e8")', 'range("0:1e8") has more than 10,000 points'],
    ['zeros([3000, 3000])', 'zeros([3000, 3000]) has more than 10,000 values'],
    ['ones(1e8, "sparse")', 'ones(1e8, "sparse") has more than 10,000 values'],
    ['identity(3000, 3000)', 'identity(3000, 3000) has more than 10,000 values'],
    ['random([3000, 3000])', 'random([3000, 3000]) has more than 10,000 values'],
    ['zeros(bignumber(1e8))', 'zeros(bignumber(1e8)) has more than 10,000 values'],
  ])('checks every form of a size: %s', (line, message) => {
    expect(errorOf(line)).toBe(message)
  })

  it.each([
    ['kron(m, m)', 'kron(m, m) has more than 10,000 values'],
    ['concat(v, v)', 'concat(v, v) has more than 10,000 values'],
    ['resize(m, [3000, 3000])', 'resize(m, [3000, 3000]) has more than 10,000 values'],
    ['diag(v)', 'diag(v) has more than 10,000 values'],
    ['setCartesian(w, w)', 'setCartesian(w, w) has more than 10,000 values'],
    ['setPowerset(w)', 'setPowerset(w) has more than 10,000 values'],
    ['pickRandom(w, 1e8)', 'pickRandom(w, 1e8) has more than 10,000 values'],
    ['c * r', 'c * r has more than 10,000 values'],
  ])('checks a result that passes the limit from legal arguments: %s', (line, message) => {
    expect(errorOf('v = 1:10000', 'm = identity(100)', 'w = 1:100', 'c = reshape(1:10000, [10000, 1])', 'r = reshape(1:10000, [1, 10000])', line)).toBe(message)
  })

  it('refuses a list times a matrix, which would hold a matrix at every point', () => {
    const result = last('q = 0 .. 200', 'm = identity(10)', 'q * m')
    expect(result).toMatchObject({ kind: 'list', failed: expect.stringContaining('q * m has more than 10,000 values') as string })
    // A small one is a list of matrices, as before.
    expect(last('q = 0 .. 2', 'k = identity(2)', 'q * k')).toMatchObject({ kind: 'list', failed: null })
  })

  it('words a call refused inside a function from its values', () => {
    expect(errorOf('f(a) = zeros(a)', 'f(1e8)')).toMatch(/^in f\(.*\): zeros\(1e8\) has more than 10,000 values$/)
  })

  it('leaves small matrices as they were', () => {
    expect(last('inv([[1, 2], [3, 4]])')).toEqual({ kind: 'value', text: '[[-2, 1], [1.5, -0.5]]' })
    expect(last('det([[1, 2], [3, 4]])')).toEqual({ kind: 'value', text: '-2' })
    expect(last('cross([1, 0, 0], [0, 1, 0])')).toEqual({ kind: 'value', text: '[0, 0, 1]' })
    expect(last('sum(1:100)')).toEqual({ kind: 'value', text: '5050' })
    expect(last('m = identity(100)', 'det(m * m)')).toEqual({ kind: 'value', text: '1' })
  })
})

describe('slow calls (section 14: the bounds)', () => {
  it('answers ∞ at once where math.js already does', () => {
    expect(last('1e8!')).toEqual({ kind: 'value', text: '∞' })
    expect(last('9^9^9')).toEqual({ kind: 'value', text: '∞' })
    expect(last('gamma(1e7)')).toEqual({ kind: 'value', text: '∞' })
    expect(last('cosh(1e8)')).toEqual({ kind: 'value', text: '∞' })
  })

  it.each(Object.entries(SLOW_ARGUMENTS).filter(([name]) => name !== 'isPrime'))('%s is allowed at its bound and refused past it', (name, most) => {
    const call = (n: number) => (['bellNumbers', 'bernoulli', 'catalan'].includes(name) ? `${name}(${n})` : `${name}(${n}, 2)`)
    expect(errorOf(call(most))).not.toMatch(/ is too large to compute$/)
    expect(errorOf(call(most + 1))).toBe(`${call(most + 1)} is too large to compute`)
  })

  it('keeps the everyday calls of a bounded function', () => {
    expect(last('combinations(52, 5)')).toEqual({ kind: 'value', text: '2.599·10⁶' })
    expect(last('permutations(5, 2)')).toEqual({ kind: 'value', text: '20' })
    expect(last('isPrime(97)')).toEqual({ kind: 'value', text: 'true' })
    expect(last('format(pi, 3)')).toEqual({ kind: 'value', text: '3.14' })
    expect(last('setUnion([1, 2], [2, 3])')).toEqual({ kind: 'value', text: '[1, 3, 2]' })
    expect(last('quantileSeq([1, 2, 3, 4], 0.5)')).toEqual({ kind: 'value', text: '2.5' })
    // At their bound, and with every value equal, the slow case.
    expect(last('median(zeros(5000))')).toEqual({ kind: 'value', text: '0' })
    expect(last('median(1:5000)')).toEqual({ kind: 'value', text: '2501' })
    expect(last('quantileSeq(zeros(5000), 0.5)')).toEqual({ kind: 'value', text: '0' })
  })

  it.each([
    ['isPrime(1/0)', 'isPrime(1/0) is too large to compute'],
    ['format(pi, 1e8)', 'format(pi, 1e8) is too large to compute'],
    ['format(pi, {precision: 1e8})', 'format(pi, {"precision": 1e8}) is too large to compute'],
    ['cosh(bignumber(1e8))', 'cosh(bignumber(1e8)) is too large to compute'],
    ['setUnion(v, v)', 'setUnion(v, v) is too large to compute'],
    ['fft(v)', 'fft(v) is too large to compute'],
    ['quantileSeq(v, 3000)', 'quantileSeq(v, 3000) is too large to compute'],
    ['median(v)', 'median(v) is too large to compute'],
    ['median(zeros(5001))', 'median(zeros(5001)) is too large to compute'],
    ['quantileSeq(v, 0.5)', 'quantileSeq(v, 0.5) is too large to compute'],
  ])('refuses %s', (line, message) => {
    expect(errorOf('v = 1:10000', line)).toBe(message)
  })

  it('lists a bound for every kind of slow call the sweep found', () => {
    for (const bounds of [SLOW_ARGUMENTS, SLOW_BIG, SLOW_VALUES, SLOW_PAIRS]) {
      expect(Object.keys(bounds).length).toBeGreaterThan(0)
      for (const most of Object.values(bounds)) expect(most).toBeGreaterThan(0)
    }
  })
})

describe('a large matrix is summarised where it is shown (section 10)', () => {
  it('shows a matrix or a math.js range of up to 20 values whole', () => {
    expect(last('1:5')).toEqual({ kind: 'value', text: '[1, 2, 3, 4, 5]' })
    expect(last('1:20')).toMatchObject({ kind: 'value' })
    expect(last('identity(4)')).toMatchObject({ kind: 'value', text: '[[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]' })
  })

  it('shows a longer row of values as a list’s summary, its ends on hover', () => {
    const [line] = run('1:2000')
    expect(line.result).toEqual({ kind: 'list', text: '2000 values, 1 … 2000', failed: null })
    expect(line.listPreview).toBe('1: 1\n2: 2\n3: 3\n…\n1998: 1998\n1999: 1999\n2000: 2000')
    expect(last('1:21')).toEqual({ kind: 'list', text: '21 values, 1 … 21', failed: null })
  })

  it('shows a larger matrix by its size, its first and last rows on hover', () => {
    const [line] = run('identity(100)')
    expect(line.result).toEqual({ kind: 'list', text: '100 × 100 matrix', failed: null })
    expect(line.listPreview?.split('\n')).toEqual([
      '1: [1, 0, 0, …, 0, 0, 0]',
      '2: [0, 1, 0, …, 0, 0, 0]',
      '3: [0, 0, 1, …, 0, 0, 0]',
      '…',
      '98: [0, 0, 0, …, 1, 0, 0]',
      '99: [0, 0, 0, …, 0, 1, 0]',
      '100: [0, 0, 0, …, 0, 0, 1]',
    ])
    expect(last('ones(3, 7)')).toMatchObject({ kind: 'list', text: '3 × 7 matrix' })
    expect(last('zeros(10, 10, 10)')).toMatchObject({ kind: 'list', text: '10 × 10 × 10 matrix' })
  })

  it('writes the summary in the values’ unit and the line’s display unit', () => {
    expect(last('(1:30) * 2 mm')).toEqual({ kind: 'list', text: '30 values, 2 … 60 mm', failed: null })
    expect(last('(1:30) * 2 mm in m')).toEqual({ kind: 'list', text: '30 values, 0.002 … 0.06 m', failed: null })
  })

  it('shows the same summary in the Variables tab', () => {
    expect(run('x = 1:2000')[0].variables).toEqual([{ name: 'x', kind: 'list', text: '2000 values, 1 … 2000' }])
    expect(run('k = identity(100)')[0].variables).toEqual([{ name: 'k', kind: 'list', text: '100 × 100 matrix' }])
    expect(run('s = 1:5')[0].variables).toEqual([{ name: 's', kind: 'value', text: '[1, 2, 3, 4, 5]' }])
  })

  it('refuses nothing for being too big to show: a matrix at the limit still works below', () => {
    expect(last('k = identity(100)', 'k[2, 2] + sum(k)')).toEqual({ kind: 'value', text: '101' })
  })

  it('answers a range at the limit quickly: nothing is typeset whole', () => {
    const began = performance.now()
    run('v = 1:10000', 'k = identity(100)', 'v + v', 'k * k')
    expect(performance.now() - began).toBeLessThan(1000)
  })
})
