import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Target } from './adapters.ts'
import { createConversation, turnsOf, type Answer, type SendWith, type SentWith } from './conversation.ts'
import { fakeRequest, type Sent } from './fixtures/load.ts'
import { INSTRUCTIONS } from './instructions.ts'
import type { AssistantRequest } from './ports.ts'

/**
 * The conversation (docs/spec-v1.md section 8, Math assistant, The conversation and What a
 * Send carries), against the fake port: what each Send carries and in what order, one
 * answer at a time, Stop, New chat, Try again, a closed sheet, and no request it wasn't asked
 * for.
 */
const target: Target = { address: 'https://api.anthropic.com', adapter: 'messages', provider: 'anthropic', key: 'sk-test-0000' }
const sheet = (listing: string | null): SentWith => ({
  counts: listing === null ? null : { elements: 1, lines: 1, texts: 0 },
  listing,
  map: listing === null ? null : new Map(),
})
const withThis = (request: AssistantRequest, listing: string | null = 'E1  (no title)\n  1 | a = 2\n'): SendWith => ({
  request,
  target,
  model: 'claude-sonnet-5-5',
  guide: '# Math guide',
  sent: sheet(listing),
})
const body = (sent: Sent) => JSON.parse(sent.body!) as { system: { text: string }[]; messages: { role: string; content: string }[] }
const answerOf = (conversation: ReturnType<typeof createConversation>) => conversation.state().entries.at(-1) as Answer
const settled = (conversation: ReturnType<typeof createConversation>) =>
  vi.waitFor(() => expect(conversation.state().busy).toBe(false))

/** A request whose answer starts, sends `first`, then waits until it is aborted. */
function hanging(first = 'Partial ') {
  const sent: Sent[] = []
  const request: AssistantRequest = (address, init) => {
    sent.push({ address, ...init })
    const encoder = new TextEncoder()
    const event = `event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":${JSON.stringify(first)}}}\n\n`
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(event))
        init.signal.addEventListener('abort', () => controller.error(init.signal.reason))
      },
    })
    return Promise.resolve({ status: 200, headers: { get: () => 'text/event-stream' }, body })
  }
  return { request, sent }
}

afterEach(() => vi.useRealTimers())

describe('a Send', () => {
  it('carries the instructions, the guide, the listing, the conversation and the message, in that order', async () => {
    const fake = fakeRequest('messages/answer.http')
    const conversation = createConversation()
    conversation.send('Check this sheet', withThis(fake.request))
    expect(conversation.state().busy).toBe(true)
    expect(answerOf(conversation).state).toBe('waiting')
    await settled(conversation)
    expect(answerOf(conversation)).toMatchObject({ state: 'answer', text: 'Hello!' })

    conversation.send('And line 1?', withThis(fake.request, 'E1  (no title)\n  1 | a = 3\n'))
    await settled(conversation)
    const [first, second] = fake.sent.map(body)
    expect(first.system.map(({ text }) => text)).toEqual([INSTRUCTIONS, '# Math guide', 'E1  (no title)\n  1 | a = 2\n'])
    expect(first.messages).toEqual([{ role: 'user', content: 'Check this sheet' }])
    // The sheet as it is at the second Send, and the earlier turns as their text: older listings never go again.
    expect(second.system.map(({ text }) => text)).toEqual([INSTRUCTIONS, '# Math guide', 'E1  (no title)\n  1 | a = 3\n'])
    expect(second.messages).toEqual([
      { role: 'user', content: 'Check this sheet' },
      { role: 'assistant', content: 'Hello!' },
      { role: 'user', content: 'And line 1?' },
    ])
    expect(JSON.stringify(second)).not.toContain('a = 2')
  })

  it('on an empty sheet carries no listing, and the message still goes', async () => {
    const fake = fakeRequest('messages/answer.http')
    const conversation = createConversation()
    conversation.send('How do I write a range?', withThis(fake.request, null))
    await settled(conversation)
    expect(body(fake.sent[0]).system.map(({ text }) => text)).toEqual([INSTRUCTIONS, '# Math guide'])
    expect(conversation.state().entries[0]).toMatchObject({ kind: 'message', sent: { counts: null, listing: null } })
  })

  it('one answer at a time: no Send while one is arriving, and an empty message sends nothing', async () => {
    const fake = hanging()
    const conversation = createConversation()
    conversation.send('   ', withThis(fake.request))
    expect(fake.sent).toHaveLength(0)
    conversation.send('First', withThis(fake.request))
    conversation.send('Second', withThis(fake.request))
    expect(fake.sent).toHaveLength(1)
    conversation.stop()
    await settled(conversation)
  })

  it('a stream with no end mark is cut short, and Try again asks the same message with the sheet as it is now', async () => {
    const cut = fakeRequest('messages/cut-short.http')
    const conversation = createConversation()
    conversation.send('Check this sheet', withThis(cut.request))
    await settled(conversation)
    expect(answerOf(conversation).state).toBe('cut')
    expect(answerOf(conversation).text).not.toBe('')

    const good = fakeRequest('messages/answer.http')
    conversation.retry(withThis(good.request, 'E1  (no title)\n  1 | a = 9\n'))
    await settled(conversation)
    // What failed is replaced: one message, one answer.
    expect(conversation.state().entries.map((entry) => entry.kind)).toEqual(['message', 'answer'])
    expect(answerOf(conversation)).toMatchObject({ state: 'answer', text: 'Hello!' })
    expect(body(good.sent[0]).messages).toEqual([{ role: 'user', content: 'Check this sheet' }])
    expect(body(good.sent[0]).system[2].text).toContain('a = 9')
    expect(conversation.state().entries[0]).toMatchObject({ sent: { listing: 'E1  (no title)\n  1 | a = 9\n' } })
  })

  it('a failure is kept with what the provider said; nothing readable is its own', async () => {
    const conversation = createConversation()
    conversation.send('Hi', withThis(fakeRequest('messages/refused-key.http').request))
    await settled(conversation)
    expect(answerOf(conversation)).toMatchObject({ state: 'failed', failure: { kind: 'refusedKey' } })
    conversation.retry(withThis(fakeRequest(null).request))
    await settled(conversation)
    expect(answerOf(conversation)).toMatchObject({ state: 'failed', failure: { kind: 'nothing' } })
  })
})

describe('Stop, New chat and a closed sheet', () => {
  it('Stop cancels the request through its signal; what arrived stays, marked stopped', async () => {
    const fake = hanging('Half an answer')
    const conversation = createConversation()
    conversation.send('Check this sheet', withThis(fake.request))
    await vi.waitFor(() => expect(answerOf(conversation)).toMatchObject({ state: 'arriving', text: 'Half an answer' }))
    conversation.stop()
    await settled(conversation)
    expect(fake.sent[0].signal.aborted).toBe(true)
    expect(answerOf(conversation)).toMatchObject({ state: 'stopped', text: 'Half an answer' })
    // A stopped answer goes with the next Send as its text.
    expect(turnsOf(conversation.state().entries)).toEqual([
      { role: 'user', text: 'Check this sheet' },
      { role: 'assistant', text: 'Half an answer' },
    ])
  })

  it('New chat stops an arriving answer and empties the list; nothing of it comes back', async () => {
    const fake = hanging()
    const conversation = createConversation()
    conversation.send('Check this sheet', withThis(fake.request))
    conversation.clear()
    expect(fake.sent[0].signal.aborted).toBe(true)
    expect(conversation.state()).toMatchObject({ entries: [], busy: false })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(conversation.state().entries).toEqual([])
  })

  it('a closed sheet ends it: the request is cancelled, and the list and the field are empty', () => {
    const fake = hanging()
    const conversation = createConversation()
    conversation.setDraft('half typed')
    conversation.send('Check this sheet', withThis(fake.request))
    conversation.end()
    expect(fake.sent[0].signal.aborted).toBe(true)
    expect(conversation.state()).toEqual({ entries: [], busy: false, draft: '' })
  })
})

describe('no request it was not asked for', () => {
  it('time passing makes none: no timer gives up and nothing is asked again', async () => {
    vi.useFakeTimers()
    const fake = hanging()
    const conversation = createConversation()
    conversation.send('Check this sheet', withThis(fake.request))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0].signal.aborted).toBe(false)
    expect(conversation.state().busy).toBe(true)
    conversation.stop()
  })

  it('an answer that fails is not asked again until Try again', async () => {
    vi.useFakeTimers()
    const fake = fakeRequest(null)
    const conversation = createConversation()
    conversation.send('Hi', withThis(fake.request))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(fake.sent).toHaveLength(1)
  })

  it('Check key under a failed answer asks for the model list only, with the key', async () => {
    const conversation = createConversation()
    conversation.send('Hi', withThis(fakeRequest(null).request))
    await settled(conversation)
    const models = fakeRequest('messages/models.http')
    conversation.checkKey(answerOf(conversation).id, models.request, target)
    await settled(conversation)
    expect(answerOf(conversation).check).toEqual({ kind: 'accepted' })
    expect(models.sent.map(({ method, address, body }) => [method, address, body])).toEqual([
      ['GET', 'https://api.anthropic.com/v1/models', undefined],
    ])
  })
})
