import { describe, expect, it } from 'vitest'
import {
  caretAfterFormat,
  codeLength,
  commitFormat,
  hasTopLevelSemicolon,
  joinClauses,
  lineFormats,
  pressCommentFormat,
  pressFormat,
  newRule,
  conditionText,
  pressRules,
  splitFormat,
  storeFormats,
  withFormat,
  NO_COMMENT_FORMAT,
  NO_FORMAT,
  readLine,
  splitDisplayUnit,
  ruleText,
  writeCommentFormat,
  writeDisplayUnit,
  writeFormat,
  writeRules,
  type CommentFormat,
  type LineFormat,
} from './lineForm.ts'
import { SLOT_UNITS } from './unitSystems.ts'
import type { EngineMessage } from './messages.ts'

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
      formatError: { code: 'unknownFormat', word: '@bolt' },
    })
    expect(formatOf('x = 1 @')).toMatchObject({ code: 'x = 1', formatError: { code: 'unknownFormat', word: '@' } })
  })

  it('leaves an @ alone inside a string, inside a note, and in the middle of the code', () => {
    expect(formatOf('s = "a @bold"')).toMatchObject({ code: 's = "a @bold"', format: NO_FORMAT })
    expect(formatOf('x = 1 # see @bold')).toMatchObject({ code: 'x = 1', note: 'see @bold', format: NO_FORMAT })
    // In the middle of the code, the clause starts there: it is the line's format error (M4c).
    expect(formatOf('x = 1 @bold + 2')).toMatchObject({ code: 'x = 1', format: NO_FORMAT, formatError: { code: 'unknownFormat', word: '@bold' } })
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
    expect(formatOf('x = 1 @text-purple')).toMatchObject({ formatError: { code: 'unknownFormat', word: '@text-purple' } })
    expect(formatOf('x = 1 @purple')).toMatchObject({ formatError: { code: 'unknownFormat', word: '@purple' } })
  })

  it('reads each word’s own rule, to the next @, beside the plain formats', () => {
    const form = formatOf('v = Q / A @bold @text-red if v > 3 m/s @text-orange if v > 2 m/s # check')
    expect(form).toMatchObject({ code: 'v = Q / A', note: 'check', format: { bold: true, textColor: null } })
    expect(form.kind === 'code' && form.rules).toEqual([
      { words: [{ kind: 'text', color: 'red' }], condition: 'v > 3 m/s', text: '@text-red if v > 3 m/s', start: 16, end: 38 },
      { words: [{ kind: 'text', color: 'orange' }], condition: 'v > 2 m/s', text: '@text-orange if v > 2 m/s', start: 39, end: 64 },
    ])
    expect(formatOf('x = 1 @blod if x > 0')).toMatchObject({ formatError: { code: 'unknownFormat', word: '@blod' } })
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
    expect(readLine('x = 1 @text-red+blod')).toMatchObject({ formatError: { code: 'unknownFormatIn', part: '@blod', word: '@text-red+blod' } })
    expect(readLine('x = 1 @text-red+blod if x > 0')).toMatchObject({ formatError: { code: 'unknownFormatIn', part: '@blod', word: '@text-red+blod' }, rules: [] })
    expect(readLine('x = 1 @bold+L')).toMatchObject({ formatError: { code: 'commentOnly', word: '@L' } })
    expect(readLine('x = 1 @bold+')).toMatchObject({ formatError: { code: 'unknownFormat', word: '@bold+' } })
    // Spaces end a word: `@bold + red` isn't joined.
    expect(readLine('x = 1 @bold + red')).toMatchObject({ formatError: { code: 'unknownFormat', word: '@bold' } })
  })

  it('reads joined words on a comment line too', () => {
    expect(readLine('@bold+L+text-blue # Pumps')).toMatchObject({ kind: 'comment', format: { bold: true, size: 'L', textColor: 'blue' } })
    expect(readLine('@bold+lg # Pumps')).toMatchObject({ formatError: { code: 'unknownFormatIn', part: '@lg', word: '@bold+lg' } })
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

  it('+ Add rule’s row is text-red with the name as its condition, or none on a table line (M4e)', () => {
    expect(newRule('v')).toEqual({ words: [{ kind: 'text', color: 'red' }], condition: 'v', text: null })
    expect(newRule(null)).toMatchObject({ condition: '' })
    // Written, it reads back as a rule, with nothing yet after the name; an empty condition is still a rule.
    expect(rulesOf(`v = 4 ${ruleText(newRule('v').words, 'v')} # speed`).at(-1)).toMatchObject({ condition: 'v' })
    expect(rulesOf(`table(x) ${ruleText(newRule(null).words, '')} @red if x > 1`)).toMatchObject([
      { condition: '', text: '@text-red if' },
      { condition: 'x > 1' },
    ])
  })

  it('a condition holds no @ and no # outside a text, which would start a word or end the clause', () => {
    expect(conditionText('v > 3 m/s ')).toBe('v > 3 m/s ')
    expect(conditionText('v > 3 @bold')).toBe('v > 3 ')
    expect(conditionText('v > 3 # fast')).toBe('v > 3 ')
    expect(conditionText('result == "a@b #1"')).toBe('result == "a@b #1"')
    expect(conditionText('')).toBe('')
  })

  it('leaves a line with no code alone', () => {
    expect(writeRules('# Pumps', [])).toBe('# Pumps')
  })
})

describe('a comment line’s format (docs/spec-v1.md section 3, A comment line’s format, M4d)', () => {
  const comment = (format: Partial<CommentFormat>, text: string, formatError: EngineMessage | null = null) => ({
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
    expect(readLine('@bold @text-red if x > 3 # Pumps')).toEqual(comment({ bold: true }, 'Pumps', { code: 'rulesNeedMathLine' }))
    expect(readLine('@L if ok # Pumps')).toEqual(comment({}, 'Pumps', { code: 'rulesNeedMathLine' }))
  })

  it('makes a word a comment line doesn’t take the line’s error, the first one named', () => {
    expect(readLine('@blod @L # x')).toEqual(comment({ size: 'L' }, 'x', { code: 'unknownFormat', word: '@blod' }))
    expect(readLine('@M # x')).toEqual(comment({}, 'x', { code: 'unknownFormat', word: '@M' }))
    expect(readLine('@l # x')).toEqual(comment({}, 'x', { code: 'unknownFormat', word: '@l' }))
    expect(readLine('@bold 2 # x')).toEqual(comment({}, 'x', { code: 'unknownFormat', word: '@bold' }))
    expect(readLine('@ # x')).toEqual(comment({}, 'x', { code: 'unknownFormat', word: '@' }))
  })

  it('makes a comment word on a math line its error, by name', () => {
    const errorOf = (line: string) => {
      const form = readLine(line)
      return form.kind === 'code' ? form.formatError : form
    }
    expect(errorOf('x = 1 @L')).toEqual({ code: 'commentOnly', word: '@L' })
    expect(errorOf('x = 1 @bold @upright # n')).toEqual({ code: 'commentOnly', word: '@upright' })
    expect(errorOf('x = 1 @S')).toEqual({ code: 'commentOnly', word: '@S' })
    expect(errorOf('x = 1 @XL if x > 0')).toEqual({ code: 'commentOnly', word: '@XL' })
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
    // #229: an `in` with `^`, `*` or `/` after it is the inch of the target.
    ['A = L^2 in in^2', 'A = L^2', 'in^2'],
    ['A = 2 in * 3 in in in^2', 'A = 2 in * 3 in', 'in^2'],
    ['V = L^3 in in^3', 'V = L^3', 'in^3'],
    ['v = L/t in in/s', 'v = L/t', 'in/s'],
    ['v = L/t to in / s', 'v = L/t', 'in / s'],
    ['P = T*w in lbf in/s', 'P = T*w', 'lbf in/s'],
    ['q = Q/A in in*in', 'q = Q/A', 'in*in'],
    ['A = 3 in^2 in cm^2', 'A = 3 in^2', 'cm^2'],
    ['T = F*r in lbf in', 'T = F*r', 'lbf in'],
    // The last one still wins: here the first `in` is the inch (section 3, step 3).
    ['T = F*r in in lbf', 'T = F*r in', 'lbf'],
    ['D = 4 in in mm', 'D = 4 in', 'mm'],
    ['x = 2 in / 4', 'x = 2 in / 4', null],
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
    ['A = L^2', 'in^2', 'A = L^2 in in^2'],
    ['A = L^2 in in^2', 'cm^2', 'A = L^2 in cm^2'],
    ['A = L^2 in in^2 @bold # area', null, 'A = L^2 @bold # area'],
    ['v = L/t in in/s', 'ft/s', 'v = L/t in ft/s'],
  ])('%s with %s', (line, unit, written) => {
    expect(writeDisplayUnit(line, unit)).toBe(written)
  })

  // #229: what the slot writes, the reader takes off whole, for every unit the
  // slot's list offers, on a line that ends in a name and on one that ends in the inch.
  const offered = [...new Set(Object.values(SLOT_UNITS).flat())]
  describe.each(['A = L^2', 'D = 4 in'])('on %s, every unit the slot offers comes back whole', (line) => {
    it.each(offered)('%s', (unit) => {
      const written = writeDisplayUnit(line, unit)
      expect(splitDisplayUnit(written)).toEqual({ expression: line, displayUnit: unit })
      expect(writeDisplayUnit(written, null)).toBe(line)
      expect(writeDisplayUnit(written, 'mm')).toBe(`${line} in mm`)
    })
  })
})

// docs/spec-v1.md section 3, Where a line's format lives (M4e, #195).
describe('a line’s format, stored beside it', () => {
  describe('splitFormat', () => {
    it.each([
      ['U = I * R in V @bold @text-red @yellow # check', 'U = I * R in V # check', '@bold @text-red @yellow'],
      ['x = 1 @bold', 'x = 1', '@bold'],
      ['x = 1   @bold   @red   ', 'x = 1', '@bold   @red'],
      ['v = Q / A @text-red if v > 3 m/s @text-orange if v > 2 m/s', 'v = Q / A', '@text-red if v > 3 m/s @text-orange if v > 2 m/s'],
      ['@bold @L @text-blue # Pumps and pipes', '# Pumps and pipes', '@bold @L @text-blue'],
      ['@bold', '', '@bold'],
      ['@bold #', '#', '@bold'],
      ['  x = 1 @blod+red', '  x = 1', '@blod+red'],
    ])('%s', (line, text, clause) => {
      expect(splitFormat(line)).toEqual({ text, clause })
    })

    it.each(['x = 1', 'x = 1   # note  ', 's = "a @bold"', 'x = 1 # see @bold', '# call me @home', '', '   ', 'a = 1# n'])(
      'leaves %j exactly as typed: it holds no clause',
      (line) => {
        expect(splitFormat(line)).toEqual({ text: line, clause: '' })
      },
    )
  })

  describe('withFormat: the line as the engine reads it', () => {
    it.each([
      ['x = 1', '@bold', 'x = 1 @bold'],
      ['x = 1 # note', '@bold @red', 'x = 1 @bold @red # note'],
      ['U = I * R in V # check', '@bold', 'U = I * R in V @bold # check'],
      ['# Pumps', '@bold @L', '@bold @L # Pumps'],
      ['', '@bold', '@bold'],
      ['x = 1', '', 'x = 1'],
      ['x = 1   # note', '', 'x = 1   # note'],
    ])('%j with %j', (line, stored, read) => {
      expect(withFormat(line, stored)).toBe(read)
    })

    it('puts a clause typed in the text in front of the stored one', () => {
      expect(withFormat('v = 4 @text-red if v > 3 # speed', '@bold @text-orange if v > 2')).toBe(
        'v = 4 @text-red if v > 3 @bold @text-orange if v > 2 # speed',
      )
    })

    it('reads back what splitFormat took out', () => {
      for (const line of ['U = I * R in V @bold @yellow # check', '@L @bold # Pumps', 'v = 1 @red if v > 0']) {
        const { text, clause } = splitFormat(line)
        expect(readLine(withFormat(text, clause))).toEqual(readLine(line))
      }
    })
  })

  describe('joinClauses: a typed clause in front of a stored one', () => {
    it.each([
      ['', '@bold', '@bold'],
      ['@bold', '', '@bold'],
      ['@underline', '@bold', '@underline @bold'],
      // A typed word that clashes with a stored one replaces it.
      ['@red', '@bold @yellow', '@red @bold'],
      ['@text-green', '@text-red @yellow', '@text-green @yellow'],
      ['@bold', '@bold @red', '@bold @red'],
      ['@S', '@bold @XL @upright', '@S @bold @upright'],
      ['@yellow', '@bold+red+underline', '@yellow @bold+underline'],
      ['@text-blue+blue', '@text-red+red', '@text-blue+blue'],
      // Rules are never dropped, and the typed ones come first, so they win.
      ['@text-red if v > 3', '@text-orange if v > 2', '@text-red if v > 3 @text-orange if v > 2'],
      ['@text-red if v > 3', '@text-blue', '@text-red if v > 3 @text-blue'],
      ['@text-blue', '@text-red if v > 3', '@text-blue @text-red if v > 3'],
      // A word that isn't a format replaces nothing, and is kept: it is the line's error.
      ['@blod', '@bold', '@blod @bold'],
      ['@red', '@blod @yellow', '@red @blod'],
    ])('%j, then %j', (typed, stored, joined) => {
      expect(joinClauses(typed, stored)).toBe(joined)
    })
  })

  it('commitFormat moves the typed clause out of the text, in front of the stored one', () => {
    expect(commitFormat('x = 1 @red # n', '@bold @yellow')).toEqual({ text: 'x = 1 # n', stored: '@red @bold' })
    expect(commitFormat('x = 1 # n', '@bold')).toEqual({ text: 'x = 1 # n', stored: '@bold' })
    expect(commitFormat('@L # Pumps', '')).toEqual({ text: '# Pumps', stored: '@L' })
  })

  describe('lineFormats and storeFormats (section 7: customData.formats)', () => {
    it('reads one entry per line, padded or cut to the lines', () => {
      expect(lineFormats('@bold\n\n@red if x > 1', 3)).toEqual(['@bold', '', '@red if x > 1'])
      expect(lineFormats('@bold', 3)).toEqual(['@bold', '', ''])
      expect(lineFormats('@bold\n@red\n@green', 2)).toEqual(['@bold', '@red'])
      expect(lineFormats('', 2)).toEqual(['', ''])
      expect(lineFormats('@bold\r\n@red', 2)).toEqual(['@bold', '@red'])
    })

    it('reads an entry that isn’t a clause as none, and ends one at a #', () => {
      expect(lineFormats('bold\n x = 1\n  @red  \n@bold # and more\n# only', 5)).toEqual(['', '', '@red', '@bold', ''])
    })

    it('stores no text at all when no line has a format', () => {
      expect(storeFormats(['', '', ''])).toBe('')
      expect(storeFormats([])).toBe('')
      expect(storeFormats(['', '@bold', ''])).toBe('\n@bold\n')
    })
  })

  describe('pressFormat: a Format tab press on a math line', () => {
    const bold: LineFormat = { ...NO_FORMAT, bold: true }

    it('writes the plain words to the stored clause and leaves the text exactly as typed', () => {
      expect(pressFormat('x = 1   # n', '', bold)).toEqual({ text: 'x = 1   # n', stored: '@bold' })
      expect(pressFormat('x = 1', '@bold @red', { ...NO_FORMAT, color: 'blue' })).toEqual({ text: 'x = 1', stored: '@blue' })
      expect(pressFormat('x = 1', '@bold', NO_FORMAT)).toEqual({ text: 'x = 1', stored: '' })
      expect(pressFormat('x = 1', '', { bold: true, underline: true, color: 'yellow', textColor: 'red' })).toEqual({
        text: 'x = 1',
        stored: '@bold @underline @text-red @yellow',
      })
    })

    it('keeps every stored rule as it is, after the plain words', () => {
      expect(pressFormat('v = 4', '@red @text-red if v > 3 @bold  if v > 9', bold)).toEqual({
        text: 'v = 4',
        stored: '@bold @text-red if v > 3 @bold  if v > 9',
      })
    })

    it('moves plain words typed in the line out with the press, and leaves a typed rule in the text', () => {
      expect(pressFormat('x = 1 @red # n', '@underline', { ...NO_FORMAT, color: 'red', underline: true, bold: true })).toEqual({
        text: 'x = 1 # n',
        stored: '@bold @underline @red',
      })
      expect(pressFormat('v = 4 @text-red if v > 3 # speed', '', bold)).toEqual({
        text: 'v = 4 @text-red if v > 3 # speed',
        stored: '@bold',
      })
      expect(pressFormat('v = 4 @yellow @text-red if v >  # speed', '@red if v > 9', bold)).toEqual({
        text: 'v = 4 @text-red if v > # speed',
        stored: '@bold @red if v > 9',
      })
    })

    it('does nothing on a line with no code', () => {
      expect(pressFormat('# Pumps', '@L', bold)).toEqual({ text: '# Pumps', stored: '@L' })
      expect(pressFormat('', '', bold)).toEqual({ text: '', stored: '' })
    })
  })

  describe('pressCommentFormat: the same press on a comment line', () => {
    it('writes the words in their fixed order and leaves the comment text alone', () => {
      expect(pressCommentFormat('# Pumps', '', { ...NO_COMMENT_FORMAT, size: 'L', bold: true })).toEqual({
        text: '# Pumps',
        stored: '@bold @L',
      })
      expect(pressCommentFormat('#   Pumps  ', '@bold @L', NO_COMMENT_FORMAT)).toEqual({ text: '#   Pumps  ', stored: '' })
    })

    it('moves a clause typed in front of the # out with the press', () => {
      expect(pressCommentFormat('@red # Pumps', '@bold', { ...NO_COMMENT_FORMAT, bold: true, color: 'red', upright: true })).toEqual({
        text: '# Pumps',
        stored: '@bold @upright @red',
      })
    })

    it('does nothing on a math line or a blank one', () => {
      expect(pressCommentFormat('x = 1', '@bold', NO_COMMENT_FORMAT)).toEqual({ text: 'x = 1', stored: '@bold' })
      expect(pressCommentFormat('', '@bold', NO_COMMENT_FORMAT)).toEqual({ text: '', stored: '@bold' })
    })
  })

  describe('pressRules: a Rules list write', () => {
    const rulesOf = (line: string, stored: string) => {
      const form = readLine(withFormat(line, stored))
      return form.kind === 'code' ? form.rules : []
    }
    const STORED = '@bold @text-red if v > 3 @red if v > 1 @bold if v > 9'

    it('reorders, removes, reformats and adds rules in the stored clause, the text untouched', () => {
      const [first, second, third] = rulesOf('v = 4 # speed', STORED)
      expect(pressRules('v = 4 # speed', STORED, [first, third, second])).toEqual({
        text: 'v = 4 # speed',
        stored: '@bold @text-red if v > 3 @bold if v > 9 @red if v > 1',
      })
      expect(pressRules('v = 4 # speed', STORED, [second, third])).toEqual({
        text: 'v = 4 # speed',
        stored: '@bold @red if v > 1 @bold if v > 9',
      })
      // A changed row is one joined word and one condition; the others keep their text.
      const changed = { ...second, words: [...second.words, { kind: 'text', color: 'blue' } as const], text: null }
      expect(pressRules('v = 4 # speed', STORED, [first, changed, third])).toEqual({
        text: 'v = 4 # speed',
        stored: '@bold @text-red if v > 3 @text-blue+red if v > 1 @bold if v > 9',
      })
      expect(pressRules('v = 4', '@red if v > 1', [])).toEqual({ text: 'v = 4', stored: '' })
      // + Add rule's row goes last; a condition typed in its field replaces the row's.
      expect(pressRules('v = 4', '@red if v > 1', [...rulesOf('v = 4', '@red if v > 1'), newRule('v')])).toEqual({
        text: 'v = 4',
        stored: '@red if v > 1 @text-red if v',
      })
      expect(pressRules('v = 4', '@bold', [{ ...newRule('v'), condition: 'v > 3 m/s' }])).toEqual({
        text: 'v = 4',
        stored: '@bold @text-red if v > 3 m/s',
      })
      expect(pressRules('v = 4', '', [newRule(null)])).toEqual({ text: 'v = 4', stored: '@text-red if' })
    })

    it('closes a text a condition leaves open, so the rules after it stay rules', () => {
      const [first, second] = rulesOf('check = "Pass"', '@text-green if result == "Pass" @text-red if result == "Fail"')
      // As it is typed in the first rule's field: the second rule is still read.
      const typing = { ...first, condition: 'result == "Pa', text: null }
      const written = pressRules('check = "Pass"', '', [typing, second])
      expect(written.stored).toBe('@text-green if result == "Pa" @text-red if result == "Fail"')
      expect(rulesOf('check = "Pass"', written.stored).map(({ condition }) => condition)).toEqual(['result == "Pa"', 'result == "Fail"'])
      // A backslash left at the end, and a single-quoted text.
      expect(ruleText(first.words, 'result == "a\\')).toBe('@text-green if result == "a\\\\"')
      expect(ruleText(first.words, "result == 'a")).toBe("@text-green if result == 'a'")
      // A transpose is no text; a closed text is left as it is.
      expect(ruleText(first.words, "A' == B")).toBe("@text-green if A' == B")
      expect(ruleText(first.words, 'result == "a@b #1"')).toBe('@text-green if result == "a@b #1"')
      // A rule typed in the line with its text left open, moved above another by the list.
      const [open] = rulesOf('check = 1 @red if result == "a', '')
      const [bold] = rulesOf('check = 1', '@bold if check > 0')
      expect(pressRules('check = 1 @red if result == "a', '', [open, bold])).toEqual({
        text: 'check = 1',
        stored: '@red if result == "a" @bold if check > 0',
      })
    })

    it('moves the rules typed in the line out of its text, in the rows’ order; plain words typed there stay', () => {
      const line = 'v = 4 @underline @text-red if v > 3 # speed'
      const [typed, stored] = rulesOf(line, '@bold @red if v > 1')
      expect(pressRules(line, '@bold @red if v > 1', [typed, stored])).toEqual({
        text: 'v = 4 @underline # speed',
        stored: '@bold @text-red if v > 3 @red if v > 1',
      })
      expect(pressRules(line, '@bold @red if v > 1', [stored, typed])).toEqual({
        text: 'v = 4 @underline # speed',
        stored: '@bold @red if v > 1 @text-red if v > 3',
      })
      // Removing the typed one takes it out of the text.
      expect(pressRules(line, '@bold @red if v > 1', [stored])).toEqual({
        text: 'v = 4 @underline # speed',
        stored: '@bold @red if v > 1',
      })
    })

    it('does nothing on a line with no code', () => {
      expect(pressRules('# Pumps', '@L', [])).toEqual({ text: '# Pumps', stored: '@L' })
    })
  })
})
