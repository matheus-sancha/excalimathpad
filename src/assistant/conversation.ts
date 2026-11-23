import { ask, listModels, type Carried, type Target, type Turn } from './adapters.ts'
import type { Failure } from './errors.ts'
import { INSTRUCTIONS } from './instructions.ts'
import type { ListingCounts, ListingMap } from './listing.ts'
import type { AssistantRequest } from './ports.ts'

/**
 * The conversation (docs/spec-v1.md section 8, Math assistant, The conversation and What a
 * Send carries; section 14, 0.7.0). It is held outside the tab's content, one per open sheet:
 * Excalidraw's sidebar removes a tab's content while another tab shows, so the list and an
 * answer still arriving live here, and the answer keeps arriving while the tab is hidden. It
 * is never saved: it ends when the sheet closes (`end`).
 *
 * It makes a request only when `send`, `retry` or `checkKey` is called, which only a press
 * does, and never by itself: no timer and no retry of its own.
 */

/** What went with a sent message: its own Send's listing, kept for "Sent with this" and the chips. */
export interface SentWith {
  /** Null for an empty sheet, which carried no listing. */
  counts: ListingCounts | null
  listing: string | null
  /** Each label of that listing; never sent. */
  map: ListingMap | null
}

export interface Message {
  kind: 'message'
  id: number
  text: string
  sent: SentWith
}

/**
 * An answer's state: `waiting` before anything arrived ("Reading the sheet…"), `arriving`
 * as it is written, then how it ended.
 */
export type AnswerState = 'waiting' | 'arriving' | 'answer' | 'stopped' | 'cut' | 'failed'

/** Check key pressed under a failed answer, and what it found. */
export type AnswerCheck =
  | { kind: 'checking' }
  | { kind: 'accepted' }
  | { kind: 'refused'; said: string }
  | { kind: 'nothing' }
  | { kind: 'other'; said: string }

export interface Answer {
  kind: 'answer'
  id: number
  /** What arrived: it stays in the list whatever happens after. */
  text: string
  state: AnswerState
  failure: Failure | null
  /** When something last arrived, or the request went: the 30 seconds' hint counts from it. */
  quietSince: number
  check: AnswerCheck | null
}

export type Entry = Message | Answer

export interface ConversationState {
  entries: readonly Entry[]
  /** An answer is arriving (or a Check key is out): there is no Send, and Send is Stop. */
  busy: boolean
  /** The field's text, kept here so it outlives the tab's content. */
  draft: string
}

/** What a Send needs besides the message: where it goes, and the sheet as it is now. */
export interface SendWith {
  request: AssistantRequest
  target: Target
  model: string
  /** The Math guide's English text. */
  guide: string
  /** The sheet's listing at this Send: null for an empty sheet. */
  sent: SentWith
}

export interface Conversation {
  state: () => ConversationState
  subscribe: (listener: () => void) => () => void
  setDraft: (text: string) => void
  /** Sends `message` with the conversation so far. Nothing while an answer is arriving. */
  send: (message: string, withThis: SendWith) => void
  /** Try again: asks the last message again, with the sheet as it is now, in place of what failed. */
  retry: (withThis: SendWith) => void
  /** Check key under the failed answer `answerId`: the model list, with the key. */
  checkKey: (answerId: number, request: AssistantRequest, target: Target) => void
  /** Stop or Esc: cancels the request in flight; what arrived stays, marked "Stopped.". */
  stop: () => void
  /** New chat: stops an arriving answer and empties the list. */
  clear: () => void
  /** The sheet closed: the request in flight is cancelled and the conversation is gone. */
  end: () => void
}

/**
 * The earlier messages and answers, as their text, exactly as the list shows them (section 8,
 * What a Send carries): stopped and cut-short answers included, an answer with no text left
 * out. Older listings never go: only the text.
 */
export function turnsOf(entries: readonly Entry[]): Turn[] {
  return entries.flatMap((entry): Turn[] => {
    if (entry.kind === 'message') return [{ role: 'user', text: entry.text }]
    return entry.text ? [{ role: 'assistant', text: entry.text }] : []
  })
}

export function createConversation(now: () => number = Date.now): Conversation {
  let state: ConversationState = { entries: [], busy: false, draft: '' }
  const listeners = new Set<() => void>()
  let nextId = 1
  /** The request in flight, and the conversation it belongs to (New chat and `end` start another). */
  let flight: AbortController | null = null
  let generation = 0

  const set = (next: Partial<ConversationState>) => {
    state = { ...state, ...next }
    for (const listener of [...listeners]) listener()
  }
  const update = (id: number, change: (answer: Answer) => Partial<Answer>) =>
    set({
      entries: state.entries.map((entry) => (entry.kind === 'answer' && entry.id === id ? { ...entry, ...change(entry) } : entry)),
    })

  /** Asks with `before` as the conversation, `message` as the new message, into a new answer. */
  const run = (before: readonly Entry[], message: Message, withThis: SendWith) => {
    const answer: Answer = { kind: 'answer', id: nextId++, text: '', state: 'waiting', failure: null, quietSince: now(), check: null }
    const controller = new AbortController()
    flight = controller
    const mine = generation
    set({ entries: [...before, message, answer], busy: true })

    const carried: Carried = {
      model: withThis.model,
      instructions: INSTRUCTIONS,
      guide: withThis.guide,
      listing: withThis.sent.listing,
      conversation: turnsOf(before),
      message: message.text,
    }
    const live = () => mine === generation
    void ask(withThis.request, withThis.target, carried, controller.signal, (text) => {
      if (live()) update(answer.id, () => ({ text, state: 'arriving', quietSince: now() }))
    }).then((outcome) => {
      if (!live()) return
      if (flight === controller) flight = null
      const failure = outcome.kind === 'failed' ? outcome.failure : null
      update(answer.id, () => ({ text: outcome.text, state: outcome.kind, failure }))
      set({ busy: false })
    })
  }

  return {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setDraft: (draft) => set({ draft }),
    send: (text, withThis) => {
      if (state.busy || !text.trim()) return
      run(state.entries, { kind: 'message', id: nextId++, text, sent: withThis.sent }, withThis)
    },
    retry: (withThis) => {
      const { entries } = state
      const last = entries.at(-1)
      const message = entries.at(-2)
      if (state.busy || last?.kind !== 'answer' || message?.kind !== 'message') return
      // The same message, with the sheet as it is now; what failed is replaced.
      run(entries.slice(0, -2), { ...message, sent: withThis.sent }, withThis)
    },
    checkKey: (answerId, request, target) => {
      if (state.busy) return
      const controller = new AbortController()
      flight = controller
      const mine = generation
      update(answerId, () => ({ check: { kind: 'checking' } }))
      set({ busy: true })
      void listModels(request, target, controller.signal).then((found) => {
        if (mine !== generation) return
        if (flight === controller) flight = null
        const check: AnswerCheck =
          found.kind === 'models'
            ? { kind: 'accepted' }
            : found.failure.kind === 'nothing'
              ? { kind: 'nothing' }
              : found.failure.kind === 'refusedKey'
                ? { kind: 'refused', said: found.failure.said }
                : { kind: 'other', said: found.failure.said }
        update(answerId, () => ({ check }))
        set({ busy: false })
      })
    },
    stop: () => flight?.abort(),
    clear: () => {
      flight?.abort()
      flight = null
      generation++
      set({ entries: [], busy: false })
    },
    end: () => {
      flight?.abort()
      flight = null
      generation++
      state = { entries: [], busy: false, draft: '' }
      for (const listener of [...listeners]) listener()
    },
  }
}
