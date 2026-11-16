import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DROPPED_KATEX_FONTS, droppedClasses, trimKatexCss } from './katexFonts.ts'
import { NO_TITLE_FORMAT } from '../canvas/mathAnchor.ts'
import { evaluateSheet, listConstants, typesetUnit } from '../math/evaluate.ts'
import { variableGroups } from '../panel/sheetPanel.ts'
import { acceptanceSheet, guideSheets, type TypedSheet } from '../test/sheetStates.tsx'
import { texToHtml } from './katex.ts'
import { LineSample } from './MathElementView.tsx'

/**
 * The font test (docs/spec-v1.md section 14, M4e, Lighter plugin): the plugin
 * ships no font for four of KaTeX's families (`katexFonts.ts`), so
 * nothing the app typesets may land in one. Every Math guide example, the pump
 * sheet and the true-position sheet are evaluated, and each line is drawn as
 * the grid draws it (`LineSample`: the name, `≔`, the expression, the result,
 * a table's headers), with the plots' legends and the Sheet panel's Variables
 * and Constants rows; the test fails on any class KaTeX's CSS sets in a dropped
 * family. The classes are read from KaTeX's own CSS, so an upgrade that adds
 * one is caught too.
 */

const ACCEPTANCE = import.meta.glob<string>('../../docs/acceptance/*.md', { query: '?raw', import: 'default', eager: true })

/** The CSS `katexModule.ts` imports, which both builds read (from the repository's root, where the tests run). */
const css = readFileSync(resolve('node_modules/katex/dist/katex.min.css'), 'utf8')
const dropped = droppedClasses(css)

/** Every class KaTeX set in the sheet as the app draws it. */
function drawnClasses(sheet: TypedSheet): Set<string> {
  const lines = evaluateSheet([{ id: 'a', source: sheet.lines.join('\n') }]).get('a')!
  const html: string[] = []
  lines.forEach((line, i) => {
    const { container, unmount } = render(<LineSample text={sheet.lines[i]} line={line} />)
    html.push(container.innerHTML)
    unmount()
    const { plot } = line
    if (plot) for (const { tex } of [...plot.series, ...plot.dots, ...plot.circles]) html.push(texToHtml(tex) ?? '')
  })
  const element = { anchorId: 'a', title: null, titleFormat: NO_TITLE_FORMAT, lines, source: sheet.lines.join('\n') }
  for (const group of variableGroups([element])) {
    for (const row of group.rows) html.push(texToHtml(row.tex) ?? '', row.unit ? (texToHtml(typesetUnit(row.unit)) ?? '') : '')
  }
  return classesIn(html.join(''))
}

function classesIn(html: string): Set<string> {
  return new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap(([, names]) => names.split(/\s+/)))
}

const inDropped = (classes: Set<string>) => [...classes].filter((name) => dropped.has(name)).sort()

const sheets = [
  ...guideSheets(),
  ...Object.entries(ACCEPTANCE).map(([path, text]) => acceptanceSheet(path.replace(/^.*\//, ''), text)),
]

afterEach(cleanup)

describe("KaTeX's fonts in the plugin (section 14, M4e, Lighter plugin)", () => {
  it("reads the dropped families' classes from KaTeX's CSS", () => {
    expect(DROPPED_KATEX_FONTS).toEqual(['Caligraphic', 'Fraktur', 'SansSerif', 'Script'])
    for (const name of ['mathcal', 'mathfrak', 'textfrak', 'mathscr', 'textscr', 'mathsf', 'textsf', 'mathboldsf', 'mathsfit']) {
      expect(dropped, name).toContain(name)
    }
    // The families the app draws in stay.
    for (const name of ['mathnormal', 'mathit', 'mathrm', 'mathbf', 'mathtt', 'texttt', 'amsrm', 'delimsizing']) {
      expect(dropped, name).not.toContain(name)
    }
  })

  it('ships no font for the dropped families and keeps every other face', () => {
    const faces = (text: string) => [...text.matchAll(/@font-face\s*\{[^}]*font-family:\s*"?KaTeX_(\w+)/g)].map(([, family]) => family)
    const kept = faces(trimKatexCss(css))
    expect(kept.filter((family) => DROPPED_KATEX_FONTS.includes(family))).toEqual([])
    expect(kept).toEqual(faces(css).filter((family) => !DROPPED_KATEX_FONTS.includes(family)))
    expect(kept).toHaveLength(12)
    expect(trimKatexCss(css)).not.toMatch(/\.(woff|ttf)\)/)
  })

  it('fails the build when a dropped family has no face to drop', () => {
    expect(() => trimKatexCss(css.replaceAll('KaTeX_Script', 'KaTeX_Hand'))).toThrow('KaTeX_Script')
  })

  it('typesets every guide line, the pump sheet and the true-position sheet in kept fonts only', () => {
    expect(sheets.filter(({ name }) => name.startsWith('guide: ')).length).toBeGreaterThanOrEqual(13)
    expect(sheets.find(({ name }) => name === 'pump-sizing.md')?.lines).toHaveLength(43)
    expect(sheets.find(({ name }) => name === 'true-position.md')?.lines).toHaveLength(9)
    const drawn = new Set<string>()
    for (const sheet of sheets) {
      const classes = drawnClasses(sheet)
      expect(inDropped(classes), sheet.name).toEqual([])
      classes.forEach((name) => drawn.add(name))
    }
    // It drew real math: italic names, upright units, big delimiters, a brace.
    for (const name of ['katex', 'mathnormal', 'mathit', 'mathrm', 'delimsizing']) expect(drawn, name).toContain(name)
  })

  it("typesets the Constants tab's symbols and values in kept fonts only", () => {
    const html = listConstants()
      .flatMap((group) => group.rows)
      .map((row) => `${texToHtml(row.tex) ?? ''}${texToHtml(row.valueTex) ?? ''}`)
      .join('')
    expect(inDropped(classesIn(html))).toEqual([])
  })

  // The control: the test sees a dropped class when a line reaches one. A
  // Unicode math letter pasted into a name or a text is the one way a sheet
  // does (section 14): KaTeX sets 𝔄 in Fraktur and 𝖠 in SansSerif.
  it('fails on a line that reaches a dropped family', () => {
    expect(inDropped(drawnClasses({ name: 'control', lines: ['𝔄 = 2', 's = "𝖠"'] }))).toEqual(['mathfrak', 'textsf'])
    expect(inDropped(classesIn(texToHtml('\\mathcal{L}') ?? ''))).toEqual(['mathcal'])
  })
})
