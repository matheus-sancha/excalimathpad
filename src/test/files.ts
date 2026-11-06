import { vi } from 'vitest'
import type { FileAccess, SheetFileHandle } from '../file/fileAccess.ts'
import type { RecoveryCopy, RecoveryStore } from '../file/recovery.ts'

/** A disk the test can read: every save lands in `disk`, by file name. */
export function fakeFileAccess() {
  const disk = new Map<string, string>()
  const handleFor = (name: string) => ({ kind: 'file', name }) as SheetFileHandle
  return {
    disk,
    handleFor,
    open: vi.fn<FileAccess['open']>(async () => null),
    save: vi.fn<FileAccess['save']>(async (handle, text) => {
      disk.set(handle.name, text)
    }),
    saveAs: vi.fn<FileAccess['saveAs']>(async (name, text) => {
      disk.set(name, text)
      return { name, handle: handleFor(name) }
    }),
    read: vi.fn<FileAccess['read']>(async (handle) => ({
      name: handle.name,
      text: disk.get(handle.name) ?? '',
      handle,
    })),
  }
}

/** A recovery store in memory, optionally holding a copy from "before the reload". */
export function fakeRecovery(initial: RecoveryCopy | null = null) {
  let copy = initial
  return {
    current: () => copy,
    read: vi.fn(async () => copy),
    write: vi.fn(async (next: RecoveryCopy) => {
      copy = next
    }),
    clear: vi.fn(async () => {
      copy = null
    }),
  } satisfies RecoveryStore & { current: () => RecoveryCopy | null }
}
