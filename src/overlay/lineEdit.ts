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
  /**
   * Goes up each time the app rewrites the text of the open line (the format
   * bar): the field takes only what the user types, so it is mounted again.
   */
  revision?: number
}

/**
 * The `lineIndex` of an edit that is on the element's title, not on a line
 * (docs/spec-v1.md section 4). The title sits above line 0.
 */
export const TITLE_LINE = -1

/** The ways an edit leaves a line, or tries to. */
export type LineMove =
  | { kind: 'up' }
  | { kind: 'down' }
  /** Enter: `from` and `to` are the selection; the caret alone has `from === to`. */
  | { kind: 'split'; from: number; to: number }
  /** Backspace at the start of the line. */
  | { kind: 'join' }
  /** The bar's Title button: the edit goes to the element's title. */
  | { kind: 'title' }
  /** Esc, a click outside, or anything else that ends the edit. */
  | { kind: 'leave' }

/** What a move leads to: the source the scene should hold, and the next edit. */
export interface LineMoveResult {
  source: string
  /** The title the scene should hold: changed only by an edit on the title. */
  title: string
  edit: LineEdit | null
  /**
   * The edit left an element with no text and no title, new or emptied: the
   * element is removed, and nothing is written (docs/spec-v1.md section 4).
   */
  remove: boolean
}

/**
 * False for an empty element: no line holds anything but spaces. A comment is
 * text, so an element holding only comments isn't empty.
 */
export function hasText(source: string): boolean {
  return splitLines(source).some((line) => line.trim() !== '')
}

export function startLineEdit(
  source: string,
  anchorId: string,
  lineIndex: number,
  title = '',
): LineEdit {
  const text = lineIndex === TITLE_LINE ? title : (splitLines(source)[lineIndex] ?? '')
  return { anchorId, lineIndex, text, caret: text.length }
}

/** The source as the sheet should evaluate it while `edit` is open. */
export function withTypedLine(source: string, edit: LineEdit): string {
  const lines = splitLines(source)
  // An edit on the title types nothing into the lines.
  if (edit.lineIndex === TITLE_LINE) return source
  if (edit.lineIndex >= lines.length || lines[edit.lineIndex] === edit.text) return source
  lines[edit.lineIndex] = edit.text
  return lines.join('\n')
}

/**
 * What each way of leaving a line does (docs/spec-v1.md section 6). `source` is
 * the scene's. The returned source is the same string when the move commits
 * nothing, so a line left unchanged writes nothing. A move with nowhere to go
 * (up from the first line, down from the last, join on the first) keeps the
 * edit open and commits nothing, because the edit hasn't left its line. Only a
 * leave can remove the element: the other moves stay inside it.
 */
export function applyLineMove(
  source: string,
  edit: LineEdit,
  move: LineMove,
  title = '',
): LineMoveResult {
  if (edit.lineIndex === TITLE_LINE) return applyTitleMove(source, edit, move, title)
  const lines = splitLines(source)
  const { anchorId, lineIndex, text } = edit
  const stay = { source, title, edit, remove: false }
  const toTitle = (): LineMoveResult => ({
    source: withTypedLine(source, edit),
    title,
    edit: startLineEdit(source, anchorId, TITLE_LINE, title),
    remove: false,
  })

  switch (move.kind) {
    case 'leave': {
      const typed = withTypedLine(source, edit)
      // A title is text too: an element holding only a title is kept.
      return { source: typed, title, edit: null, remove: !hasText(typed) && title === '' }
    }

    case 'title':
      return toTitle()

    case 'up':
    case 'down': {
      const target = lineIndex + (move.kind === 'up' ? -1 : 1)
      // Up from the first line goes to the title, adding one if there is none.
      if (target < 0) return toTitle()
      if (target >= lines.length) return stay
      return {
        source: withTypedLine(source, edit),
        title,
        edit: startLineEdit(source, anchorId, target),
        remove: false,
      }
    }

    case 'split': {
      const before = text.slice(0, move.from)
      const after = text.slice(move.to)
      lines.splice(lineIndex, 1, before, after)
      return {
        source: lines.join('\n'),
        title,
        edit: { anchorId, lineIndex: lineIndex + 1, text: after, caret: 0 },
        remove: false,
      }
    }

    case 'join': {
      if (lineIndex === 0) return stay
      const above = lines[lineIndex - 1]
      const joined = above + text
      lines.splice(lineIndex - 1, 2, joined)
      return {
        source: lines.join('\n'),
        title,
        edit: { anchorId, lineIndex: lineIndex - 1, text: joined, caret: above.length },
        remove: false,
      }
    }
  }
}

/**
 * The moves of an edit on the title. Down and Enter commit the title and go to
 * the first line; leaving commits it. Up, Backspace at the start and the Title
 * button have nowhere to go. The title is its text trimmed, so an empty one, or
 * one of only spaces, removes the header.
 */
function applyTitleMove(
  source: string,
  edit: LineEdit,
  move: LineMove,
  sceneTitle: string,
): LineMoveResult {
  const title = edit.text.trim()
  switch (move.kind) {
    case 'leave':
      return { source, title, edit: null, remove: !hasText(source) && title === '' }
    case 'down':
    case 'split':
      return { source, title, edit: startLineEdit(source, edit.anchorId, 0), remove: false }
    case 'up':
    case 'join':
    case 'title':
      // The edit hasn't left the title, so nothing is committed.
      return { source, title: sceneTitle, edit, remove: false }
  }
}
