import type { DisplaySettings } from '../math/display.ts'
import { splitLines, type SheetBlock } from '../math/evaluate.ts'
import { lineFormats } from '../math/lineForm.ts'
import {
  markParts,
  planRename,
  type MarkedPart,
  type NameSpan,
  type RenameLineRef,
  type RenamePlan,
  type RenameTarget,
} from '../math/rename.ts'
import { words, type Words } from '../text/words.ts'
import { elementLabel, type PanelElement } from './sheetPanel.ts'

/**
 * The rename form on a Variables row (docs/spec-v1.md section 4, Renaming a
 * name: The form, on a Variables row), as a view of what `planRename` returns.
 * Pure: `RenameForm.tsx` draws it, and Rename writes the view's `plan`.
 */

/** One math element as the form reads it: the panel's, with its lines as text and their stored formats. */
export interface RenameElement extends PanelElement {
  source: string
  formats?: string
}

export type { MarkedPart }

/** A line the form lists: "Fluid and pipe, line 2" and its source. */
export interface RenameFormLine extends RenameLineRef {
  key: string
  where: string
  text: MarkedPart[]
  /** The line's stored clause, when the name stands in it (a rule's condition kept beside the line); else empty. */
  stored: MarkedPart[]
}

export interface RenameFormView {
  /** What Rename writes: exactly what the lists below show. */
  plan: RenamePlan
  /** The lines that will be written, in reading order, the old name marked. */
  lines: RenameFormLine[]
  /** Under the field: why the name is refused, or the new name's shadow warning (amber, allowed). */
  reason: { kind: 'refused' | 'warning'; text: string } | null
  /** The lines whose result would differ (amber, allowed). */
  changes: RenameFormLine[]
  /** False while the name is refused: Rename is dimmed. */
  canRename: boolean
}

/** The sheet as the engine takes it, from the panel's elements. */
export function renameBlocks(sheet: readonly RenameElement[]): SheetBlock[] {
  return sheet.map(({ anchorId, source, formats }) => ({ id: anchorId, source, ...(formats === undefined ? {} : { formats }) }))
}

/**
 * The form for renaming `target` to `newName`, as typed (spaces around it are
 * dropped: a name is one word). Null when `target` no longer assigns that
 * name: the form closes.
 */
export function renameFormView(
  sheet: readonly RenameElement[],
  target: RenameTarget,
  newName: string,
  settings?: DisplaySettings,
  w: Words = words(),
): RenameFormView | null {
  const plan = planRename(renameBlocks(sheet), target, newName.trim(), settings)
  if (plan === null) return null
  const line = (ref: RenameLineRef, uses: readonly NameSpan[], storedUses: readonly NameSpan[]): RenameFormLine => {
    const index = sheet.findIndex(({ anchorId }) => anchorId === ref.id)
    const element = sheet[index]
    const sources = splitLines(element.source)
    const stored = lineFormats(element.formats ?? '', sources.length)[ref.line] ?? ''
    return {
      id: ref.id,
      line: ref.line,
      key: `${ref.id}:${ref.line}`,
      where: w.panel.line(elementLabel(element, index, w), ref.line + 1),
      text: markParts(sources[ref.line] ?? '', uses),
      stored: storedUses.length > 0 ? markParts(stored, storedUses) : [],
    }
  }
  return {
    plan,
    lines: plan.lines.map((planned) => line(planned, planned.uses, planned.storedUses)),
    reason:
      plan.refusal?.message != null
        ? { kind: 'refused', text: plan.refusal.message }
        : plan.warning !== null
          ? { kind: 'warning', text: plan.warning }
          : null,
    changes: plan.changes.map((ref) => line(ref, [], [])),
    canRename: plan.refusal === null,
  }
}
