import { describe, expect, it, vi } from 'vitest'
import { evaluateSheet, type LineResult, type TableView } from './evaluate.ts'

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
        't = 2 hr\nl = 3 ft',
        'w = 4 lbm\nx = 5 mmHg to psi',
      ].join('\n')
      const check = 'F = (2 kg) / (3 m * s^2)\nQ = 10 m^3 / hr\nA = 2 m^2\nQ\nA\nQ / A'
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
          '60 mi / hr',
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
    expect(variables('f(a) = solve x^2 = a, guess x = 1\nr = solve r^2 = 2, for r = 0 .. 10')).toEqual([
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

  it('offers torque units for a torque, which has energy’s dimension', () => {
    const slot = slots('F = 100 N\nr = 0.5 m\nT = F * r')[2]!
    const options = new Map(slot.options.map((option) => [option.unit, option.text]))

    expect(options.get('N m')).toBe('50 N m')
    expect(options.get('kN m')).toBe('0.05 kN m')
    expect(options.get('lbf ft')).toBe('36.88 lbf ft')
    expect(options.get('lbf in')).toBe('442.5 lbf in')
    expect(options.get('J')).toBe('50 J')
  })

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

describe('solve, the value form: a search range (docs/spec-v1.md section 9, #70, #105)', () => {
  const lines = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!
  const list = (text: string): LineResult => ({ kind: 'list', text, failed: null })

  it('solves into a name, which the lines below use', () => {
    expect(block('x = solve x^2 = 2, for x = 0 .. 10\nx * 10')).toEqual([value('1.414'), value('14.14')])
  })

  it('gives every root found in the range, ascending: several are a list', () => {
    expect(block('x_r = solve x^3 - 6x^2 + 11x = 6, for x = 0 .. 10\nx_r[2]\nx_r * 2')).toEqual([
      list('3 values, 1 … 3'),
      value('2'),
      list('3 values, 2 … 6'),
    ])
    expect(block('x = solve x^2 = 4, for x = -10 .. 10')).toEqual([list('2 values, -2 … 2')])
  })

  it('gives the unknown the low end’s dimension, and shows in the unit system or `in <unit>`', () => {
    expect(block('A = 2 m^2\nw = solve w^2 = A, for w = 0 m .. 10 m\nv = solve v^2 = A, for v = 0 m .. 10 m in cm')).toEqual([
      empty,
      value('1.414 m'),
      value('141.4 cm'),
    ])
  })

  it('evaluates the ends as any expression, in the scope at the line', () => {
    expect(block('g = 3\nx = solve x^3 = 27, for x = g - 1 .. g * 2')).toEqual([empty, value('3')])
  })

  it('keeps the unknown local to the line: it wins inside and is not defined below', () => {
    expect(block('Q = 100\nq = solve Q + 1 = 3, for Q = 0 .. 10\nQ')).toEqual([empty, value('2'), value('100')])
    // A unit name: the unknown wins over the unit, with the shadow warning.
    expect(block('k_t = solve s * 2 = 6, for s = 0 .. 10\ns')).toEqual([value('3'), value('s')])
    expect(warnings('k_t = solve s * 2 = 6, for s = 0 .. 10')[0]).toEqual(['s shadows the unit s'])
  })

  it('does not let the ends use the unknown', () => {
    expect(block('x = 5\ny = solve x = 2, for x = 0 .. x')).toEqual([empty, error('for x: Undefined symbol x')])
  })

  it('needs a range, not a guess, and one equation', () => {
    expect(block('Q_op = solve Hp(Q) = Hs(Q)\nQ_op + 1')).toEqual([
      error('solve needs a range: ", for Q = <from> .. <to>"'),
      error('Q_op has an error above'),
    ])
    expect(block('Q_op = solve Hp(Q) = Hs(Q), guess Q = 15 L/s\nQ_op + 1')).toEqual([
      error('solve needs a range: ", for Q = <from> .. <to>"'),
      error('Q_op has an error above'),
    ])
    expect(block('x = solve x^2, for x = 0 .. 1')).toEqual([
      error('solve needs one equation: "<left side> = <right side>"'),
    ])
  })

  it('needs two ends and no step, from below to, of one kind', () => {
    expect(block('x = solve x = 1, for x = 0\nx = solve x = 1, for x = 0 .. 2 step 1')).toEqual([
      error('for x needs two ends and no step: "for x = <from> .. <to>"'),
      error('for x needs two ends and no step: "for x = <from> .. <to>"'),
    ])
    expect(block('Q = solve Q = 3 L/s, for Q = 30 L/s .. 1 L/s')).toEqual([
      error('for Q = 30 L/s .. 1 L/s: from must be below to'),
    ])
    expect(block('Q = solve Q = 3 L/s, for Q = 1 L/s .. 30 m')).toEqual([
      error('for Q = 1 L/s .. 30 m: the ends must be the same kind'),
    ])
    expect(block('x = solve x = 1, for x = 1 m + 1 s .. 2')).toEqual([error('for x: Units do not match')])
  })

  it('reports no root in the range, and a range where the equation has no value', () => {
    expect(block('x = solve x^2 = -1, for x = -10 .. 10')).toEqual([error('no root found for x in -10 .. 10')])
    expect(block('Q = solve Q = -1 L/s, for Q = 1 L/s .. 30 L/s')).toEqual([
      error('no root found for Q in 1 .. 30 L / s'),
    ])
    expect(block('x = solve sqrt(x) = 1, for x = -10 .. -1')).toEqual([
      error('no root found for x in -10 .. -1 (the equation has no value in the range)'),
    ])
  })

  it('reports more than 100 roots', () => {
    expect(block('x = solve sin(x) = 0, for x = 0.5 .. 340')).toEqual([
      error('more than 100 roots for x in 0.5 .. 340: narrow the range'),
    ])
  })

  it('refuses a list in its equation or its range, but takes one value out of a list', () => {
    expect(block('a_s = 1 .. 3\nx = solve x = a_s, for x = 0 .. 10\ny = solve x = 2, for x = 0 .. max(a_s)\nz = solve x = a_s[2], for x = 0 .. 10')).toEqual([
      list('3 values, 1 … 3'),
      error("a range solve can't use the list a_s; use a solve function with a guess"),
      error("a range solve can't use the list a_s; use a solve function with a guess"),
      value('2'),
    ])
    expect(block('a_s = 1 .. 3\ny = solve x = 2, for x = 0 .. a_s')[1]).toEqual(
      error("a range solve can't use the list a_s; use a solve function with a guess"),
    )
  })

  it('reports the sides’ units not matching', () => {
    expect(block('Q = solve Q = 3 m, for Q = 1 m^3/s .. 30 m^3/s')).toEqual([
      error('for Q = 1 m^3/s .. 30 m^3/s: Q - 3 m units do not match'),
    ])
  })

  it('never shows a value when it fails: the name is removed, and the lines below say so', () => {
    expect(block('x = 4\nx = solve x^2 = -1, for x = 0 .. 1\nx + 1')).toEqual([
      empty,
      error('no root found for x in 0 .. 1'),
      error('x has an error above'),
    ])
  })

  it('cannot appear mid-expression', () => {
    expect(block('y = 2 * solve x = 1, for x = 0 .. 2')[0].kind).toBe('error')
  })

  it('is an error, not a solve, when it assigns to solve', () => {
    expect(block('solve = solve x = 1, for x = 0 .. 2')).toEqual([error('solve is a line form: choose another name')])
  })

  it('reads its note and format clause as any line does', () => {
    const [line] = lines('x = solve x^2 = 4 m^2, for x = 0 m .. 10 m in cm @bold # positive root')
    expect(line.result).toEqual(value('200 cm'))
    expect(line.typeset).toMatchObject({ kind: 'math', note: 'positive root', format: { bold: true } })
  })

  it('is the same solve on every run, with the same roots in the same order', () => {
    const source = 'x = solve cos(x) = x, for x = -5 .. 5\ny = solve tan(y) = 1, for y = 0 .. 10'
    expect(lines(source)).toEqual(lines(source))
  })

  it('gives the range solve’s details to the hover, and none to other lines', () => {
    const [solved, plain] = lines('x = solve x^2 = 2, for x = 0 .. 10\ny = x')
    expect(solved.solveDetails).toMatchObject({ method: 'scan', range: '0 .. 10', points: 200, rejected: 0 })
    expect(solved.solveDetails?.method === 'scan' && solved.solveDetails.roots[0].value).toContain('1.41421356237')
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
      'Q_op = solve Hs(Q) = 25 m, for Q = -5 L/s .. 30 L/s',
    ].join('\n')
    const [, , solved] = lines(sheet)
    expect(solved.result.kind).toBe('value')
    expect(solved.solveDetails?.method).toBe('scan')
  })

  it('carries the last inner error when the outer solve finds no root', () => {
    const [, result] = block('g(a) = solve x^2 = a, guess x = 1\ny = solve g(y) = -5, for y = -4 .. 4')
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toMatch(/^no root found for y in -4 \.\. 4; last inner error: in g\(-?[\d.·⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+\): no root near x = 1/)
    }
  })

  it('never swallows a units error in an inner solve', () => {
    expect(block('g(a) = solve x = a, guess x = 1 m\ny = solve g(y) = 5, for y = 1 .. 2')).toEqual([
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

  it('asks a solve function for a guess, not a range', () => {
    expect(block('h(a) = solve x = a, for x = 0 .. 1')).toEqual([
      error('a solve function takes a guess: ", guess x = <value>"'),
    ])
    expect(block('h(a) = solve x = a')).toEqual([error('solve needs a guess: ", guess x = <value>"')])
  })

  it('warns on a guess name not defined above, but not on the unknown or the parameters', () => {
    expect(warnings('r(a) = solve x^2 = a, guess x = a / q')[0]).toEqual(["q isn't defined above this line"])
    expect(warnings(colebrook)[0]).toEqual([])
  })
})

describe('ranges and lists (docs/spec-v1.md section 10, #74)', () => {
  const list = (text: string, failed: string | null = null): LineResult => ({ kind: 'list', text, failed })
  const variables = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!.map((line) => line.variables)

  it('makes a list from a range: the end included when the steps land on it', () => {
    expect(block('n = 1 .. 10\nx = 0 .. 1 step 0.1\nQ_s = 1 L/s .. 30 L/s step 1 L/s')).toEqual([
      list('10 values, 1 … 10'),
      list('11 values, 0 … 1'),
      list('30 values, 1 … 30 L / s'),
    ])
  })

  it('stops at the last point before the end, and counts down with a negative step', () => {
    expect(block('a = 0 .. 1 step 0.3\nb = 10 .. 1 step -3')).toEqual([
      list('4 values, 0 … 0.9'),
      list('4 values, 10 … 1'),
    ])
  })

  it('needs a step with units, the same kind throughout, and one that reaches the end', () => {
    expect(block('a = 1 m .. 3 m\nb = 1 .. 3 step 1 m\nc = 1 .. 3 step 0\nd = 1 .. 3 step -1')).toEqual([
      error('a range with units needs a step, such as "step 1 m"'),
      error('start, end and step must be the same kind'),
      error('step 0 never reaches the end'),
      error('step -1 never reaches the end'),
    ])
  })

  it('refuses more than 10,000 points', () => {
    expect(block('big = 1 .. 10001\nok = 1 .. 10000')).toEqual([
      error('big has more than 10,000 points'),
      list('10000 values, 1 … 1·10⁴'),
    ])
  })

  it('runs a line that mentions a list once per point, functions included', () => {
    expect(block('x = 1 .. 3\nsq(t) = t^2\ny = sq(x)\nx^2 + 1')).toEqual([
      list('3 values, 1 … 3'),
      empty,
      list('3 values, 1 … 9'),
      list('3 values, 2 … 10'),
    ])
  })

  it('pairs several lists point by point, and refuses different lengths', () => {
    expect(block('a = 1 .. 3\nb = 10 .. 30 step 10\na + b\nc = 1 .. 4\na + c')).toEqual([
      list('3 values, 1 … 3'),
      list('3 values, 10 … 30'),
      list('3 values, 11 … 33'),
      list('4 values, 1 … 4'),
      error('a has 3 values, c has 4'),
    ])
  })

  it('takes the whole list in an aggregate: min, max, sum, mean, count', () => {
    expect(block('h = 1 m .. 4 m step 1 m\nmin(h)\nmax(h)\nsum(h)\nmean(h)\ncount(h)\nmax(h * 2) + 1 m')).toEqual([
      list('4 values, 1 … 4 m'),
      value('1 m'),
      value('4 m'),
      value('10 m'),
      value('2.5 m'),
      value('4'),
      value('9 m'),
    ])
  })

  it('leaves aggregates on plain values to math.js', () => {
    expect(block('max(1, 5, 3)')).toEqual([value('5')])
  })

  it('fails only the failed point, names it, and fails an aggregate over it', () => {
    expect(block('x = -1 .. 2\nr(t) = 1 / sqrt(t) + (t < 0 ? missing : 0)\ny = r(x)\nmax(y)')).toEqual([
      list('4 values, -1 … 2'),
      empty,
      list('3 of 4 values, ∞ … 0.7071', '1 of 4 points failed. At x = -1: in r(-1): Undefined symbol missing'),
      error('y has a failed point'),
    ])
  })

  it('carries a failed input point to the lines below, without shifting the others', () => {
    const [, , , twice] = block('x = -1 .. 1\nr(t) = t < 0 ? missing : t\ny = r(x)\ny * 2')
    // The input point itself failed, so there is no value to name it by.
    expect(twice).toEqual(list('2 of 3 values, 0 … 2', '1 of 3 points failed. At point 1: in r(-1): Undefined symbol missing'))
  })

  it('keeps a function body from reaching an outside list', () => {
    expect(block('Q_s = 1 .. 3\ng(x) = x + Q_s\nh(x, Q_s) = x + Q_s')).toEqual([
      list('3 values, 1 … 3'),
      error('pass Q_s as an argument'),
      empty,
    ])
  })

  it('shows a list in its display unit, and in Variables as its summary', () => {
    expect(block('Q_s = 1 L/s .. 2 L/s step 1 L/s in L/minute')).toEqual([list('2 values, 60 … 120 L / minute')])
    expect(variables('Q_s = 1 L/s .. 2 L/s step 1 L/s')).toEqual([
      [{ name: 'Q_s', kind: 'list', text: '2 values, 1 … 2 L / s' }],
    ])
  })
})

describe('an index (docs/spec-v1.md section 3, An index; #104)', () => {
  const list = (text: string, failed: string | null = null): LineResult => ({ kind: 'list', text, failed })
  const RANGE = 'Q_s = 1 L/s .. 30 L/s step 1 L/s'

  it('takes one value out of a list, counting from 1, as one value', () => {
    expect(block(`${RANGE}\nQ_5 = Q_s[5]\nQ_s[5] + 1 L/s\nQ_s[1]\nQ_s[count(Q_s)]`)).toEqual([
      list('30 values, 1 … 30 L / s'),
      value('5 L / s'),
      value('6 L / s'),
      value('1 L / s'),
      value('30 L / s'),
    ])
  })

  it('works on a per-point result, and an index on a whole list beside the list itself', () => {
    expect(block('x = 1 .. 3\ny = x * 10\ny[2]\nx[3] + x')).toEqual([
      list('3 values, 1 … 3'),
      list('3 values, 10 … 30'),
      value('20'),
      list('3 values, 4 … 6'),
    ])
  })

  it('takes any whole-number expression, and an index inside an aggregate', () => {
    expect(block('x = 1 .. 5\nn = 2\nx[n + 1]\nmax(x[1], x[4])')).toEqual([
      list('5 values, 1 … 5'),
      empty,
      value('3'),
      value('4'),
    ])
  })

  it('reads a single value as a list of one', () => {
    expect(block('x = 3 m\nx[1] * 2\nx[2]')).toEqual([empty, value('6 m'), error('x has 1 value')])
  })

  it('refuses an index that isn’t a whole number from 1, one past the end, and one not on a name', () => {
    const [, zero, half, past, paren, below] = block(
      `${RANGE}\na = Q_s[0]\nQ_s[1.5]\nQ_s[31]\n(Q_s)[2]\na + 1 L/s`,
    )
    expect(zero).toEqual(error('Q_s[0]: an index is a whole number from 1'))
    expect(half).toEqual(error('Q_s[1.5]: an index is a whole number from 1'))
    expect(past).toEqual(error('Q_s has 30 values'))
    expect(paren).toEqual(error('an index goes on a name: x_r[2]'))
    expect(below).toEqual(error('a has an error above'))
  })

  it('refuses a list or a unit as the index: a name inside an index never iterates', () => {
    expect(block('x = 1 .. 3\nx[x]\nx[2 m]')).toEqual([
      list('3 values, 1 … 3'),
      error('x[x]: an index is a whole number from 1'),
      error('x[2 m]: an index is a whole number from 1'),
    ])
  })

  it('gives a failed point’s own error', () => {
    const [, , y, second, third] = block('x = -1 .. 1\nr(t) = t < 0 ? missing : t\ny = r(x)\ny[2]\ny[1]')
    expect(y.kind).toBe('list')
    expect(second).toEqual(value('0'))
    expect(third).toEqual(error('in r(-1): Undefined symbol missing'))
  })

  it('says when the indexed name is defined below', () => {
    expect(block('x[1]\nx = 1 .. 2')[0]).toEqual(error('x is defined below'))
  })
})

describe('a list’s hover (docs/spec-v1.md section 10, #75)', () => {
  const preview = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!.map((line) => line.listPreview)

  it('shows every point of a short list with its index, in the line’s unit', () => {
    expect(preview('x = 1 m .. 3 m step 1 m in cm\ny = 2')).toEqual(['1: 100 cm\n2: 200 cm\n3: 300 cm', null])
  })

  it('shows three points from each end of a long one, and a failed point’s message', () => {
    expect(preview('x = 1 .. 30')[0]).toBe('1: 1\n2: 2\n3: 3\n…\n28: 28\n29: 29\n30: 30')
    expect(preview('x = -1 .. 1\nr(t) = t < 0 ? nope : t\nr(x)')[2]).toBe(
      '1: failed: in r(-1): Undefined symbol nope\n2: 0\n3: 1',
    )
  })
})

describe('tables (docs/spec-v1.md section 10, #76)', () => {
  const lines = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!
  const cells = (table: TableView | null) => table?.rows.map((row) => row.map((cell) => (cell.ok ? cell.text : `! ${cell.message}`)))

  it('draws one column per argument, a list run point by point and a value filling its column', () => {
    const line = lines('x = 1 .. 3\ntable(x, x / 4, 2)')[1]
    expect(line.result).toEqual(empty)
    expect(line.variables).toEqual([])
    expect(line.table?.columns.map((column) => column.unit)).toEqual(['', '', ''])
    expect(cells(line.table)).toEqual([
      ['1', '0.2500', '2'],
      ['2', '0.5000', '2'],
      ['3', '0.7500', '2'],
    ])
  })

  it('shows each column in its argument’s unit, else its list line’s, else one system unit', () => {
    const [, , table] = lines('Q = 1 L/s .. 2 L/s step 1 L/s in L/minute\nH = 500 mm .. 1500 mm step 1000 mm\ntable(Q, H, Q in L/s)')
    expect(table.table?.columns.map((column) => [column.unit, column.slot?.chosen ?? null])).toEqual([
      ['L / minute', null],
      ['m', null],
      ['L / s', 'L/s'],
    ])
    expect(cells(table.table)).toEqual([
      ['60', '0.5000', '1'],
      ['120', '1.500', '2'],
    ])
  })

  it('heads each column with its expression, typeset', () => {
    const [, table] = lines('Q_s = 1 .. 2\ntable(Q_s, Q_s^2)')
    expect(table.table?.columns.map((column) => column.header)).toEqual(['{Q}_{s}', '{ {Q}_{s}}^{2}'])
  })

  it('shows a failed point as a failed cell, and reports failures it worked out itself', () => {
    const [, , listed, table] = lines('x = -1 .. 1\nr(t) = t < 0 ? nope : t\ny = r(x)\ntable(x, y, r(x))')
    expect(listed.result.kind).toBe('list')
    expect(cells(table.table)?.[0]).toEqual([
      '-1',
      '! in r(-1): Undefined symbol nope',
      '! in r(-1): Undefined symbol nope',
    ])
    expect(table.result).toEqual(error('1 of 3 points failed. At x = -1: in r(-1): Undefined symbol nope'))
    expect(lines('x = -1 .. 1\nr(t) = t < 0 ? nope : t\ny = r(x)\ntable(x, y)')[3].result).toEqual(empty)
  })

  it('needs a list, and lists of one length', () => {
    expect(block('table(1, 2)\nx = 1 .. 3\nz = 1 .. 4\ntable(x, z)')).toEqual([
      error('a table needs a list, such as table(Q_s)'),
      { kind: 'list', text: '3 values, 1 … 3', failed: null },
      { kind: 'list', text: '4 values, 1 … 4', failed: null },
      error('x has 3 values, z has 4'),
    ])
  })

  it('typesets the line as its call', () => {
    expect(lines('x = 1 .. 2\ntable(x, 2 x)')[1].typeset).toMatchObject({
      kind: 'math',
      name: null,
      expression: expect.stringContaining('\\mathrm{table}'),
    })
  })
})

describe('plots (docs/spec-v1.md section 10, #77)', () => {
  const plotOf = (source: string) => {
    const lines = evaluateSheet([{ id: 'b', source }]).get('b')!
    return lines[lines.length - 1]
  }
  const base = 'x = 1 m .. 3 m step 1 m\nsq(t) = t^2 / (1 m)\n'

  it('gives the chart its x values, series and automatic axis titles, in the axes’ units', () => {
    const line = plotOf(`${base}plot(x in cm, sq(x), x)`)
    expect(line.result).toEqual(empty)
    expect(line.variables).toEqual([])
    expect(line.plot).toMatchObject({
      x: { label: 'x [cm]', unit: 'cm', values: [100, 200, 300], log: false, domain: null },
      y: { label: 'sq(x), x [m]', unit: 'm' },
      series: [
        { name: 'sq(x)', values: [1, 4, 9] },
        { name: 'x', values: [1, 2, 3] },
      ],
      marks: [],
      failed: [],
      width: 480,
      height: 280,
      title: null,
    })
  })

  it('reads the settings: marks, labels, points, log, ranges, size and title', () => {
    const line = plotOf(`${base}m0 = 2 m\nplot(x, sq(x)), mark m0, labels direct, points, x log, y 0 m .. 10 m, size S, title "Squares"`)
    expect(line.plot).toMatchObject({
      marks: [{ x: 2, label: 'm0 = 2 m' }],
      labelsDirect: true,
      points: true,
      x: { log: true },
      y: { domain: [0, 10] },
      width: 360,
      height: 220,
      title: 'Squares',
    })
  })

  it('draws a single-value y as a horizontal line', () => {
    expect(plotOf(`${base}plot(x, 2 m)`).plot?.series[0].values).toEqual([2, 2, 2])
  })

  it('shows a failed point as a gap and a ×, and makes it the line’s error', () => {
    const line = plotOf('x = -1 .. 1\nr(t) = t < 0 ? nope : t\nplot(x, r(x))')
    expect(line.plot?.series[0].values).toEqual([null, 0, 1])
    expect(line.plot?.failed).toEqual([{ x: -1, message: 'in r(-1): Undefined symbol nope' }])
    expect(line.result).toEqual(error('1 of 3 points failed. At x = -1: in r(-1): Undefined symbol nope'))
  })

  it.each([
    [`${base}plot(x, sq(x), 2 kW)`, 'sq(x) is a length, 2 kW is a power: one plot shows one kind'],
    [`${base}plot(x, sq(x)), wobble`, 'Unknown plot setting wobble'],
    [`${base}plot(x)`, 'a plot needs x and at least one y: plot(Q_s, Hs(Q_s))'],
    [`${base}plot(2 m, x)`, 'x must be a list: 2 m is a single value'],
    [`${base}y = 1 .. 4\nplot(x, y)`, 'x has 3 values, y has 4'],
    [`${base}plot(x - 1 m, sq(x)), x log`, 'x log needs values above 0'],
    [`${base}plot(x, sq(x)), mark 2 s`, "mark 2 s: one value of x's kind"],
    ['x = -1 .. 1\nr(t) = nope\nplot(x, r(x))', 'r(x): every point failed. At x = -1: in r(-1): Undefined symbol nope'],
  ])('is an error on the line: %s', (source, message) => {
    const line = plotOf(source)
    expect(line.result).toEqual(error(message))
    expect(line.plot).toBeNull()
  })

  it('typesets the line as its call, clauses hidden', () => {
    expect(plotOf(`${base}plot(x, sq(x)), mark 2 m`).typeset).toMatchObject({
      kind: 'math',
      name: null,
      expression: expect.not.stringContaining('mark'),
    })
  })
})

describe('constants (docs/spec-v1.md section 5)', () => {
  const run = (source: string) => evaluateSheet([{ id: 'b', source }]).get('b')!
  const results = (source: string) => run(source).map((line) => line.result)
  const warningsOf = (source: string) => run(source).map((line) => line.warnings)
  const text = (source: string) => results(source).map((r) => (r.kind === 'value' ? r.text : r.kind === 'error' ? r.message : r.kind))

  it('reads a short name as the same value as math.js’s long one', async () => {
    const { SHORT_CONSTANTS } = await import('./constants.ts')
    for (const [short, name] of SHORT_CONSTANTS) {
      const [a, b] = text(`${short}\n${name}`)
      expect(a, short).toBe(b)
    }
    expect(text('c\nR\nk\nN_A\nsigma')).toEqual([
      '2.998·10⁵ km / s',
      '8.314 (kg m^2) / (s^2 K mol)',
      '1.381·10⁻²³ (kg m^2) / (s^2 K)',
      '6.022·10²³ mol^-1',
      '5.67·10⁻⁸ kg / (s^3 K^4)',
    ])
  })

  it('keeps g the gram and gravity the constant; h is Planck’s constant and hr the hour', () => {
    expect(text('5 g\ngravity\nh\n2 hr\n90 km/hr')).toEqual([
      '5 g',
      '9.807 m / s^2',
      '6.626·10⁻³⁴ (kg m^2) / s',
      '7200 s',
      '25 m / s',
    ])
  })

  it('still takes h as the hour in a display unit, which is read as units only', () => {
    expect(text('v = 25 m/s in km/h')).toEqual(['90 km / h'])
  })

  it('lets a sheet take a short name, with no warning', () => {
    expect(text('R = 10 kohm\nI = 2 mA\nI * R')).toEqual(['empty', 'empty', '20 V'])
    expect(warningsOf('R = 10 kohm\nk = 3\nc = 2 m\nf(k) = k * 2')).toEqual([[], [], [], []])
  })

  it('a short name the sheet defines is the sheet’s on every line: an error above its line, never the constant', () => {
    expect(text('2 * R\nR = 10 ohm\n2 * R')).toEqual(['R is defined below', 'empty', '20 ohm'])
    expect(text('k = 1 +\nk * 2')).toEqual(['Unexpected end of expression (char 8)', 'k has an error above'])
    expect(warningsOf('2 * R\nR = 10 ohm')).toEqual([[], []])
    // A function body binds late, so the warning says the name comes later.
    expect(warningsOf('f(x) = k * x\nk = 2\nf(3)')).toEqual([["k isn't defined above this line"], [], []])
  })

  it('lists every constant once, each one a name math.js has, with its value', async () => {
    const { listConstants } = await import('./evaluate.ts')
    const rows = listConstants().flatMap((group) => group.rows)
    expect(new Set(rows.map((row) => row.name)).size).toBe(rows.length)
    expect(rows.length).toBeGreaterThan(55)
    for (const row of rows) {
      expect(text(row.name)[0], row.name).toBe(row.value)
      expect(row.value, row.name).not.toMatch(/undefined|object/)
    }
    const c = rows.find((row) => row.name === 'speedOfLight')!
    expect(c).toMatchObject({ short: 'c', label: 'Speed of light in vacuum', value: '2.998·10⁵ km / s', tex: 'c' })
    expect(rows.find((row) => row.short === 'hbar')!.tex).toBe('\\hbar')
    expect(rows.find((row) => row.short === 'R_inf')!.tex).toBe('{R}_{\\infty}')
  })

  it('shows the list in the sheet’s system', async () => {
    const { listConstants } = await import('./evaluate.ts')
    const uscs = listConstants({ units: { system: 'uscs', custom: {} }, digits: 4 }).flatMap((group) => group.rows)
    expect(uscs.find((row) => row.name === 'gravity')!.value).toBe('32.17 ft / s^2')
  })
})
