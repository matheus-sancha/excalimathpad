import { cleanup, render } from '@testing-library/react'
import guide from '../../docs/math-guide.md?raw'
import { NO_TITLE_FORMAT } from '../canvas/mathAnchor.ts'
import { evaluateSheet, listConstants } from '../math/evaluate.ts'
import { readLine } from '../math/lineForm.ts'
import { readPlot } from '../math/plotLine.ts'
import { LineSample } from '../overlay/MathElementView.tsx'
import { drawChart, loadPlot } from '../overlay/plotDrawing.ts'
import { constantSuggestions, functionSuggestions, sheetNames, suggest, unitSuggestions } from '../overlay/suggest.ts'
import { FormatTab, type FormatActions } from '../panel/FormatTab.tsx'
import { problemRows, variableGroups } from '../panel/sheetPanel.ts'

/**
 * A sheet's states sent through the engine and the view, for the typing test
 * and the odd-values probe (docs/spec-v1.md section 14, M4e; the method is
 * `docs/research/half-typed-lines.md`'s). Not app code.
 */

export interface TypedSheet {
  name: string
  lines: string[]
}

/** Each numbered section of the Math guide, its examples as one sheet, as `math-guide.test.ts` runs them. */
export function guideSheets(): TypedSheet[] {
  const all = guide.split('\n')
  const starts = all.flatMap((line, i) => (/^## \d+\. /.test(line) ? [i] : []))
  return starts.flatMap((start, n) => {
    const lines = all.slice(start + 1, starts[n + 1] ?? all.length)
    const found: string[] = []
    for (let i = 0; i < lines.length; i++) {
      if (/^\| Write \| Shows \| Note \|$/.test(lines[i])) {
        for (i += 2; i < lines.length && lines[i].startsWith('|'); i++) {
          const write = splitRow(lines[i])[0]
          const code = /^`([^`]+)`$/.exec(write)
          if (code) found.push(code[1])
        }
      } else if (lines[i] === '```sheet') {
        for (i++; lines[i] !== '```'; i++) {
          const arrow = lines[i].lastIndexOf('→')
          found.push(arrow < 0 ? lines[i].trimEnd() : lines[i].slice(0, arrow).trimEnd())
        }
      }
    }
    return found.length > 0 ? [{ name: `guide: ${all[start].replace(/^## /, '')}`, lines: found }] : []
  })
}

/** A table row's cells; `\|` is a bar inside a cell. */
function splitRow(row: string): string[] {
  const cells: string[] = []
  let cell = ''
  const inner = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\' && inner[i + 1] === '|') {
      cell += '|'
      i++
    } else if (inner[i] === '|') {
      cells.push(cell.trim())
      cell = ''
    } else cell += inner[i]
  }
  cells.push(cell.trim())
  return cells
}

/**
 * An acceptance sheet under `docs/acceptance/`: the lines of its table, whose
 * rows are `| 1 | \`source\` | … |` (a row numbered `c` is a comment line).
 */
export function acceptanceSheet(name: string, markdown: string): TypedSheet {
  const lines = markdown
    .split('\n')
    .filter((row) => /^\| (c|\d+[a-z]?) \| `/.test(row))
    .flatMap((row) => {
      const code = /^`(.+)`$/.exec(splitRow(row)[1])
      return code ? [code[1]] : []
    })
  return { name, lines }
}

export interface Finding {
  /** What threw or caught: `engine: evaluateSheet threw`, `view: LineSample`, … */
  stage: string
  message: string
  /** The sheet and the lines that gave it. */
  where: string
}

const NO_ACTIONS = new Proxy({}, { get: () => () => {} }) as FormatActions

/**
 * Checks sheet states one at a time, as the app meets them at a keystroke:
 * `evaluateSheet`, then the panel's rows, each line's row (`LineSample`, the
 * same `TypesetRow` the grid draws), the Format tab on it and its chart. A
 * throw anywhere, or a line that reached the per-line guard (section 4,
 * Unexpected failures), is a finding. A row already drawn isn't drawn again.
 */
export async function sheetChecker() {
  const Plot = await loadPlot()
  const units = unitSuggestions()
  const constants = constantSuggestions(listConstants())
  const drawn = new Set<string>()
  const findings: Finding[] = []
  let states = 0

  return {
    findings,
    states: () => states,
    /**
     * One state: `texts` are the sheet's lines. `typed` is the line being
     * typed, or null to take every line from `from` on as just typed.
     */
    check(sheet: string, texts: readonly string[], typed: number | null, from = 0) {
      states++
      // Testing-library keeps every render until cleanup: without this the run itself runs out of memory.
      if (states % 200 === 0) cleanup()
      const where = `${sheet}: ${JSON.stringify(typed === null ? texts.slice(from) : texts[typed])}`
      const attempt = <T,>(stage: string, run: () => T): T | undefined => {
        try {
          return run()
        } catch (error) {
          findings.push({ stage, message: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error), where })
          return undefined
        }
      }

      const lines = attempt('engine: evaluateSheet threw', () => evaluateSheet([{ id: 'a', source: texts.join('\n') }]).get('a')!)
      if (!lines) return
      lines.forEach(({ result }, i) => {
        if (result.kind === 'error' && result.unexpected) {
          findings.push({ stage: `engine: line ${i + 1} reached the per-line guard`, message: `${result.unexpected.text}\n${result.unexpected.stack}`, where })
        }
      })

      if (typed !== null) {
        const text = texts[typed]
        attempt('view: readLine and readPlot', () => {
          const form = readLine(text)
          return form.kind === 'code' ? readPlot(form.code) : null
        })
        attempt('view: suggest', () => {
          const sources = {
            sheet: sheetNames([{ id: 'a', lines }], { anchorId: 'a', lineIndex: typed }),
            constants,
            functions: functionSuggestions(),
            units,
          }
          suggest(text, 0, sources)
          suggest(text, text.length, sources)
        })
      }
      const element = { anchorId: 'a', title: null, titleFormat: NO_TITLE_FORMAT, lines, source: texts.join('\n') }
      attempt('view: variableGroups', () => variableGroups([element]))
      attempt('view: problemRows', () => problemRows([element]))

      lines.forEach((line, i) => {
        if (i < from) return
        const key = hash(`${texts[i]}\u0000${JSON.stringify(line)}`)
        if (drawn.has(key)) return
        drawn.add(key)
        attempt('view: LineSample', () => render(<LineSample text={texts[i]} line={line} />).unmount())
        const { plot } = line
        if (plot) attempt('view: drawChart', () => drawChart(Plot, plot))
        if (typed === null || i === typed) {
          attempt('view: FormatTab', () =>
            render(
              <FormatTab sheet={[element]} target={{ anchorId: 'a', lineIndex: i, text: texts[i] }} selected={null} actions={NO_ACTIONS} />,
            ).unmount(),
          )
        }
      })
    },
  }
}

/** A short key for a long string (cyrb53), so the set of rows drawn stays small. */
function hash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `${h2 >>> 0}:${h1 >>> 0}:${text.length}`
}

/** One line per finding, for a test's failure message. */
export function report(findings: readonly Finding[]): string {
  return findings
    .slice(0, 20)
    .map(({ stage, where, message }) => `${stage}\n  ${where}\n  ${message.split('\n').slice(0, 4).join('\n  ')}`)
    .join('\n\n')
}
