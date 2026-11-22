import type { SessionDialogs } from './sheetSession.ts'
import { SHEET_EXTENSION } from './sheetFormat.ts'
import type { Words } from '../text/words.ts'

/**
 * The questions the sheet session asks, held as plain state for the UI to show
 * (`FileDialog` in `FileChrome.tsx`). Each question is a promise that the UI's
 * button settles.
 */
export interface PendingDialog {
  kind: 'restore' | 'save-changes'
  /** The file the question names; null for an untitled sheet. Worded when drawn (`dialogTitle`). */
  name: string | null
  /** The first is the default button. */
  choices: readonly Choice[]
  answer: (choice: Choice) => void
  /** What Esc answers, if anything. */
  escape: Choice | null
}

export type Choice = 'restore' | 'discard' | 'save' | 'dont-save' | 'cancel'

export interface DialogHost extends SessionDialogs {
  getPending: () => PendingDialog | null
  subscribe: (listener: () => void) => () => void
}

/**
 * The question, in section 13's wording, in the language of `words`: it is
 * worded as it is drawn, so a choice in ☰ → Language reaches an open one.
 */
export function dialogTitle({ kind, name }: Pick<PendingDialog, 'kind' | 'name'>, words: Words): string {
  if (kind === 'restore') return words.dialogs.restore(name)
  return words.dialogs.saveChanges(name ?? `${words.file.untitled}${SHEET_EXTENSION}`)
}

export function createDialogHost(message: (text: string) => void): DialogHost {
  let pending: PendingDialog | null = null
  const listeners = new Set<() => void>()
  const show = (next: PendingDialog | null) => {
    pending = next
    listeners.forEach((listener) => listener())
  }

  function ask<C extends Choice>(
    kind: PendingDialog['kind'],
    name: string | null,
    choices: readonly C[],
    escape: C | null,
  ): Promise<C> {
    return new Promise((resolve) =>
      show({
        kind,
        name,
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
    askRestore: (name) => ask('restore', name, ['restore', 'discard'], null),
    askSaveChanges: (name) =>
      ask('save-changes', name, ['save', 'dont-save', 'cancel'], 'cancel'),
    message,
  }
}
