import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { indexedDbRecovery, type RecoveryCopy } from './recovery.ts'

const copy = (text: string, name: string | null = 'pump.excalimathpad'): RecoveryCopy => ({
  text,
  name,
  handle: null,
})

describe('indexedDbRecovery', () => {
  it('reads nothing before the first write', async () => {
    expect(await indexedDbRecovery('t', new IDBFactory()).read()).toBeNull()
  })

  it('holds one copy: a write replaces the last one', async () => {
    const store = indexedDbRecovery('t', new IDBFactory())

    await store.write(copy('one'))
    await store.write(copy('two', null))

    expect(await store.read()).toEqual(copy('two', null))
  })

  it('keeps the copy across a new connection, as after a reload', async () => {
    const factory = new IDBFactory()
    await indexedDbRecovery('t', factory).write(copy('kept'))

    expect(await indexedDbRecovery('t', factory).read()).toEqual(copy('kept'))
  })

  it('stores the file handle as it is', async () => {
    const store = indexedDbRecovery('t', new IDBFactory())
    // A real handle only exists in a browser; any cloneable object stands in.
    const handle = { kind: 'file', name: 'pump.excalimathpad' } as never

    await store.write({ ...copy('x'), handle })

    expect((await store.read())?.handle).toEqual(handle)
  })

  it('clears the copy', async () => {
    const store = indexedDbRecovery('t', new IDBFactory())
    await store.write(copy('gone'))

    await store.clear()

    expect(await store.read()).toBeNull()
  })
})
