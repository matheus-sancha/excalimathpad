import { describe, expect, it } from 'vitest'
import {
  TITLE_LINE,
  applyLineMove,
  hasText,
  startLineEdit,
  withTypedLine,
  type LineEdit,
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

