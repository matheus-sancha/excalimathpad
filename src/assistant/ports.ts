/**
 * The Math assistant's two ports (docs/spec-v1.md section 14, 0.7.0; ADR
 * 0008). `src/assistant/` never calls the network or a store itself: each home
 * hands App both, as it hands it the file pickers and the recovery copy, and
 * tests hand it a fake that records every request. With no ports there is no
 * Math assistant: no tab and no More tools item.
 */
export interface AssistantPorts {
  request: AssistantRequest
  store: SetupStore
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

/** A store that lasts as long as the page: what a home passes until it has its own, and what tests pass. */
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
