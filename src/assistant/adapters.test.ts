import { describe, expect, it } from 'vitest'
import { ANTHROPIC_VERSION, ask, listModels, MAX_TOKENS, modelsRequest, sendRequest, type Carried, type Outcome, type Target } from './adapters.ts'
import { readFailure } from './errors.ts'
import { fakeRequest, FIXTURES, fixture, piecesOf } from './fixtures/load.ts'
import type { AssistantRequest } from './ports.ts'
import { PROVIDERS } from './providers.ts'
import { readEvents } from './stream.ts'

/** The adapters, the stream reader and the error reader (docs/spec-v1.md section 14, 0.7.0; section 13, Math assistant). */

const CANARY = 'sk-canary-0123456789abcdefWXYZ'

const anthropic: Target = { address: 'https://api.anthropic.com', adapter: 'messages', provider: 'anthropic', key: CANARY }
const openai: Target = { address: 'https://api.openai.com/v1', adapter: 'chat', provider: 'openai', key: CANARY }
const openrouter: Target = { ...openai, address: 'https://openrouter.ai/api/v1', provider: 'openrouter' }
const google: Target = { ...openai, address: 'https://generativelanguage.googleapis.com/v1beta/openai', provider: 'google' }
const typed: Target = { address: 'http://localhost:11434/v1', adapter: 'chat', provider: null, key: '' }

const carried: Carried = {
  model: 'claude-sonnet-5-5',
  instructions: 'You are the Math assistant.',
  guide: '# Math guide\n\nEvery form.',
  listing: 'E1\n1 Q = 30 L/s = 30 L/s',
  conversation: [
    { role: 'user', text: 'Check this sheet' },
    { role: 'assistant', text: 'It reads well.' },
  ],
  message: 'What is missing?',
}

const run = async (target: Target, path: string | null, size = 7) => {
  const { request, sent } = fakeRequest(path, size)
  const texts: string[] = []
  const outcome = await ask(request, target, carried, new AbortController().signal, (text) => texts.push(text))
  return { outcome, sent, texts }
}

describe("each adapter's request", () => {
  it('Messages: POST <base>/v1/messages, the key in a Bearer header, and only the carried fields', () => {
    const { address, method, headers, body } = sendRequest(anthropic, carried)
    expect([address, method]).toEqual(['https://api.anthropic.com/v1/messages', 'POST'])
    expect(headers).toEqual({
      'content-type': 'application/json',
      authorization: `Bearer ${CANARY}`,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    })
    expect(JSON.parse(body ?? '')).toEqual({
      model: 'claude-sonnet-5-5',
      max_tokens: MAX_TOKENS,
      stream: true,
      system: [
        { type: 'text', text: carried.instructions },
        { type: 'text', text: carried.guide, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: carried.listing },
      ],
      messages: [
        { role: 'user', content: 'Check this sheet' },
        { role: 'assistant', content: 'It reads well.' },
        { role: 'user', content: 'What is missing?' },
      ],
    })
    expect(MAX_TOKENS).toBe(32_000)
  })

  it('Chat Completions: POST <base>/chat/completions, the key in a Bearer header, and only the carried fields', () => {
    const { address, method, headers, body } = sendRequest(openrouter, { ...carried, model: 'anthropic/claude-sonnet-5.5' })
    expect([address, method]).toEqual(['https://openrouter.ai/api/v1/chat/completions', 'POST'])
    expect(headers).toEqual({ 'content-type': 'application/json', authorization: `Bearer ${CANARY}` })
    expect(JSON.parse(body ?? '')).toEqual({
      model: 'anthropic/claude-sonnet-5.5',
      stream: true,
      messages: [
        { role: 'system', content: `${carried.instructions}\n\n${carried.guide}\n\n${carried.listing}` },
        { role: 'user', content: 'Check this sheet' },
        { role: 'assistant', content: 'It reads well.' },
        { role: 'user', content: 'What is missing?' },
      ],
    })
  })

  it('an empty sheet sends no listing; a typed address with no key sends no authorization', () => {
    const empty = { ...carried, listing: null }
    expect(JSON.parse(sendRequest(anthropic, empty).body ?? '').system).toHaveLength(2)
    expect(JSON.parse(sendRequest(typed, empty).body ?? '').messages[0].content).toBe(
      `${carried.instructions}\n\n${carried.guide}`,
    )
    expect(sendRequest(typed, empty)).toMatchObject({
      address: 'http://localhost:11434/v1/chat/completions',
      headers: { 'content-type': 'application/json' },
    })
    expect(sendRequest(typed, empty).headers).not.toHaveProperty('authorization')
  })

  it.each([
    ['Messages', anthropic],
    ['Chat Completions', openai],
  ])('%s: the fixed start is the same bytes on two Sends', (_, target) => {
    const first = sendRequest(target, carried).body ?? ''
    const second =
      sendRequest(target, {
        ...carried,
        listing: 'E1\n1 Q = 25 L/s = 25 L/s',
        conversation: [...carried.conversation, { role: 'user', text: 'What is missing?' }, { role: 'assistant', text: 'A source.' }],
        message: 'And now?',
      }).body ?? ''
    // Up to the end of the guide, and its cache mark on Messages.
    const encoded = (text: string) => JSON.stringify(text).slice(1, -1)
    const guide = encoded(carried.guide)
    const start = first.slice(0, first.indexOf(guide) + guide.length)
    expect(start).toContain(encoded(carried.instructions))
    expect(second.startsWith(start)).toBe(true)
    expect(second).not.toBe(first)
  })

  it.each([
    [anthropic, 'https://api.anthropic.com/v1/models'],
    [openai, 'https://api.openai.com/v1/models'],
    [google, 'https://generativelanguage.googleapis.com/v1beta/openai/models'],
    [openrouter, 'https://openrouter.ai/api/v1/models'],
  ])('the model list is GET <base>/models with the key and nothing of the sheet (%#)', (target, address) => {
    const built = modelsRequest(target)
    expect(built).toEqual({
      address,
      method: 'GET',
      headers: {
        authorization: `Bearer ${CANARY}`,
        ...(target.adapter === 'messages'
          ? { 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' }
          : {}),
      },
    })
  })
})

describe('the stream reader', () => {
  const read = async (text: string, size: number) => {
    const events = []
    for await (const event of readEvents(piecesOf(text, size), new AbortController().signal)) events.push(event)
    return events
  }

  it('carries an event cut between two pieces, at every size, and skips comments', async () => {
    const text = ': OPENROUTER PROCESSING\n\nevent: a\ndata: {"t":"é ü"}\n\ndata: one\ndata: two\r\n\r\ndata:[DONE]\n\n'
    const whole = [
      { event: 'a', data: '{"t":"é ü"}' },
      { event: '', data: 'one\ntwo' },
      { event: '', data: '[DONE]' },
    ]
    for (const size of [1, 2, 3, 5, 8, 13, text.length]) expect(await read(text, size), `${size}`).toEqual(whole)
  })

  it('gives the last event when the stream ends without its blank line', async () => {
    expect(await read('data: last', 3)).toEqual([{ event: '', data: 'last' }])
  })
})

describe('each adapter on every fixture', () => {
  const sizes = [1, 7, 64, 100_000]

  it.each<[string, Target, Outcome]>([
    ['messages/answer.http', anthropic, { kind: 'answer', text: 'Hello!' }],
    ['messages/answer-pieces.http', anthropic, { kind: 'answer', text: 'Hello!' }],
    ['messages/cut-short.http', anthropic, { kind: 'cut', text: 'Hello', cap: false }],
    ['messages/max-tokens.http', anthropic, { kind: 'cut', text: '', cap: true }],
    [
      'messages/stream-error.http',
      anthropic,
      { kind: 'failed', failure: { kind: 'other', said: 'Overloaded' }, text: '' },
    ],
    [
      'messages/refused-key.http',
      anthropic,
      { kind: 'failed', failure: { kind: 'refusedKey', said: 'Invalid bearer token' }, text: '' },
    ],
    [
      'messages/no-credit.http',
      anthropic,
      {
        kind: 'failed',
        failure: { kind: 'noCredit', said: 'Your credit balance is too low to access the Anthropic API.' },
        text: '',
      },
    ],
    [
      'messages/unknown-model.http',
      anthropic,
      { kind: 'failed', failure: { kind: 'unknownModel', said: 'model: no-such-model-excalimathpad' }, text: '' },
    ],
    ['chat/answer.http', openai, { kind: 'answer', text: 'Hello!' }],
    ['chat/openrouter-answer.http', openrouter, { kind: 'answer', text: 'Hello!' }],
    ['chat/cut-short.http', openai, { kind: 'cut', text: 'Hello', cap: false }],
    ['chat/length.http', openai, { kind: 'cut', text: 'Hello', cap: true }],
    [
      'chat/openrouter-stream-error.http',
      openrouter,
      { kind: 'failed', failure: { kind: 'other', said: 'Provider disconnected unexpectedly' }, text: '' },
    ],
    [
      'chat/refused-key.http',
      openai,
      { kind: 'failed', failure: { kind: 'refusedKey', said: 'Incorrect API key provided: …' }, text: '' },
    ],
    [
      'chat/google-refused-key.http',
      google,
      { kind: 'failed', failure: { kind: 'refusedKey', said: 'Please pass a valid API key' }, text: '' },
    ],
    [
      'chat/openai-no-credit.http',
      openai,
      { kind: 'failed', failure: { kind: 'noCredit', said: 'Your organization has no prepaid credits remaining.' }, text: '' },
    ],
    [
      'chat/openrouter-no-credit.http',
      openrouter,
      {
        kind: 'failed',
        failure: {
          kind: 'noCredit',
          said: 'Your account or API key has insufficient credits. Add more credits and retry the request.',
        },
        text: '',
      },
    ],
    [
      'chat/unknown-model.http',
      openai,
      {
        kind: 'failed',
        failure: { kind: 'unknownModel', said: 'The model `gpt-0` does not exist or you do not have access to it.' },
        text: '',
      },
    ],
  ])('%s', async (path, target, expected) => {
    for (const size of sizes) expect((await run(target, path, size)).outcome, `${size}`).toEqual(expected)
  })

  it('every fixture is read by a case here, and says where it is from', () => {
    for (const [path] of Object.entries(FIXTURES)) {
      expect(fixture(path).from[0], path).toMatch(/^(from documentation, \d{4}-\d\d-\d\d, https:\/\/\S+|recorded \d{4}-\d\d-\d\d from \S+)/)
      expect(fixture(path).status, path).toBeGreaterThan(0)
    }
    expect(Object.keys(FIXTURES).sort()).toEqual(
      [
        'chat/answer.http',
        'chat/cut-short.http',
        'chat/google-refused-key.http',
        'chat/length.http',
        'chat/models.http',
        'chat/openai-no-credit.http',
        'chat/openrouter-answer.http',
        'chat/openrouter-no-credit.http',
        'chat/openrouter-stream-error.http',
        'chat/refused-key.http',
        'chat/unknown-model.http',
        'messages/answer.http',
        'messages/answer-pieces.http',
        'messages/cut-short.http',
        'messages/max-tokens.http',
        'messages/models.http',
        'messages/no-credit.http',
        'messages/refused-key.http',
        'messages/stream-error.http',
        'messages/unknown-model.http',
      ].sort(),
    )
  })

  it('no fixture holds text shaped like a key', () => {
    const shapes = [
      /sk-ant-[\w-]{8,}/,
      /sk-or-v1-[0-9a-f]{16,}/,
      /sk-(proj-)?[A-Za-z0-9_-]{20,}/,
      /AIza[0-9A-Za-z_-]{20,}/,
      /Bearer\s+[A-Za-z0-9._-]{12,}/i,
      /xai-[A-Za-z0-9]{20,}/,
    ]
    for (const [path, text] of Object.entries(FIXTURES))
      for (const shape of shapes) expect(shape.test(text), `${path}: ${shape}`).toBe(false)
    // The canary is shaped like one, so the test can catch it.
    expect(shapes.some((shape) => shape.test(CANARY))).toBe(true)
  })

  it('gives the text as it arrives, each time the whole text so far', async () => {
    expect((await run(anthropic, 'messages/answer-pieces.http', 1)).texts).toEqual(['Hello', 'Hello!'])
    expect((await run(openai, 'chat/answer.http', 3)).texts).toEqual(['Hello', 'Hello!'])
  })
})

describe('the outcomes no fixture holds', () => {
  it('a failure with nothing readable is its own outcome', async () => {
    for (const target of [anthropic, openai])
      expect((await run(target, null)).outcome).toEqual({ kind: 'failed', failure: { kind: 'nothing' }, text: '' })
  })

  it('a connection that drops in the middle keeps what arrived, as cut short', async () => {
    const request: AssistantRequest = () => {
      let sent = false
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent) return controller.error(new TypeError('network error'))
          sent = true
          controller.enqueue(new TextEncoder().encode(fixture('chat/cut-short.http').body))
        },
      })
      return Promise.resolve({ status: 200, headers: { get: () => null }, body })
    }
    expect(await ask(request, openai, carried, new AbortController().signal, () => {})).toEqual({
      kind: 'cut',
      text: 'Hello',
      cap: false,
    })
  })

  it('an abort stops the answer and keeps what arrived; one before the request sends nothing readable', async () => {
    const stop = new AbortController()
    const { request } = fakeRequest('messages/answer-pieces.http', 1)
    const outcome = await ask(request, anthropic, carried, stop.signal, () => stop.abort())
    expect(outcome).toEqual({ kind: 'stopped', text: 'Hello' })

    const early = new AbortController()
    early.abort()
    expect(await ask(fakeRequest('chat/answer.http').request, openai, carried, early.signal, () => {})).toEqual({
      kind: 'stopped',
      text: '',
    })
  })

  it('a stream that never ends is ended by the abort, and its body is cancelled', async () => {
    let cancelled = false
    const stop = new AbortController()
    const request: AssistantRequest = () =>
      Promise.resolve({
        status: 200,
        headers: { get: () => null },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(fixture('chat/cut-short.http').body))
          },
          cancel() {
            cancelled = true
          },
        }),
      })
    const outcome = ask(request, openai, carried, stop.signal, () => setTimeout(() => stop.abort(), 5))
    expect(await outcome).toEqual({ kind: 'stopped', text: 'Hello' })
    expect(cancelled).toBe(true)
  })
})

describe('the error reader', () => {
  it('reads each no-credit answer only at its own provider; a typed address gets the quoted message', () => {
    const anthropicBody = fixture('messages/no-credit.http').body
    const openaiBody = fixture('chat/openai-no-credit.http').body
    const openrouterBody = fixture('chat/openrouter-no-credit.http').body
    expect(readFailure(400, anthropicBody, 'anthropic', '').kind).toBe('noCredit')
    expect(readFailure(429, openaiBody, 'openai', '').kind).toBe('noCredit')
    expect(readFailure(402, openrouterBody, 'openrouter', '').kind).toBe('noCredit')
    for (const provider of [null, 'google'] as const) {
      expect(readFailure(400, anthropicBody, provider, '').kind).toBe('other')
      expect(readFailure(429, openaiBody, provider, '').kind).toBe('other')
      expect(readFailure(402, openrouterBody, provider, '').kind).toBe('other')
    }
    // OpenAI's older code, and its type alone, read the same.
    const quota = '{"error":{"message":"You exceeded your current quota.","type":"insufficient_quota","code":"insufficient_quota"}}'
    expect(readFailure(429, quota, 'openai', '')).toEqual({ kind: 'noCredit', said: 'You exceeded your current quota.' })
    // A rate limit is not "no credit".
    const limit = '{"error":{"message":"Rate limit reached","type":"rate_limit_error","code":"slow_down"}}'
    expect(readFailure(429, limit, 'openai', '').kind).toBe('other')
  })

  it("reads OpenRouter's 403, a guardrail or a budget, as the provider's words, not a refused key", () => {
    const budget = '{"error":{"code":403,"message":"Budget limit exceeded (weekly limit). Contact your org admin."}}'
    expect(readFailure(403, budget, 'openrouter', '')).toEqual({
      kind: 'other',
      said: 'Budget limit exceeded (weekly limit). Contact your org admin.',
    })
    expect(readFailure(403, '{"type":"error","error":{"type":"permission_error","message":"No"}}', 'anthropic', '').kind).toBe(
      'refusedKey',
    )
  })

  it('finds the message in each of the six shapes, and quotes a plain body or the status', () => {
    expect(readFailure(400, '{"code":"x","error":"As a string"}', null, '').kind === 'other').toBe(true)
    expect(readFailure(400, '{"code":"x","error":"As a string"}', null, '')).toEqual({ kind: 'other', said: 'As a string' })
    expect(readFailure(422, '{"detail":"Mistral says"}', null, '')).toEqual({ kind: 'other', said: 'Mistral says' })
    expect(readFailure(400, '{"message":"Cerebras says","type":"t","code":"c"}', null, '')).toEqual({
      kind: 'other',
      said: 'Cerebras says',
    })
    expect(readFailure(500, 'upstream timed out', null, '')).toEqual({ kind: 'other', said: 'upstream timed out' })
    expect(readFailure(502, '<html><body>Bad gateway</body></html>', null, '')).toEqual({ kind: 'other', said: 'HTTP 502' })
    expect(readFailure(503, '', null, '')).toEqual({ kind: 'other', said: 'HTTP 503' })
  })

  it('replaces a verbatim copy of the key by "…" and its last four characters', () => {
    const body = JSON.stringify({ error: { message: `Incorrect API key provided: ${CANARY}. Check ${CANARY}.` } })
    expect(readFailure(401, body, 'openai', CANARY)).toEqual({
      kind: 'refusedKey',
      said: 'Incorrect API key provided: …WXYZ. Check …WXYZ.',
    })
  })
})

describe('the model list', () => {
  it('gives the names, or the refusal read as a Send is', async () => {
    expect(await listModels(fakeRequest('chat/models.http').request, openai, new AbortController().signal)).toEqual({
      kind: 'models',
      names: ['model-id-0', 'model-id-1'],
    })
    // Every id of the list, in its order; re-recorded, the list changes, so the fixture says which.
    const recorded = (JSON.parse(fixture('messages/models.http').body) as { data: { id: string }[] }).data.map(({ id }) => id)
    expect(recorded.length).toBeGreaterThan(1)
    expect(recorded).toContain(PROVIDERS.find(({ id }) => id === 'anthropic')?.defaultModel)
    expect(await listModels(fakeRequest('messages/models.http').request, anthropic, new AbortController().signal)).toEqual({
      kind: 'models',
      names: recorded,
    })
    expect(await listModels(fakeRequest('chat/refused-key.http').request, openai, new AbortController().signal)).toEqual({
      kind: 'failed',
      failure: { kind: 'refusedKey', said: 'Incorrect API key provided: …' },
    })
    expect(await listModels(fakeRequest(null).request, openai, new AbortController().signal)).toEqual({
      kind: 'failed',
      failure: { kind: 'nothing' },
    })
    // A 200 that isn't a list.
    expect(await listModels(fakeRequest('chat/answer.http').request, openai, new AbortController().signal)).toMatchObject({
      kind: 'failed',
      failure: { kind: 'other' },
    })
  })
})

describe('the canary key', () => {
  it('shows nowhere but a request’s header', async () => {
    const reflected = JSON.stringify({ error: { message: `Bad key ${CANARY}` } })
    for (const [target, path] of [
      [anthropic, 'messages/answer.http'],
      [anthropic, 'messages/refused-key.http'],
      [openai, 'chat/answer.http'],
      [openrouter, 'chat/openrouter-stream-error.http'],
      [google, 'chat/google-refused-key.http'],
    ] as const) {
      const { outcome, sent, texts } = await run(target, path)
      const models = fakeRequest(path)
      await listModels(models.request, target, new AbortController().signal)
      for (const { address, headers, body, method } of [...sent, ...models.sent]) {
        expect(JSON.stringify({ address, body, method }), path).not.toContain(CANARY)
        expect(Object.entries(headers).filter(([, value]) => value.includes(CANARY))).toEqual([
          ['authorization', `Bearer ${CANARY}`],
        ])
      }
      expect(JSON.stringify([outcome, texts]), path).not.toContain(CANARY)
    }
    expect(JSON.stringify(readFailure(401, reflected, 'anthropic', CANARY))).not.toContain(CANARY)
  })
})
