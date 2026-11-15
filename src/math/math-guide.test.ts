import { describe, expect, it } from 'vitest'
import guide from '../../docs/math-guide.md?raw'
import { guideTree, slug } from '../guide/markdown.ts'
import { evaluateSheet, type SheetLine } from './evaluate.ts'

/**
 * The Math guide in CI (docs/spec-v1.md section 8, Math guide): every example
 * in `docs/math-guide.md` runs, so the guide can't drift from the app.
 *
 * Each numbered section's examples run top to bottom as one sheet, at the
 * default settings (Digits 4, SI with prefixes):
 *
 * - **a table** whose header is `Write | Shows | Note`. Its Write cell is one
 *   code span, the line typed. A Write cell in italics, `*(an empty line)*`, is
 *   the marker of a row that isn't math, and is skipped; any other Write cell
 *   fails the test, so a missing backtick can't hide an example;
 * - **a `sheet` code block**: each line is typed, and its result follows `→`.
 *
 * What a line shows is read the same way in both:
 *
 * - `` `82.19 cm²` `` (a code span; plain in a block): the shown result, a
 *   value, a list's summary or roots, compared with spaces, `·` and `^` set
 *   aside, so `82.19 cm²` matches the engine's `82.19 cm^2`;
 * - `—` (in a block, no `→`): the result cell stays empty;
 * - `` ● `message` ``: the line's error;
 * - prose (a table's Shows only, such as "A table of 5 rows under the line"):
 *   the line draws something under itself or as text, so its result cell is
 *   empty and it has no error;
 * - each `` ⚠ `message` `` after it: the line's warnings, all of them.
 *
 * It also fails on any link outside the guide: a link to a file or a site, or
 * to a heading the guide doesn't have.
 */

interface Example {
  /** Where the example is, for the failure message: `3. Units, line 74`. */
  where: string
  source: string
  shows: Shows
}

interface Shows {
  kind: 'value' | 'empty' | 'error' | 'prose'
  text: string
  warnings: readonly string[]
}

const LINES = guide.split('\n')

/** The 17 sections, in the order the spec lists them. */
const SECTIONS = [
  'A first sheet',
  'Lines and names',
  'Units',
  'Numbers and constants',
  'Functions',
  'Checks and conditions',
  'Solve',
  'Ranges and lists',
  'Tables',
  'Plots',
  'Comments and notes',
  'Formatting',
  'The Symbols tab',
  'The Sheet panel',
  'Files and recovery',
  'Keys and gestures',
  'Common messages',
]

/** Each numbered section, by title, with its lines and the doc line it starts on. */
function sections() {
  const starts = LINES.flatMap((line, i) => (/^## \d+\. /.test(line) ? [i] : []))
  return starts.map((start, n) => ({
    title: LINES[start].replace(/^## \d+\. /, ''),
    start,
    lines: LINES.slice(start + 1, starts[n + 1] ?? LINES.length),
  }))
}

/** A table row's cells, `\|` read as `|`. */
function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'))
}

/** A table's Shows cell. */
function readShowsCell(cell: string, where: string): Shows {
  const warnings = [...cell.matchAll(/⚠ `([^`]+)`/g)].map(([, message]) => message)
  const main = cell.replace(/⚠ `[^`]+`/g, '').trim()
  const code = /^`([^`]+)`$/.exec(main)
  if (code) return { kind: 'value', text: code[1], warnings }
  if (main === '—') return { kind: 'empty', text: '', warnings }
  const error = /^● `([^`]+)`$/.exec(main)
  if (error) return { kind: 'error', text: error[1], warnings }
  if (main.startsWith('●') || main.startsWith('`')) throw new Error(`${where}: can't read the Shows cell ${cell}`)
  return { kind: 'prose', text: main, warnings }
}

/** A `sheet` block's line: the source, and what follows its `→`. */
function readBlockLine(line: string): { source: string; shows: Shows } {
  const arrow = line.lastIndexOf('→')
  if (arrow < 0) return { source: line.trimEnd(), shows: { kind: 'empty', text: '', warnings: [] } }
  const source = line.slice(0, arrow).trimEnd()
  const [main, ...warnings] = line
    .slice(arrow + 1)
    .split('⚠')
    .map((part) => part.trim())
  if (main.startsWith('●')) return { source, shows: { kind: 'error', text: main.slice(1).trim(), warnings } }
  return { source, shows: { kind: main === '—' ? 'empty' : 'value', text: main, warnings } }
}

/** Every example in a section, in the order the section shows them. */
function examples(section: ReturnType<typeof sections>[number]): Example[] {
  const found: Example[] = []
  const { lines, title, start } = section
  for (let i = 0; i < lines.length; i++) {
    const at = (j: number) => `${title}, line ${start + j + 2}`
    if (/^\| Write \| Shows \| Note \|$/.test(lines[i])) {
      for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) {
        const [write, shows, note, ...extra] = cells(lines[i])
        if (note === undefined || extra.length) throw new Error(`${at(i)}: a row needs three cells`)
        if (/^\*.+\*$/.test(write)) continue
        const source = /^`([^`]+)`$/.exec(write)
        if (!source) throw new Error(`${at(i)}: a Write cell is one code span, or in italics for a row that isn't math`)
        found.push({ where: at(i), source: source[1], shows: readShowsCell(shows, at(i)) })
      }
    } else if (lines[i] === '```sheet') {
      for (i++; lines[i] !== '```'; i++) found.push({ where: at(i), ...readBlockLine(lines[i]) })
    }
  }
  return found
}

/** A shown result, as the guide writes it or as the engine does, compared without spaces, `·` and `^`. */
function canonical(text: string): string {
  const superscript = (digits: string) => [...digits].map((char) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(char)]).join('')
  return text
    .replace(/\^(?:\((-?\d+)\)|(-?\d+))/g, (_, bracketed?: string, bare?: string) => superscript(bracketed ?? bare ?? ''))
    .replace(/[\s·]/g, '')
}

/** What the line shows, read back into the guide's terms. */
function shown(line: SheetLine): Shows {
  const warnings = line.warnings
  const { result } = line
  if (result.kind === 'empty') return { kind: 'empty', text: '', warnings }
  if (result.kind === 'error') return { kind: 'error', text: result.message, warnings }
  return { kind: 'value', text: result.text, warnings }
}

describe('the Math guide (docs/math-guide.md)', () => {
  it('has the 17 sections in learning order, and a contents list that names them', () => {
    expect(sections().map(({ title }) => title)).toEqual(SECTIONS)
    const contents = [...guide.matchAll(/^\d+\. \[(.+)\]\(#(.+)\)$/gm)].map(([, title, anchor]) => ({ title, anchor }))
    expect(contents).toEqual(SECTIONS.map((title, i) => ({ title, anchor: slug(`${i + 1}. ${title}`) })))
  })

  it('is about 400 to 600 lines', () => {
    expect(LINES.length).toBeGreaterThanOrEqual(400)
    expect(LINES.length).toBeLessThanOrEqual(600)
  })

  it('links only to its own headings, and to no file or site', () => {
    const anchors = new Set(LINES.flatMap((line) => (/^#{1,3} (.+)$/.test(line) ? [slug(line.replace(/^#+ /, ''))] : [])))
    const links = [...guide.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)].map(([, href]) => href)
    expect(links.length).toBeGreaterThan(17)
    for (const href of links) expect(href.startsWith('#') && anchors.has(href.slice(1)), href).toBe(true)
    expect(guide).not.toMatch(/https?:|www\.|<a |<img/i)
    // The build reads it the same way, and refuses a link it can't follow.
    expect(() => guideTree(guide)).not.toThrow()
  })

  for (const section of sections()) {
    const found = examples(section)
    if (found.length === 0) continue
    it(`runs every example in "${section.title}"`, () => {
      const lines = evaluateSheet([{ id: 'section', source: found.map(({ source }) => source).join('\n') }]).get('section')!
      const failures = found.flatMap(({ where, source, shows }, i) => {
        const actual = shown(lines[i])
        const ok =
          (shows.kind === 'prose' ? actual.kind === 'empty' : actual.kind === shows.kind) &&
          (shows.kind === 'prose' || shows.kind === 'empty' || canonical(actual.text) === canonical(shows.text)) &&
          canonical(actual.warnings.join('|')) === canonical(shows.warnings.join('|'))
        return ok ? [] : [`${where}: ${source}\n  guide:  ${JSON.stringify(shows)}\n  engine: ${JSON.stringify(actual)}`]
      })
      expect(failures.join('\n')).toBe('')
    })
  }

  it('checks examples in every section that has math', () => {
    const withExamples = sections().filter((section) => examples(section).length > 0).map(({ title }) => title)
    expect(withExamples).toEqual([
      'A first sheet',
      'Lines and names',
      'Units',
      'Numbers and constants',
      'Functions',
      'Checks and conditions',
      'Solve',
      'Ranges and lists',
      'Tables',
      'Plots',
      'Comments and notes',
      'Formatting',
      'Common messages',
    ])
  })
})
