/** A box in px, in the window's frame. */
export interface RowBox {
  left: number
  top: number
  right: number
  bottom: number
}

/** The open line's or title's field. */
export type OpenField = HTMLTextAreaElement | HTMLInputElement

/** The hidden copy of the field's text that shares its cell, laid out as the field is. */
const copyOf = (field: OpenField) => field.parentElement?.querySelector<HTMLElement>('.math-element__field-text') ?? null

/**
 * The caret's row, for the follow rule (docs/spec-v1.md section 4, While
 * editing a line, 0.2.1, #191) and for the suggestion list: the open field's
 * box and, once the field has wrapped (M4e), the one of its rows the caret is
 * on. A row wider than `room` can't be wholly in view (the element's left
 * edge is out of view, or its title is very long), so it narrows to the
 * caret, and the view then follows the caret sideways.
 *
 * The caret is measured on the hidden copy of the text that shares the
 * field's cell (`.math-element__field-text`), which is drawn with the same
 * font at the same place and breaks where the field does; a field has no box
 * for its caret.
 */
export function caretRow(field: OpenField, room: number): RowBox {
  const { left, top, right, bottom } = field.getBoundingClientRect()
  const caret = field.selectionStart ?? field.value.length
  const at = caretBox(field, caret)
  const row = { left, top, right, bottom }
  // Wrapped: the caret's own row, by the character it stands before (or after, at the end).
  if (at && at.box.bottom - at.box.top > 0 && bottom - top > 1.5 * (at.box.bottom - at.box.top)) {
    row.top = Math.max(top, at.box.top)
    row.bottom = Math.min(bottom, at.box.bottom)
  }
  if (right - left <= room) return row
  // Rotated, the character's box still bounds the caret.
  const x = caret === 0 ? left : at ? (at.after ? at.box.right : at.box.left) : right
  return { ...row, left: x, right: x }
}

/** The box of the character the caret stands before; at the end of the text, of the one it stands `after`. */
function caretBox(field: OpenField, caret: number): { box: RowBox; after: boolean } | null {
  const text = copyOf(field)?.firstChild
  const length = text?.textContent?.length ?? 0
  if (!text || text.nodeType !== 3 || length === 0) return null
  const range = field.ownerDocument.createRange()
  const after = caret >= length
  const from = after ? length - 1 : caret
  range.setStart(text, from)
  range.setEnd(text, from + 1)
  if (typeof range.getClientRects !== 'function') return null
  const boxes = range.getClientRects()
  const box = after ? boxes[boxes.length - 1] : boxes[0]
  return box ? { box, after } : null
}

/** Where the caret is among the rows of a wrapped field, in the field's own px (before zoom and rotation). */
export interface CaretPlace {
  /** The caret is on the field's first row, and on its last: both, in a field of one row. */
  first: boolean
  last: boolean
  /** The caret's row, from the top of the field's cell. */
  top: number
  bottom: number
}

/**
 * The row of a wrapped field the caret is on (section 4, While editing a
 * line, The field wraps, M4e): ↑ and ↓ leave the line only from its first or
 * last row, and the suggestions open under the caret's row. A copy of the
 * text, split at the caret, is laid out in the field's cell for a moment:
 * `offsetTop` ignores transforms, so this holds at any zoom and rotation.
 * Null when nothing is laid out (jsdom), where a field is one row.
 */
export function caretPlace(field: OpenField, caret: number): CaretPlace | null {
  const copy = copyOf(field)
  const view = field.ownerDocument.defaultView
  if (!copy || !view) return null
  const probe = copy.cloneNode(false) as HTMLElement
  const rest = field.ownerDocument.createElement('span')
  // The text after the caret starts on the caret's row; at the end, a mark of no width does.
  rest.textContent = field.value.slice(caret) || '​'
  probe.append(field.value.slice(0, caret), rest)
  copy.after(probe)
  const rowHeight = parseFloat(view.getComputedStyle(probe).lineHeight)
  const height = probe.offsetHeight
  const offset = rest.offsetTop - probe.offsetTop
  probe.remove()
  if (!(rowHeight > 0) || height === 0) return null
  const rows = Math.max(1, Math.round(height / rowHeight))
  const row = Math.min(rows - 1, Math.max(0, Math.floor(offset / rowHeight)))
  return { first: row === 0, last: row === rows - 1, top: row * rowHeight, bottom: (row + 1) * rowHeight }
}
