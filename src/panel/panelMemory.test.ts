import { describe, expect, it } from 'vitest'
import { rememberedOpen, rememberedWidth, rememberOpen, rememberWidth, sessionPanelMemory, storagePanelMemory } from './panelMemory.ts'

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

describe('the Sheet panel’s open state, per browser (docs/spec-v1.md section 8)', () => {
  it('is unknown until set, then remembered', () => {
    const storage = memoryStorage()
    expect(rememberedOpen(storage)).toBeNull()
    rememberOpen(false, storage)
    expect(rememberedOpen(storage)).toBe(false)
    rememberOpen(true, storage)
    expect(rememberedOpen(storage)).toBe(true)
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    } as unknown as Storage
    expect(() => rememberOpen(true, broken)).not.toThrow()
    expect(rememberedOpen(broken)).toBeNull()
  })
})

describe('the Sheet panel’s width, per browser (section 8, M4e, #198)', () => {
  it('is unknown until set, then remembered, beside the open state', () => {
    const storage = memoryStorage()
    expect(rememberedWidth(storage)).toBeNull()
    rememberWidth(400, storage)
    rememberOpen(false, storage)
    expect(rememberedWidth(storage)).toBe(400)
    expect(rememberedOpen(storage)).toBe(false)
  })

  it('reads anything that isn’t a number as none', () => {
    const storage = memoryStorage()
    storage.setItem('excalimathpad.sheetPanelWidth', 'wide')
    expect(rememberedWidth(storage)).toBeNull()
    storage.setItem('excalimathpad.sheetPanelWidth', '')
    expect(rememberedWidth(storage)).toBeNull()
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
    expect(() => rememberWidth(400, broken)).not.toThrow()
    expect(rememberedWidth(broken)).toBeNull()
    const none = storagePanelMemory(() => null)
    expect(() => none.rememberWidth(400)).not.toThrow()
    expect(none.rememberedWidth()).toBeNull()
  })

  it('the storage memory and the page’s own memory both keep it', () => {
    const storage = memoryStorage()
    storagePanelMemory(() => storage).rememberWidth(296)
    expect(storagePanelMemory(() => storage).rememberedWidth()).toBe(296)
    const session = sessionPanelMemory()
    expect(session.rememberedWidth()).toBeNull()
    session.rememberWidth(296)
    expect(session.rememberedWidth()).toBe(296)
  })
})
