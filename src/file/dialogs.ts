import type { SessionDialogs } from './sheetSession.ts'
import { SHEET_EXTENSION } from './sheetFormat.ts'

/**
 * The questions the sheet session asks, held as plain state for the UI to show
 * (`FileDialog` in `FileChrome.tsx`). Each question is a promise that the UI's
 * button settles.
 */
export interface PendingDialog {
  kind: 'restore' | 'save-changes'
  title: string
  /** The first is the default button. */
  choices: readonly Choice[]
  answer: (choice: Choice) => void
  /** What Esc answers, if anything. */
  escape: Choice | null
}

export type Choice = 'restore' | 'discard' | 'save' | 'dont-save' | 'cancel'

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

  function ask<C extends Choice>(
    kind: PendingDialog['kind'],
    title: string,
    choices: readonly C[],
    escape: C | null,
  ): Promise<C> {
    return new Promise((resolve) =>
      show({
        kind,
        title,
        choices,
        escape,
        answer: (choice) => {
          show(null)
          resolve(choice as C)
        },
      }),
    )
  }

  return {
    getPending: () => pending,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    // No Esc on the restore offer: discarding the copy by accident loses work.
    askRestore: (name) => ask('restore', restoreTitle(name), ['restore', 'discard'], null),
    askSaveChanges: (name) =>
      ask('save-changes', saveChangesTitle(name), ['save', 'dont-save', 'cancel'], 'cancel'),
    message,
  }
}
