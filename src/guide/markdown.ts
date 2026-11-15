/**
 * The Math guide's Markdown, turned into elements at build time
 * (docs/spec-v1.md section 8, Math guide). `vite.config.ts` and
 * `esbuild.plugin.mjs` run it on `docs/math-guide.md` when the app imports
 * `docs/math-guide.md?guide`, so the bundle carries the guide as a tree of
 * elements and no Markdown code. React draws the tree: nothing sets
 * `innerHTML`, which Obsidian's review asks plugins to avoid.
 *
 * It reads the subset the guide is written in, and refuses anything else, so a
 * construct the dialog can't show fails the build rather than showing raw:
 *
 * - `#`, `##` and `###` headings, each with an id from its text, as GitHub
 *   makes one, so the guide's own links work on GitHub and in the dialog;
 * - paragraphs, `-` lists and `1.` lists, one paragraph per item;
 * - tables with a header row, and `\|` for a `|` inside a cell;
 * - fenced code blocks with an info string (`sheet` or `text`);
 * - inline code, `**bold**`, `*italic*` and links to the guide's own
 *   headings (`[A first sheet](#1-a-first-sheet)`). A link anywhere else is
 *   refused: the guide links to no file or site.
 *
 * Pure: no DOM and no Node, so the build, the dialog's tests and the guide's
 * CI test (`src/math/math-guide.test.ts`) all read the same rules.
 */

/** An element of the guide: its tag, its attributes, and what it holds. */
export interface GuideElement {
  tag: GuideTag
  attrs?: Readonly<Record<string, string>>
  children: readonly GuideNode[]
}

/** Text, or an element. */
export type GuideNode = string | GuideElement

export type GuideTag =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'p'
  | 'ul'
  | 'ol'
  | 'li'
  | 'table'
  | 'thead'
  | 'tbody'
  | 'tr'
  | 'th'
  | 'td'
  | 'pre'
  | 'code'
  | 'strong'
  | 'em'
  | 'a'

/** The prefix of every heading's id in the dialog, so it never meets an id of the page around it. */
export const HEADING_ID_PREFIX = 'math-guide-'

/**
 * A heading's anchor, as GitHub makes it: lower case, punctuation dropped,
 * each space a hyphen. `1. A first sheet` → `1-a-first-sheet`.
 */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

/** The guide as elements, or an error naming the line it can't read. */
export function guideTree(markdown: string): GuideNode[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const anchors = new Set(
    lines.flatMap((line) => {
      const heading = /^#{1,3} (.+)$/.exec(line)
      return heading ? [slug(plainText(heading[1]))] : []
    }),
  )
  const inline = (text: string, at: number) => inlineNodes(text, anchors, at)
  const nodes: GuideNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const at = i + 1
    if (line.trim() === '') {
      i++
      continue
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      if (level > 3) throw new Error(`line ${at}: the guide's headings go down to ###`)
      const text = heading[2].trim()
      nodes.push(element(`h${level}` as GuideTag, inline(text, at), { id: HEADING_ID_PREFIX + slug(plainText(text)) }))
      i++
      continue
    }
    const fence = /^```(.*)$/.exec(line)
    if (fence) {
      const info = fence[1].trim()
      if (!info) throw new Error(`line ${at}: a code block needs an info string, such as \`\`\`sheet`)
      const end = lines.findIndex((next, j) => j > i && next.startsWith('```'))
      if (end < 0) throw new Error(`line ${at}: the code block never ends`)
      const code = lines.slice(i + 1, end).join('\n')
      nodes.push(element('pre', [element('code', [code])], { 'data-info': info }))
      i = end + 1
      continue
    }
    if (line.startsWith('|') && isDivider(lines[i + 1])) {
      const header = cells(line)
      let end = i + 2
      while (end < lines.length && lines[end].startsWith('|')) end++
      const rows = lines.slice(i + 2, end).map((row, j) => {
        const cellsOfRow = cells(row)
        if (cellsOfRow.length !== header.length) {
          throw new Error(`line ${i + 3 + j}: a row has ${cellsOfRow.length} cells, the header ${header.length}`)
        }
        return element(
          'tr',
          cellsOfRow.map((cell) => element('td', inline(cell, i + 3 + j))),
        )
      })
      nodes.push(
        element('table', [
          element('thead', [element('tr', header.map((cell) => element('th', inline(cell, at))))]),
          element('tbody', rows),
        ]),
      )
      i = end
      continue
    }
    const item = /^(- |\d+\. )/.exec(line)
    if (item) {
      const ordered = item[1] !== '- '
      const items: GuideNode[] = []
      while (i < lines.length && listItem(lines[i], ordered)) {
        const start = i + 1
        let text = lines[i].replace(/^(- |\d+\. )/, '')
        i++
        // An item's continuation lines are indented.
        while (i < lines.length && /^ {2,}\S/.test(lines[i])) text += ` ${lines[i++].trim()}`
        items.push(element('li', inline(text, start)))
      }
      nodes.push(element(ordered ? 'ol' : 'ul', items))
      continue
    }
    if (/^\s*[<>]/.test(line)) throw new Error(`line ${at}: the guide holds no HTML or quotes`)
    if (/^\s/.test(line)) throw new Error(`line ${at}: an indented line belongs to a list item`)
    let text = line
    i++
    while (i < lines.length && lines[i].trim() !== '' && !startsBlock(lines[i], lines[i + 1])) {
      text += ` ${lines[i].trim()}`
      i++
    }
    nodes.push(element('p', inline(text, at)))
  }
  return nodes
}

function element(tag: GuideTag, children: readonly GuideNode[], attrs?: Record<string, string>): GuideElement {
  return attrs ? { tag, attrs, children } : { tag, children }
}

function isDivider(line: string | undefined): boolean {
  return line !== undefined && /^\|(\s*:?-+:?\s*\|)+\s*$/.test(line)
}

function listItem(line: string, ordered: boolean): boolean {
  return ordered ? /^\d+\. /.test(line) : line.startsWith('- ')
}

function startsBlock(line: string, next: string | undefined): boolean {
  return /^(#{1,6} |```|- |\d+\. )/.test(line) || (line.startsWith('|') && isDivider(next))
}

/** A table row's cells: split at each `|` that isn't escaped, then `\|` read as `|`. */
function cells(row: string): string[] {
  const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner
    .replaceAll('\\|', '\uE002')
    .split('|')
    .map((cell) => cell.trim().replaceAll('\uE002', '|'))
}

/** A heading's text without its inline marks, for its anchor. */
function plainText(text: string): string {
  return text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '')
}

/** Stands in for the n-th code span while the marks around it are read. */
const CODE = /(\d+)/

/**
 * Inline code, bold, italic and the guide's own links. Code is set aside
 * first, so nothing inside it is read as a mark, and a mark can still hold
 * code (`**Write `f_d * (L/D)`**`).
 */
function inlineNodes(text: string, anchors: ReadonlySet<string>, at: number): GuideNode[] {
  const codes: string[] = []
  const masked = text.replace(/`([^`]+)`/g, (_, code: string) => `${codes.push(code) - 1}`)
  if (masked.includes('`')) throw new Error(`line ${at}: a code span never ends`)
  const unmask = (nodes: readonly GuideNode[]): GuideNode[] =>
    nodes.flatMap((node) => {
      if (typeof node !== 'string') return [{ ...node, children: unmask(node.children) }]
      return node
        .split(/(\d+)/)
        .filter((part) => part !== '')
        .map((part) => {
          const code = CODE.exec(part)
          return code ? element('code', [codes[Number(code[1])]]) : part
        })
    })
  return unmask(marks(masked, anchors, at))
}

// Italic starts and ends on a letter, not a space, so `2 * pi * r` isn't italic.
const MARK = /\[([^\]]+)\]\(([^)]*)\)|\*\*(.+?)\*\*|\*(\S(?:.*?\S)?)\*/

function marks(text: string, anchors: ReadonlySet<string>, at: number): GuideNode[] {
  if (/https?:|www\.|<[a-z/!]/i.test(text)) throw new Error(`line ${at}: the guide links to no file or site`)
  const nodes: GuideNode[] = []
  let rest = text
  for (let found = MARK.exec(rest); found; found = MARK.exec(rest)) {
    if (found.index > 0) nodes.push(rest.slice(0, found.index))
    const [whole, label, href, bold, italic] = found
    if (label !== undefined) {
      if (!href.startsWith('#') || !anchors.has(href.slice(1))) {
        throw new Error(`line ${at}: the link to ${JSON.stringify(href)} isn't to one of the guide's headings`)
      }
      nodes.push(element('a', marks(label, anchors, at), { href }))
    } else if (bold !== undefined) {
      nodes.push(element('strong', marks(bold, anchors, at)))
    } else {
      nodes.push(element('em', marks(italic, anchors, at)))
    }
    rest = rest.slice(found.index + whole.length)
  }
  if (rest) nodes.push(rest)
  return nodes
}

/** The import that brings the guide in: `docs/math-guide.md?guide`. */
export const GUIDE_QUERY = '?guide'

/** The module both builds hand the app for that import: the guide's elements, as JSON. */
export function guideModule(markdown: string): string {
  return `export default ${JSON.stringify(guideTree(markdown))}\n`
}
