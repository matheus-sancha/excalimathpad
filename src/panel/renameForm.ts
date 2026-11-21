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
import { elementLabel, type PanelElement } from './sheetPanel.ts'
import type { EngineMessage } from '../math/messages.ts'

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

/** Section 13, Rename and Language: the form's and the toast's words. */
export const RENAME_WORDS = {
  /** A Variables row's ✎: its name and its tooltip. */
  start: (name: string) => `Rename ${name}`,
  /** The field's name; the heading over it shows the old name as code. */
  field: (name: string) => `Rename ${name} to`,
  lines: (count: number) => (count === 1 ? 'Changes 1 line:' : `Changes ${count} lines:`),
  results: (count: number) => (count === 1 ? 'This changes 1 result:' : `This changes ${count} results:`),
  rename: 'Rename',
  cancel: 'Cancel',
  /** After a rename; on touch there is no Ctrl+Z to name. */
  renamed: (from: string, to: string, count: number, touch: boolean) =>
    `Renamed ${from} to ${to} in ${count === 1 ? '1 line' : `${count} lines`}. ${touch ? 'Undo' : 'Ctrl+Z'} takes it back.`,
} as const

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
  /** The refusal, or the shadow warning: worded where it shows (`wordMessage`). */
  reason: { kind: 'refused' | 'warning'; message: EngineMessage } | null
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
      where: `${elementLabel(element, index)}, line ${ref.line + 1}`,
      text: markParts(sources[ref.line] ?? '', uses),
      stored: storedUses.length > 0 ? markParts(stored, storedUses) : [],
    }
  }
  return {
    plan,
    lines: plan.lines.map((planned) => line(planned, planned.uses, planned.storedUses)),
    reason:
      plan.refusal?.message != null
        ? { kind: 'refused', message: plan.refusal.message }
        : plan.warning !== null
          ? { kind: 'warning', message: plan.warning }
          : null,
    changes: plan.changes.map((ref) => line(ref, [], [])),
    canRename: plan.refusal === null,
  }
}
