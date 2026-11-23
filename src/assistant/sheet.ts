import type { Target } from './adapters.ts'
import { hostOf } from './address.ts'
import { readingOrder } from '../overlay/readingOrder.ts'
import { listSheet, type Listing, type ListingInput, type SceneNow } from './listing.ts'
import { PROVIDERS } from './providers.ts'
import type { Setup } from './setup.ts'

/**
 * What the Math assistant reads of the sheet, handed to its tab by App (docs/spec-v1.md
 * section 8, Math assistant, What a Send carries): the sheet as it is now, and a way to
 * leave the open line before a Send from a button.
 */
export interface AssistantSheet {
  /**
   * The sheet as it is at this moment: the same object until it may have changed (an
   * evaluation, the scene, the settings, the language), so `useSyncExternalStore` can read it.
   */
  now: () => SheetNow
  /** Called when the sheet may have changed. */
  subscribe: (listener: () => void) => () => void
  /** Leaves the open line, so a Send from a button sends the sheet as written. */
  leaveLine: () => void
  /**
   * A chip's press (section 8, An answer): the Problems row's jump to the element or text `id`,
   * flashing `line` when there is one. Nothing opens.
   */
  jump: (to: JumpTarget) => void
}

/** Where a chip goes: a math element or a text element, and the line to flash, or none. */
export interface JumpTarget {
  id: string
  line: number | null
}

/** The sheet's listing, and each math element's name and line count for "Goes with your message". */
export interface SheetNow {
  listing: Listing
  elements: readonly { name: string; lines: number }[]
  /** Each math element's lines and each text's text, as the chips read them (`chipTarget`). */
  scene: SceneNow
  /** Each math element's name, by its anchor's id: its title, else its position in reading order. */
  names: ReadonlyMap<string, string>
}

/**
 * The sheet now, from what the listing is made of. An element is named as the Sheet panel
 * names it (`elementLabel`): its title, else its position in reading order.
 */
export function sheetNow(input: ListingInput): SheetNow {
  const listing = listSheet(input)
  const titles = new Map(input.elements.map(({ anchorId, title }) => [anchorId, title?.trim() || null]))
  const scene: SceneNow = {
    anchors: input.elements.map(({ anchorId, source, formats }) => ({ id: anchorId, source, formats })),
    texts: input.texts.map(({ id, text }) => ({ id, text })),
  }
  const names = new Map<string, string>()
  const order = readingOrder(input.anchors.filter(({ id }) => titles.has(id)))
  // An element whose anchor wasn't handed in still has a name, after the placed ones.
  const placed = new Set(order)
  for (const { anchorId } of input.elements) if (!placed.has(anchorId)) order.push(anchorId)
  order.forEach((id, index) => names.set(id, titles.get(id) ?? input.words.panel.element(index + 1)))
  if (listing.kind !== 'listing') return { listing, elements: [], scene, names }
  const elements: { name: string; lines: number }[] = []
  const at = new Map<string, number>()
  for (const entry of listing.map.values()) {
    if (entry.kind === 'element') {
      at.set(entry.anchorId, elements.length)
      elements.push({ name: names.get(entry.anchorId) ?? input.words.panel.element(elements.length + 1), lines: 0 })
    } else if (entry.kind === 'line') {
      const index = at.get(entry.anchorId)
      if (index !== undefined) elements[index].lines++
    }
  }
  return { listing, elements, scene, names }
}

/** The built-in a setup names, or undefined for a typed address. */
export const builtInOf = (setup: Setup) => PROVIDERS.find(({ id }) => id === setup.provider)

/** Where a setup's requests go, and with what key. */
export function targetOf(setup: Setup): Target {
  const builtIn = builtInOf(setup)
  return { address: setup.address, adapter: builtIn?.adapter ?? 'chat', provider: builtIn?.id ?? null, key: setup.key }
}

/** `<host>`: the host of the setup's address. */
export const hostOfSetup = (setup: Setup) => hostOf(setup.address) ?? setup.address

/** `<provider>`: a built-in's name; for a typed address, its host (section 13, Math assistant). */
export const providerOf = (setup: Setup) => builtInOf(setup)?.name ?? hostOfSetup(setup)

/** A setup the chat can send with: a built-in with a key, or a typed address, which may need none. */
export const canSend = (setup: Setup | null): setup is Setup =>
  setup !== null && (setup.provider === 'other' || setup.key !== '')
