import guide from '../../docs/math-guide.md?raw'

/**
 * The Math guide's examples, read from `docs/math-guide.md`: each numbered
 * section's `Write | Shows | Note` tables and `sheet` code blocks, in order,
 * one sheet per section. `src/math/math-guide.test.ts` runs them and says how
 * each is written; `src/math/rename.test.ts` renames every name in them. Not
 * app code.
 */

export interface Example {
  /** Where the example is, for the failure message: `3. Units, line 74`. */
  where: string
  source: string
  shows: Shows
}

export interface Shows {
  kind: 'value' | 'empty' | 'error' | 'prose'
  text: string
  warnings: readonly string[]
}

export const LINES = guide.split('\n')

/** Each numbered section, by title, with its lines and the doc line it starts on. */
export function sections() {
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
export function examples(section: ReturnType<typeof sections>[number]): Example[] {
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
