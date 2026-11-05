import type { SheetFileHandle } from './fileAccess.ts'

/**
 * The recovery copy (docs/spec-v1.md section 7): the whole sheet as it would be
 * saved, with its file name and handle, kept in the browser between saves. One
 * at a time: a write replaces it.
 */
export interface RecoveryCopy {
  /** The sheet file's text, block included. */
  text: string
  /** The sheet's file name, or null for an untitled sheet. */
  name: string | null
  /** So Ctrl+S after Restore writes back to the same file (#42, question 4). */
  handle: SheetFileHandle | null
}

export interface RecoveryStore {
  read(): Promise<RecoveryCopy | null>
  write(copy: RecoveryCopy): Promise<void>
  clear(): Promise<void>
}

const STORE = 'recovery'
const KEY = 'current'

/**
 * The recovery copy in IndexedDB. A file handle is structured-cloneable in
 * Chromium, so it is stored as it is. Anything unreadable reads as no copy.
 */
export function indexedDbRecovery(
  name = 'excalimathpad',
  factory: IDBFactory = indexedDB,
): RecoveryStore {
  let opening: Promise<IDBDatabase> | null = null
  const database = () => {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return opening
  }

  const run = async <T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest) =>
    new Promise<T>((resolve, reject) => {
      database().then((db) => {
        const transaction = db.transaction(STORE, mode)
        const request = act(transaction.objectStore(STORE))
        transaction.oncomplete = () => resolve(request.result as T)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      }, reject)
    })

  return {
    async read() {
      const value = await run<unknown>('readonly', (store) => store.get(KEY))
      return isCopy(value) ? value : null
    },
    async write(copy) {
      await run('readwrite', (store) => store.put(copy, KEY))
    },
    async clear() {
      await run('readwrite', (store) => store.delete(KEY))
    },
  }
}

function isCopy(value: unknown): value is RecoveryCopy {
  if (typeof value !== 'object' || value === null) return false
  const copy = value as Record<string, unknown>
  return (
    typeof copy.text === 'string' &&
    (copy.name === null || typeof copy.name === 'string') &&
    'handle' in copy
  )
}
