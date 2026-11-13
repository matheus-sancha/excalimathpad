import { describe, expect, it } from 'vitest'
import {
  codeLength,
  NO_FORMAT,
  readLine,
  splitDisplayUnit,
  writeDisplayUnit,
  writeFormat,
  type LineFormat,
} from './lineForm.ts'

describe('readLine (docs/spec-v1.md section 3, step 1: the comment)', () => {
  it.each([
    ['an empty line', ''],
    ['spaces only', '   '],
    ['a bare #', '#'],
    ['a # with spaces', '  #  '],
  ])('reads %s as blank, a spacer row', (_, line) => {
    expect(readLine(line)).toEqual({ kind: 'blank' })
  })

  it('reads a line starting with # as a comment line, without the #', () => {
    expect(readLine('# Water at 20 C, 4" Sch 40 steel')).toEqual({
      kind: 'comment',
      text: 'Water at 20 C, 4" Sch 40 steel',
    })
    expect(readLine('   #indented')).toEqual({ kind: 'comment', text: 'indented' })
  })

  it('splits a note off code at the first #', () => {
    expect(readLine('K = 4*0.9 + 0.5 # 4 elbows # and more')).toMatchObject({
      kind: 'code',
      code: 'K = 4*0.9 + 0.5',
      note: '4 elbows # and more',
    })
  })

  it('keeps code without a note as typed, but for trailing spaces', () => {
    expect(readLine('  D = 102.3 mm  ')).toMatchObject({ kind: 'code', code: '  D = 102.3 mm', note: null })
    expect(readLine('D = 102.3 mm #')).toMatchObject({ kind: 'code', code: 'D = 102.3 mm', note: null })
  })

  it('ignores a # inside a string', () => {
    expect(readLine('s = "a # b" # note')).toMatchObject({ kind: 'code', code: 's = "a # b"', note: 'note' })
    expect(readLine("s = 'a # b'")).toMatchObject({ kind: 'code', code: "s = 'a # b'", note: null })
    expect(readLine('s = "say \\"#\\"" # n')).toMatchObject({
      kind: 'code',
      code: 's = "say \\"#\\""',
      note: 'n',
    })
  })

  it("reads ' after a value as a transpose, not a string", () => {
    expect(readLine("B = A' # transposed")).toMatchObject({ kind: 'code', code: "B = A'", note: 'transposed' })
  })
})

describe('the format clause (docs/spec-v1.md section 3: after everything, before the note)', () => {
  const formatOf = (line: string) => {
    const form = readLine(line)
    return form.kind === 'code' ? form : null
  }
  const format = (props: Partial<LineFormat>): LineFormat => ({ ...NO_FORMAT, ...props })

  it('has no format without a clause', () => {
    expect(formatOf('U = I * R')).toMatchObject({ format: NO_FORMAT, unknownFormat: null })
  })

  it('takes the @ words off the code, so math.js never sees them', () => {
    expect(formatOf('U = I * R @bold @yellow')).toEqual({
      kind: 'code',
      code: 'U = I * R',
      note: null,
      format: { bold: true, underline: false, color: 'yellow', textColor: null },
      unknownFormat: null,
      rules: [],
      displayUnit: null,
      expression: 'U = I * R',
    })
  })

  it('reads the words in any order, after in <unit> and before the note', () => {
    expect(formatOf('dP = f * 2 in kPa @green @underline # friction')).toMatchObject({
      code: 'dP = f * 2 in kPa',
      note: 'friction',
      format: format({ underline: true, color: 'green' }),
    })
  })

  it.each(['yellow', 'green', 'blue', 'red', 'gray'] as const)('knows the colour %s', (color) => {
    expect(formatOf(`x = 1 @${color}`)!.format.color).toBe(color)
  })

  it('keeps the last of two colours', () => {
    expect(formatOf('x = 1 @red @blue')!.format.color).toBe('blue')
  })

  it('names the first word that isn’t a format, and still takes the clause off', () => {
    expect(formatOf('x = 1 @bolt @bold @pink')).toMatchObject({
      code: 'x = 1',
      format: format({ bold: true }),
      unknownFormat: '@bolt',
    })
    expect(formatOf('x = 1 @')).toMatchObject({ code: 'x = 1', unknownFormat: '@' })
  })

  it('leaves an @ alone inside a string, inside a note, and in the middle of the code', () => {
    expect(formatOf('s = "a @bold"')).toMatchObject({ code: 's = "a @bold"', format: NO_FORMAT })
    expect(formatOf('x = 1 # see @bold')).toMatchObject({ code: 'x = 1', note: 'see @bold', format: NO_FORMAT })
    // In the middle of the code, the clause starts there: it is the line's format error (M4c).
    expect(formatOf('x = 1 @bold + 2')).toMatchObject({ code: 'x = 1', format: NO_FORMAT, unknownFormat: '@bold' })
  })

  it('gives a comment line and a blank line no format', () => {
    expect(readLine('# heading @bold')).toEqual({ kind: 'comment', text: 'heading @bold' })
    expect(readLine('   ')).toEqual({ kind: 'blank' })
  })
})

describe('text colours and rules (docs/spec-v1.md section 3, M4c)', () => {
  const formatOf = (line: string) => {
    const form = readLine(line)
    if (form.kind !== 'code') throw new Error('not code')
    return form
  }
  it('reads a text colour, apart from a highlight; the last of two wins', () => {
    expect(formatOf('U = I * R in V @bold @text-red @yellow # check')).toMatchObject({
      code: 'U = I * R in V',
      format: { bold: true, underline: false, color: 'yellow', textColor: 'red' },
      unknownFormat: null,
    })
    expect(formatOf('x = 1 @red')).toMatchObject({ format: { color: 'red', textColor: null } })
    expect(formatOf('x = 1 @text-red @text-blue')).toMatchObject({ format: { textColor: 'blue' } })
  })

  it('makes a word that isn’t a format the line’s error', () => {
    expect(formatOf('x = 1 @text-purple')).toMatchObject({ unknownFormat: '@text-purple' })
    expect(formatOf('x = 1 @purple')).toMatchObject({ unknownFormat: '@purple' })
  })

  it('reads each word’s own rule, to the next @, beside the plain formats', () => {
    const form = formatOf('v = Q / A @bold @text-red if v > 3 m/s @text-orange if v > 2 m/s # check')
    expect(form).toMatchObject({ code: 'v = Q / A', note: 'check', format: { bold: true, textColor: null } })
    expect(form.kind === 'code' && form.rules).toEqual([
      { word: { kind: 'text', color: 'red' }, condition: 'v > 3 m/s', text: '@text-red if v > 3 m/s' },
      { word: { kind: 'text', color: 'orange' }, condition: 'v > 2 m/s', text: '@text-orange if v > 2 m/s' },
    ])
    expect(formatOf('x = 1 @blod if x > 0')).toMatchObject({ unknownFormat: '@blod' })
    expect(formatOf('s = "a@b" @red if s == "a@b"')).toMatchObject({ code: 's = "a@b"' })
  })
})

describe('writeFormat (what the format bar writes)', () => {
  const bold: LineFormat = { ...NO_FORMAT, bold: true }

  it('adds the clause after the code', () => {
    expect(writeFormat('U = I * R', bold)).toBe('U = I * R @bold')
    expect(writeFormat('U = I * R in V', { bold: true, underline: true, color: 'yellow', textColor: null })).toBe(
      'U = I * R in V @bold @underline @yellow',
    )
  })

  it('writes it before the note, which stays exactly as typed', () => {
    expect(writeFormat('D = 102.3 mm  #  4" Sch 40', bold)).toBe('D = 102.3 mm @bold #  4" Sch 40')
  })

  it('replaces the clause that is there, unknown words too', () => {
    expect(writeFormat('x = 1 @bolt @red # n', { ...NO_FORMAT, color: 'blue' })).toBe('x = 1 @blue # n')
  })

  it('writes the plain words in a fixed order, then every rule exactly as typed', () => {
    expect(
      writeFormat('v = Q / A @text-red if v > 3 m/s @yellow @red if  v>4 m/s # n', {
        bold: true,
        underline: true,
        color: 'green',
        textColor: 'blue',
      }),
    ).toBe('v = Q / A @bold @underline @text-blue @green @text-red if v > 3 m/s @red if  v>4 m/s # n')
    expect(writeFormat('v = 1 @text-red if v > 0', NO_FORMAT)).toBe('v = 1 @text-red if v > 0')
  })

  it('removes the clause for no format', () => {
    expect(writeFormat('x = 1 @bold @red', NO_FORMAT)).toBe('x = 1')
    expect(writeFormat('x = 1 @bold # n', NO_FORMAT)).toBe('x = 1 # n')
  })

  it('leaves a line with no code unchanged', () => {
    expect(writeFormat('# heading', bold)).toBe('# heading')
    expect(writeFormat('', bold)).toBe('')
  })

  it('reads back what it wrote', () => {
    const format: LineFormat = { bold: true, underline: true, color: 'gray', textColor: 'red' }
    const form = readLine(writeFormat('  Q = 2 L/s # flow', format))
    expect(form).toMatchObject({ code: '  Q = 2 L/s', note: 'flow', format, unknownFormat: null })
  })

  it('says where the code ends, for the caret', () => {
    expect(codeLength('x = 1 @bold # n')).toBe(5)
    expect(codeLength('x = 1')).toBe(5)
  })
})

describe('splitDisplayUnit (docs/spec-v1.md section 3, step 3)', () => {
  it.each([
    ['dP = a * b in kPa', 'dP = a * b', 'kPa'],
    ['Q = q to L/minute', 'Q = q', 'L/minute'],
    ['D = 102.3 mm in in', 'D = 102.3 mm', 'in'],
    ['a to m in cm', 'a to m', 'cm'],
    ['x = 2', 'x = 2', null],
    ['x = (a in bar) + b', 'x = (a in bar) + b', null],
    ['s = "go to bed"', 's = "go to bed"', null],
    ['x_in = 2 in_2', 'x_in = 2 in_2', null],
    ['in = 2', 'in = 2', null],
  ])('%s', (code, expression, displayUnit) => {
    expect(splitDisplayUnit(code)).toEqual({ expression, displayUnit })
  })

  it('reads a line’s display unit after its format clause and note are off', () => {
    expect(readLine('U = I * R in V @bold # check')).toMatchObject({
      code: 'U = I * R in V',
      expression: 'U = I * R',
      displayUnit: 'V',
    })
  })
})

describe('writeDisplayUnit (docs/spec-v1.md sections 3 and 5: what the unit slot writes)', () => {
  it.each([
    ['D = 102.3 mm', 'cm', 'D = 102.3 mm in cm'],
    ['D = 102.3 mm in in', 'cm', 'D = 102.3 mm in cm'],
    ['D = 102.3 mm in in', null, 'D = 102.3 mm'],
    ['dP = a * b # friction only', 'kPa', 'dP = a * b in kPa # friction only'],
    ['U = I * R in V @bold @yellow # check', 'mV', 'U = I * R in mV @bold @yellow # check'],
    ['U = I * R @bold', null, 'U = I * R @bold'],
    ['Q = q to L/s   # flow', 'L/minute', 'Q = q in L/minute # flow'],
    ['# a comment', 'm', '# a comment'],
  ])('%s with %s', (line, unit, written) => {
    expect(writeDisplayUnit(line, unit)).toBe(written)
  })
})
