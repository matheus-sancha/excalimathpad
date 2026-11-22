import type { ProviderId } from './providers.ts'
import { hideKey } from './setup.ts'

/**
 * The one error reader of both adapters (docs/spec-v1.md section 13, Math
 * assistant, and the notes under its table; section 14, 0.7.0). It reads what a
 * provider answered when it refused, and says which of five outcomes it is.
 * `said` is the provider's own words, quoted as they arrived, with any copy of
 * the key replaced by "…" and its last four characters.
 */
export type Failure =
  | { kind: 'refusedKey'; said: string }
  | { kind: 'unknownModel'; said: string }
  | { kind: 'noCredit'; said: string }
  | { kind: 'other'; said: string }
  /** No answer the page could read: no network, a refused connection, an answer with no CORS header. */
  | { kind: 'nothing' }

interface Body {
  message?: unknown
  detail?: unknown
  type?: unknown
  code?: unknown
  status?: unknown
  error?: unknown
}

const asText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)

/**
 * The error object of a body, in any of the six shapes seen
 * (`docs/research/provider-shapes.md`, item 4): `{error: {…}}`, a list of those
 * (Google), `{error: "<message>"}` (xAI), `{detail}` (Mistral) or the fields
 * with no wrapper (Cerebras).
 */
export function errorOf(value: unknown): Body | undefined {
  const first: unknown = Array.isArray(value) ? value[0] : value
  if (!first || typeof first !== 'object') return undefined
  const body = first as Body
  if (body.error && typeof body.error === 'object') return body.error
  if (asText(body.error)) return { ...body, message: body.error }
  return body
}

/**
 * What a refusal means. `status` is the answer's (or, for an error inside a
 * stream, the error's own code, or 0); `text` its body; `provider` the
 * built-in, or null for a typed address, which gets no "no credit" reading.
 */
export function readFailure(status: number, text: string, provider: ProviderId | null, key: string): Failure {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = undefined
  }
  const error = errorOf(parsed)
  const plain = text.trim()
  const found =
    asText(error?.message) ??
    asText(error?.detail) ??
    // A body that isn't JSON is quoted as it is, unless it is a page.
    (plain && !plain.startsWith('<') ? plain.slice(0, 500) : `HTTP ${status}`)
  const said = hideKey(found, key)
  const type = error?.type
  const code = error?.code
  // Each built-in's own "no credit" answer (section 13); Google's hasn't been read.
  if (
    (provider === 'anthropic' && /credit balance is too low/i.test(found)) ||
    (provider === 'openai' &&
      status === 429 &&
      (type === 'insufficient_quota' || code === 'insufficient_quota' || code === 'credit_balance_exhausted')) ||
    (provider === 'openrouter' && status === 402)
  )
    return { kind: 'noCredit', said }
  if (
    status === 401 ||
    // Anthropic's permission_error; OpenRouter's 403 is a guardrail or a budget, quoted as it is.
    (provider === 'anthropic' && status === 403) ||
    // Google's compatible endpoint answers a wrong key with 400 INVALID_ARGUMENT.
    (provider === 'google' && status === 400 && /api key/i.test(found))
  )
    return { kind: 'refusedKey', said }
  if (status === 404 || code === 'model_not_found') return { kind: 'unknownModel', said }
  return { kind: 'other', said }
}
