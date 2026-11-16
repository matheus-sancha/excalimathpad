import { describe, expect, it } from 'vitest'
import { caretRow } from './caretRow.ts'

const rect = (left: number, right: number) => ({ left, top: 300, right, bottom: 324 }) as DOMRect

/** An open field of the given box holding `text`, in its cell beside the hidden copy. */
function fieldOf(text: string, box: DOMRect, caret: number) {
  const cell = document.createElement('span')
  const copy = document.createElement('span')
  copy.className = 'math-element__field-text'
  copy.textContent = text
  const field = document.createElement('input')
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
    // jsdom lays nothing out: stand in for the typed part's box.
    const range = { setStart() {}, setEnd() {}, getBoundingClientRect: () => rect(100, 1498) }
    field.ownerDocument.createRange = () => range as unknown as Range

    expect(caretRow(field, 900)).toEqual({ left: 1498, top: 300, right: 1498, bottom: 324 })
  })

  it('is the field’s left edge with the caret at the start of a wide field', () => {
    expect(caretRow(fieldOf('x'.repeat(200), rect(100, 1500), 0), 900)).toEqual({ left: 100, top: 300, right: 100, bottom: 324 })
  })
})
