import { describe, expect, it } from 'vitest'
import { NO_TITLE_FORMAT } from '../canvas/mathAnchor.ts'
import { evaluateSheet } from '../math/evaluate.ts'
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
      overrides: ['A rule sets the highlight while v > 3.', 'A rule sets bold while v > 1.'],
    })
  })

  it('says nothing about rules the evaluation hasn’t caught up with', () => {
    const view = formatView(sheetOf('v = 4'), { anchorId: 'm1', lineIndex: 0, text: 'v = 4 @red if v > 3' })
    expect(view).toMatchObject({ kind: 'math', overrides: [] })
  })

  it('reads the kind and the link from what is typed and the title the element has', () => {
    const sheet = sheetOf('x = 1\n\n# Pumps', 'Pipe flow')
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 1, text: '' })).toMatchObject({
      kind: 'blank',
      caption: 'Line — Pipe flow, line 2',
      link: 'Edit title ↑',
    })
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 2, text: '@L # Pumps' })).toMatchObject({
      kind: 'comment',
      format: { size: 'L', upright: false },
    })
    expect(formatView(sheet, { anchorId: 'm1', lineIndex: 'title', text: 'Pipe' })).toMatchObject({
      kind: 'title',
      caption: 'Title — Pipe flow',
      link: 'First line ↓',
      text: 'Pipe',
    })
    expect(formatView(sheetOf('x = 1'), { anchorId: 'm1', lineIndex: 0, text: 'x = 1' })).toMatchObject({ link: 'Add title ↑' })
  })
})
