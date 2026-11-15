import { describe, expect, it } from 'vitest'
import {
  caretAfterFormat,
  codeLength,
  hasTopLevelSemicolon,
  NO_COMMENT_FORMAT,
  NO_FORMAT,
  readLine,
  splitDisplayUnit,
  ruleText,
  writeCommentFormat,
  writeDisplayUnit,
  writeFormat,
  writeNewRule,
  writeRules,
  type CommentFormat,
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
      format: NO_COMMENT_FORMAT,
      formatError: null,
    })
    expect(readLine('   #indented')).toEqual({ kind: 'comment', text: 'indented', format: NO_COMMENT_FORMAT, formatError: null })
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
    expect(formatOf('U = I * R')).toMatchObject({ format: NO_FORMAT, formatError: null })
  })

  it('takes the @ words off the code, so math.js never sees them', () => {
    expect(formatOf('U = I * R @bold @yellow')).toEqual({
      kind: 'code',
      code: 'U = I * R',
      note: null,
      format: { bold: true, underline: false, color: 'yellow', textColor: null },
      formatError: null,
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
      formatError: 'Unknown format @bolt',
    })
    expect(formatOf('x = 1 @')).toMatchObject({ code: 'x = 1', formatError: 'Unknown format @' })
  })

  it('leaves an @ alone inside a string, inside a note, and in the middle of the code', () => {
    expect(formatOf('s = "a @bold"')).toMatchObject({ code: 's = "a @bold"', format: NO_FORMAT })
    expect(formatOf('x = 1 # see @bold')).toMatchObject({ code: 'x = 1', note: 'see @bold', format: NO_FORMAT })
    // In the middle of the code, the clause starts there: it is the line's format error (M4c).
    expect(formatOf('x = 1 @bold + 2')).toMatchObject({ code: 'x = 1', format: NO_FORMAT, formatError: 'Unknown format @bold' })
  })

  it('gives a comment line and a blank line no format', () => {
    expect(readLine('# heading @bold')).toEqual({
      kind: 'comment',
      text: 'heading @bold',
      format: NO_COMMENT_FORMAT,
      formatError: null,
    })
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
      formatError: null,
    })
    expect(formatOf('x = 1 @red')).toMatchObject({ format: { color: 'red', textColor: null } })
    expect(formatOf('x = 1 @text-red @text-blue')).toMatchObject({ format: { textColor: 'blue' } })
  })

  it('makes a word that isn’t a format the line’s error', () => {
    expect(formatOf('x = 1 @text-purple')).toMatchObject({ formatError: 'Unknown format @text-purple' })
    expect(formatOf('x = 1 @purple')).toMatchObject({ formatError: 'Unknown format @purple' })
  })

  it('reads each word’s own rule, to the next @, beside the plain formats', () => {
    const form = formatOf('v = Q / A @bold @text-red if v > 3 m/s @text-orange if v > 2 m/s # check')
    expect(form).toMatchObject({ code: 'v = Q / A', note: 'check', format: { bold: true, textColor: null } })
    expect(form.kind === 'code' && form.rules).toEqual([
      { words: [{ kind: 'text', color: 'red' }], condition: 'v > 3 m/s', text: '@text-red if v > 3 m/s', start: 16, end: 38 },
      { words: [{ kind: 'text', color: 'orange' }], condition: 'v > 2 m/s', text: '@text-orange if v > 2 m/s', start: 39, end: 64 },
    ])
    expect(formatOf('x = 1 @blod if x > 0')).toMatchObject({ formatError: 'Unknown format @blod' })
    expect(formatOf('s = "a@b" @red if s == "a@b"')).toMatchObject({ code: 's = "a@b"' })
  })
})

describe('joined words (docs/spec-v1.md section 3, Joined words, M4d)', () => {
  it('reads words joined by + as one word: plain, or one rule with one if', () => {
    expect(readLine('x = 1 @bold+underline+text-red+red @text-blue+text-green')).toMatchObject({
      format: { bold: true, underline: true, color: 'red', textColor: 'green' },
      formatError: null,
    })
    const form = readLine('v = 4 @text-red+red+bold if v > 3 m/s # n')
    expect(form.kind === 'code' && form.rules).toEqual([
      {
        words: [{ kind: 'text', color: 'red' }, { kind: 'highlight', color: 'red' }, { kind: 'bold' }],
        condition: 'v > 3 m/s',
        text: '@text-red+red+bold if v > 3 m/s',
        start: 6,
        end: 37,
      },
    ])
  })

  it('names a part that isn’t a format, in the word it is in', () => {
    expect(readLine('x = 1 @text-red+blod')).toMatchObject({ formatError: 'Unknown format @blod in @text-red+blod' })
    expect(readLine('x = 1 @text-red+blod if x > 0')).toMatchObject({ formatError: 'Unknown format @blod in @text-red+blod', rules: [] })
    expect(readLine('x = 1 @bold+L')).toMatchObject({ formatError: '@L is for comment lines' })
    expect(readLine('x = 1 @bold+')).toMatchObject({ formatError: 'Unknown format @bold+' })
    // Spaces end a word: `@bold + red` isn't joined.
    expect(readLine('x = 1 @bold + red')).toMatchObject({ formatError: 'Unknown format @bold' })
  })

  it('reads joined words on a comment line too', () => {
    expect(readLine('@bold+L+text-blue # Pumps')).toMatchObject({ kind: 'comment', format: { bold: true, size: 'L', textColor: 'blue' } })
    expect(readLine('@bold+lg # Pumps')).toMatchObject({ formatError: 'Unknown format @lg in @bold+lg' })
  })
})

describe('the Rules list’s writers (docs/spec-v1.md section 4, Rules list, M4d)', () => {
  const LINE = 'v = 4 m/s @bold @text-red if v > 3 m/s @yellow+underline if v>2 m/s # speed'
  const rulesOf = (line: string) => {
    const form = readLine(line)
    return form.kind === 'code' ? form.rules : []
  }

  it('keeps a row it didn’t change exactly as typed, and writes a changed one as one joined word', () => {
    const [red, yellow] = rulesOf(LINE)
    expect(writeRules(LINE, [yellow, red])).toBe('v = 4 m/s @bold @yellow+underline if v>2 m/s @text-red if v > 3 m/s # speed')
    expect(
      writeRules(LINE, [{ ...red, words: [...red.words, { kind: 'highlight', color: 'red' }, { kind: 'bold' }], text: null }, yellow]),
    ).toBe('v = 4 m/s @bold @text-red+red+bold if v > 3 m/s @yellow+underline if v>2 m/s # speed')
    expect(writeRules(LINE, [yellow])).toBe('v = 4 m/s @bold @yellow+underline if v>2 m/s # speed')
  })

  it('writes the words in the order text, highlight, bold, underline, the last of a property kept', () => {
    expect(ruleText([{ kind: 'underline' }, { kind: 'highlight', color: 'red' }, { kind: 'text', color: 'blue' }, { kind: 'text', color: 'red' }], ' v > 3 ')).toBe(
      '@text-red+red+underline if v > 3',
    )
    expect(ruleText([{ kind: 'bold' }], '')).toBe('@bold if')
  })

  it('+ Add rule writes @text-red if <name> at the end of the clause, before the note, the caret after it', () => {
    expect(writeNewRule('v = 4 m/s @bold # speed', 'v')).toEqual({ text: 'v = 4 m/s @bold @text-red if v  # speed', caret: 31 })
    expect(writeNewRule('Q / A', 'result')).toEqual({ text: 'Q / A @text-red if result ', caret: 26 })
    expect(writeNewRule('table(x)  ', null)).toEqual({ text: 'table(x) @text-red if ', caret: 22 })
    // What it wrote reads back as the last rule, with nothing yet after the name.
    expect(rulesOf(writeNewRule('v = 4 # speed', 'v').text).at(-1)).toMatchObject({ condition: 'v', end: 20 })
  })

  it('leaves a line with no code alone', () => {
    expect(writeRules('# Pumps', [])).toBe('# Pumps')
  })
})

describe('a comment line’s format (docs/spec-v1.md section 3, A comment line’s format, M4d)', () => {
  const comment = (format: Partial<CommentFormat>, text: string, formatError: string | null = null) => ({
    kind: 'comment',
    text,
    format: { ...NO_COMMENT_FORMAT, ...format },
    formatError,
  })

  it('reads a clause before the # as the comment’s format', () => {
    expect(readLine('@bold @L @text-blue # Pumps and pipes')).toEqual(
      comment({ bold: true, size: 'L', textColor: 'blue' }, 'Pumps and pipes'),
    )
    expect(readLine('  @bold @upright @underline @XL @text-red @yellow   #   Heading  ')).toEqual(
      comment({ bold: true, upright: true, underline: true, size: 'XL', textColor: 'red', color: 'yellow' }, 'Heading'),
    )
    expect(readLine('@S # small print')).toEqual(comment({ size: 'S' }, 'small print'))
  })

  it('keeps the last of two sizes and of two colours', () => {
    expect(readLine('@S @XL @red @gray @text-red @text-green # x')).toEqual(
      comment({ size: 'XL', color: 'gray', textColor: 'green' }, 'x'),
    )
  })

  it('reads nothing after the #, so every comment saved before M4d reads as before', () => {
    expect(readLine('# call me @home')).toEqual(comment({}, 'call me @home'))
    expect(readLine('#@bold @L Pumps')).toEqual(comment({}, '@bold @L Pumps'))
    expect(readLine('@bold # see @L and # more')).toEqual(comment({ bold: true }, 'see @L and # more'))
  })

  it.each([['@bold'], ['@bold #'], ['  @L @text-red  #   '], ['@blod'], ['@bold if x > 1']])(
    'reads a clause with no comment text after it, %j, as a blank line',
    (line) => {
      expect(readLine(line)).toEqual({ kind: 'blank' })
    },
  )

  it('makes a rule the line’s error, and keeps the clause’s other words', () => {
    expect(readLine('@bold @text-red if x > 3 # Pumps')).toEqual(comment({ bold: true }, 'Pumps', 'rules need a math line'))
    expect(readLine('@L if ok # Pumps')).toEqual(comment({}, 'Pumps', 'rules need a math line'))
  })

  it('makes a word a comment line doesn’t take the line’s error, the first one named', () => {
    expect(readLine('@blod @L # x')).toEqual(comment({ size: 'L' }, 'x', 'Unknown format @blod'))
    expect(readLine('@M # x')).toEqual(comment({}, 'x', 'Unknown format @M'))
    expect(readLine('@l # x')).toEqual(comment({}, 'x', 'Unknown format @l'))
    expect(readLine('@bold 2 # x')).toEqual(comment({}, 'x', 'Unknown format @bold'))
    expect(readLine('@ # x')).toEqual(comment({}, 'x', 'Unknown format @'))
  })

  it('makes a comment word on a math line its error, by name', () => {
    const errorOf = (line: string) => {
      const form = readLine(line)
      return form.kind === 'code' ? form.formatError : form
    }
    expect(errorOf('x = 1 @L')).toBe('@L is for comment lines')
    expect(errorOf('x = 1 @bold @upright # n')).toBe('@upright is for comment lines')
    expect(errorOf('x = 1 @S')).toBe('@S is for comment lines')
    expect(errorOf('x = 1 @XL if x > 0')).toBe('@XL is for comment lines')
    expect(readLine('x = 1 @bold @L')).toMatchObject({ code: 'x = 1', format: { bold: true } })
  })

  it('leaves a note’s @ words alone', () => {
    expect(readLine('x = 1 # see @L')).toMatchObject({ kind: 'code', note: 'see @L', formatError: null })
  })

  it('is left as typed by the format bar and the unit slot', () => {
    expect(writeFormat('@bold @L # Pumps', { ...NO_FORMAT, underline: true })).toBe('@bold @L # Pumps')
    expect(writeFormat('@bold', { ...NO_FORMAT, underline: true })).toBe('@bold')
    expect(writeDisplayUnit('@bold @L # Pumps', 'm')).toBe('@bold @L # Pumps')
    expect(codeLength('@bold @L # Pumps')).toBe(0)
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
    expect(form).toMatchObject({ code: '  Q = 2 L/s', note: 'flow', format, formatError: null })
  })

  it('says where the code ends, for the caret', () => {
    expect(codeLength('x = 1 @bold # n')).toBe(5)
    expect(codeLength('x = 1')).toBe(5)
  })
})

describe('writeCommentFormat (what the Format tab writes on a comment line, M4d)', () => {
  const all: CommentFormat = { bold: true, upright: true, underline: true, size: 'XL', textColor: 'blue', color: 'yellow' }

  it('writes the words in the fixed order, before the #, the comment as typed', () => {
    expect(writeCommentFormat('#  Pumps @home', all)).toBe('@bold @upright @underline @XL @text-blue @yellow #  Pumps @home')
    expect(writeCommentFormat('# Pumps', { ...NO_COMMENT_FORMAT, size: 'L' })).toBe('@L # Pumps')
  })

  it('replaces the clause there was, and takes it off for no format', () => {
    expect(writeCommentFormat('@L @bold @red # Pumps', { ...NO_COMMENT_FORMAT, bold: true })).toBe('@bold # Pumps')
    expect(writeCommentFormat('@bold @L # Pumps', NO_COMMENT_FORMAT)).toBe('# Pumps')
  })

  it('drops words a comment doesn’t take', () => {
    expect(writeCommentFormat('@bolt @red if x > 1 # Pumps', NO_COMMENT_FORMAT)).toBe('# Pumps')
  })

  it('reads back what it wrote', () => {
    expect(readLine(writeCommentFormat('# Pumps', all))).toEqual({ kind: 'comment', text: 'Pumps', format: all, formatError: null })
  })

  it('leaves a math line, a blank line and a bare clause alone', () => {
    for (const line of ['x = 1 # n', '', '#', '@bold']) expect(writeCommentFormat(line, all)).toBe(line)
  })

  it('keeps the caret in the comment text where it was; in the clause, before the #', () => {
    // `# Pumps` with the caret after `Pu`, then `@bold # Pumps`: still after `Pu`.
    expect(caretAfterFormat('# Pumps', '@bold # Pumps', 4)).toBe(10)
    expect(caretAfterFormat('@bold @L # Pumps', '# Pumps', 13)).toBe(4)
    expect(caretAfterFormat('@bold @L # Pumps', '@L # Pumps', 2)).toBe(2)
    expect(caretAfterFormat('@bold @L # Pumps', '# Pumps', 8)).toBe(0)
    // A math line: where it was in the code, never in the clause.
    expect(caretAfterFormat('x = 2 # two', 'x = 2 @bold # two', 3)).toBe(3)
    expect(caretAfterFormat('x = 2 # two', 'x = 2 @bold # two', 9)).toBe(5)
  })
})

describe('hasTopLevelSemicolon (docs/spec-v1.md section 3, step 6: one statement)', () => {
  it.each([
    ['x1 = 5; y1 = x1 * 2', true],
    ['x = 5;', true],
    ['Q = 1 .. 3; R = 2', true],
    ['[1, 2; 3, 4]', false],
    ['f([1; 2])', false],
    ['s = "a; b"', false],
    ["s = 'a; b'", false],
    ["A'; B", true],
    ['x = 2', false],
  ])('%s', (code, expected) => {
    expect(hasTopLevelSemicolon(code)).toBe(expected)
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
