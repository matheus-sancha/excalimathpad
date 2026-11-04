import { describe, expect, it, vi } from 'vitest'
import { evaluateSheet, type LineResult } from './evaluate.ts'

/** Evaluates blocks (in reading order) as one sheet; results per block, in order. */
function sheet(...sources: string[]): LineResult[][] {
  const results = evaluateSheet(sources.map((source, i) => ({ id: `b${i}`, source })))
  return sources.map((_, i) => results.get(`b${i}`)!)
}

/** A sheet of one block. */
const block = (source: string) => sheet(source)[0]

const value = (text: string): LineResult => ({ kind: 'value', text })
const error = (message: string): LineResult => ({ kind: 'error', message })
const empty: LineResult = { kind: 'empty' }

describe('evaluateSheet', () => {
  describe('one block', () => {
    it('evaluates I * R with units to 20 V (milestone M1)', () => {
      expect(block('R = 10 kohm\nI = 2 mA\nI * R')).toEqual([
        empty,
        empty,
        value('20 V'),
      ])
    })

    it('reports incompatible units as an error on that line only', () => {
      const results = block('R = 10 kohm\nI = 2 mA\nR + I\nI * R')

      expect(results[2]).toEqual(error('Units do not match'))
      expect(results[3]).toEqual(value('20 V'))
    })

    // Also pins math.js's wording, which the "defined below" and "has an
    // error above" messages rely on.
    it('keeps evaluating after an undefined symbol or function', () => {
      expect(block('foo + 1\ng(1)\n2 + 2')).toEqual([
        error('Undefined symbol foo'),
        error('Undefined function g'),
        value('4'),
      ])
    })

    it('keeps evaluating after a syntax error, without its variable', () => {
      const results = block('R = 10 kohm +\nI = 2 mA\nI * R')

      expect(results[0]).toEqual(error('Unexpected end of expression (char 14)'))
      expect(results[1]).toEqual(empty)
      // The name is read from the raw text, so the use still points at it.
      expect(results[2]).toEqual(error('R has an error above'))
    })

    it('rejects Mathcad-style := (plain math.js = only)', () => {
      expect(block('R := 10 kohm')).toEqual([error('Value expected (char 4)')])
    })

    it('returns one result per line, blank and comment lines as empty', () => {
      expect(block('\n  \n# note\nCRLF = 1\r\n2 * CRLF')).toEqual([
        empty,
        empty,
        empty,
        empty,
        value('2'),
      ])
    })
  })

  // docs/spec-v1.md section 3, the forms built by M1 (comments arrive with #44).
  describe('line forms', () => {
    it.each([
      ['a bare number', 'eta = 0.70'],
      ['a number and unit', 'D = 102.3 mm'],
      ['a compound unit', 'rho = 998.2 kg/m^3'],
      ['a unit in brackets', 'mu = 1.002 kg/(m s)'],
      ['a negative exponent', 'a = 2 m s^-2'],
      ['a sign', 'x = -5 m'],
      ['a number over a unit', 'f = 5 / s'],
      ['a trailing note', 'D = 102.3 mm # 4" Sch 40'],
    ])('leaves the result cell of a plain input empty: %s', (_, line) => {
      expect(block(line)).toEqual([empty])
    })

    it('still passes a plain input to the lines below', () => {
      expect(block('D = 102.3 mm\nD * 2')).toEqual([empty, value('204.6 mm')])
    })

    it.each([
      ['arithmetic', 'x = 2 * 3', '6'],
      ['a constant', 'x = 2 pi', '6.2831853071796'],
      ['another name', 'x = pi', '3.1415926535898'],
    ])('shows a value when the right side is not a literal: %s', (_, line, shown) => {
      expect(block(line)).toEqual([value(shown)])
    })

    // After K = 2, `5 K` is a calculation, not five kelvin.
    it('shows a value when a unit name is a variable above', () => {
      expect(block('K = 2\ny = 5 K')).toEqual([empty, value('10')])
    })

    it('still shows the error of a plain input that fails', () => {
      expect(block('mu = 1.002 notaunit')).toEqual([error('Undefined symbol notaunit')])
    })

    it('shows the value of a bare expression', () => {
      expect(block('2 * 4')).toEqual([value('8')])
    })

    it('leaves the result cell empty for any line whose value is a function', () => {
      expect(block('q(x) = x^2\nr = q\nr(3)')).toEqual([empty, empty, value('9')])
    })

    it('reads a blank line and a bare # as empty', () => {
      expect(block('\n#')).toEqual([empty, empty])
    })
  })

  describe('reading order (one scope across blocks)', () => {
    it('evaluates U = I * R from inputs in an earlier block (milestone M2)', () => {
      expect(sheet('R = 10 kohm\nI = 2 mA', 'U = I * R')[1]).toEqual([value('20 V')])
    })

    it('recalculates U when I is edited', () => {
      expect(sheet('R = 10 kohm\nI = 4 mA', 'U = I * R')[1]).toEqual([value('40 V')])
    })

    it('never lets a block see a name defined after it, and says where it is', () => {
      const [uses, defines] = sheet('U = I * R', 'R = 10 kohm\nI = 2 mA')

      expect(uses).toEqual([error('I is defined below')])
      expect(defines).toEqual([empty, empty])
    })

    it('says so within a block too', () => {
      expect(block('2 * x\nx = 3')[0]).toEqual(error('x is defined below'))
    })

    it('points a cascade at the failed definition', () => {
      const [inputs, uses, further] = sheet(
        'R = 10 kohm\nI = 2 mA + 1 V',
        'U = I * R',
        'P = U * 2',
      )

      expect(inputs[1]).toEqual(error('Units do not match'))
      expect(uses).toEqual([error('I has an error above')])
      // U failed because of I, so P points at U, the next link in the chain.
      expect(further).toEqual([error('U has an error above')])
    })

    // Regression (PR #6 review, B2): a failed redefinition kept the old I in
    // scope, so U silently stayed 20 V.
    it('drops the old value when a redefinition fails', () => {
      const [, redefinition, uses] = sheet(
        'R = 10 kohm\nI = 2 mA',
        'I = 4 mA + 1 V',
        'U = I * R',
      )

      expect(redefinition).toEqual([error('Units do not match')])
      expect(uses).toEqual([error('I has an error above')])
    })

    it('drops the old value when a redefinition does not parse', () => {
      const [, redefinition, uses] = sheet('R = 10 kohm\nI = 2 mA', 'I = 4 mA +', 'U = I * R')

      expect(redefinition[0].kind).toBe('error')
      expect(uses).toEqual([error('I has an error above')])
    })

    // Known limit, follow-up #7: a name that is also a unit (V, A, m, ...)
    // is never undefined. If its definition fails, lines below silently read
    // the unit instead.
    it('falls back to the unit when a unit-named definition fails', () => {
      expect(sheet('V = 1 mA + 1 V', 'V * 2')[1]).toEqual([value('2 V')])
    })

    it('clears the error once the name is defined again', () => {
      expect(sheet('I = 2 mA + 1 V', 'I = 3 mA', 'I')[2]).toEqual([value('3 mA')])
    })

    // Approved on #3: redefinition is silent and affects only the lines below.
    it('lets a later line redefine a name, for the lines below it only', () => {
      expect(sheet('I = 2 mA\nI * 1 kohm', 'I = 4 mA', 'I * 1 kohm')).toEqual([
        [empty, value('2 V')],
        [empty],
        [value('4 V')],
      ])
    })

    // Approved on #3: math.js functions bind late, so f uses k's value at
    // the call, not at the definition.
    it('binds function bodies late', () => {
      expect(sheet('k = 2\nf(x) = k * x\nf(1)', 'k = 3', 'f(1)')).toEqual([
        [empty, empty, value('2')],
        [empty],
        [value('3')],
      ])
    })

    it('treats an index assignment as a change, not a definition', () => {
      // So using xs above it keeps math.js's own message.
      expect(block('xs\nxs[1] = 5')[0]).toEqual(error('Undefined symbol xs'))
    })

    it('returns results for every block, including empty ones', () => {
      expect(sheet('', 'x = 1 + 1')).toEqual([[empty], [value('2')]])
    })
  })

  describe('isolation', () => {
    it('starts every run from a fresh scope', () => {
      sheet('x = 5')
      expect(block('x')[0]).toEqual(error('Undefined symbol x'))
    })

    // Index assignment mutates a matrix in place (probed on #3): it must not
    // reach the next run, or a re-run on the next keystroke would differ.
    it('gives the same results on every run, even after in-place changes', () => {
      const source = ['A = [1, 2]', 'A[1] = 5\nA']
      const first = sheet(...source)

      expect(sheet(...source)).toEqual(first)
      expect(first[0]).toEqual([value('[1, 2]')])
      expect(first[1][1]).toEqual(value('[5, 2]'))
    })

    // Regression (PR #5 review): createUnit mutated the shared instance, so
    // re-evaluating the same block (every keystroke) failed the second time,
    // and the unit leaked into other blocks.
    it('gives the same results when the same sheet is evaluated again', () => {
      const source = ['createUnit("knot", "0.514444 m/s")\nI = 2 mA', 'I * 10 kohm']
      const first = sheet(...source)

      expect(sheet(...source)).toEqual(first)
      expect(first[0][0]).toEqual(error('createUnit is not supported in a math element'))
      expect(first[1][0]).toEqual(value('20 V'))
    })

    it('cannot change the engine for later blocks or later runs', () => {
      const attack = [
        'createUnit("knot", "0.514444 m/s")',
        'config({number: "BigNumber"})',
        'import({ pi: 3 }, { override: true })',
      ].join('\n')
      const check = '2 knot\ntypeOf(0.1)\npi'
      const expected = [
        error('Undefined symbol knot'),
        value('"number"'),
        value('3.1415926535898'),
      ]

      // In the same run, below the attack...
      expect(sheet(attack, check)[1]).toEqual(expected)
      // ...and in the next run.
      expect(block(check)).toEqual(expected)
    })

    // Regression (#25): a result showed in whichever unit of its dimension
    // an earlier line or run had read last: after `1 psi`, pressure showed
    // as `9.6691825159135e-5 psi`; after `h`, speed as `m / h`.
    describe('formats results in SI, whatever units were read before', () => {
      // Each line reads units that, under `auto`, took over a dimension.
      const otherUnits = [
        'p = 1 psi',
        'unit("2 bar")',
        't = 2 h\nl = 3 ft',
        'w = 4 lbm\nx = 5 mmHg to psi',
      ].join('\n')
      const check = 'F = (2 kg) / (3 m * s^2)\nQ = 10 m^3 / h\nA = 2 m^2\nQ\nA\nQ / A'
      const expected = [
        value('0.66666666666667 Pa'),
        empty,
        empty,
        value('10 m^3 / h'),
        value('2 m^2'),
        value('0.0013888888888889 m / s'),
      ]

      it('in a run that reads only these units', () => {
        expect(block(check)).toEqual(expected)
      })

      it('in a later block of the same run', () => {
        const [read, checked] = sheet(otherUnits, check)

        expect(read.some((line) => line.kind === 'error')).toBe(false)
        expect(checked).toEqual(expected)
      })

      it('in a later line of the same block', () => {
        expect(block(`${otherUnits}\n${check}`).slice(-check.split('\n').length)).toEqual(expected)
      })

      it('in a later run', () => {
        sheet(otherUnits)
        expect(block(check)).toEqual(expected)
      })

      // The display trade-off of a fixed system (ADR 0003): a result math.js
      // simplifies shows in SI with an SI prefix, even from SI-prefixed or
      // non-SI inputs (`auto` showed `10 ft^2`, `6 cm^2`, `4 cm^2`). A
      // result whose units it keeps shows as written. `to` converts.
      it('simplifies to SI with a prefix, keeps units it does not simplify', () => {
        const lines = [
          '5 ft * 2 ft',
          '2 cm * 3 cm',
          'x = 2 cm\nx * x',
          '1 psi',
          '60 mi / h',
          '5 ft * 2 ft to ft^2',
        ]

        expect(block(lines.join('\n'))).toEqual([
          value('0.9290304 m^2'),
          value('600 mm^2'),
          empty,
          value('400 mm^2'),
          value('1 psi'),
          value('60 mi / h'),
          value('10 ft^2'),
        ])
      })

      // `Unit` (and its static `setUnitSystem`) is not a symbol in
      // expressions, so no line can switch the system back.
      it('cannot be switched by a line', () => {
        const [attempt, checked] = sheet('Unit.setUnitSystem("us")', check)

        expect(attempt).toEqual([error('Undefined symbol Unit')])
        expect(checked).toEqual(expected)
      })
    })

    it('reports each disabled function as unsupported', () => {
      for (const call of [
        'config({number: "BigNumber"})',
        'evaluate("1 + 1")',
        'parse("1 + 1")',
        'compile("1 + 1")',
        'simplify("x + x")',
      ]) {
        expect(block(call)[0]).toMatchObject({
          kind: 'error',
          message: expect.stringMatching(/is not supported in a math element$/),
        })
      }
    })

    // Regression (PR #5 review, round 3): simplifyCore parses with the real
    // parser, and the returned Node evaluates against the shared namespace,
    // where `typed` is the real registry, not the scope's stub.
    it('typed cannot be reached through a parsed Node', async () => {
      // A fresh engine, so sqrt/cos/to are first built after the attack.
      vi.resetModules()
      const fresh = await import('./evaluate.ts')
      const run = (...sources: string[]) => {
        const results = fresh.evaluateSheet(sources.map((source, i) => ({ id: `${i}`, source })))
        return sources.map((_, i) => results.get(`${i}`)!)
      }

      const [, afterwards] = run('n = simplifyCore("typed.clear()")\nn.evaluate()', '20 V to mV\nsqrt(16)\ncos(0)')

      const expected = [value('20000 mV'), value('4'), value('1')]
      expect(afterwards).toEqual(expected)
      expect(run('20 V to mV\nsqrt(16)\ncos(0)')[0]).toEqual(expected)
    })

    // Regression (PR #5 review, round 2): math.js exposes its `typed` registry
    // to expressions. typed.clear() broke every function not yet built (in
    // all blocks, until reload); typed.addConversion() leaked into other
    // blocks and failed on re-evaluation.
    it('typed cannot break or extend the engine, across blocks or runs', () => {
      const attack = [
        'typed.clear()',
        'g(x) = 0\ntyped.addConversion({from: "boolean", to: "Unit", convert: g})',
      ]
      // Functions this file has not used yet, so they are built after clear().
      const check = '20 V to mV\nsqrt(16)\ncos(0)\nmean(1, 2, 3)'
      const expected = [value('20000 mV'), value('4'), value('1'), value('2')]

      expect(sheet(...attack, check)[2]).toEqual(expected)
      expect(block(check)).toEqual(expected)
      // No boolean -> Unit conversion leaked in.
      expect(sheet(...attack, 'true + 1 V')[2][0].kind).toBe('error')
      expect(block('true + 1 V')[0].kind).toBe('error')
    })

    it('reports typed methods as errors, the same on every evaluation', () => {
      const source = [
        'typed.clear()',
        'g(x) = 0\ntyped.addConversion({from: "boolean", to: "Unit", convert: g})',
      ]
      const first = sheet(...source)

      expect(sheet(...source)).toEqual(first)
      expect(first[0][0]).toEqual(error('No access to method "clear"'))
      expect(first[1][1]).toEqual(error('No access to method "addConversion"'))
    })

    // Why the other stubs live in the namespace, not the scope: a scope-only
    // stub is bypassed through parser(), which resolves names in the
    // namespace.
    it('cannot reach the disabled functions through parser()', () => {
      const [viaParser, check] = sheet(
        'p = parser()\np.evaluate("createUnit(\\"knot2\\", \\"1 m/s\\")")',
        '2 knot2',
      )

      expect(viaParser[1]).toEqual(error('evaluate is not supported in a math element'))
      expect(check[0]).toEqual(error('Undefined symbol knot2'))
      expect(block('2 knot2')[0]).toEqual(error('Undefined symbol knot2'))
    })

    // Dropping a failed name must not delete `typed` from the scope: that
    // would expose the real registry to the lines below.
    it('restores the typed stub when an assignment to typed fails', () => {
      expect(sheet('typed = 1\ntyped = nope', 'typed.clear()\nsqrt(9)')).toEqual([
        [empty, error('Undefined symbol nope')],
        [error('No access to method "clear"'), value('3')],
      ])
    })

    it("lets a user's own `typed` shadow the stub below it, never the registry", () => {
      const [own, below] = sheet('typed = 1\ntyped + 1', 'typed + 2\ntyped.clear()')

      expect(own[1]).toEqual(value('2'))
      expect(below[0]).toEqual(value('3'))
      expect(below[1].kind).toBe('error')
      // The next run starts with the stub again, and the engine is intact.
      expect(block('typed.clear()\nsqrt(9)')).toEqual([
        error('No access to method "clear"'),
        value('3'),
      ])
    })
  })
})
