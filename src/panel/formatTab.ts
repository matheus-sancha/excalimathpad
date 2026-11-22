import type { TitleFormat } from '../canvas/mathAnchor.ts'
import type { RuleState, SheetLine } from '../math/evaluate.ts'
import { readLine, withFormat, type CommentFormat, type FormatRule, type FormatWord, type LineFormat } from '../math/lineForm.ts'
import { words, type Words } from '../text/words.ts'
import { elementLabel, type PanelElement } from './sheetPanel.ts'

/**
 * What the Format tab shows (docs/spec-v1.md section 4, Format tab, M4d), from
 * the sheet as evaluated and what is open. Pure: `FormatTab` renders it. Its
 * words are the text table's (`panel.format`, 0.6.0), the one shown unless
 * another is passed; a rule's note keeps its condition apart, so the tab can
 * keep it whole when the note wraps (section 8, Sheet panel).
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
  /** The line's stored format (section 3, Where a line's format lives, M4e); none when left out. */
  stored?: string
}

/** The link beside the sample that moves the edit (section 4, Format tab): its key in `panel.format.links`. */
export type FormatLink = 'editTitle' | 'addTitle' | 'firstLine'

/** "A rule sets the text colour while v > 3 m/s.": the note, and the condition it quotes. */
export interface RuleNote {
  text: string
  condition: string
}

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
      overrides: RuleNote[]
      /** The line's rules, those typed in its text first, then the stored ones, for the Rules list (section 4). */
      rules: readonly FormatRule[]
      /** Each rule's live state; null while the evaluation hasn't caught up with the typed rules. */
      ruleStates: readonly RuleState[] | null
      /** What + Add rule's condition starts with: the name the line defines, `result` with none, null on a table line. */
      ruleName: string | null
    })
  | (Open & { kind: 'comment'; line: SheetLine | null; format: CommentFormat })
  /** A blank line, or a clause with no comment text: it takes no format. */
  | (Open & { kind: 'blank'; line: SheetLine | null })

export function formatView(
  sheet: readonly FormatElement[],
  target: FormatTarget | null,
  w: Words = words(),
): FormatView {
  const index = target ? sheet.findIndex(({ anchorId }) => anchorId === target.anchorId) : -1
  if (!target || index === -1) return { kind: 'none' }
  const element = sheet[index]
  const label = elementLabel(element, index, w)
  const { captions } = w.panel.format
  const { anchorId, text } = target
  if (target.lineIndex === 'title') {
    return { kind: 'title', anchorId, caption: captions.title(label), link: 'firstLine', text, format: element.titleFormat }
  }
  const where = w.panel.line(label, target.lineIndex + 1)
  const link: FormatLink = element.title ? 'editTitle' : 'addTitle'
  const line = element.lines[target.lineIndex] ?? null
  // The format is the stored one, behind any clause typed in the text (section 3).
  const form = readLine(withFormat(text, target.stored ?? ''))
  switch (form.kind) {
    case 'code':
      return {
        kind: 'math',
        anchorId,
        caption: captions.math(where),
        link,
        text,
        line,
        format: form.format,
        overrides: overrides(form.rules, line?.ruleTruth ?? [], w),
        rules: form.rules,
        ruleStates: line && line.ruleStates.length === form.rules.length ? line.ruleStates : null,
        ruleName: line?.table ? null : (line?.variables[0]?.name ?? 'result'),
      }
    case 'comment':
      return { kind: 'comment', anchorId, caption: captions.comment(where), link, text, line, format: form.format }
    case 'blank':
      return { kind: 'blank', anchorId, caption: captions.blank(where), link, text, line }
  }
}

/**
 * What a true rule sets over the buttons (section 4, Format tab): for each
 * property, the first true rule that sets it wins, as the sheet draws it.
 * Nothing while the evaluation hasn't caught up with the typed rules.
 */
function overrides(rules: readonly FormatRule[], truth: readonly boolean[], w: Words): RuleNote[] {
  if (truth.length !== rules.length) return []
  const decided = new Set<FormatWord['kind']>()
  return rules.flatMap((rule, index) => {
    if (!truth[index]) return []
    // A joined word sets each of its properties.
    const won = [...new Set(rule.words.map(({ kind }) => kind))].filter((kind) => !decided.has(kind))
    won.forEach((kind) => decided.add(kind))
    return won.map((kind) => ({ text: w.panel.format.ruleSets(kind, rule.condition), condition: rule.condition }))
  })
}

/** A link's text with its arrow kept on its last word's line ("Primeira linha ↓", section 8, Sheet panel). */
export function withArrow(text: string): string {
  return text.replace(/ ([↑↓])$/, '\u00a0$1')
}
