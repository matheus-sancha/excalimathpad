/**
 * The Math assistant's two ports (docs/spec-v1.md section 14, 0.7.0; ADR
 * 0008). `src/assistant/` never calls the network or a store itself: each home
 * hands App both, as it hands it the file pickers and the recovery copy, and
 * tests hand it a fake that records every request. With no ports there is no
 * Math assistant: no tab and no More tools item.
 */
export interface AssistantPorts {
  request: AssistantRequest
  /**
   * Null where this home has nowhere to keep a setup: an Obsidian older than
   * 1.11.4, where the tab says so and holds nothing else (section 8, Its place).
   */
  store: SetupStore | null
}

/**
 * How a request is made, shaped like the browser's own: an address, a method,
 * headers, a body and an abort signal go in; a status, headers and the
 * answer's body, read in pieces, come out. It rejects when nothing readable
 * came back (no network, a refused connection, an abort).
 */
export type AssistantRequest = (address: string, init: AssistantRequestInit) => Promise<AssistantAnswer>

export interface AssistantRequestInit {
  method: 'GET' | 'POST'
  headers: Readonly<Record<string, string>>
  /** A POST's body, as text. */
  body?: string
  /** Stop, Esc and a closed sheet end the request through it. */
  signal: AbortSignal
}

export interface AssistantAnswer {
  status: number
  headers: { get: (name: string) => string | null }
  /** The answer's bytes, as they arrive; null when the answer has no body. */
  body: ReadableStream<Uint8Array> | null
}

/**
 * Where the setup is kept, one record per device (section 8, The setup card):
 * its text as the assistant wrote it, or null when none is saved. The record's
 * fields are the assistant's own; a store only keeps the text.
 */
export interface SetupStore {
  read: () => string | null
  write: (record: string) => void
  remove: () => void
}

/** Where the web keeps the setup: one entry beside the panel memory's (`src/panel/panelMemory.ts`). */
export const SETUP_ENTRY = 'excalimathpad.assistant'

/**
 * The setup in a `Storage` (the web, given the browser's by `src/main.tsx`,
 * so this file names none). `storage` is asked on every call and may throw,
 * as a blocked or full one does: the error reaches the assistant, which then
 * holds the setup for the session and says so (section 8, The setup card).
 */
export function storageSetupStore(storage: () => Storage): SetupStore {
  return {
    read: () => storage().getItem(SETUP_ENTRY),
    write: (record) => storage().setItem(SETUP_ENTRY, record),
    remove: () => storage().removeItem(SETUP_ENTRY),
  }
}

/** A store that lasts as long as the page: what tests pass. */
export function sessionSetupStore(): SetupStore {
  let kept: string | null = null
  return {
    read: () => kept,
    write: (record) => {
      kept = record
    },
    remove: () => {
      kept = null
    },
  }
}
