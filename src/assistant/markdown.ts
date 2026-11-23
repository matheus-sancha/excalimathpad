/**
 * The chat's small Markdown (docs/spec-v1.md section 8, Math assistant, An answer; section 14,
 * 0.7.0: the app's own small reader, no dependency). It reads paragraphs, lists, bold, inline
 * code, code blocks and references, and nothing else: a heading, a table, a quote or a rule
 * stays as its text, a link is its text, an image is its words, and raw HTML is text. It gives
 * parts, never markup, so nothing it reads can become an element: `AnswerText.tsx` draws each
 * part as text inside the chat's own elements.
 *
 * It reads the whole answer each time, so an answer read as it arrives gives the same parts as
 * the same text read at the end. While it arrives (`arriving`), what may still turn into
 * something else waits for the next piece: a line that is only a list's number or mark, or a
 * code block's first backticks; and at the end, a label, a link or a run of `*` not yet whole.
 * A bold or inline code not yet closed is drawn as such, to the end.
 */

/** A part of a line. `bold` holds text, code and references; a reference is a label's text, as `E2:3`. */
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; parts: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'ref'; label: string }

export type Block =
  /** Its lines as written: a line break inside a paragraph stays one. */
  | { kind: 'paragraph'; lines: Inline[][] }
  /** Each item is its lines; an ordered list starts at its first item's number. */
  | { kind: 'list'; ordered: boolean; start: number; items: Inline[][][] }
  /** A code block's lines, as written: never read for marks. */
  | { kind: 'code'; lines: string[] }

/** A label of the listing, whole: `E2:3`, `E2` or `T1` (section 8, The listing). */
const LABEL = /^(?:E[1-9]\d*(?::[1-9]\d*)?|T[1-9]\d*)$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/
const BULLET = /^( *)([-*+])(?: +(.*))?$/
const NUMBERED = /^( *)(\d{1,9})[.)](?: +(.*))?$/
/** A last line, while the answer arrives, that may yet be a list's mark or a code block's start. */
const MARK_SO_FAR = /^ *(?:\d{1,9}[.)]?|[-*+]|`{1,2}|~{1,2})$/
/**
 * The end of a last line, while it arrives, that may yet be a label, a link or an image (a
 * `[`, its text, its `]`, its address unclosed), a bold's `*`, an escape's `\` or an image's `!`.
 */
const TAIL_SO_FAR = /(?:!?\[[^\]\n]*(?:\](?:\([^)\n]*)?)?|\*+|\\|!)$/

interface Item {
  ordered: boolean
  number: number
  /** How far the item's text starts in: a line indented as far or further runs it on. */
  indent: number
  text: string
}

function itemOf(line: string): Item | null {
  const bullet = BULLET.exec(line)
  if (bullet) return { ordered: false, number: 0, indent: bullet[1].length + 2, text: bullet[3] ?? '' }
  const numbered = NUMBERED.exec(line)
  if (numbered) return { ordered: true, number: Number(numbered[2]), indent: numbered[1].length + numbered[2].length + 2, text: numbered[3] ?? '' }
  return null
}

/** The answer's text so far, or whole, read into blocks. */
export function readAnswer(answer: string, arriving: boolean): Block[] {
  const lines = answer.replace(/\r\n?/g, '\n').split('\n')
  // The line still being written is the last; a finished line ends in a line break.
  if (arriving && MARK_SO_FAR.test(lines[lines.length - 1])) lines[lines.length - 1] = ''
  const last = lines.length - 1
  const inline = (text: string, at: number) => readInline(text, arriving && at === last)

  const blocks: Block[] = []
  let paragraph: Inline[][] | null = null
  let list: (Block & { kind: 'list' }) | null = null
  let item: { indent: number } | null = null
  const endParagraph = () => {
    paragraph = null
  }
  const endList = () => {
    list = null
    item = null
  }

  for (let at = 0; at < lines.length; at++) {
    const line = lines[at]
    const fence = FENCE.exec(line)
    if (fence) {
      endParagraph()
      endList()
      const mark = fence[1]
      const code: string[] = []
      let end = at + 1
      // A block closes on a line of the same mark, at least as long; else it runs to the end.
      const closes = new RegExp(`^ {0,3}${mark[0] === '`' ? '`' : '~'}{${mark.length},} *$`)
      while (end < lines.length && !closes.test(lines[end])) code.push(lines[end++])
      // Unclosed, the line after the answer's last line break is no line of the block (yet).
      if (end === lines.length && code.length > 0 && lines[last] === '') code.pop()
      blocks.push({ kind: 'code', lines: code })
      at = end
      continue
    }
    if (line.trim() === '') {
      endParagraph()
      if (list) {
        // A blank line ends the list, unless the next line with text is another of its items.
        let next = at + 1
        while (next < lines.length && lines[next].trim() === '') next++
        const after = next < lines.length ? itemOf(lines[next]) : null
        if (!after || after.ordered !== list.ordered) endList()
        else item = null
      }
      continue
    }
    const found = itemOf(line)
    const current: (Block & { kind: 'list' }) | null = list
    const open: { indent: number } | null = item
    // Indented under an open item, a line runs it on, even one that looks like an item.
    const indent = line.length - line.trimStart().length
    if (current && open && indent >= open.indent && (indent > 0 || !found)) {
      current.items[current.items.length - 1].push(inline(line.trim(), at))
      continue
    }
    if (found && !(current && found.ordered !== current.ordered && indent > 0)) {
      endParagraph()
      if (!current || current.ordered !== found.ordered) {
        list = { kind: 'list', ordered: found.ordered, start: found.ordered ? found.number : 1, items: [] }
        blocks.push(list)
      }
      list!.items.push([inline(found.text, at)])
      item = { indent: found.indent }
      continue
    }
    if (current && open) {
      // A line with no indent straight after an item runs it on, as Markdown reads it.
      current.items[current.items.length - 1].push(inline(line.trim(), at))
      continue
    }
    endList()
    if (!paragraph) {
      paragraph = []
      blocks.push({ kind: 'paragraph', lines: paragraph })
    }
    paragraph.push(inline(line, at))
  }
  return blocks
}

/**
 * One line's parts. `open` is the line still being written: what may yet be a label, a link
 * or a bold's mark waits, and a bold or inline code not yet closed is drawn to the end.
 */
export function readInline(line: string, open: boolean): Inline[] {
  const text = open ? line.replace(TAIL_SO_FAR, '') : line
  return merge(scan(text, open, true))
}

function scan(text: string, open: boolean, boldAllowed: boolean): Inline[] {
  const parts: Inline[] = []
  const plain = (value: string) => {
    if (value) parts.push({ kind: 'text', text: value })
  }
  let at = 0
  while (at < text.length) {
    const char = text[at]
    if (char === '\\' && at + 1 < text.length && /[!-/:-@[-`{-~]/.test(text[at + 1])) {
      plain(text[at + 1])
      at += 2
      continue
    }
    if (char === '`') {
      let run = 1
      while (text[at + run] === '`') run++
      const ticks = '`'.repeat(run)
      let close = text.indexOf(ticks, at + run)
      // A run of exactly that many, not part of a longer one.
      while (close !== -1 && text[close + run] === '`') close = text.indexOf(ticks, close + run + 1)
      if (close !== -1) {
        parts.push({ kind: 'code', text: trimCode(text.slice(at + run, close)) })
        at = close + run
        continue
      }
      if (open) {
        parts.push({ kind: 'code', text: text.slice(at + run) })
        at = text.length
        continue
      }
      plain(ticks)
      at += run
      continue
    }
    if (boldAllowed && text.startsWith('**', at)) {
      const close = text.indexOf('**', at + 2)
      if (close !== -1 && close > at + 2) {
        parts.push({ kind: 'bold', parts: merge(scan(text.slice(at + 2, close), false, false)) })
        at = close + 2
        continue
      }
      if (close === -1 && open) {
        parts.push({ kind: 'bold', parts: merge(scan(text.slice(at + 2), true, false)) })
        at = text.length
        continue
      }
      plain('**')
      at += 2
      continue
    }
    if (char === '[' || (char === '!' && text[at + 1] === '[')) {
      const start = char === '!' ? at + 1 : at
      const close = text.indexOf(']', start + 1)
      if (close !== -1) {
        const inside = text.slice(start + 1, close)
        // A link or an image: its text only, never its address.
        if (text[close + 1] === '(') {
          const end = text.indexOf(')', close + 2)
          if (end !== -1) {
            plain(inside)
            at = end + 1
            continue
          }
        }
        if (char === '[' && LABEL.test(inside)) {
          parts.push({ kind: 'ref', label: inside })
          at = close + 1
          continue
        }
      }
    }
    // Text up to the next character that may start a mark.
    let end = at + 1
    while (end < text.length && !'\\`*[!'.includes(text[end])) end++
    plain(text.slice(at, end))
    at = end
  }
  return parts
}

/** Inline code drops one space at each end when it has both, so `` `a` `` and `` ` a ` `` read alike. */
function trimCode(code: string): string {
  return code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '' ? code.slice(1, -1) : code
}

function merge(parts: Inline[]): Inline[] {
  const out: Inline[] = []
  for (const part of parts) {
    const previous = out[out.length - 1]
    if (part.kind === 'text' && previous?.kind === 'text') out[out.length - 1] = { kind: 'text', text: previous.text + part.text }
    else out.push(part)
  }
  return out
}
