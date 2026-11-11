import { describe, expect, it } from 'vitest'
import { rememberedOpen, rememberOpen } from './panelMemory.ts'

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
