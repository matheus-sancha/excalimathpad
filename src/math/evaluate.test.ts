import { describe, expect, it, vi } from 'vitest'
import { evaluateSheet, type LineResult } from './evaluate.ts'

/** Evaluates blocks (in reading order) as one sheet; results per block, in order. */
function sheet(...sources: string[]): LineResult[][] {
  const lines = evaluateSheet(sources.map((source, i) => ({ id: `b${i}`, source })))
  return sources.map((_, i) => lines.get(`b${i}`)!.map(({ result }) => result))
}

/** The warnings of each line of a one-block sheet. */
function warnings(source: string): (readonly string[])[] {
  return evaluateSheet([{ id: 'b', source }]).get('b')!.map((line) => line.warnings)
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
      ['brackets around the literal', 'x = (5 mm)'],
      ['a number over a unit', 'f = 5 / s'],
      ['a trailing note', 'D = 102.3 mm # 4" Sch 40'],
    ])('leaves the result cell of a plain input empty: %s', (_, line) => {
      expect(block(line)).toEqual([empty])
    })

    // Section 3: empty "unless it has a display unit".
    it('shows a plain input that has a display unit', () => {
      expect(block('D = 102.3 mm in cm')).toEqual([value('10.23 cm')])
    })

    it('still passes a plain input to the lines below', () => {
      expect(block('D = 102.3 mm\nD * 2')).toEqual([empty, value('204.6 mm')])
    })

    it.each([
      ['arithmetic', 'x = 2 * 3', '6'],
      ['a constant', 'x = 2 pi', '6.283'],
      ['another name', 'x = pi', '3.142'],
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

    // Section 2: comments and notes never change a result (#44).
    it('never lets a note change a result', () => {
      expect(block('x = 2 * 3 # times three\nx + 1 # 1 + x')).toEqual([value('6'), value('7')])
      expect(block('x = 2 * 3\nx + 1')).toEqual([value('6'), value('7')])
    })

    it('reads a comment line as empty, defining nothing', () => {
      expect(block('# x = 5\nx')).toEqual([empty, error('Undefined symbol x')])
    })

    it('keeps a # inside a string out of the note', () => {
      expect(block('s = concat("a # b", "c") # note')).toEqual([value('"a # bc"')])
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
    it('falls back to the unit when a unit-named definition fails, with a warning (#7)', () => {
      expect(sheet('V = 1 mA + 1 V', 'V * 2')[1]).toEqual([value('2 V')])
      expect(warnings('V = 1 mA + 1 V\nV * 2')[1]).toEqual([
        'V reads as the unit V here: its definition failed',
      ])
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
        value('3.142'),
      ]

      // In the same run, below the attack...
      expect(sheet(attack, check)[1]).toEqual(expected)
      // ...and in the next run.
      expect(block(check)).toEqual(expected)
    })

    // Regression (#25): a result showed in whichever unit of its dimension
    // an earlier line or run had read last: after `1 psi`, pressure showed
    // as `9.6691825159135e-5 psi`; after `h`, speed as `m / h`.
    describe('formats results in the sheet system, whatever units were read before', () => {
      // Each line reads units that, under `auto`, took over a dimension.
      const otherUnits = [
        'p = 1 psi',
        'unit("2 bar")',
        't = 2 h\nl = 3 ft',
        'w = 4 lbm\nx = 5 mmHg to psi',
      ].join('\n')
      const check = 'F = (2 kg) / (3 m * s^2)\nQ = 10 m^3 / h\nA = 2 m^2\nQ\nA\nQ / A'
      const expected = [
        value('0.6667 Pa'),
        empty,
        empty,
        value('2.778 L / s'),
        value('2 m^2'),
        value('1.389 mm / s'),
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

      // Section 5, Shown result: every result shows in the sheet's system for
      // its kind, whatever units it was written in; SI with prefixes keeps
      // the number at 1 or above in the largest unit the steps allow. A
      // display unit (`in`, or `to` at the end) shows it in that unit.
      it('shows each kind in the sheet system, a display unit as chosen', () => {
        const lines = [
          '5 ft * 2 ft',
          '2 cm * 3 cm',
          'x = 2 cm\nx * x',
          '1 psi',
          '60 mi / h',
          '5 ft * 2 ft to ft^2',
        ]

        expect(block(lines.join('\n'))).toEqual([
          value('9290 cm^2'),
          value('6 cm^2'),
          empty,
          value('4 cm^2'),
          value('6.895 kPa'),
          value('26.82 m / s'),
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
        const lines = fresh.evaluateSheet(sources.map((source, i) => ({ id: `${i}`, source })))
        return sources.map((_, i) => lines.get(`${i}`)!.map(({ result }) => result))
      }

      const [, afterwards] = run('n = simplifyCore("typed.clear()")\nn.evaluate()', '2 V to mV\nsqrt(16)\ncos(0)')

      const expected = [value('2000 mV'), value('4'), value('1')]
      expect(afterwards).toEqual(expected)
      expect(run('2 V to mV\nsqrt(16)\ncos(0)')[0]).toEqual(expected)
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
      const check = '2 V to mV\nsqrt(16)\ncos(0)\nmean(1, 2, 3)'
      const expected = [value('2000 mV'), value('4'), value('1'), value('2')]

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

describe('the format clause (docs/spec-v1.md section 3)', () => {
  it('never changes a result', () => {
    expect(block('a = 2 m @bold @yellow\nb = a * 3 @underline # tripled')).toEqual(
      block('a = 2 m\nb = a * 3 # tripled'),
    )
  })

  it('reports a word that isn’t a format, and the value still reaches the lines below', () => {
    expect(block('a = 2 m * 2 @bolt\nb = a * 3')).toEqual([
      error('Unknown format @bolt'),
      value('12 m'),
    ])
  })

  it('leaves an @ in the middle of the code to math.js, as a syntax error', () => {
    expect(block('a = 2 @bold + 1')[0].kind).toBe('error')
  })
})

describe('numbers (docs/spec-v1.md section 5)', () => {
  it.each([
    ['1234', '1234'],
    ['12345', '1.235·10⁴'],
    ['185997', '1.86·10⁵'],
    ['0.01864', '0.01864'],
    ['0.0004399', '4.399·10⁻⁴'],
    ['5.400', '5.4'],
    ['25 m', '25 m'],
    ['n = 123456\nn', '1.235·10⁵'],
    ['1/0', '∞'],
    ['-1/0', '-∞'],
    ['0/0', 'NaN'],
    ['-0', '0'],
    ['2 + 3i', '2 + 3i'],
  ])('%s shows %s at the default 4 digits', (source, shown) => {
    expect(block(source).at(-1)).toEqual(value(shown))
  })

  it('never reformats source: a plain input stays as typed', () => {
    expect(block('D = 102.30 mm\nD')).toEqual([empty, value('102.3 mm')])
  })
})

describe('app units (docs/spec-v1.md section 5)', () => {
  it.each([
    ['1.002 cP', '1.002 mPa s'],
    ['1.002 cP to Pa s', '0.001002 Pa s'],
    ['2 poise to Pa s', '0.2 Pa s'],
    ['1 cSt to m^2/s', '1·10⁻⁶ m^2 / s'],
    ['3 St to cSt', '300 cSt'],
    ['1500 rpm to Hz', '25 Hz'],
    ['1 gpm to L/minute', '3.785 L / minute'],
    ['1 cfm to L/s', '0.4719 L / s'],
    ['1 kcal to J', '4184 J'],
    ['1 tonf to lbf', '2000 lbf'],
    ['1 tf to kgf', '1000 kgf'],
  ])('%s is %s', (source, shown) => {
    expect(block(source)).toEqual([value(shown)])
  })

  it('registers each name with no prefixes, and no bare P', () => {
    expect(block('1 mcP')).toEqual([error('Undefined symbol mcP')])
    expect(block('1 P')).toEqual([error('Undefined symbol P')])
    expect(block('P = 5 kW\nP * 2')).toEqual([empty, value('10 kW')])
  })

  it('leaves a name free for a variable', () => {
    expect(block('St = 3\nSt * 2')).toEqual([empty, value('6')])
  })

  // Section 14, setup order: a plain createUnit made each app unit a display
  // unit (`0.01 m^2 * 1.8 m/s` showed `285.3 gpm`). The app's formatter
  // converts each unit result itself; a matrix still goes through math.js's
  // own format, which a leak would reach.
  it('shows results as an engine without them does', async () => {
    const { all, create } = await import('mathjs')
    const { createDisplay } = await import('./display.ts')
    const { DEFAULT_DISPLAY } = await import('./evaluate.ts')
    const bare = create(all)
    bare.Unit.setUnitSystem('si')
    const bareDisplay = createDisplay(bare, bare.parse)
    const expressions = [
      '0.01 m^2 * 1.8 m/s',
      '[0.01 m^2 * 1.8 m/s, 2 Pa * 3 s]',
      '2 Pa * 3 s',
      '4 m^2 / (2 s)',
      '5 m^3 / s * 2',
      '6 kg m^2 / s^2',
      '7 kg m^2 / s^3',
      '8 kg m / s^2',
      '9 / s * 2',
      '10 kg / s * 2',
      '1 gal * 2 / (3 minute)',
      '1 lbf * 3',
      '1 BTU * 2',
    ]

    expect(block(expressions.join('\n'))).toEqual(
      expressions.map((source) =>
        value(bareDisplay.show(bare.evaluate(source), null, DEFAULT_DISPLAY)),
      ),
    )
  })
})

describe('display unit, `in <unit>` (docs/spec-v1.md sections 3 and 5)', () => {
  it('shows the result in the chosen unit', () => {
    expect(block('dP = 45430 Pa in kPa\nQ = 0.5 L/s in L/minute\nv = 2 m/s to km/h')).toEqual([
      value('45.43 kPa'),
      value('30 L / minute'),
      value('7.2 km / h'),
    ])
  })

  it('reads the whole unit after `in`, as math.js would not: `L/minute`, `kN/m^2`, `m^-1`', () => {
    expect(block('a = 3 L/s in L/minute\nb = 2 kPa in kN/m^2\nc = 4 / mm in m^-1')).toEqual([
      value('180 L / minute'),
      value('2 kN / m^2'),
      value('4000 m^-1'),
    ])
  })

  it('shows a plain input converted, and still passes its value below', () => {
    expect(block('D = 102.3 mm in in\nD2 = D * 2')).toEqual([value('4.028 in'), value('204.6 mm')])
  })

  it('balances a unit of the wrong kind, as in Mathcad', () => {
    expect(block('dP = 45430 Pa in m')).toEqual([value('4.543·10⁴ m kg / (m^2 s^2)')])
  })

  it('reads the unit outside the sheet: a variable named like a unit changes nothing', () => {
    expect(block('m = 3\nd = 2 km in m')).toEqual([empty, value('2000 m')])
  })

  it('reports an unknown unit, and the value still reaches the lines below', () => {
    expect(block('x = 2 m * 1 in xyz\ny = x * 2')).toEqual([error('Unknown unit xyz'), value('4 m')])
    expect(block('k = 3\nx = 2 m * 1 in k')).toEqual([empty, error('Unknown unit k')])
  })

  it('leaves a conversion inside the expression to math.js', () => {
    expect(block('(2 bar in kPa) + 1 kPa')).toEqual([value('201 kPa')])
  })

  it('is an error on a function definition, which removes the function', () => {
    expect(block('p(x) = x * 2 in kPa\np(1 kPa)')).toEqual([
      error("Set a function's display unit on the line that calls it"),
      error('p has an error above'),
    ])
  })

  it('works on the line that calls a function', () => {
    expect(block('p(x) = x * 2\ndP = p(100 kPa) in bar')).toEqual([empty, value('2 bar')])
  })

  it('comes before the format clause and the note', () => {
    expect(block('U = 2 A * 3 ohm in mV @bold # check')).toEqual([value('6000 mV')])
  })
})

describe('unit systems (docs/spec-v1.md section 5)', () => {
  const inSystem = (source: string, units: Parameters<typeof evaluateSheet>[1]) =>
    evaluateSheet([{ id: 'b', source }], units).get('b')!.map(({ result }) => result)
  const lines = '45430 Pa\n5412 W\n0.001002 Pa s\n1 m\n0.008219 m^2\n0.01881 m^3/s\n2 kg m / s'

  it('SI with prefixes is the default: the number between 1 and 1000 where the kind has steps', () => {
    expect(block(lines)).toEqual([
      value('45.43 kPa'),
      value('5.412 kW'),
      value('1.002 mPa s'),
      value('1 m'),
      value('82.19 cm^2'),
      value('18.81 L / s'),
      value('2 (kg m) / s'),
    ])
  })

  it('SI base units: no prefixes', () => {
    expect(inSystem(lines, { units: { system: 'si-base', custom: {} }, digits: 4 })).toEqual([
      value('4.543·10⁴ Pa'),
      value('5412 W'),
      value('0.001002 Pa s'),
      value('1 m'),
      value('0.008219 m^2'),
      value('0.01881 m^3 / s'),
      value('2 (kg m) / s'),
    ])
  })

  it('USCS: ft, psi, hp and so on, other kinds in its base units', () => {
    expect(inSystem(lines, { units: { system: 'uscs', custom: {} }, digits: 4 })).toEqual([
      value('6.589 psi'),
      value('7.258 hp'),
      value('2.093·10⁻⁵ (lbf s) / ft^2'),
      value('3.281 ft'),
      value('0.08847 ft^2'),
      value('0.6643 ft^3 / s'),
      value('14.47 (lbm ft) / s'),
    ])
  })

  it('Custom changes the unit for chosen kinds, and the rest follow the system', () => {
    const custom = { units: { system: 'si-prefixed', custom: { pressure: 'bar' } }, digits: 4 } as const
    expect(inSystem('45430 Pa\n5412 W', custom)).toEqual([value('0.4543 bar'), value('5.412 kW')])
  })

  it('shows electrical units by name, with a prefix', () => {
    expect(block('R = 10 kohm\nI = 2 mA\nI * R\nI * R / 1000')).toEqual([
      empty,
      empty,
      value('20 V'),
      value('20 mV'),
    ])
  })

  it('shows a dimensionless result as a plain number', () => {
    expect(block('2 m / (4 mm)')).toEqual([value('500')])
  })

  it('takes the sheet digits', () => {
    expect(inSystem('45430.12 Pa', { units: { system: 'si-base', custom: {} }, digits: 6 })).toEqual([
      value('45430.1 Pa'),
    ])
  })
})

describe('warnings (docs/spec-v1.md section 5, #7)', () => {
  it('warns when a variable shadows a unit; the name wins and the result is unchanged', () => {
    expect(warnings('K = 5.4\nx = 2 K')).toEqual([['K shadows the unit K'], []])
    expect(block('K = 5.4\nx = 2 K')).toEqual([empty, value('10.8')])
  })

  it('covers function names, parameters, built-ins and the app units', () => {
    expect(warnings('g(x) = x^2')).toEqual([['g shadows the unit g']])
    expect(warnings('u(s) = s + 5 s')).toEqual([['s shadows the unit s']])
    expect(warnings('pi = 3')).toEqual([['pi shadows the built-in pi']])
    expect(warnings('cP = 2')).toEqual([['cP shadows the unit cP']])
  })

  it('does not warn for a parameter that hides a sheet function', () => {
    expect(warnings('h(Q) = Q * 2\nf(h, r) = h * r')).toEqual([['h shadows the unit h'], []])
  })

  it('flags a use that falls back to the unit because the variable is defined below', () => {
    expect(warnings('P = V * 2\nV = 3 A * 2 ohm')).toEqual([
      ['V reads as the unit V here: the variable is defined below'],
      ['V shadows the unit V'],
    ])
    expect(block('P = V * 2\nV = 3 A * 2 ohm')[0]).toEqual(value('2 V'))
  })

  it('keeps 5 V meaning volts above any V = ... without a fallback warning when V is not defined', () => {
    expect(warnings('U = 5 V\nI = 2 A')).toEqual([[], []])
  })

  it('warns on a function body name not defined above this line', () => {
    expect(warnings('f(x) = k * x\nk = 2\nf(3)')).toEqual([["k isn't defined above this line"], [], []])
    expect(block('f(x) = k * x\nk = 2\nf(3)')[2]).toEqual(value('6'))
  })

  it('skips the function itself, its parameters, units and math.js functions in a body', () => {
    expect(warnings('fact(n) = n <= 1 ? 1 : n * fact(n - 1)')).toEqual([[]])
    expect(warnings('w(x) = sqrt(x) * 2 m + pi')).toEqual([[]])
  })

  it('stays silent for a body name defined above and redefined later', () => {
    expect(warnings('k = 1\nf(x) = k * x\nk = 2')).toEqual([[], [], []])
  })

  it('leaves names that are not units or built-ins alone', () => {
    expect(warnings('rho = 998.2 kg/m^3\nD = 2 m\nx = rho * D')).toEqual([[], [], []])
  })

  it('keeps the warnings of a line that fails', () => {
    expect(warnings('K = 1 m + 1 s')).toEqual([['K shadows the unit K']])
  })
})

describe('function and reserved-name messages (docs/spec-v1.md section 13, #57)', () => {
  it('a value called like a function', () => {
    expect(block('f_d = 0.02\nx = f_d (2)')[1]).toEqual(
      error('f_d is a value, not a function: write f_d * (...) to multiply'),
    )
  })

  it('a function used as a number', () => {
    expect(block('q(x) = x * 2\nq + 1')[1]).toEqual(error('q is a function: call it with q(...)'))
  })

  it('the wrong number of arguments', () => {
    expect(block('h(a, b) = a + b\nh(1)\nh(1, 2, 3)')).toEqual([
      empty,
      error('h needs 2 arguments, got 1'),
      error('h needs 2 arguments, got 3'),
    ])
    expect(block('k(a) = a\nk(1, 2)')[1]).toEqual(error('k needs 1 argument, got 2'))
  })

  it('recursion with no end, and recursion with an end still works', () => {
    expect(block('loop(x) = loop(x)\nloop(1)')[1]).toEqual(error('loop calls itself without end'))
    expect(block('fact(n) = n <= 1 ? 1 : n * fact(n - 1)\nfact(5)')[1]).toEqual(value('120'))
  })

  it('an error inside a body, on the calling line, with the arguments as the sheet shows them', () => {
    expect(block('k(t) = t + 1 m\nk(1 s)')[1]).toEqual(error('in k(1 s): Units do not match'))
    expect(block('k(t) = t + 1 m\nk(12345 s)')[1]).toEqual(
      error('in k(1.235·10⁴ s): Units do not match'),
    )
  })

  it('names each function an error passes through', () => {
    expect(block('h(x) = x + 1 m\ng(x) = h(x * 2)\ng(1 s)')[2]).toEqual(
      error('in g(1 s): in h(2 s): Units do not match'),
    )
  })

  it('words a misuse inside a body too', () => {
    expect(block('c = 3\nw(x) = c (x)\nw(2)')[2]).toEqual(
      error('in w(2): c is a value, not a function: write c * (...) to multiply'),
    )
  })

  it('table, plot and solve are reserved names', () => {
    expect(block('table = 3\nplot(x) = x\nsolve = 1\ny = 2')).toEqual([
      error('table is a line form: choose another name'),
      error('plot is a line form: choose another name'),
      error('solve is a line form: choose another name'),
      empty,
    ])
  })

  it('a failed line still removes its name, and the lines below run', () => {
    expect(block('a = 2\na = a (3)\nb = 4\nb * 2\na')).toEqual([
      empty,
      error('a is a value, not a function: write a * (...) to multiply'),
      empty,
      value('8'),
      error('a has an error above'),
    ])
  })

  it('keeps functions as values and late binding', () => {
    expect(block('q(x) = x * k\nr = q\nk = 3\nr(2)')).toEqual([empty, empty, empty, value('6')])
  })
})

describe('variables (docs/spec-v1.md section 8, Variables tab)', () => {
  const variables = (source: string) =>
    evaluateSheet([{ id: 'b', source }]).get('b')!.map((line) => line.variables)

  it('gives each defined name its value in the sheet system, plain inputs included', () => {
    expect(variables('D = 102.3 mm\nP = 5412 W\n2 * D\n# note')).toEqual([
      [{ name: 'D', kind: 'value', text: '102.3 mm' }],
      [{ name: 'P', kind: 'value', text: '5.412 kW' }],
      [],
      [],
    ])
  })

  it('gives a function its parameters, and a failed line error', () => {
    expect(variables('Hs(Q, k) = Q * k\nx = 1 m + 1 s\ny = (')).toEqual([
      [{ name: 'Hs', kind: 'function', params: ['Q', 'k'], solve: false }],
      [{ name: 'x', kind: 'error' }],
      [{ name: 'y', kind: 'error' }],
    ])
  })

  it('marks a solve function, and gives a solved value its value', () => {
    expect(variables('f(a) = solve x^2 = a, guess x = 1\nr = solve r^2 = 2, guess r = 1')).toEqual([
      [{ name: 'f', kind: 'function', params: ['a'], solve: true }],
      [{ name: 'r', kind: 'value', text: '1.414' }],
    ])
  })
})

describe('the unit lists per kind (docs/spec-v1.md section 5)', () => {
  it('offers only units math.js knows, each of its own kind', async () => {
    const { all, create } = await import('mathjs')
    const { KIND_REFERENCE, SLOT_UNITS, SI_PREFIXED, USCS } = await import('./unitSystems.ts')
    const check = create(all)
    for (const name of ['cP', 'poise', 'cSt', 'St', 'rpm', 'gpm', 'cfm', 'kcal', 'tonf', 'tf']) {
      // The app units, as the engine registers them.
      if (!check.Unit.isValuelessUnit(name)) {
        const { APP_UNITS } = await import('./appUnits.ts')
        const unit = APP_UNITS.find((entry) => entry.name === name)!
        check.createUnit(name, { definition: unit.definition, prefixes: 'none' })
      }
    }
    for (const [kind, reference] of Object.entries(KIND_REFERENCE)) {
      const units = [
        ...SLOT_UNITS[kind as keyof typeof SLOT_UNITS],
        ...SI_PREFIXED[kind as keyof typeof SI_PREFIXED],
        USCS[kind as keyof typeof USCS],
      ]
      for (const unit of units) {
        expect(check.unit(unit).equalBase(check.unit(reference)), `${kind}: ${unit}`).toBe(true)
      }
    }
  })
})

describe('unit slot (docs/spec-v1.md section 5)', () => {
  const slots = (source: string) =>
    evaluateSheet([{ id: 'b', source }]).get('b')!.map((line) => line.unitSlot)

  it('offers the units of the result’s kind, each with the value in it, and Sheet units', () => {
    const [slot] = slots('dP = 45430 Pa * 1')
    expect(slot).toMatchObject({ kind: 'pressure', system: '45.43 kPa', chosen: null })
    expect(slot!.options).toEqual([
      { unit: 'Pa', text: '4.543·10⁴ Pa' },
      { unit: 'kPa', text: '45.43 kPa' },
      { unit: 'MPa', text: '0.04543 MPa' },
      { unit: 'mbar', text: '454.3 mbar' },
      { unit: 'bar', text: '0.4543 bar' },
      { unit: 'psi', text: '6.589 psi' },
      { unit: 'atm', text: '0.4484 atm' },
    ])
  })

  it('knows the chosen unit as typed, and a plain input has a slot too', () => {
    expect(slots('D = 102.3 mm in in\nL = 2 m')).toMatchObject([
      { kind: 'length', chosen: 'in' },
      { kind: 'length', chosen: null, system: '2 m' },
    ])
  })

  it('offers % for a dimensionless result, and in % shows it in percent', () => {
    expect(slots('eta = 0.7 * 1')[0]).toMatchObject({
      kind: 'dimensionless',
      options: [{ unit: '%', text: '70 %' }],
    })
    expect(block('eta = 0.7 * 1 in %')).toEqual([value('70 %')])
  })

  it('has no slot on a function, an error or a matrix; the app units join their kinds', () => {
    expect(slots('f(x) = x\n1 m + 1 s\n[1, 2]')).toEqual([null, null, null])
    expect(slots('mu = 0.001002 Pa s * 1')[0]!.options.map((o) => o.unit)).toContain('cP')
  })
})

describe('solve, the value form (docs/spec-v1.md section 9, #70)', () => {
  const lines = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!

  it('solves into a name, which the lines below use', () => {
    expect(block('x = solve x^2 = 2, guess x = 1\nx * 10')).toEqual([value('1.414'), value('14.14')])
  })

  it('gives the unknown the guess’s dimension, and shows in the unit system or `in <unit>`', () => {
    expect(block('A = 2 m^2\nw = solve w^2 = A, guess w = 1 m\nv = solve v^2 = A, guess v = 1 m in cm')).toEqual([
      empty,
      value('1.414 m'),
      value('141.4 cm'),
    ])
  })

  it('evaluates the guess as any expression, in the scope at the line', () => {
    expect(block('g = 3\nx = solve x^3 = 27, guess x = g + 1')).toEqual([empty, value('3')])
  })

  it('keeps the unknown local to the line: it wins inside and is not defined below', () => {
    expect(block('Q = 100\nq = solve Q + 1 = 3, guess Q = 1\nQ')).toEqual([empty, value('2'), value('100')])
    // A unit name: the unknown wins over the unit, with the shadow warning.
    expect(block('k_t = solve s * 2 = 6, guess s = 1\ns')).toEqual([value('3'), value('s')])
    expect(warnings('k_t = solve s * 2 = 6, guess s = 1')[0]).toEqual(['s shadows the unit s'])
  })

  it('does not let the guess use the unknown', () => {
    expect(block('x = 5\ny = solve x = 2, guess x = x')).toEqual([empty, error('guess x: Undefined symbol x')])
  })

  it('needs a guess, and one equation', () => {
    expect(block('Q_op = solve Hp(Q) = Hs(Q)')).toEqual([error('solve needs a guess: ", guess Q = <value>"')])
    expect(block('x = solve x^2, guess x = 1')).toEqual([
      error('solve needs one equation: "<left side> = <right side>"'),
    ])
  })

  it('reports no root with the guess and the span searched, in the guess’s unit', () => {
    const [result] = block('x = solve x^2 = -1 m^2, guess x = 2 m')
    expect(result).toEqual(error('no root near x = 2 m (searched -2.209·10¹¹ .. 2.209·10¹¹ m)'))
  })

  it('reports the sides’ units not matching, at the guess', () => {
    expect(block('Q = solve Q = 3 m, guess Q = 15 m^3/s')).toEqual([
      error('guess Q = 15 m^3/s: Q - 3 m units do not match'),
    ])
  })

  it('reports a guess that fails', () => {
    expect(block('x = solve x = 1, guess x = 1 m + 1 s')).toEqual([error('guess x: Units do not match')])
  })

  it('never shows a value when it fails: the name is removed, and the lines below say so', () => {
    expect(block('x = 4\nx = solve x^2 = -1, guess x = 1\nx + 1')).toEqual([
      empty,
      error('no root near x = 1 (searched -1.104·10¹¹ .. 1.104·10¹¹)'),
      error('x has an error above'),
    ])
  })

  it('fails after 100 iterations rather than showing a value', () => {
    expect(block('x = solve x^3 = 0, guess x = 0.5')).toEqual([error('no convergence for x after 100 iterations')])
  })

  it('cannot appear mid-expression', () => {
    expect(block('y = 2 * solve x = 1, guess x = 1')[0].kind).toBe('error')
  })

  it('is an error, not a solve, when it assigns to solve', () => {
    expect(block('solve = solve x = 1, guess x = 1')).toEqual([error('solve is a line form: choose another name')])
  })

  it('reads its note and format clause as any line does', () => {
    const [line] = lines('x = solve x^2 = 4 m^2, guess x = 1 m in cm @bold # positive root')
    expect(line.result).toEqual(value('200 cm'))
    expect(line.typeset).toMatchObject({ kind: 'math', note: 'positive root', format: { bold: true } })
  })

  it('is the same solve on every run', () => {
    const source = 'x = solve cos(x) = x, guess x = 1'
    expect(lines(source)).toEqual(lines(source))
  })

  it('gives the solve details to the hover, and none to other lines', () => {
    const [solved, plain] = lines('x = solve x^2 = 2, guess x = 1\ny = x')
    expect(solved.solveDetails).toMatchObject({ method: 'Brent', bracket: expect.stringContaining('1.41421356237') })
    expect(solved.solveDetails?.iterations).toBeGreaterThan(0)
    expect(plain.solveDetails).toBeNull()
  })
})

describe('solve functions and nested solves (docs/spec-v1.md section 9, #71)', () => {
  const lines = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!
  const colebrook = 'f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02'

  it('defines a function that solves at each call; the definition’s cell stays empty', () => {
    expect(block(`${colebrook}\nf(1.86e5, 4.399e-4)\nf(3e4, 4.4e-4)`)).toEqual([
      empty,
      value('0.01864'),
      value('0.02463'),
    ])
  })

  it('lets the unknown win over the function being defined', () => {
    // In Colebrook, `f` inside is the unknown, not a recursive call.
    expect(block('g(a) = solve g^2 = a, guess g = 1\ng(9)')).toEqual([empty, value('3')])
  })

  it('evaluates the guess at each call, with the parameters and late binding', () => {
    expect(block('r(a) = solve x^2 = a, guess x = a / k\nk = 2\nr(16)\nk = -2\nr(16)')).toEqual([
      empty,
      empty,
      value('4'),
      empty,
      value('-4'),
    ])
  })

  it('fails only for syntax at its definition; a failure lands on the calling line', () => {
    expect(block('h(a) = solve x^2 = a, guess x = 1\nh(-1)\nh(4)')).toEqual([
      empty,
      error('in h(-1): no root near x = 1 (searched -1.104·10¹¹ .. 1.104·10¹¹)'),
      value('2'),
    ])
    expect(block('h(a) = solve x^2 = a, guess x = 1 m\nh(4)')).toEqual([
      empty,
      error('in h(4): guess x = 1 m: x^2 - a units do not match'),
    ])
  })

  it('checks the number of arguments', () => {
    expect(block('h(a, b) = solve x = a + b, guess x = 1\nh(1)')).toEqual([
      empty,
      error('h needs 2 arguments, got 1'),
    ])
  })

  it('takes no display unit on its definition', () => {
    expect(block('h(a) = solve x = a, guess x = 1 m in cm\nh(2 m)')).toEqual([
      error("Set a function's display unit on the line that calls it"),
      error('h has an error above'),
    ])
  })

  it('solves through a solve: an inner failure counts as outside the domain', () => {
    // At Q ≤ 0 Colebrook has no root; the outer search steps past those points.
    const sheet = [
      colebrook,
      'Hs(Q) = 12 m + f(Q / (1 L/s) * 1e4, 4e-4) * 1e3 m * (Q / (1 L/s))^2 / 100',
      'Q_op = solve Hs(Q) = 25 m, guess Q = 1 L/s',
    ].join('\n')
    const [, , solved] = lines(sheet)
    expect(solved.result.kind).toBe('value')
    expect(solved.solveDetails?.method).toBe('Brent')
  })

  it('carries the last inner error when the outer solve finds no root', () => {
    const [, result] = block('g(a) = solve x^2 = a, guess x = 1\ny = solve g(y) = -5, guess y = 4')
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toMatch(/^no root near y = 4 \(searched .*\); last inner error: in g\(-?[\d.·⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+\): no root near x = 1/)
    }
  })

  it('never swallows a units error in an inner solve', () => {
    expect(block('g(a) = solve x = a, guess x = 1 m\ny = solve g(y) = 5, guess y = 1')).toEqual([
      empty,
      error('in g(1): guess x = 1 m: x - a units do not match'),
    ])
  })

  it('gives details to a line that is just one call, and none deeper or to the definition', () => {
    const [definition, direct, bare, deeper] = lines(`${colebrook}\nf_d = f(1.86e5, 4.399e-4)\nf(1e5, 4e-4)\n2 * f(1e5, 4e-4)`)
    expect(definition.solveDetails).toBeNull()
    expect(direct.solveDetails?.method).toBe('Brent')
    expect(bare.solveDetails?.method).toBe('Brent')
    expect(deeper.solveDetails).toBeNull()
  })

  it('warns on a guess name not defined above, but not on the unknown or the parameters', () => {
    expect(warnings('r(a) = solve x^2 = a, guess x = a / k')[0]).toEqual(["k isn't defined above this line"])
    expect(warnings(colebrook)[0]).toEqual([])
  })
})
