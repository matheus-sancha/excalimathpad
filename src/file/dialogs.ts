import type { SessionDialogs } from './sheetSession.ts'
import { SHEET_EXTENSION } from './sheetFormat.ts'

/**
 * The questions the sheet session asks, held as plain state for the UI to show
 * (`FileDialogs`). Each question is a promise that the UI's button settles.
 */
export type PendingDialog =
  | {
      kind: 'restore'
      title: string
      choices: readonly ['restore', 'discard']
      answer: (choice: 'restore' | 'discard') => void
    }
  | {
      kind: 'save-changes'
      title: string
      choices: readonly ['save', 'dont-save', 'cancel']
      answer: (choice: 'save' | 'dont-save' | 'cancel') => void
    }

export interface DialogHost extends SessionDialogs {
  getPending(): PendingDialog | null
  subscribe(listener: () => void): () => void
}

/** Section 13's wording. */
export const restoreTitle = (name: string | null) =>
  name ? `Restore unsaved changes to ${name}?` : 'Restore unsaved changes to an untitled sheet?'

export const saveChangesTitle = (name: string | null) =>
  `Save changes to ${name ?? `Untitled${SHEET_EXTENSION}`}?`

export function createDialogHost(message: (text: string) => void): DialogHost {
  let pending: PendingDialog | null = null
  const listeners = new Set<() => void>()
  const show = (next: PendingDialog | null) => {
    pending = next
    listeners.forEach((listener) => listener())
  }

  return {
    getPending: () => pending,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    askRestore: (name) =>
      new Promise((resolve) =>
        show({
          kind: 'restore',
          title: restoreTitle(name),
          choices: ['restore', 'discard'],
          answer: (choice) => {
            show(null)
            resolve(choice)
          },
        }),
      ),
    askSaveChanges: (name) =>
      new Promise((resolve) =>
        show({
          kind: 'save-changes',
          title: saveChangesTitle(name),
          choices: ['save', 'dont-save', 'cancel'],
          answer: (choice) => {
            show(null)
            resolve(choice)
          },
        }),
      ),
    message,
  }
}
