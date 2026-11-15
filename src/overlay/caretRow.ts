/** A box in px, in the window's frame. */
export interface RowBox {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * The caret's row, for the follow rule (docs/spec-v1.md section 4, While
 * editing a line, 0.2.2, #191): the open field's box. A field wider than
 * `room` can't be wholly in view, so its row narrows to the caret: the field
 * doesn't wrap until M4e, and the view then follows the caret sideways.
 *
 * The caret is measured on the hidden copy of the text that shares the
 * field's cell (`.math-element__field-text`), which is drawn with the same
 * font at the same place; an `<input>` has no box for its caret.
 */
export function caretRow(field: HTMLInputElement, room: number): RowBox {
  const { left, top, right, bottom } = field.getBoundingClientRect()
  if (right - left <= room) return { left, top, right, bottom }
  const caret = field.selectionStart ?? field.value.length
  const copy = field.parentElement?.querySelector('.math-element__field-text')?.firstChild
  let x = caret === 0 ? left : right
  if (copy && copy.nodeType === 3 && caret > 0) {
    const range = field.ownerDocument.createRange()
    range.setStart(copy, 0)
    range.setEnd(copy, Math.min(caret, copy.textContent?.length ?? 0))
    // The typed part's box; rotated, its far edge still bounds the caret.
    if (typeof range.getBoundingClientRect === 'function') x = range.getBoundingClientRect().right
  }
  return { left: x, top, right: x, bottom }
}
