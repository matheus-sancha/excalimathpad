/**
 * What the view's boundary reads when the view fails (docs/spec-v1.md section
 * 4, Unexpected failures). The sheet tells it things as it runs, since by the
 * time the boundary has the failure the sheet's own state is gone. `Kept` is
 * what the sheet file keeps of a failed view; `Sheet` the sheet as evaluated.
 */
export interface FailureBox<Kept, Sheet> {
  /** The open line's or title's text, as typed; null with none open. */
  typing: (text: string | null) => void
  /** The sheet as last evaluated: its text is kept out of the copied details. */
  evaluated: (sheet: Sheet) => void
  /** The sheet file's `fail`: what it keeps, and the end of its writes. Null with no file yet. */
  file: (fail: (() => Kept | null) | null) => void
  /** The view failed: tells the sheet file, once, and notes what was being typed. */
  failed: () => void
  /** At the failure: what the sheet file kept, and what was being typed. */
  kept: () => Kept | null
  typed: () => string | null
  /** The sheet as last evaluated, and the text open now or at the failure. */
  sheet: () => Sheet
  open: () => string | null
}

export function createFailureBox<Kept, Sheet>(empty: Sheet): FailureBox<Kept, Sheet> {
  let typing: string | null = null
  let sheet = empty
  let fail: (() => Kept | null) | null = null
  let kept: Kept | null = null
  let typed: string | null = null
  return {
    typing: (text) => {
      typing = text
    },
    evaluated: (next) => {
      sheet = next
    },
    file: (next) => {
      fail = next
    },
    failed: () => {
      const tell = fail
      fail = null
      kept = tell?.() ?? null
      typed = typing
      typing = null
    },
    kept: () => kept,
    typed: () => typed,
    sheet: () => sheet,
    open: () => typed ?? typing,
  }
}
