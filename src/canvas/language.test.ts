import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, isSheetLanguage, LANGUAGES, storageLanguageMemory } from './language.ts'

/** ☰ → Language's memory on the web (docs/spec-v1.md section 8, Language, 0.5.0): per browser, never in the file. */

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

describe('the language, per browser', () => {
  it('offers English and Português (Brasil), English first and by default', () => {
    expect(LANGUAGES.map(({ code, label }) => [code, label])).toEqual([
      ['en', 'English'],
      ['pt-BR', 'Português (Brasil)'],
    ])
    expect(DEFAULT_LANGUAGE).toBe('en')
    expect(isSheetLanguage('pt-PT')).toBe(false)
  })

  it('is unknown until chosen, then remembered, beside the panel’s memory', () => {
    const storage = memoryStorage()
    storage.setItem('excalimathpad.sheetPanel', 'open')
    expect(storageLanguageMemory(() => storage).rememberedLanguage()).toBeNull()
    storageLanguageMemory(() => storage).rememberLanguage('pt-BR')
    expect(storageLanguageMemory(() => storage).rememberedLanguage()).toBe('pt-BR')
    expect(storage.getItem('excalimathpad.sheetPanel')).toBe('open')
  })

  it('reads a language it doesn’t offer as none', () => {
    const storage = memoryStorage()
    storage.setItem('excalimathpad.language', 'fr-FR')
    expect(storageLanguageMemory(() => storage).rememberedLanguage()).toBeNull()
  })

  it('survives storage that throws, and storage that is missing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(() => storageLanguageMemory(() => broken).rememberLanguage('pt-BR')).not.toThrow()
    expect(storageLanguageMemory(() => broken).rememberedLanguage()).toBeNull()
    expect(storageLanguageMemory(() => null).rememberedLanguage()).toBeNull()
  })
})
