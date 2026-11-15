import { readLine } from '../math/lineForm.ts'
import type { SymbolInsert } from '../math/symbols.ts'

/**
 * What a Symbols or Constants button types into the open field (docs/spec-v1.md
 * section 4, What a click inserts, M4d). Pure: the field's text and selection
 * in, the range to replace, the text that replaces it and where the caret
 * ends out. The overlay types it with `execCommand('insertText')`, so the
 * insert is one step of the field's own Ctrl+Z.
 */
export interface PlannedInsert {
  /** The range `text` replaces: the selection, or the caret when there is none. */
  from: number
  to: number
  text: string
  /** Where the caret ends, in the text after the insert. */
  caret: number
}

const NAME_CHAR = /[A-Za-z0-9_]/

/**
 * Plans an insert over `value.slice(start, end)`. With `plain` (an open
 * title or comment line, which take the insert as plain text, like any
 * typing), the text goes in as it is, over the selection, the caret after it.
 */
export function planInsert(value: string, start: number, end: number, insert: SymbolInsert, plain = false): PlannedInsert {
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  const before = value.slice(0, from)
  const after = value.slice(to)
  const selected = value.slice(from, to)
  const close = insert.close ?? ''
  const at = (text: string, caret: number): PlannedInsert => ({ from, to, text, caret: from + caret })

  if (plain) {
    const text = insert.text + close
    return at(text, text.length)
  }

  const nameBefore = NAME_CHAR.test(before.at(-1) ?? '')
  const nameAfter = NAME_CHAR.test(after[0] ?? '')
  const spaceBefore = before === '' || /\s$/.test(before)
  const spaceAfter = /^\s/.test(after)

  switch (insert.mode) {
    case 'name': {
      // Joins only right after `_`; a name character before or after gets a space between.
      const lead = nameBefore && !before.endsWith('_') ? ' ' : ''
      const text = lead + insert.text
      return at(text + (nameAfter ? ' ' : ''), text.length)
    }
    case 'word':
    case 'prefix': {
      const lead = nameBefore ? ' ' : ''
      const text = lead + insert.text
      if (insert.mode === 'word') return at(text + (nameAfter ? ' ' : ''), text.length)
      // A prefix is always followed by what it applies to: a space after, never two.
      return spaceAfter ? at(text, text.length + 1) : at(`${text} `, text.length + 1)
    }
    case 'spaced': {
      const lead = spaceBefore ? '' : ' '
      if (close) {
        // `? :`: the caret goes between the two halves, each spaced.
        const head = `${lead}${insert.text} `
        const tail = ` ${close}${spaceAfter ? '' : ' '}`
        return at(head + tail, head.length)
      }
      const text = lead + insert.text
      // The caret ends after the operator's space, the one added or the one there.
      return spaceAfter ? at(text, text.length + 1) : at(`${text} `, text.length + 1)
    }
    case 'tight':
      return at(insert.text + close, insert.text.length)
    case 'wrap': {
      // A call right after a name character would join it (`a` + √ is `asqrt`).
      const lead = nameBefore && /^[A-Za-z]/.test(insert.text) ? ' ' : ''
      const open = lead + insert.text
      if (selected) {
        const text = open + selected + close
        return at(text, text.length)
      }
      return at(open + close, open.length)
    }
  }
}

/**
 * Whether the caret is in text, not math: a comment line (`# Pumps`, or one
 * whose code is only a format clause) or a line's note, after its `#`.
 */
export function isPlainAt(value: string, caret: number): boolean {
  if (readLine(value).kind === 'comment') return true
  const lead = value.slice(0, caret)
  let quoted = false
  for (const char of lead) {
    if (char === '"') quoted = !quoted
    else if (char === '#' && !quoted) return true
  }
  return false
}
