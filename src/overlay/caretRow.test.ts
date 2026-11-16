import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { caretPlace, caretRow } from './caretRow.ts'

const rect = (left: number, right: number) => ({ left, top: 300, right, bottom: 324 }) as DOMRect

/** An open field of the given box holding `text`, in its cell beside the hidden copy. */
function fieldOf(text: string, box: DOMRect, caret: number) {
  const cell = document.createElement('span')
  const copy = document.createElement('span')
  copy.className = 'math-element__field-text'
  copy.textContent = text
  const field = document.createElement('textarea')
  field.value = text
  field.getBoundingClientRect = () => box
  cell.append(copy, field)
  document.body.append(cell)
  field.setSelectionRange(caret, caret)
  return field
}

describe('caretRow (docs/spec-v1.md section 4, While editing a line: the view follows the caret, 0.2.1)', () => {
  it('is the field’s box when the field fits the room', () => {
    expect(caretRow(fieldOf('a = 2 m', rect(100, 180), 3), 900)).toEqual({ left: 100, top: 300, right: 180, bottom: 324 })
  })

  it('narrows to the caret when the field is wider than the room', () => {
    const field = fieldOf('x'.repeat(200), rect(100, 1500), 200)
    // jsdom lays nothing out: stand in for the last character's box.
    const range = { setStart() {}, setEnd() {}, getClientRects: () => [rect(1488, 1498)] }
    field.ownerDocument.createRange = () => range as unknown as Range

    expect(caretRow(field, 900)).toEqual({ left: 1498, top: 300, right: 1498, bottom: 324 })
  })

  it('is the field’s left edge with the caret at the start of a wide field', () => {
    expect(caretRow(fieldOf('x'.repeat(200), rect(100, 1500), 0), 900)).toEqual({ left: 100, top: 300, right: 100, bottom: 324 })
  })
})

describe('caretRow in a wrapped field (section 4, While editing a line, The field wraps, M4e)', () => {
  const tall = { left: 100, top: 300, right: 500, bottom: 372 } as DOMRect

  /** The character at the caret is drawn at `box`: on the field's second row of three. */
  function onSecondRow(field: HTMLTextAreaElement, box: { left: number; right: number }) {
    const range = { setStart() {}, setEnd() {}, getClientRects: () => [{ ...box, top: 326, bottom: 345 }] }
    field.ownerDocument.createRange = () => range as unknown as Range
  }

  it('is the row of the field the caret is on, the field’s whole width', () => {
    const field = fieldOf('x'.repeat(120), tall, 60)
    onSecondRow(field, { left: 300, right: 310 })

    expect(caretRow(field, 900)).toEqual({ left: 100, top: 326, right: 500, bottom: 345 })
  })

  it('narrows to the caret on its row when the field is wider than the room', () => {
    const field = fieldOf('x'.repeat(120), tall, 60)
    onSecondRow(field, { left: 300, right: 310 })

    expect(caretRow(field, 200)).toEqual({ left: 300, top: 326, right: 300, bottom: 345 })
  })
})

describe('caretPlace (section 4, While editing a line: ↑ and ↓ between the field’s rows, M4e)', () => {
  /**
   * Lays the probe out as a browser would a field of `perRow` characters a
   * row: the text after the caret starts on the caret's row, 3 px into it.
   */
  function layOut(perRow: number, text: string) {
    const proto = HTMLElement.prototype
    const top = Object.getOwnPropertyDescriptor(proto, 'offsetTop')!
    const height = Object.getOwnPropertyDescriptor(proto, 'offsetHeight')!
    const probed: string[] = []
    Object.defineProperty(proto, 'offsetTop', {
      configurable: true,
      get(this: HTMLElement) {
        const before = this.previousSibling?.textContent?.length ?? 0
        return this.parentElement?.classList.contains('math-element__field-text') ? Math.floor(before / perRow) * 24 + 3 : 0
      },
    })
    Object.defineProperty(proto, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains('math-element__field-text')) return 0
        probed.push(this.textContent ?? '')
        return Math.max(1, Math.ceil(text.length / perRow)) * 24
      },
    })
    const computed = vi.spyOn(window, 'getComputedStyle').mockReturnValue({ lineHeight: '24px' } as CSSStyleDeclaration)
    onTestFinished(() => {
      Object.defineProperty(proto, 'offsetTop', top)
      Object.defineProperty(proto, 'offsetHeight', height)
      computed.mockRestore()
    })
    return probed
  }
  const text = 'x'.repeat(25)
  const box = { left: 0, top: 0, right: 100, bottom: 72 } as DOMRect

  it('says which row of the field the caret is on, in the cell’s own px', () => {
    layOut(10, text)
    const field = fieldOf(text, box, 0)

    expect(caretPlace(field, 4)).toEqual({ first: true, last: false, top: 0, bottom: 24 })
    expect(caretPlace(field, 14)).toEqual({ first: false, last: false, top: 24, bottom: 48 })
    expect(caretPlace(field, 25)).toEqual({ first: false, last: true, top: 48, bottom: 72 })
  })

  it('is the first and the last row in a field of one row', () => {
    layOut(40, text)

    expect(caretPlace(fieldOf(text, box, 0), 12)).toEqual({ first: true, last: true, top: 0, bottom: 24 })
  })

  it('measures a copy of the whole text, and leaves nothing behind in the cell', () => {
    const probed = layOut(10, text)
    const field = fieldOf(text, box, 0)

    caretPlace(field, 14)

    expect(probed).toEqual([text])
    expect(field.parentElement!.children).toHaveLength(2)
  })

  it('is null where nothing is laid out', () => {
    expect(caretPlace(fieldOf(text, box, 0), 4)).toBeNull()
  })
})
