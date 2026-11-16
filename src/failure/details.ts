/**
 * What an unexpected failure says and what it offers to report
 * (docs/spec-v1.md section 4, Unexpected failures; the words are section
 * 13's). Pure: no React, no DOM.
 */

/** The thing that failed: the failure stays as small as it. */
export type FailedThing = 'line' | 'element' | 'chart' | 'tab' | 'view'

export const FAILURE_MESSAGES = {
  element: 'this element hit an unexpected error in Excalimathpad',
  chart: 'this chart hit an unexpected error in Excalimathpad',
  tab: 'this tab hit an unexpected error in Excalimathpad',
  view: 'This sheet hit an unexpected error in Excalimathpad.',
  kept: 'Your sheet is kept up to the last finished line.',
  typing: 'You were typing:',
  reload: 'Reload the sheet',
  copyDetails: 'Copy details',
  copy: 'Copy',
  copied: 'Copied',
  report: 'Report this error',
  noContent: '(no sheet content is included)',
} as const

/** The repository's new-issue page, with nothing filled in: the app sends nothing by itself. */
export const REPORT_URL = 'https://github.com/matheus-sancha/excalimathpad/issues/new'

/** A failure as it is kept: its raw text, `TypeError: …`, and its stack. */
export interface Failure {
  text: string
  stack: string
}

export function failureOf(error: unknown): Failure {
  return error instanceof Error
    ? { text: `${error.name}: ${error.message}`, stack: error.stack ?? '' }
    : { text: String(error), stack: '' }
}

/** Where the app runs, for the details. */
export interface FailureHome {
  version: string
  /** The build stamp; on the plugin it is the version, and isn't said twice. */
  stamp: string
  home: 'web' | 'Obsidian plugin'
  device: 'desktop' | 'phone' | 'tablet' | null
}

const WHAT: Record<FailedThing, string> = {
  line: 'a line',
  element: 'an element',
  chart: 'a chart',
  tab: 'a tab',
  view: 'the view',
}

/**
 * The text Copy details puts on the clipboard: the version and build stamp,
 * the home, what failed, and the error with its stack. `words` is the sheet's
 * own text (`sheetWords`): none of it is in the result.
 */
export function failureDetails(
  what: FailedThing,
  failure: Failure,
  home: FailureHome,
  words: readonly string[],
): string {
  const build = home.stamp && home.stamp !== home.version ? ` (${home.stamp})` : ''
  return [
    `Excalimathpad ${home.version}${build}`,
    home.device ? `${home.home}, ${home.device}` : home.home,
    `What failed: ${WHAT[what]}`,
    scrub(failure.text, words),
    // Frames are places in the app's code: they hold nothing of the sheet.
    ...frames(failure),
    FAILURE_MESSAGES.noContent,
  ].join('\n')
}

/** The stack's frames, without the message some engines repeat at its top. */
function frames({ text, stack }: Failure): string[] {
  const body = stack.startsWith(text) ? stack.slice(text.length) : stack
  return body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== '')
}

/**
 * The sheet's own text, for `scrub`: every line and title, every word and
 * number in them, each name a line defines and each result as shown. A name
 * of one letter and any other text under three characters are left out:
 * replacing each `a` or `2` would cut the error's own words, and alone they
 * say nothing of the sheet. A word of the sheet that is also a word of the
 * error is cut too: the details err on the side of saying less.
 */
export function sheetWords(
  sheet: readonly {
    title?: string | null
    source?: string
    /** The lines' stored formats (section 7): a rule's condition is the sheet's text too. */
    formats?: string
    lines: readonly { result: { kind: string; text?: string }; variables: readonly { name: string; text?: string }[] }[]
  }[],
  typing: string | null = null,
): string[] {
  const words = new Set<string>()
  const add = (text: string | null | undefined, least = 3) => {
    const word = text?.trim()
    if (word && word.length >= least) words.add(word)
  }
  const addText = (text: string | null | undefined) => {
    add(text)
    for (const [token] of text?.matchAll(TOKEN) ?? []) add(token)
  }
  addText(typing)
  for (const element of sheet) {
    addText(element.title)
    element.source?.split(/\r?\n/).forEach(addText)
    element.formats?.split(/\r?\n/).forEach(addText)
    for (const line of element.lines) {
      add(line.result.text)
      for (const variable of line.variables) {
        add(variable.name, 2)
        add(variable.text)
      }
    }
  }
  return [...words]
}

/** A word or a number inside a line. */
const TOKEN = /[\p{L}_][\p{L}\p{N}_]*|\d[\d.,]*\d/gu

const WORD_CHAR = /[\p{L}\p{N}_]/u

/**
 * `text` with every whole occurrence of a sheet word replaced by `…`, longest
 * word first. Whole: not inside a longer run of letters and digits, so a
 * variable `or` doesn't cut `error`.
 */
export function scrub(text: string, words: readonly string[]): string {
  let out = text
  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    let from = 0
    for (;;) {
      const at = out.indexOf(word, from)
      if (at < 0) break
      const end = at + word.length
      const inside =
        (WORD_CHAR.test(word[0]) && at > 0 && WORD_CHAR.test(out[at - 1])) ||
        (WORD_CHAR.test(word[word.length - 1]) && end < out.length && WORD_CHAR.test(out[end]))
      if (inside) {
        from = at + 1
        continue
      }
      out = `${out.slice(0, at)}…${out.slice(end)}`
      from = at + 1
    }
  }
  return out
}
