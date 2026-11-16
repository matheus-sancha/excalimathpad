import { describe, expect, it } from 'vitest'
import {
  TITLE_LINE,
  applyLineMove,
  commitTypedLine,
  hasText,
  startLineEdit,
  withTypedLine,
  type LineEdit,
  type LineMove,
} from './lineEdit.ts'

const SOURCE = 'a = 1\nb = 2\nc = 3'

function editing(lineIndex: number, text?: string, source = SOURCE): LineEdit {
  const edit = startLineEdit(source, 'm1', lineIndex)
  return text === undefined ? edit : { ...edit, text }
}

describe('startLineEdit', () => {
  it('opens the line with the caret at its end', () => {
    expect(editing(1)).toEqual({ anchorId: 'm1', lineIndex: 1, text: 'b = 2', caret: 5 })
  })
})

describe('withTypedLine', () => {
  it('puts the typed text in place of its line', () => {
    expect(withTypedLine(SOURCE, editing(1, 'b = 9'))).toBe('a = 1\nb = 9\nc = 3')
  })
})

describe('applyLineMove', () => {
  describe('a line left unchanged writes nothing', () => {
    it.each([
      ['leave', { kind: 'leave' }],
      ['up', { kind: 'up' }],
      ['down', { kind: 'down' }],
    ] as const)('%s keeps the same source', (_, move) => {
      expect(applyLineMove(SOURCE, editing(1), move).source).toBe(SOURCE)
    })

    // Rejoining the lines would turn \r\n into \n and look like a change.
    it('leaves \\r\\n alone when nothing was typed', () => {
      const source = 'a = 1\r\nb = 2'
      const edit = editing(0, undefined, source)
      expect(applyLineMove(source, edit, { kind: 'leave' }).source).toBe(source)
    })
  })

  it('leave commits the typed text and ends the edit', () => {
    expect(applyLineMove(SOURCE, editing(1, 'b = 9'), { kind: 'leave' })).toMatchObject({
      source: 'a = 1\nb = 9\nc = 3',
      edit: null,
    })
  })

  it('up and down commit the line and open the next with the caret at its end', () => {
    const up = applyLineMove(SOURCE, editing(1, 'b = 9'), { kind: 'up' })
    expect(up.source).toBe('a = 1\nb = 9\nc = 3')
    expect(up.edit).toEqual({ anchorId: 'm1', lineIndex: 0, text: 'a = 1', caret: 5 })

    const down = applyLineMove(SOURCE, editing(1, 'b = 9'), { kind: 'down' })
    expect(down.source).toBe('a = 1\nb = 9\nc = 3')
    expect(down.edit).toEqual({ anchorId: 'm1', lineIndex: 2, text: 'c = 3', caret: 5 })
  })

  describe('a move with nowhere to go stays on the line and commits nothing', () => {
    it.each([
      ['down from the last line', 2, { kind: 'down' }],
      ['join on the first line', 0, { kind: 'join' }],
    ] as const)('%s', (_, lineIndex, move) => {
      const edit = editing(lineIndex, 'typed')
      expect(applyLineMove(SOURCE, edit, move)).toMatchObject({ source: SOURCE, edit })
    })
  })

  describe('split', () => {
    it('in the middle writes both halves and continues on the new line', () => {
      const result = applyLineMove(SOURCE, editing(1), { kind: 'split', from: 3, to: 3 })
      expect(result.source).toBe('a = 1\nb =\n 2\nc = 3')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 2, text: ' 2', caret: 0 })
    })

    it('at the end opens an empty line', () => {
      const result = applyLineMove(SOURCE, editing(2), { kind: 'split', from: 5, to: 5 })
      expect(result.source).toBe('a = 1\nb = 2\nc = 3\n')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 3, text: '', caret: 0 })
    })

    it('at the start pushes the whole line down', () => {
      const result = applyLineMove(SOURCE, editing(0), { kind: 'split', from: 0, to: 0 })
      expect(result.source).toBe('\na = 1\nb = 2\nc = 3')
      expect(result.edit?.text).toBe('a = 1')
    })

    it('uses the typed text, not the scene line, and drops a selection', () => {
      const result = applyLineMove(SOURCE, editing(1, 'xyz'), { kind: 'split', from: 1, to: 2 })
      expect(result.source).toBe('a = 1\nx\nz\nc = 3')
      expect(result.edit?.text).toBe('z')
    })
  })

  describe('join', () => {
    it('writes one line and puts the caret at the join', () => {
      const result = applyLineMove(SOURCE, editing(1), { kind: 'join' })
      expect(result.source).toBe('a = 1b = 2\nc = 3')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 0, text: 'a = 1b = 2', caret: 5 })
    })

    it('uses the typed text', () => {
      const result = applyLineMove(SOURCE, editing(2, 'typed'), { kind: 'join' })
      expect(result.source).toBe('a = 1\nb = 2typed')
    })
  })

  it('splits and rejoins back to the same text', () => {
    const split = applyLineMove(SOURCE, editing(1), { kind: 'split', from: 2, to: 2 })
    const joined = applyLineMove(split.source, split.edit!, { kind: 'join' })
    expect(joined.source).toBe(SOURCE)
  })
})

describe('an element left with no text is removed (section 4)', () => {
  it('has no text when every line is blank or spaces', () => {
    expect(hasText('')).toBe(false)
    expect(hasText('  \n\t\n')).toBe(false)
    expect(hasText('a = 1')).toBe(true)
  })

  it('counts a comment as text', () => {
    expect(hasText('# pump inputs')).toBe(true)
  })

  it('a leave removes a new element left empty, and one emptied', () => {
    expect(applyLineMove('', editing(0, '', ''), { kind: 'leave' }).remove).toBe(true)
    expect(applyLineMove('a = 1', editing(0, '  ', 'a = 1'), { kind: 'leave' }).remove).toBe(true)
  })

  it('a leave keeps an element with text on any line', () => {
    expect(applyLineMove(SOURCE, editing(1, ''), { kind: 'leave' }).remove).toBe(false)
    expect(applyLineMove('', editing(0, 'a = 1', ''), { kind: 'leave' }).remove).toBe(false)
  })

  // The edit is still inside the element, so it isn't left yet.
  it('moves inside an empty element never remove it', () => {
    const source = '\n'
    expect(applyLineMove(source, editing(0, '', source), { kind: 'down' }).remove).toBe(false)
    expect(applyLineMove(source, editing(1, '', source), { kind: 'up' }).remove).toBe(false)
    expect(applyLineMove(source, editing(1, '', source), { kind: 'join' }).remove).toBe(false)
    expect(applyLineMove('', editing(0, '', ''), { kind: 'split', from: 0, to: 0 }).remove).toBe(false)
  })
})

describe('the title (section 4: above the first line)', () => {
  const onTitle = (text: string, title = ''): LineEdit => ({
    ...startLineEdit(SOURCE, 'm1', TITLE_LINE, title),
    text,
  })

  it('opens on the scene’s title, with the caret at its end', () => {
    expect(startLineEdit(SOURCE, 'm1', TITLE_LINE, 'Pipe flow')).toEqual({
      anchorId: 'm1',
      lineIndex: TITLE_LINE,
      text: 'Pipe flow',
      caret: 9,
    })
  })

  it.each([{ kind: 'up' }, { kind: 'title' }] as const)(
    '$kind from the first line commits the line and opens the title',
    (move) => {
      expect(applyLineMove(SOURCE, editing(0, 'a = 9'), move, 'Pipe flow')).toEqual({
        source: 'a = 9\nb = 2\nc = 3',
        formats: '',
        title: 'Pipe flow',
        edit: { anchorId: 'm1', lineIndex: TITLE_LINE, text: 'Pipe flow', caret: 9 },
        remove: false,
      })
    },
  )

  it('the Title move works from any line', () => {
    expect(applyLineMove(SOURCE, editing(2), { kind: 'title' }).edit?.lineIndex).toBe(TITLE_LINE)
  })

  it('typing in the title leaves the lines alone', () => {
    expect(withTypedLine(SOURCE, onTitle('Pipe flow'))).toBe(SOURCE)
  })

  it('leave commits the title, trimmed', () => {
    expect(applyLineMove(SOURCE, onTitle('  Pipe flow '), { kind: 'leave' })).toEqual({
      source: SOURCE,
      formats: '',
      title: 'Pipe flow',
      edit: null,
      remove: false,
    })
  })

  it.each([{ kind: 'down' }, { kind: 'split', from: 2, to: 2 }] as const)(
    '$kind commits the title and opens the first line',
    (move) => {
      expect(applyLineMove(SOURCE, onTitle('Inputs'), move)).toEqual({
        source: SOURCE,
        formats: '',
        title: 'Inputs',
        edit: { anchorId: 'm1', lineIndex: 0, text: 'a = 1', caret: 5 },
        remove: false,
      })
    },
  )

  it.each([{ kind: 'up' }, { kind: 'join' }, { kind: 'title' }] as const)(
    '$kind has nowhere to go from the title, and commits nothing',
    (move) => {
      const edit = onTitle('typed', 'Pipe flow')
      expect(applyLineMove(SOURCE, edit, move, 'Pipe flow')).toEqual({
        source: SOURCE,
        formats: '',
        title: 'Pipe flow',
        edit,
        remove: false,
      })
    },
  )

  it('a title is text: an element with only a title is kept, with neither it is removed', () => {
    const leave = { kind: 'leave' } as const
    expect(applyLineMove('', editing(0, '', ''), leave, 'Notes').remove).toBe(false)
    expect(applyLineMove('', { ...onTitle('Notes'), text: 'Notes' }, leave).remove).toBe(false)
    expect(applyLineMove('', { ...onTitle(''), text: ' ' }, leave, 'Notes').remove).toBe(true)
  })
})


// docs/spec-v1.md section 3, Where a line's format lives (M4e, #195): the
// source and the stored formats a move leads to, to be written in one write.
describe('a line’s format through the moves', () => {
  const FORMATS = '@bold\n\n@red if c > 2'
  const move = (edit: LineEdit, kind: LineMove, formats = FORMATS, source = SOURCE) =>
    applyLineMove(source, edit, kind, '', formats)

  it.each([{ kind: 'leave' }, { kind: 'up' }, { kind: 'down' }, { kind: 'title' }] as const)(
    '$kind on a line left unchanged keeps the same source and the same formats',
    (kind) => {
      const result = move(editing(1), kind)
      expect(result.source).toBe(SOURCE)
      expect(result.formats).toBe(FORMATS)
    },
  )

  it.each([{ kind: 'leave' }, { kind: 'up' }, { kind: 'down' }, { kind: 'title' }] as const)(
    '$kind commits a typed clause out of the text, into the line’s format',
    (kind) => {
      const result = move(editing(1, 'b = 9 @underline @text-red if b > 3 # nine'), kind)
      expect(result.source).toBe('a = 1\nb = 9 # nine\nc = 3')
      expect(result.formats).toBe('@bold\n@underline @text-red if b > 3\n@red if c > 2')
    },
  )

  it('a typed clause goes in front of the stored one, and a word that clashes replaces it', () => {
    const result = move(editing(0, 'a = 1 @text-blue @yellow if a > 0'), { kind: 'leave' }, '@bold @text-red @red if a > 5')
    expect(result.source).toBe(SOURCE)
    expect(result.formats).toBe('@text-blue @yellow if a > 0 @bold @red if a > 5\n\n')
  })

  it('a changed line keeps its stored format', () => {
    const result = move(editing(0, 'a = 7'), { kind: 'down' })
    expect(result).toMatchObject({ source: 'a = 7\nb = 2\nc = 3', formats: FORMATS })
    expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 1, text: 'b = 2', caret: 5 })
  })

  it('the next line opens on its text alone, whatever its stored format', () => {
    expect(move(editing(1), { kind: 'down' }).edit).toEqual({ anchorId: 'm1', lineIndex: 2, text: 'c = 3', caret: 5 })
  })

  it('a clause on a comment line moves out from in front of its #', () => {
    const result = move(editing(1, '@L @bold # Results'), { kind: 'leave' }, '')
    expect(result.source).toBe('a = 1\n# Results\nc = 3')
    expect(result.formats).toBe('\n@L @bold\n')
  })

  it('a sheet with no format anywhere stores none', () => {
    expect(move(editing(1, 'b = 9'), { kind: 'leave' }, '').formats).toBe('')
    expect(move(editing(0), { kind: 'split', from: 2, to: 2 }, '').formats).toBe('')
  })

  it('pads formats that are short of the lines, and cuts those past them', () => {
    expect(move(editing(2, 'c = 3 @red'), { kind: 'leave' }, '@bold').formats).toBe('@bold\n\n@red')
    expect(move(editing(0, 'a = 1 @red'), { kind: 'leave' }, '\n\n\n\n@bold').formats).toBe('@red\n\n')
  })

  describe('Enter: the first half keeps the format, and the new line starts with none', () => {
    it('in the middle', () => {
      const result = move(editing(0), { kind: 'split', from: 3, to: 3 })
      expect(result.source).toBe('a =\n 1\nb = 2\nc = 3')
      expect(result.formats).toBe('@bold\n\n\n@red if c > 2')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 1, text: ' 1', caret: 0 })
    })

    it('at the end, and the lines below keep theirs', () => {
      const result = move(editing(0), { kind: 'split', from: 5, to: 5 })
      expect(result.source).toBe('a = 1\n\nb = 2\nc = 3')
      expect(result.formats).toBe('@bold\n\n\n@red if c > 2')
    })

    it('on the last line', () => {
      const result = move(editing(2), { kind: 'split', from: 5, to: 5 })
      expect(result.source).toBe('a = 1\nb = 2\nc = 3\n')
      expect(result.formats).toBe('@bold\n\n@red if c > 2\n')
    })

    it('a clause typed before the caret moves out with the first half', () => {
      const text = 'a = 1 @yellow'
      const result = move(editing(0, text), { kind: 'split', from: text.length, to: text.length })
      expect(result.source).toBe('a = 1\n\nb = 2\nc = 3')
      expect(result.formats).toBe('@yellow @bold\n\n\n@red if c > 2')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 1, text: '', caret: 0 })
    })

    it('text after the caret with an @ in it is read as typed: it is the new line’s', () => {
      const result = move(editing(0, 'a = 1 @L # Results'), { kind: 'split', from: 5, to: 5 })
      expect(result.source).toBe('a = 1\n# Results\nb = 2\nc = 3')
      expect(result.formats).toBe('@bold\n@L\n\n@red if c > 2')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 1, text: '# Results', caret: 0 })
    })
  })

  describe('Backspace at the start: the joined line keeps the upper line’s format', () => {
    it('the upper line’s, when it has one', () => {
      const result = move(editing(1), { kind: 'join' }, '@bold\n@red\n@green')
      expect(result.source).toBe('a = 1b = 2\nc = 3')
      expect(result.formats).toBe('@bold\n@green')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 0, text: 'a = 1b = 2', caret: 5 })
    })

    it('the lower line’s, when the upper line has none', () => {
      const result = move(editing(2), { kind: 'join' })
      expect(result.source).toBe('a = 1\nb = 2c = 3')
      expect(result.formats).toBe('@bold\n@red if c > 2')
    })

    it('none, when neither has one', () => {
      const result = move(editing(1), { kind: 'join' }, '\n\n@green')
      expect(result.formats).toBe('\n@green')
    })

    it('a clause typed in the lower line moves out, in front, and the caret stays at the join', () => {
      const result = move(editing(1, 'b = 2 @red # two'), { kind: 'join' })
      expect(result.source).toBe('a = 1b = 2 # two\nc = 3')
      expect(result.formats).toBe('@red @bold\n@red if c > 2')
      expect(result.edit).toEqual({ anchorId: 'm1', lineIndex: 0, text: 'a = 1b = 2 # two', caret: 5 })
    })

    it('join on the first line commits nothing', () => {
      const edit = editing(0, 'a = 1 @red')
      expect(move(edit, { kind: 'join' })).toMatchObject({ source: SOURCE, formats: FORMATS, edit })
    })
  })

  it('a hand-edited line with a clause in its text is put right when the edit leaves it', () => {
    const source = 'a = 1 @red\nb = 2'
    const result = applyLineMove(source, editing(0, undefined, source), { kind: 'leave' }, '', '@bold @yellow')
    expect(result.source).toBe('a = 1\nb = 2')
    expect(result.formats).toBe('@red @bold\n')
  })

  it('an edit on the title leaves the formats as they are', () => {
    const onTitle: LineEdit = { anchorId: 'm1', lineIndex: TITLE_LINE, text: 'Inputs', caret: 6 }
    expect(applyLineMove(SOURCE, onTitle, { kind: 'leave' }, '', FORMATS)).toMatchObject({ source: SOURCE, formats: FORMATS })
    expect(applyLineMove(SOURCE, onTitle, { kind: 'down' }, '', FORMATS)).toMatchObject({ source: SOURCE, formats: FORMATS })
  })

  it('commitTypedLine is the same commit, for a write that keeps the line open', () => {
    expect(commitTypedLine(SOURCE, FORMATS, editing(1, 'b = 9 @green'))).toEqual({
      source: 'a = 1\nb = 9\nc = 3',
      formats: '@bold\n@green\n@red if c > 2',
    })
    const same = commitTypedLine(SOURCE, FORMATS, editing(1))
    expect(same.source).toBe(SOURCE)
    expect(same.formats).toBe(FORMATS)
  })
})
