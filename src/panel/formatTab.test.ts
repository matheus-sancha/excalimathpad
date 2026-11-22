import { describe, expect, it } from 'vitest'
import { NO_TITLE_FORMAT } from '../canvas/mathAnchor.ts'
import { evaluateSheet } from '../math/evaluate.ts'
import { ptBR } from '../text/ptBR.ts'
import { formatView, type FormatElement } from './formatTab.ts'

/** A sheet of one element, evaluated as the overlay evaluates it. */
function sheetOf(source: string, title: string | null = null): FormatElement[] {
  return [{ anchorId: 'm1', title, titleFormat: NO_TITLE_FORMAT, lines: evaluateSheet([{ id: 'm1', source }]).get('m1')! }]
}

describe('formatView (docs/spec-v1.md section 4, Format tab)', () => {
  it('is none with nothing open, or for an element the sheet doesn’t hold', () => {
    expect(formatView(sheetOf('x = 1'), null)).toEqual({ kind: 'none' })
    expect(formatView(sheetOf('x = 1'), { anchorId: 'gone', lineIndex: 0, text: 'x = 1' })).toEqual({ kind: 'none' })
  })

  it('names the rule that wins each property: the first true one, as the sheet draws it', () => {
    const source = 'v = 4 @red if v > 5 @red if v > 3 @bold if v > 1 @text-red if v > 9'
    const view = formatView(sheetOf(source), { anchorId: 'm1', lineIndex: 0, text: source })
    expect(view).toMatchObject({
      kind: 'math',
      overrides: [
        { text: 'A rule sets the highlight while v > 3.', condition: 'v > 3' },
        { text: 'A rule sets bold while v > 1.', condition: 'v > 1' },
      ],
    })
  })

  it('says nothing about rules the evaluation hasn’t caught up with', () => {
    const view = formatView(sheetOf('v = 4'), { anchorId: 'm1', lineIndex: 0, text: 'v = 4 @red if v > 3' })
    expect(view).toMatchObject({ kind: 'math', overrides: [] })
  })

  // Section 3, Where a line's format lives (M4e): the format is the stored one.
  it('reads a line’s format from where it is stored, behind a clause typed in the text', () => {
    const lines = evaluateSheet([{ id: 'm1', source: 'v = 4\n# Pumps', formats: '@bold @red @text-red if v > 3\n@L' }]).get('m1')!
    const sheet: FormatElement[] = [{ anchorId: 'm1', title: null, titleFormat: NO_TITLE_FORMAT, lines }]

    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 0, text: 'v = 4', stored: '@bold @red @text-red if v > 3' })).toMatchObject({
      kind: 'math',
      text: 'v = 4',
      format: { bold: true, underline: false, color: 'red', textColor: null },
      overrides: [{ text: 'A rule sets the text colour while v > 3.', condition: 'v > 3' }],
      rules: [{ condition: 'v > 3', text: '@text-red if v > 3' }],
      ruleStates: [{ kind: 'true' }],
    })
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 1, text: '# Pumps', stored: '@L' })).toMatchObject({
      kind: 'comment',
      format: { size: 'L' },
    })
    // A typed word replaces the stored one it clashes with; a typed rule comes first.
    expect(
      formatView(sheet, { anchorId: 'm1', lineIndex: 0, text: 'v = 4 @yellow @bold if v > 9', stored: '@bold @red @text-red if v > 3' }),
    ).toMatchObject({
      format: { bold: true, color: 'yellow' },
      rules: [{ condition: 'v > 9' }, { condition: 'v > 3' }],
    })
    // Stored on a blank line, a clause formats nothing.
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 0, text: '', stored: '@bold' })).toMatchObject({ kind: 'blank' })
  })

  it('reads the kind and the link from what is typed and the title the element has', () => {
    const sheet = sheetOf('x = 1\n\n# Pumps', 'Pipe flow')
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 1, text: '' })).toMatchObject({
      kind: 'blank',
      caption: 'Line — Pipe flow, line 2',
      link: 'editTitle',
    })
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 2, text: '@L # Pumps' })).toMatchObject({
      kind: 'comment',
      format: { size: 'L', upright: false },
    })
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 'title', text: 'Pipe' })).toMatchObject({
      kind: 'title',
      caption: 'Title — Pipe flow',
      link: 'firstLine',
      text: 'Pipe',
    })
    expect(formatView(sheetOf('x = 1'), { anchorId: 'm1', lineIndex: 0, text: 'x = 1' })).toMatchObject({ link: 'addTitle' })
  })

  it('words the caption and a rule’s note in the language it is given, the condition kept apart (0.6.0)', () => {
    const source = 'v = 4 m/s @text-red if v > 3 m/s'
    expect(formatView(sheetOf(source), { anchorId: 'm1', lineIndex: 0, text: source }, ptBR)).toMatchObject({
      kind: 'math',
      caption: 'Linha de cálculo — Bloco 1, linha 1',
      link: 'addTitle',
      overrides: [{ text: 'Uma regra define a cor do texto enquanto v > 3 m/s.', condition: 'v > 3 m/s' }],
    })
    expect(formatView(sheetOf('x = 1', 'Bomba'), { anchorId: 'm1', lineIndex: 'title', text: 'Bomba' }, ptBR)).toMatchObject({
      caption: 'Título — Bomba',
    })
  })
})
