import { splitLines, type SheetBlock } from '../math/evaluate.ts'
import { lineFormats } from '../math/lineForm.ts'
import {
  assignedName,
  markParts,
  planOffer,
  type MarkedPart,
  type NameSpan,
  type RenameLineRef,
  type RenameOfferTarget,
  type RenamePlan,
} from '../math/rename.ts'

/**
 * The offer on a committed line (docs/spec-v1.md section 4, Renaming a name:
 * The offer, on a committed line; section 14, 0.5.0). Pure: when a commit
 * makes, moves or drops an offer, and what a card shows. UI state, beside the
 * line edit: nothing of it is in the scene or the file.
 */

/** One offer waiting by its line: the line now assigns `to`, and assigned `from`. */
export interface RenameOffer {
  anchorId: string
  line: number
  from: string
  to: string
  /** Goes up with each offer made: the newest has the largest. */
  key: number
}

/** A line commit, as the offer reads it: the line's name when its edit opened, and once written. */
export interface NamedCommit {
  anchorId: string
  line: number
  /** The name the line assigned before the edit, or null. */
  before: string | null
  /** The name the line assigns as written, or null. */
  after: string | null
}

/**
 * The offers after a line commit that can change a name (↑ / ↓, a click on
 * another line or outside, Esc, a drag, Enter at the end of the line). A
 * changed name makes an offer; on a line that has one already, a name changed
 * again asks about the newest name, and the old name put back drops it. Whether
 * any line still reads the old name is `followOffers`'s to say.
 */
export function noteCommit(
  offers: readonly RenameOffer[],
  commit: NamedCommit,
  key: number,
): readonly RenameOffer[] {
  const { anchorId, line, before, after } = commit
  const waiting = offers.find((offer) => offer.anchorId === anchorId && offer.line === line)
  if (waiting) {
    if (after === waiting.to) return offers
    const others = offers.filter((offer) => offer !== waiting)
    return after === null || after === waiting.from ? others : [...others, { anchorId, line, from: waiting.from, to: after, key }]
  }
  if (before === null || after === null || before === after) return offers
  return [...offers, { anchorId, line, from: before, to: after, key }]
}

/** An offer still waiting, with what its Rename writes (no engine run: `changes` is empty). */
export interface FollowedOffer {
  offer: RenameOffer
  plan: RenamePlan
}

/**
 * The offers that still wait on the sheet as the scene holds it, after any
 * change. One goes when its element is removed, when its line no longer
 * assigns the new name (an undo, the old name typed back) and when no line in
 * its reach reads the old name any more. A line moved by a split or a join
 * above it in its element is followed when that element assigns the new name
 * on one line only.
 */
export function followOffers(offers: readonly RenameOffer[], blocks: readonly SheetBlock[]): FollowedOffer[] {
  return offers.flatMap((offer): FollowedOffer[] => {
    const block = blocks.find(({ id }) => id === offer.anchorId)
    if (!block) return []
    const line = lineOf(block, offer)
    if (line === null) return []
    const placed = { ...offer, line }
    const plan = planOffer(blocks, target(placed), undefined, false)
    return plan ? [{ offer: placed, plan }] : []
  })
}

/** The question an offer's plan answers. */
export function target({ anchorId, line, from, to }: RenameOffer): RenameOfferTarget {
  return { id: anchorId, line, from, to }
}

/** The offer's line in its element: where it was, else the one line that assigns its new name there. */
function lineOf(block: SheetBlock, offer: RenameOffer): number | null {
  const lines = splitLines(block.source)
  const stored = lineFormats(block.formats ?? '', lines.length)
  const assigning = lines.flatMap((text, index) => (assignedName(text, stored[index]) === offer.to ? [index] : []))
  if (assigning.includes(offer.line)) return offer.line
  return assigning.length === 1 ? assigning[0] : null
}

/** Section 13, Rename and Language: the offer's words. */
export const OFFER_WORDS = {
  /** The card's question, as plain text (its name): the names show as code in the card. */
  ask: (from: string, to: string, count: number) => `Rename ${from} to ${to} in ${count === 1 ? '1 line' : `${count} lines`}?`,
  /** The count, after the names: it opens the list of lines. */
  count: (count: number) => (count === 1 ? 'in 1 line' : `in ${count} lines`),
  rename: 'Rename',
  keep: (from: string) => `Keep ${from}`,
  /** On a phone, with more than one offer waiting. */
  of: (index: number, total: number) => `${index} of ${total}`,
  results: (count: number) => (count === 1 ? 'This changes 1 result:' : `This changes ${count} results:`),
} as const

/** A line the card's list shows: "Fluid and pipe, line 2" and its source, the old name marked. */
export interface OfferLine extends RenameLineRef {
  key: string
  where: string
  text: MarkedPart[]
  stored: MarkedPart[]
}

/**
 * Lines as the card lists them, as the form lists them: each element named by
 * its title, else "Element 3" by its place in reading order, as the Sheet
 * panel names it (`elementLabel`).
 */
export function offerLines(
  refs: readonly (RenameLineRef & { uses?: readonly NameSpan[]; storedUses?: readonly NameSpan[] })[],
  blocks: readonly SheetBlock[],
  titles: ReadonlyMap<string, string | null>,
): OfferLine[] {
  return refs.flatMap((ref): OfferLine[] => {
    const index = blocks.findIndex(({ id }) => id === ref.id)
    if (index === -1) return []
    const block = blocks[index]
    const sources = splitLines(block.source)
    const stored = lineFormats(block.formats ?? '', sources.length)[ref.line] ?? ''
    const title = titles.get(ref.id)?.trim()
    const storedUses = ref.storedUses ?? []
    return [
      {
        id: ref.id,
        line: ref.line,
        key: `${ref.id}:${ref.line}`,
        where: `${title ? title : `Element ${index + 1}`}, line ${ref.line + 1}`,
        text: markParts(sources[ref.line] ?? '', ref.uses ?? []),
        stored: storedUses.length > 0 ? markParts(stored, storedUses) : [],
      },
    ]
  })
}
