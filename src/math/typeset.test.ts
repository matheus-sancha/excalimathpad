import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { evaluateSheet, typesetResult, type TypesetLine } from './evaluate.ts'
import { nameTex, textTex } from './typeset.ts'

/** Each line of one block, typeset in a sheet of that block. */
function typeset(source: string): TypesetLine[] {
  return evaluateSheet([{ id: 'b', source }]).get('b')!.map(({ typeset }) => typeset)
}

const math = (line: TypesetLine) => {
  if (line.kind !== 'math') throw new Error(`not a math line: ${JSON.stringify(line)}`)
  return line
}

/** KaTeX at its strictest (the research's probe): bad TeX throws, non-LaTeX input throws. */
function render(tex: string) {
  return katex.renderToString(tex, { throwOnError: true, strict: 'error' })
}

const PUMP_SHEET_LINES_1_13 = [
  '# Water at 20 C, 4" Sch 40 steel, between two open tanks',
  'rho = 998.2 kg/m^3',
  'mu = 1.002 cP',
  'D = 102.3 mm',
  'L_p = 150 m',
  'eps = 0.045 mm',
  'K = 4*0.9 + 2*0.15 + 0.5 + 1.0 # 4 elbows, 2 gate valves, entry, exit',
  'dz = 12 m',
  'g_n = 9.80665 m/s^2',
  'Q_d = 15 L/s',
  'eta = 0.70',
  'A_p = pi D^2 / 4',
  'v(Q) = Q / A_p',
  'Re(Q) = rho v(Q) D / mu',
]

describe('nameTex (docs/spec-v1.md section 4, Typesetting names)', () => {
  it.each([
    ['one letter', 'D', 'D'],
    ['a multi-letter subscript, upright', 'L_pipe', '{L}_{\\mathrm{pipe}}'],
    ['a digit subscript', 'H_0', '{H}_{0}'],
    ['a one-letter subscript, italic', 'Q_s', '{Q}_{s}'],
    ['a whole Greek base', 'rho_w', '{\\rho}_{w}'],
    ['a Greek word before a capital', 'DeltaP', '\\Delta P'],
    ['a Greek word, then a longer word', 'deltaT_max', '{\\delta T}_{\\mathrm{max}}'],
    ['a Greek name alone', 'eta', '\\eta'],
    ['a multi-letter name, one italic word', 'Re', '\\mathit{Re}'],
    ['a word that starts like a Greek one', 'piston', '\\mathit{piston}'],
    ['dP, which isn’t guessed to be ΔP', 'dP', '\\mathit{dP}'],
    ['eps, which isn’t a Greek word', 'eps', '\\mathit{eps}'],
    ['a Greek subscript', 'T_alpha', '{T}_{\\alpha}'],
    ['a second underscore', 'a_b_c', '{a}_{\\mathrm{b\\_c}}'],
    ['a dollar sign', 'a$b', '\\mathit{a\\$b}'],
    ['a Greek Unicode name', 'ΔP', '\\mathit{ΔP}'],
  ])('%s: %s', (_, name, tex) => {
    expect(nameTex(name)).toBe(tex)
    expect(() => render(tex)).not.toThrow()
  })
})

describe('typeset lines', () => {
  it('splits an assignment into its name and expression cells', () => {
    expect(math(typeset('Q = 1\nA_p = 2\nv_d = Q / A_p')[2])).toMatchObject({
      kind: 'math',
      name: '{v}_{d}',
      expression: '\\frac{ Q}{ {A}_{p}}',
      note: null,
    })
  })

  it('leaves the name cell empty for a bare expression', () => {
    expect(math(typeset('2 * 4')[0]).name).toBeNull()
  })

  it('sets a quantity inline, with a thin space', () => {
    expect(math(typeset('Q = 50 m^3/hr')[0]).expression).toBe('50\\,{\\mathrm{m}}^{3}/\\mathrm{hr}')
    expect(math(typeset('mu = 1.002 kg/(m s)')[0]).expression).toBe(
      '1.002\\,\\mathrm{kg}/\\left(\\mathrm{m}\\,\\mathrm{s}\\right)',
    )
  })

  it('shows a variable named like a unit as a variable, from its line down', () => {
    const [above, defined, below] = typeset('x = 5 L\nL = 120 m\ny = 2 L')
    expect(math(above).expression).toBe('5\\,\\mathrm{L}')
    expect(math(defined).name).toBe('L')
    expect(math(below).expression).not.toContain('\\mathrm{L}')
  })

  it('puts a function’s parameters in its name cell, and typesets them as names in the body', () => {
    const line = math(typeset('f(Re, k) = 0.25 / log10(k / Re)^2')[0])
    expect(line.name).toBe('f\\left(\\mathit{Re},k\\right)')
    expect(line.expression).not.toContain('\\mathrm{k}')
  })

  it('a parameter named like a unit stays a name in the body', () => {
    expect(math(typeset('u(s) = s + 5 s')[0]).expression).not.toContain('\\mathrm{s}')
  })

  it('sets a call to a sheet function as its name, and leaves built-ins to math.js', () => {
    const [, call, , longer] = typeset('v(Q) = Q / 2\nv_d = v(3) + sqrt(4)\nHs(Q) = 2 Q\nHs(1)')
    expect(math(call).expression).toContain('v\\left(3\\right)')
    expect(math(call).expression).toContain('\\sqrt{4}')
    expect(math(longer).expression).toBe('\\mathit{Hs}\\left(1\\right)')
  })

  it('hides a trailing in or to, which is the result’s display unit', () => {
    expect(math(typeset('dP = 2 kPa + 1 kPa in bar')[0]).expression).not.toContain('bar')
    expect(math(typeset('x = 5 m to cm')[0]).expression).toBe('5\\,\\mathrm{m}')
  })

  it('shows micro as µ, not math.js’s u, and ohm as Ω', () => {
    expect(math(typeset('d = 3 um')[0]).expression).toBe('3\\,\\mathrm{\\mu m}')
    expect(math(typeset('R = 10 kohm')[0]).expression).toBe('10\\,\\mathrm{k}\\Omega')
  })

  it('keeps the note out of the code', () => {
    expect(math(typeset('K = 4*0.9 # 4 elbows')[0]).note).toBe('4 elbows')
  })

  it('reads blank lines, comment lines and lines that don’t parse', () => {
    expect(typeset('\n#\n# Water at 20 C\nx = (1 + # oops')).toEqual([
      { kind: 'blank' },
      { kind: 'blank' },
      { kind: 'comment', text: 'Water at 20 C' },
      { kind: 'unparsed', source: 'x = (1 + # oops' },
    ])
  })

  // M1's hand check types lines 1-13 of the pump sheet (spec section 16).
  it('KaTeX renders every cell of pump-sheet lines 1-13, strictly', () => {
    const lines = typeset(PUMP_SHEET_LINES_1_13.join('\n'))
    expect(lines.map(({ kind }) => kind)).toEqual(['comment', ...Array(13).fill('math')])
    lines.forEach((line, i) => {
      if (line.kind !== 'math') return
      for (const tex of [line.name, line.expression]) {
        if (tex !== null) expect(() => render(tex), PUMP_SHEET_LINES_1_13[i]).not.toThrow()
      }
    })
  })
})

describe('solve lines (section 4: keyword form, guess small after it)', () => {
  it('typesets the value form: the name, solve and the equation, the range apart', () => {
    const line = math(typeset('Hp(Q) = 2 Q\nHs(Q) = Q + 1\nQ_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s in L/s')[2])
    expect(line.name).toBe('{Q}_{\\mathrm{op}}')
    expect(line.expression).toBe('\\mathrm{solve}\\;\\mathit{Hp}\\left( Q\\right)=\\mathit{Hs}\\left( Q\\right)')
    expect(line.aside).toBe('Q=1\\,\\mathrm{L}/\\mathrm{s}\\ldots 30\\,\\mathrm{L}/\\mathrm{s}')
    expect(() => render(line.aside!)).not.toThrow()
  })

  it('typesets the function form, its unknown and parameters as names, and renders in KaTeX', () => {
    const line = math(
      typeset('f(Re, r) = solve 1/sqrt(f) = -2 log10(r/3.7 + 2.51/(Re sqrt(f))), guess f = 0.02')[0],
    )
    expect(line.name).toBe('f\\left(\\mathit{Re},r\\right)')
    for (const tex of [line.name!, line.expression, line.aside!]) expect(() => render(tex)).not.toThrow()
  })

  it('gives other lines no aside', () => {
    expect(math(typeset('x = 2')[0]).aside).toBeUndefined()
  })
})

describe('range lines (section 4: start … end, the step small after it)', () => {
  it('typesets the range with its step apart, and renders in KaTeX', () => {
    const line = math(typeset('Q_s = 1 L/s .. 30 L/s step 1 L/s')[0])
    expect(line.name).toBe('{Q}_{s}')
    expect(line.expression).toBe('1\\,\\mathrm{L}/\\mathrm{s}\\ldots 30\\,\\mathrm{L}/\\mathrm{s}')
    expect(line.aside).toBe('\\text{step }1\\,\\mathrm{L}/\\mathrm{s}')
    for (const tex of [line.name!, line.expression, line.aside!]) expect(() => render(tex)).not.toThrow()
  })

  it('has no aside without a step, and no name for a bare range', () => {
    const line = math(typeset('1 .. 10')[0])
    expect(line).toMatchObject({ name: null, expression: '1\\ldots 10' })
    expect(line.aside).toBeUndefined()
  })
})

describe('typesetResult (section 4: from the result’s plain text)', () => {
  it.each([
    ['a number', '6', '6'],
    ['a negative number', '-2.5', '-2.5'],
    ['a value with a unit', '20 V', '20\\,\\mathrm{V}'],
    ['a prefixed power', '600 mm^2', '600\\,{\\mathrm{mm}}^{2}'],
    ['a compound unit', '60 mi / hr', '60\\,\\mathrm{mi}/\\mathrm{hr}'],
    ['micro', '6 uA', '6\\,\\mathrm{\\mu A}'],
    ['scientific notation (section 5)', '1.235·10⁴ m', '1.235 \\cdot 10^{4}\\,\\mathrm{m}'],
    ['a negative exponent', '-4.399·10⁻⁴', '-4.399 \\cdot 10^{-4}'],
    ['infinity', '-∞', '-\\infty'],
    ['not a number, as text', 'NaN', '\\text{NaN}'],
    ['a complex number, as text', '2 + 3i', '\\text{2 + 3i}'],
    ['a matrix, as text', '[1, 2]', '\\text{[1, 2]}'],
    ['a string, as text', '"a # b"', '\\text{"a \\# b"}'],
  ])('%s: %s', (_, text, tex) => {
    expect(typesetResult(text)).toBe(tex)
    expect(() => render(tex)).not.toThrow()
  })

  it('escapes every TeX special character in text', () => {
    expect(() => render(textTex('\\ { } $ & # ^ _ % ~'))).not.toThrow()
  })
})

describe('an index (docs/spec-v1.md section 4, Typesetting names; #104)', () => {
  it('shows in square brackets after the whole name, at the baseline, not as a subscript', () => {
    const [, line] = typeset('Q_s = 1 .. 3\nQ_5 = Q_s[2] + 1')
    expect(math(line).expression).toBe('{Q}_{s}\\lbrack 2\\rbrack +1')
    expect(() => render(math(line).expression)).not.toThrow()
  })
})

