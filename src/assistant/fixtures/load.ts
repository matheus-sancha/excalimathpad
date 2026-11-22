import type { AssistantAnswer, AssistantRequest, AssistantRequestInit } from '../ports.ts'

/** Every fixture's text, by its path under `fixtures/` (`messages/answer.http`). Tests only. */
export const FIXTURES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('./**/*.http', { query: '?raw', import: 'default', eager: true }),
  ).map(([path, text]) => [path.slice(2), text]),
)

export interface Fixture {
  /** The header's lines, `#` taken off: where it is from first. */
  from: string[]
  status: number
  headers: Record<string, string>
  body: string
}

/** A fixture file read: its header, its status line, its headers and its body as it is. */
export function fixture(path: string): Fixture {
  const text = FIXTURES[path]
  if (text === undefined) throw new Error(`No fixture ${path}`)
  const lines = text.split('\n')
  const from: string[] = []
  while (lines[0]?.startsWith('#')) from.push((lines.shift() ?? '').replace(/^# ?/, ''))
  const status = Number(/^HTTP (\d+)$/.exec(lines.shift() ?? '')?.[1])
  const headers: Record<string, string> = {}
  for (let line = lines.shift(); line; line = lines.shift()) {
    const colon = line.indexOf(':')
    headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim()
  }
  return { from, status, headers, body: lines.join('\n') }
}

/** A body that arrives in pieces of `size` bytes, so events (and characters) are cut between them. */
export function piecesOf(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let at = 0
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close()
      controller.enqueue(bytes.slice(at, at + size))
      at += size
    },
  })
}

export interface Sent extends AssistantRequestInit {
  address: string
}

/**
 * The fake `request` port: it records every request and answers with the
 * fixture, `size` bytes at a time; or, with no fixture, rejects, as the
 * browser's own does when nothing readable came back.
 */
export function fakeRequest(path: string | null, size = 7): { request: AssistantRequest; sent: Sent[] } {
  const sent: Sent[] = []
  const request: AssistantRequest = (address, init) => {
    sent.push({ address, ...init })
    if (init.signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))
    if (path === null) return Promise.reject(new TypeError('Failed to load'))
    const { status, headers, body } = fixture(path)
    const answer: AssistantAnswer = {
      status,
      headers: { get: (name) => headers[name.toLowerCase()] ?? null },
      body: piecesOf(body, size),
    }
    return Promise.resolve(answer)
  }
  return { request, sent }
}
