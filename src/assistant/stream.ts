/**
 * The one server-sent-events reader of both adapters (docs/spec-v1.md section
 * 14, 0.7.0). It reads the answer's body as it arrives and gives each event
 * once it is whole, so an event cut between two pieces (21 events in 5 or 6
 * pieces, in Obsidian) is carried to the next one. Comment lines (`:` first,
 * OpenRouter's `: OPENROUTER PROCESSING`, a keep-alive) are skipped.
 */
export interface StreamEvent {
  /** The `event:` field, or '' where the stream names none (Chat Completions). */
  event: string
  /** The `data:` lines, joined with a line break. */
  data: string
}

/** Each whole event of `body`, in order. A read the signal aborts rejects, as the port's own does. */
export async function* readEvents(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const stop = () => void reader.cancel().catch(() => {})
  signal.addEventListener('abort', stop)
  let held = ''
  let event = ''
  let data: string[] = []
  try {
    for (;;) {
      if (signal.aborted) throw signal.reason
      const { done, value } = await reader.read()
      if (signal.aborted) throw signal.reason
      held += done ? decoder.decode() : decoder.decode(value, { stream: true })
      // A line ends at \n, \r\n or \r; the last, unfinished one waits for the next piece.
      const lines = held.split(/\r\n|\r(?!$)|\n/)
      held = done ? '' : (lines.pop() ?? '')
      if (done && lines.at(-1) === '') lines.pop()
      for (const line of done ? [...lines, ''] : lines) {
        if (line === '') {
          if (data.length) yield { event, data: data.join('\n') }
          event = ''
          data = []
        } else if (!line.startsWith(':')) {
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
          if (field === 'event') event = value
          else if (field === 'data') data.push(value)
        }
      }
      if (done) return
    }
  } finally {
    signal.removeEventListener('abort', stop)
    // A reader stopped early, or by the signal, frees the connection.
    void reader.cancel().catch(() => {})
  }
}
