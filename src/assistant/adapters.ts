import { readFailure, type Failure } from './errors.ts'
import type { AssistantRequest, AssistantRequestInit } from './ports.ts'
import type { AdapterId, ProviderId } from './providers.ts'
import { readEvents } from './stream.ts'

/**
 * The two adapters, hand-written with no SDK (docs/spec-v1.md section 14,
 * 0.7.0; ADR 0008): **Chat Completions** at a base URL, for OpenAI, Google,
 * OpenRouter and every typed address, and **Anthropic's Messages API**, so the
 * fixed instructions and the Math guide carry its cache mark. Both go through
 * the `request` port only, and share one stream reader and one error reader.
 * The key goes only into a header.
 */

/** Where a request goes, and with what key. `provider` is the built-in, or null for a typed address. */
export interface Target {
  address: string
  adapter: AdapterId
  provider: ProviderId | null
  key: string
}

/** One earlier message or answer, as its text, exactly as the list shows it (section 8, What a Send carries). */
export interface Turn {
  role: 'user' | 'assistant'
  text: string
}

/** What a Send carries, in this order: the instructions, the guide, the listing, the conversation, the message. */
export interface Carried {
  model: string
  instructions: string
  guide: string
  /** Null for a sheet with no math element and no text: no listing goes. */
  listing: string | null
  conversation: readonly Turn[]
  message: string
}

export type Built = Omit<AssistantRequestInit, 'signal'> & { address: string }

/** Anthropic's API version, the latest its reference served on 2026-11-22. */
export const ANTHROPIC_VERSION = '2026-10-21'

/**
 * Anthropic's cap on an answer's tokens, which its thinking counts against: at
 * 8,000 a long answer arrived with no text, at 32,000 it arrived whole (#247).
 */
export const MAX_TOKENS = 32_000

function headers({ adapter, key }: Target, json: boolean): Record<string, string> {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    // A typed address may have no key, for a local model.
    ...(key ? { authorization: `Bearer ${key}` } : {}),
    ...(adapter === 'messages'
      ? { 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' }
      : {}),
  }
}

const turns = (carried: Carried) => [
  ...carried.conversation.map(({ role, text }) => ({ role, content: text })),
  { role: 'user', content: carried.message },
]

/**
 * A Send's request. The body's fixed start, the instructions and then the
 * guide, is the same bytes on every Send, so a provider's prefix caching applies.
 */
export function sendRequest(target: Target, carried: Carried): Built {
  const { model, instructions, guide, listing } = carried
  const body =
    target.adapter === 'messages'
      ? {
          model,
          max_tokens: MAX_TOKENS,
          stream: true,
          system: [
            { type: 'text', text: instructions },
            { type: 'text', text: guide, cache_control: { type: 'ephemeral' } },
            ...(listing === null ? [] : [{ type: 'text', text: listing }]),
          ],
          messages: turns(carried),
        }
      : {
          model,
          stream: true,
          messages: [
            { role: 'system', content: [instructions, guide, ...(listing === null ? [] : [listing])].join('\n\n') },
            ...turns(carried),
          ],
        }
  return {
    address: `${target.address}${target.adapter === 'messages' ? '/v1/messages' : '/chat/completions'}`,
    method: 'POST',
    headers: headers(target, true),
    body: JSON.stringify(body),
  }
}

/** Show models' and Check key's request: the model list, with the key and nothing of the sheet. */
export function modelsRequest(target: Target): Built {
  return {
    address: `${target.address}${target.adapter === 'messages' ? '/v1' : ''}/models`,
    method: 'GET',
    headers: headers(target, false),
  }
}

/** How a Send ended. `text` is what had arrived, which stays in the list. */
export type Outcome =
  | { kind: 'answer'; text: string }
  /** The stream ended without the provider's end mark, or stopped at the token cap (`cap`). */
  | { kind: 'cut'; text: string; cap: boolean }
  /** The signal ended it: Stop, Esc, New chat or a closed sheet. */
  | { kind: 'stopped'; text: string }
  | { kind: 'failed'; failure: Failure; text: string }

type Piece = { text?: string; end?: 'mark' | 'cap'; failure?: Failure }

const parse = (data: string): Record<string, unknown> | undefined => {
  try {
    const value: unknown = JSON.parse(data)
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** An error inside a 200's stream (Anthropic's `error` event; OpenRouter's top-level `error`). */
function streamFailure(error: unknown, target: Target): Failure {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
  return readFailure(typeof code === 'number' ? code : 0, JSON.stringify({ error }), target.provider, target.key)
}

/** What one event of the stream holds. */
function readPiece(adapter: AdapterId, data: string, target: Target): Piece {
  if (adapter === 'chat' && data === '[DONE]') return { end: 'mark' }
  const event = parse(data)
  if (!event) return {}
  if (event.error) return { failure: streamFailure(event.error, target) }
  if (adapter === 'messages') {
    const delta = event.delta as { type?: unknown; text?: unknown; stop_reason?: unknown } | undefined
    if (event.type === 'content_block_delta' && delta?.type === 'text_delta' && typeof delta.text === 'string')
      return { text: delta.text }
    if (event.type === 'message_delta' && delta?.stop_reason === 'max_tokens') return { end: 'cap' }
    if (event.type === 'message_stop') return { end: 'mark' }
    return {}
  }
  const choice = (event.choices as { delta?: { content?: unknown }; finish_reason?: unknown }[] | undefined)?.[0]
  const text = typeof choice?.delta?.content === 'string' ? choice.delta.content : undefined
  if (choice?.finish_reason === 'length') return { text, end: 'cap' }
  return { text }
}

/** A refused answer's body, as text; '' when it can't be read. */
async function bodyText(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<string> {
  if (!body) return ''
  let text = ''
  try {
    for await (const piece of chunks(body, signal)) text += piece
  } catch {
    // What arrived is all there is.
  }
  return text
}

async function* chunks(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  try {
    for (;;) {
      if (signal.aborted) throw signal.reason
      const { done, value } = await reader.read()
      if (done) return
      yield decoder.decode(value, { stream: true })
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
}

const ok = (status: number) => status >= 200 && status < 300

/**
 * A Send: the request through the port, then the answer read as it arrives.
 * `onText` gets the whole text so far after each piece. It never throws.
 */
export async function ask(
  request: AssistantRequest,
  target: Target,
  carried: Carried,
  signal: AbortSignal,
  onText: (text: string) => void,
): Promise<Outcome> {
  const { address, ...init } = sendRequest(target, carried)
  let text = ''
  let answered = false
  try {
    const answer = await request(address, { ...init, signal })
    answered = true
    if (!ok(answer.status)) {
      const failure = readFailure(answer.status, await bodyText(answer.body, signal), target.provider, target.key)
      return signal.aborted ? { kind: 'stopped', text } : { kind: 'failed', failure, text }
    }
    if (!answer.body) return { kind: 'cut', text, cap: false }
    for await (const { data } of readEvents(answer.body, signal)) {
      const piece = readPiece(target.adapter, data, target)
      if (piece.text) {
        text += piece.text
        onText(text)
      }
      if (piece.failure) return { kind: 'failed', failure: piece.failure, text }
      if (piece.end === 'cap') return { kind: 'cut', text, cap: true }
      if (piece.end === 'mark') return { kind: 'answer', text }
    }
    return { kind: 'cut', text, cap: false }
  } catch {
    if (signal.aborted) return { kind: 'stopped', text }
    // The connection dropped in the middle, or nothing came back at all.
    return answered ? { kind: 'cut', text, cap: false } : { kind: 'failed', failure: { kind: 'nothing' }, text }
  }
}

/** Show models' and Check key's answer: the models' names, or why not. It never throws. */
export async function listModels(
  request: AssistantRequest,
  target: Target,
  signal: AbortSignal,
): Promise<{ kind: 'models'; names: string[] } | { kind: 'failed'; failure: Failure }> {
  const { address, ...init } = modelsRequest(target)
  try {
    const answer = await request(address, { ...init, signal })
    const text = await bodyText(answer.body, signal)
    if (!ok(answer.status))
      return { kind: 'failed', failure: readFailure(answer.status, text, target.provider, target.key) }
    const data = parse(text)?.data
    if (!Array.isArray(data)) return { kind: 'failed', failure: readFailure(answer.status, text, null, target.key) }
    const names = data.flatMap((model: { id?: unknown }) => (typeof model?.id === 'string' ? [model.id] : []))
    return { kind: 'models', names }
  } catch {
    return { kind: 'failed', failure: { kind: 'nothing' } }
  }
}
