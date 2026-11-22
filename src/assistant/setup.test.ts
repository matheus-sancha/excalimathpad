import { describe, expect, it, vi } from 'vitest'
import { sessionSetupStore, SETUP_ENTRY, storageSetupStore, type SetupStore } from './ports.ts'
import { keyEnding, readSetup, setupKeeper, setupText, type Setup } from './setup.ts'

/** The setup's record and its keeper (docs/spec-v1.md section 8, The setup card). */
const CANARY = 'sk-canary-9f3c7e21d8b64a05-a1B2'
const anthropic: Setup = { provider: 'anthropic', address: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', key: CANARY, hosts: [] }
const local: Setup = { provider: 'other', address: 'http://localhost:11434/v1', model: 'llama', key: '', hosts: ['localhost:11434'] }

describe('the record', () => {
  it('is one text of five fields: provider, address, model, key and confirmed hosts', () => {
    expect(Object.keys(JSON.parse(setupText(anthropic)) as object)).toEqual(['provider', 'address', 'model', 'key', 'hosts'])
    expect(readSetup(setupText(anthropic))).toEqual(anthropic)
    // A typed address may have no key.
    expect(readSetup(setupText(local))).toEqual(local)
  })

  it.each([null, '', 'not json', '[]', '"text"', '{}', '{"provider":"anthropic"}', '{"provider":"nobody","address":"https://a.example","model":"m","key":"k"}'])(
    'nothing kept, an entry written empty or text that isn’t a record is no setup: %s',
    (text) => {
      expect(readSetup(text)).toBeNull()
    },
  )

  it('a built-in’s address is always its constant’s, so a changed entry sends no key elsewhere', () => {
    const changed = setupText({ ...anthropic, address: 'https://evil.example' })
    expect(readSetup(changed)?.address).toBe('https://api.anthropic.com')
  })

  it('a typed address that no longer passes the check is no setup', () => {
    expect(readSetup(setupText({ ...local, address: 'http://192.168.1.20/v1' }))).toBeNull()
    expect(readSetup(setupText({ ...local, address: 'https://user:pass@api.example.com' }))).toBeNull()
  })

  it('shows a key’s last four characters only, and nothing of a key that short', () => {
    expect(keyEnding(CANARY)).toBe('a1B2')
    expect(keyEnding('abcd')).toBe('…')
  })
})

describe('the keeper of a store', () => {
  it('is one per store, and reads the store once', () => {
    const store = sessionSetupStore()
    store.write(setupText(anthropic))
    const read = vi.spyOn(store, 'read')
    const keeper = setupKeeper(store)
    expect(setupKeeper(store)).toBe(keeper)
    expect(read).toHaveBeenCalledTimes(1)
    expect(keeper.state()).toEqual({ setup: anthropic, session: null, removed: false })
    expect(setupKeeper(sessionSetupStore())).not.toBe(keeper)
  })

  it('Save writes the record, and tells whoever listens', () => {
    const store = sessionSetupStore()
    const keeper = setupKeeper(store)
    const heard = vi.fn()
    const stop = keeper.subscribe(heard)
    keeper.save(anthropic)
    expect(readSetup(store.read())).toEqual(anthropic)
    expect(keeper.state()).toEqual({ setup: anthropic, session: null, removed: false })
    expect(heard).toHaveBeenCalledTimes(1)
    stop()
    keeper.save(local)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('Remove forgets the key only, by writing the entry again without it', () => {
    const store = sessionSetupStore()
    const keeper = setupKeeper(store)
    keeper.save({ ...anthropic, hosts: ['api.anthropic.com'] })
    const write = vi.spyOn(store, 'write')
    const remove = vi.spyOn(store, 'remove')
    keeper.removeKey()
    expect(write).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
    expect(store.read()).not.toContain(CANARY)
    expect(keeper.state()).toEqual({ setup: { ...anthropic, key: '', hosts: ['api.anthropic.com'] }, session: null, removed: true })
    // Read again on another day: a built-in with no key had its key removed.
    const again = sessionSetupStore()
    again.write(store.read()!)
    expect(setupKeeper(again).state().removed).toBe(true)
  })

  it('Forget this setup forgets all of it', () => {
    const store = sessionSetupStore()
    const keeper = setupKeeper(store)
    keeper.save(anthropic)
    keeper.forget()
    expect(store.read()).toBeNull()
    expect(keeper.state()).toEqual({ setup: null, session: null, removed: false })
  })

  it('a store that throws keeps the setup for the session, with the store’s error, and no second store is tried', () => {
    const store: SetupStore = {
      read: vi.fn(() => null),
      write: vi.fn(() => {
        throw new DOMException("Failed to execute 'setItem' on 'Storage': the quota has been exceeded.", 'QuotaExceededError')
      }),
      remove: vi.fn(),
    }
    const keeper = setupKeeper(store)
    keeper.save(anthropic)
    expect(keeper.state()).toEqual({
      setup: anthropic,
      session: expect.stringContaining("Failed to execute 'setItem' on 'Storage': the quota has been exceeded.") as string,
      removed: false,
    })
    expect(store.write).toHaveBeenCalledTimes(1)
    // The next Save tries the same store again, and a store that then keeps it ends the session's hold.
    vi.mocked(store.write).mockImplementation(() => {})
    keeper.save(anthropic)
    expect(keeper.state().session).toBeNull()
  })

  it('a store’s error that quotes the record never shows the key', () => {
    const store: SetupStore = {
      read: () => null,
      write: (record) => {
        throw new Error(`Couldn't write ${record}`)
      },
      remove: () => {},
    }
    const keeper = setupKeeper(store)
    keeper.save(anthropic)
    expect(keeper.state().session).not.toContain(CANARY)
    expect(keeper.state().session).toContain('…a1B2')
  })

  it('a store that can’t be read holds nothing, and one that can’t forget is forgotten here', () => {
    const store: SetupStore = {
      read: () => {
        throw new Error('blocked')
      },
      write: () => {},
      remove: () => {
        throw new Error('blocked')
      },
    }
    const keeper = setupKeeper(store)
    expect(keeper.state().setup).toBeNull()
    keeper.save(anthropic)
    expect(() => keeper.forget()).not.toThrow()
    expect(keeper.state().setup).toBeNull()
  })
})

describe('the web’s store', () => {
  it('is one entry of the storage it is given, asked for on each call', () => {
    const kept = new Map<string, string>()
    const storage = {
      getItem: (name: string) => kept.get(name) ?? null,
      setItem: (name: string, value: string) => void kept.set(name, value),
      removeItem: (name: string) => void kept.delete(name),
    } as Storage
    const asked = vi.fn(() => storage)
    const store = storageSetupStore(asked)
    expect(asked).not.toHaveBeenCalled()
    expect(store.read()).toBeNull()
    store.write(setupText(anthropic))
    expect([...kept.keys()]).toEqual([SETUP_ENTRY])
    expect(SETUP_ENTRY).toBe('excalimathpad.assistant')
    expect(readSetup(store.read())).toEqual(anthropic)
    store.remove()
    expect(kept.size).toBe(0)
    expect(asked).toHaveBeenCalledTimes(4)
  })

  it('lets a blocked storage’s error through, for the card to say', () => {
    const store = storageSetupStore(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    expect(() => store.write('{}')).toThrow('The operation is insecure.')
  })
})
