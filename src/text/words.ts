import { useSyncExternalStore } from 'react'
import { en, type Words } from './en.ts'
import { ptBR } from './ptBR.ts'

/**
 * The reader (docs/spec-v1.md section 14, 0.6.0: one answer to "which
 * language"): the one way any code reads the app's own words. The language is
 * the one Excalidraw shows, its public `useI18n`, which the canvas hands here
 * as it changes (`showLanguage`, from `LanguageShown` in `SheetCanvas.tsx`).
 * Excalidraw keeps one language for the whole window, so this does too: every
 * sheet tab open in a vault reads the same.
 *
 * A component reads its words while it renders (`useWords`), so a choice in
 * ☰ redraws it at once. Code outside React (CSS `content`, the window title,
 * the save picker, a toast) reads `words()` when it words something, and
 * `onLanguage` tells it of a change.
 */
export type SheetLanguage = 'en' | 'pt-BR'

export type { Words } from './en.ts'

const TABLES: Record<SheetLanguage, Words> = { en, 'pt-BR': ptBR }

let shown: SheetLanguage = 'en'
const listeners = new Set<() => void>()

/** The table of one language, for what is worded before any sheet shows (the plugin's `onload`). */
export function wordsFor(language: SheetLanguage): Words {
  return TABLES[language]
}

/** The language Excalidraw shows: English until a sheet shows another. */
export function shownLanguage(): SheetLanguage {
  return shown
}

/** The table of the language shown, read when something is worded. */
export function words(): Words {
  return TABLES[shown]
}

/**
 * The canvas tells the reader the language Excalidraw now shows. Only the
 * canvas calls this: it is Excalidraw's answer, not a choice.
 */
export function showLanguage(language: SheetLanguage): void {
  if (language === shown) return
  shown = language
  for (const listener of [...listeners]) listener()
}

/** Calls `listener` after each change of the language shown. Returns the way to stop. */
export function onLanguage(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The table of the language shown, in a component: it draws again when the language changes. */
export function useWords(): Words {
  return useSyncExternalStore(onLanguage, words)
}
