import type { SheetLanguage } from '../text/words.ts'

/**
 * ☰ → Language (docs/spec-v1.md section 8, Language): the choice and its
 * memory. It is given to Excalidraw as its `langCode` prop (0.5.0), and the
 * app's own text follows the language Excalidraw then shows, through the
 * reader in `src/text/words.ts` (0.6.0).
 */
export type { SheetLanguage }

/** The row's two choices, in their order, each named in its own language (section 13). */
export const LANGUAGES: readonly { code: SheetLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
]

/** English until one is chosen: nothing reads the browser's or Obsidian's language. */
export const DEFAULT_LANGUAGE: SheetLanguage = 'en'

export function isSheetLanguage(value: unknown): value is SheetLanguage {
  return LANGUAGES.some(({ code }) => code === value)
}

/**
 * Where a home keeps the language last chosen, per device and never in the
 * file (section 8, Language): browser storage on the web
 * (`storageLanguageMemory`, given `localStorage` by `src/main.tsx`), the
 * plugin's `data.json` in a vault (`plugin/main.ts`). App knows only this
 * port, so the plugin's bundle never names browser storage.
 */
export interface LanguageMemory {
  /** The language last chosen; null until one is. */
  rememberedLanguage(): SheetLanguage | null
  rememberLanguage(language: SheetLanguage): void
}

const KEY = 'excalimathpad.language'

/**
 * The memory in a `Storage`. Storage can be missing or throw (a private
 * window, blocked site data); the page then opens in English, as if new.
 */
export function storageLanguageMemory(storage: () => Storage | null): LanguageMemory {
  return {
    rememberedLanguage: () => {
      try {
        const value = storage()?.getItem(KEY)
        return isSheetLanguage(value) ? value : null
      } catch {
        return null
      }
    },
    rememberLanguage: (language) => {
      try {
        storage()?.setItem(KEY, language)
      } catch {
        // Not remembered: the next launch opens in English.
      }
    },
  }
}
