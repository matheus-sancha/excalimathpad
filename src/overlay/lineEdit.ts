import { splitLines } from '../math/evaluate.ts'

/**
 * The one line shown as raw source (docs/spec-v1.md section 4). UI state: it is
 * never in the scene or the file. `text` is what the user has typed so far, and
 * `caret` is where the field puts the caret when it opens.
 */
export interface LineEdit {
  anchorId: string
  lineIndex: number
  text: string
  caret: number
}

/** The ways an edit leaves a line, or tries to. */
export type LineMove =
  | { kind: 'up' }
  | { kind: 'down' }
  /** Enter: `from` and `to` are the selection; the caret alone has `from === to`. */
  | { kind: 'split'; from: number; to: number }
  /** Backspace at the start of the line. */
  | { kind: 'join' }
  /** Esc, a click outside, or anything else that ends the edit. */
  | { kind: 'leave' }

/** What a move leads to: the source the scene should hold, and the next edit. */
export interface LineMoveResult {
  source: string
  edit: LineEdit | null
}

export function startLineEdit(
  source: string,
  anchorId: string,
  lineIndex: number,
): LineEdit {
  const text = splitLines(source)[lineIndex] ?? ''
  return { anchorId, lineIndex, text, caret: text.length }
}

/** The source as the sheet should evaluate it while `edit` is open. */
export function withTypedLine(source: string, edit: LineEdit): string {
  const lines = splitLines(source)
  if (edit.lineIndex >= lines.length || lines[edit.lineIndex] === edit.text) return source
  lines[edit.lineIndex] = edit.text
  return lines.join('\n')
}

/**
 * What each way of leaving a line does (docs/spec-v1.md section 6). `source` is
 * the scene's. The returned source is the same string when the move commits
 * nothing, so a line left unchanged writes nothing. A move with nowhere to go
 * (up from the first line, down from the last, join on the first) keeps the
 * edit open and commits nothing, because the edit hasn't left its line.
 */
export function applyLineMove(
  source: string,
  edit: LineEdit,
  move: LineMove,
): LineMoveResult {
  const lines = splitLines(source)
  const { anchorId, lineIndex, text } = edit
  const stay = { source, edit }

  switch (move.kind) {
    case 'leave':
      return { source: withTypedLine(source, edit), edit: null }

    case 'up':
    case 'down': {
      const target = lineIndex + (move.kind === 'up' ? -1 : 1)
      if (target < 0 || target >= lines.length) return stay
      return {
        source: withTypedLine(source, edit),
        edit: startLineEdit(source, anchorId, target),
      }
    }

    case 'split': {
      const before = text.slice(0, move.from)
      const after = text.slice(move.to)
      lines.splice(lineIndex, 1, before, after)
      return {
        source: lines.join('\n'),
        edit: { anchorId, lineIndex: lineIndex + 1, text: after, caret: 0 },
      }
    }

    case 'join': {
      if (lineIndex === 0) return stay
      const above = lines[lineIndex - 1]
      const joined = above + text
      lines.splice(lineIndex - 1, 2, joined)
      return {
        source: lines.join('\n'),
        edit: { anchorId, lineIndex: lineIndex - 1, text: joined, caret: above.length },
      }
    }
  }
}
