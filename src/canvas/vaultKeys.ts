/**
 * The keys of a sheet in an Obsidian tab (docs/spec-v1.md section 8, Inside an
 * Obsidian tab; section 14, Gestures). Everything the sheet uses stays the
 * sheet's, apart from two lists:
 *
 * - **Passed through:** Obsidian's core keys. Obsidian's keymap hears a key
 *   before the view does, so a key it acts on (and so marks
 *   `defaultPrevented`) is stopped at the view: neither the app nor Excalidraw
 *   acts on it as well (Excalidraw 0.18 answers Ctrl+P with a toast naming its
 *   own palette). A key Obsidian left alone goes on to the sheet as usual.
 * - **Swallowed:** Ctrl+Shift+E (Excalidraw's image export, which drops the
 *   sheet's block, ADR 0004) and the keys of Excalidraw's command palette,
 *   which the plugin hides. They stop at the view, whatever Obsidian did.
 *
 * `Mod` is Ctrl, or Cmd on macOS, as in Obsidian; Ctrl+Tab is Ctrl everywhere.
 */
export interface KeyChord {
  /** Ctrl or Cmd. */
  mod?: boolean
  /** The Ctrl key itself, on every system. */
  ctrl?: boolean
  shift?: boolean
  /** `KeyboardEvent.key`, lower case for a letter. */
  key: string
}

/** Obsidian's core keys, which always reach Obsidian, even from the canvas or a line. */
export const PASS_THROUGH_KEYS: readonly KeyChord[] = [
  { mod: true, key: 'p' }, // command palette
  { mod: true, key: 'o' }, // quick switcher
  { mod: true, key: 'n' }, // new note
  { mod: true, key: 'w' }, // close the tab
  { mod: true, key: ',' }, // settings
  { mod: true, shift: true, key: 'f' }, // search the vault
  { mod: true, key: 's' }, // Obsidian's save: the view writes at once
  { ctrl: true, key: 'Tab' }, // next tab
  { ctrl: true, shift: true, key: 'Tab' }, // previous tab
]

/** Keys that stop at the view, so Excalidraw never opens what they would. */
export const SWALLOWED_KEYS: readonly KeyChord[] = [
  { mod: true, shift: true, key: 'e' }, // Excalidraw's image export
  { mod: true, key: '/' }, // Excalidraw's command palette
  { mod: true, shift: true, key: 'p' }, // the same
]

/** Whether `event` is `chord`, with no other modifier held. */
export function isChord(event: KeyboardEvent, chord: KeyChord): boolean {
  if (event.altKey) return false
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (key !== chord.key) return false
  if (!!event.shiftKey !== !!chord.shift) return false
  if (chord.ctrl) return event.ctrlKey && !event.metaKey
  if (chord.mod) return event.ctrlKey !== event.metaKey
  return !event.ctrlKey && !event.metaKey
}

export type VaultKeyRoute = 'pass' | 'swallow' | null

/** Which list `event` is on, if any. */
export function vaultKeyRoute(event: KeyboardEvent): VaultKeyRoute {
  if (PASS_THROUGH_KEYS.some((chord) => isChord(event, chord))) return 'pass'
  if (SWALLOWED_KEYS.some((chord) => isChord(event, chord))) return 'swallow'
  return null
}

/**
 * Listens on the view's own container, in the capture phase, before the app's
 * gestures, its line field and Excalidraw hear a key. Returns the function
 * that stops.
 */
export function confineKeys(container: HTMLElement): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    const route = vaultKeyRoute(event)
    if (route === 'swallow') {
      event.preventDefault()
      event.stopImmediatePropagation()
    } else if (route === 'pass' && event.defaultPrevented) {
      // Obsidian took it: the sheet doesn't act on it too.
      event.stopImmediatePropagation()
    }
  }
  container.addEventListener('keydown', onKeyDown, true)
  return () => container.removeEventListener('keydown', onKeyDown, true)
}
