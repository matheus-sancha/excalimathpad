import type { Words } from '../text/words.ts'
import { chipTarget, type ChipState, type ListingMap } from './listing.ts'
import type { JumpTarget, SheetNow } from './sheet.ts'

/**
 * A reference in an answer as the chat draws it (docs/spec-v1.md section 8, Math assistant, An
 * answer): a chip in the panel's words, read against the map of the Send the answer came from.
 */
export interface Chip {
  state: Exclude<ChipState, 'unknown'>
  /** "Pipe flow, line 3", "Element 2", or a text's first words; `changed` adds its mark. */
  name: string
  /** Where a press goes: null when the element is gone, and the chip does nothing. */
  to: JumpTarget | null
}

/** How many of a text's words name its chip, and the most characters they take. */
const TEXT_WORDS = 4
const TEXT_CHARS = 32

/** A text element named by its first words, on one line. */
export function firstWords(text: string): string {
  const words = text.split(/\s+/).filter(Boolean)
  const named = words.slice(0, TEXT_WORDS).join(' ')
  if (named.length > TEXT_CHARS) return `${named.slice(0, TEXT_CHARS).trimEnd()}…`
  return words.length > TEXT_WORDS ? `${named}…` : named
}

/**
 * The chip for `label`, or null for plain text: a label in no map (the model made it up), or
 * an answer to a Send that carried no listing. An element is named as it is now on the sheet,
 * as Variables and Problems name it; one that is gone, as it was sent.
 */
export function chipOf(map: ListingMap | null, label: string, now: Pick<SheetNow, 'scene' | 'names'>, w: Words): Chip | null {
  if (!map) return null
  const { state, entry } = chipTarget(map, label, now.scene)
  if (state === 'unknown' || !entry) return null

  if (entry.kind === 'text') {
    const text = now.scene.texts.find(({ id }) => id === entry.textId)?.text ?? entry.text
    const name = firstWords(text)
    if (state === 'gone') return { state, name, to: null }
    return { state, name: state === 'changed' ? w.assistant.changed(name, 'text') : name, to: { id: entry.textId, line: null } }
  }

  const elementLabel = label.split(':')[0]
  const sent = map.get(elementLabel)
  const sentName = (sent?.kind === 'element' && sent.title) || w.panel.element(Number(elementLabel.slice(1)))
  const element = now.names.get(entry.anchorId) ?? sentName
  const name = entry.kind === 'line' ? w.panel.line(element, entry.line + 1) : element
  if (state === 'gone') return { state, name, to: null }
  if (state === 'changed') return { state, name: w.assistant.changed(name, 'line'), to: { id: entry.anchorId, line: null } }
  return { state, name, to: { id: entry.anchorId, line: entry.kind === 'line' ? entry.line : null } }
}
