import type { TitleFormat } from '../canvas/mathAnchor.ts'
import type { SheetLine } from '../math/evaluate.ts'
import { readLine, type CommentFormat, type FormatWord, type LineFormat } from '../math/lineForm.ts'
import { elementLabel, type PanelElement } from './sheetPanel.ts'

/**
 * What the Format tab shows (docs/spec-v1.md section 4, Format tab, M4d), from
 * the sheet as evaluated and what is open. Pure: `FormatTab` renders it.
 */

/** One math element as the Format tab sees it: the panel's view, and its title's format. */
export interface FormatElement extends PanelElement {
  titleFormat: TitleFormat
}

/** What is open (`MathOverlay`'s `EditTarget`): a line or the title, and its typed text. */
export interface FormatTarget {
  anchorId: string
  lineIndex: number | 'title'
  text: string
}

/** The link beside the sample that moves the edit (section 4, Format tab). */
export type FormatLink = 'Edit title ↑' | 'Add title ↑' | 'First line ↓'

interface Open {
  anchorId: string
  /** "Math line — Pipe flow, line 3", shown in capitals; the element named as the Variables tab names it. */
  caption: string
  link: FormatLink
  /** The typed text: the sample draws it. */
  text: string
}

export type FormatView =
  | { kind: 'none' }
  | (Open & { kind: 'title'; format: TitleFormat })
  | (Open & {
      kind: 'math'
      /** The evaluated line, for the sample; null until the sheet has run on it. */
      line: SheetLine | null
      /** The plain format, which the buttons show and set. */
      format: LineFormat
      /** "A rule sets the text colour while v > 3 m/s.", one per property a true rule wins. */
      overrides: string[]
    })
  | (Open & { kind: 'comment'; line: SheetLine | null; format: CommentFormat })
  /** A blank line, or a clause with no comment text: it takes no format. */
  | (Open & { kind: 'blank'; line: SheetLine | null })

export function formatView(sheet: readonly FormatElement[], target: FormatTarget | null): FormatView {
  const index = target ? sheet.findIndex(({ anchorId }) => anchorId === target.anchorId) : -1
  if (!target || index === -1) return { kind: 'none' }
  const element = sheet[index]
  const label = elementLabel(element, index)
  const { anchorId, text } = target
  if (target.lineIndex === 'title') {
    return { kind: 'title', anchorId, caption: `Title — ${label}`, link: 'First line ↓', text, format: element.titleFormat }
  }
  const where = `${label}, line ${target.lineIndex + 1}`
  const link: FormatLink = element.title ? 'Edit title ↑' : 'Add title ↑'
  const line = element.lines[target.lineIndex] ?? null
  const form = readLine(text)
  switch (form.kind) {
    case 'code':
      return {
        kind: 'math',
        anchorId,
        caption: `Math line — ${where}`,
        link,
        text,
        line,
        format: form.format,
        overrides: overrides(form.rules, line?.ruleTruth ?? []),
      }
    case 'comment':
      return { kind: 'comment', anchorId, caption: `Comment line — ${where}`, link, text, line, format: form.format }
    case 'blank':
      return { kind: 'blank', anchorId, caption: `Line — ${where}`, link, text, line }
  }
}

const PROPERTIES: Record<FormatWord['kind'], string> = {
  bold: 'bold',
  underline: 'underline',
  text: 'the text colour',
  highlight: 'the highlight',
}

/**
 * What a true rule sets over the buttons (section 4, Format tab): for each
 * property, the first true rule that sets it wins, as the sheet draws it.
 * Nothing while the evaluation hasn't caught up with the typed rules.
 */
function overrides(rules: readonly { word: FormatWord; condition: string }[], truth: readonly boolean[]): string[] {
  if (truth.length !== rules.length) return []
  const decided = new Set<FormatWord['kind']>()
  return rules.flatMap((rule, index) => {
    if (!truth[index] || decided.has(rule.word.kind)) return []
    decided.add(rule.word.kind)
    return [`A rule sets ${PROPERTIES[rule.word.kind]} while ${rule.condition}.`]
  })
}

/** The Format tab's hints (section 13, Panel). */
export const FORMAT_HINTS = {
  nothingOpen: 'Open a line or a title to format it: double-click it, or select its element and press Enter.',
  nothingOpenTouch: 'Double-tap a line, or tap Edit',
  noFormat: 'This line takes no format.',
} as const
