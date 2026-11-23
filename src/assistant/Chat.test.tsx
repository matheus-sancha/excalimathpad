import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from '../text/en.ts'
import { ptBR } from '../text/ptBR.ts'
import { showLanguage } from '../text/words.ts'
import { AssistantTab } from './AssistantTab.tsx'
import { QUIET_MS } from './answerWords.ts'
import { createConversation, type Conversation } from './conversation.ts'
import { fakeRequest, type Sent } from './fixtures/load.ts'
import type { Listing } from './listing.ts'
import { sessionSetupStore, type AssistantRequest } from './ports.ts'
import { readSetup, setupText, type Setup } from './setup.ts'
import type { AssistantSheet, SheetNow } from './sheet.ts'

/**
 * The conversation in the tab (docs/spec-v1.md section 8, Math assistant, The conversation;
 * section 13's words), against the fake port and a fake sheet: the empty state, the field,
 * the first request's confirm, "Goes with your message", waiting, Stop and the failures.
 */
const w = en.assistant
const KEY = 'sk-test-9f3c7e21d8b64a05-a1B2'
const HOST = 'api.anthropic.com'

const listing: Listing = {
  kind: 'listing',
  text: 'unit system: SI with prefixes, Digits: 4\n\nE1  title: "Pipe flow"\n  1 | Q = 30 L/s\n    = (input)\n',
  counts: { elements: 2, lines: 5, texts: 1 },
  map: new Map(),
}
const twoElements: SheetNow = {
  listing,
  elements: [
    { name: 'Pipe flow', lines: 4 },
    { name: 'Element 2', lines: 1 },
  ],
  scene: { anchors: [], texts: [] },
  names: new Map(),
}

function fakeSheet(now: SheetNow = twoElements) {
  const sheet = { now: vi.fn(() => now), subscribe: () => () => {}, leaveLine: vi.fn(), jump: vi.fn() } satisfies AssistantSheet
  return sheet
}

const storeWith = (setup: Partial<Setup> = {}) => {
  const store = sessionSetupStore()
  store.write(setupText({ provider: 'anthropic', address: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', key: KEY, hosts: [HOST], ...setup }))
  return store
}

interface Drawn {
  sheet: ReturnType<typeof fakeSheet>
  conversation: Conversation
  store: ReturnType<typeof sessionSetupStore>
}

function draw(request: AssistantRequest, { setup = {}, now }: { setup?: Partial<Setup>; now?: SheetNow } = {}): Drawn {
  const sheet = fakeSheet(now)
  const conversation = createConversation()
  const store = storeWith(setup)
  render(<AssistantTab ports={{ request, store }} conversation={conversation} sheet={sheet} />)
  return { sheet, conversation, store }
}

const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: w.placeholder })
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const typeIn = (text: string) => fireEvent.change(field(), { target: { value: text } })
const answer = () => screen.getAllByTestId('assistant-answer').at(-1)!
const ended = () => waitFor(() => expect(answer().dataset.state).not.toMatch(/waiting|arriving/))

/** A request that sends `first`, then waits until it is aborted. */
function hanging(first: string | null = null) {
  const sent: Sent[] = []
  const request: AssistantRequest = (address, init) => {
    sent.push({ address, ...init })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (first !== null) {
          const data = JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: first } })
          controller.enqueue(new TextEncoder().encode(`event: content_block_delta\ndata: ${data}\n\n`))
        }
        init.signal.addEventListener('abort', () => controller.error(init.signal.reason))
      },
    })
    return Promise.resolve({ status: 200, headers: { get: () => null }, body })
  }
  return { request, sent }
}

afterEach(() => {
  showLanguage('en')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the tab with a setup saved', () => {
  it('is a column: New chat and the key button, the empty state, Goes with, the field and its hint', () => {
    draw(fakeRequest('messages/answer.http').request)
    expect(button(w.newChat)).toBeDisabled()
    expect(button(w.keyButton)).toBeEnabled()
    const list = screen.getByTestId('assistant-list')
    expect(list).toHaveTextContent(w.emptyAbout)
    expect(list).toHaveTextContent(w.emptySaved)
    for (const question of w.suggested) expect(within(list).getByRole('button', { name: question })).toBeEnabled()
    expect(screen.getByText(w.goesWith(2, 5, 1, HOST))).toBeInTheDocument()
    expect(field().tagName).toBe('TEXTAREA')
    expect(screen.getByText(w.fieldHint)).toBeInTheDocument()
    // Send is dimmed while the field is empty, and the chat's buttons never take the keyboard.
    expect(button(w.send)).toBeDisabled()
    for (const each of screen.getAllByRole('button')) expect(each).toHaveAttribute('tabindex', '-1')
  })

  it('is worded in Português when the app shows it', () => {
    showLanguage('pt-BR')
    draw(fakeRequest('messages/answer.http').request)
    expect(screen.getByText(ptBR.assistant.goesWith(2, 5, 1, HOST))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ptBR.assistant.suggested[0] })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: ptBR.assistant.placeholder })).toBeInTheDocument()
  })

  it('"Goes with your message" lists each math element with its line count when pressed', () => {
    draw(fakeRequest('messages/answer.http').request)
    fireEvent.click(screen.getByText(w.goesWith(2, 5, 1, HOST)))
    expect(screen.getByText(w.goesElement('Pipe flow', 4))).toBeInTheDocument()
    expect(screen.getByText(w.goesElement('Element 2', 1))).toBeInTheDocument()
    expect(screen.getByText(w.goesNote)).toBeInTheDocument()
  })

  it('on an empty sheet says so, and the message still goes', async () => {
    const fake = fakeRequest('messages/answer.http')
    draw(fake.request, { now: { listing: { kind: 'empty' }, elements: [], scene: twoElements.scene, names: twoElements.names } })
    expect(screen.getByText(w.goesWithEmpty(HOST))).toBeInTheDocument()
    typeIn('How do I write a range?')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    expect(fake.sent).toHaveLength(1)
  })

  it('a sheet over the cap refuses the Send in section 13’s words, and nothing is sent', () => {
    const fake = fakeRequest('messages/answer.http')
    const message = en.assistant.tooLong(412_300, 200_000)
    draw(fake.request, { now: { listing: { kind: 'tooLong', length: 412_300, limit: 200_000, message }, elements: [], scene: twoElements.scene, names: twoElements.names } })
    typeIn('Check it')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(fake.sent).toHaveLength(0)
    expect(field().value).toBe('Check it')
  })
})

describe('the field and Send', () => {
  it('Enter sends, Shift+Enter starts a new line, and the field empties after a Send', async () => {
    const fake = fakeRequest('messages/answer.http')
    const { sheet } = draw(fake.request)
    typeIn('Check this sheet')
    expect(fireEvent.keyDown(field(), { key: 'Enter', shiftKey: true })).toBe(true)
    expect(fake.sent).toHaveLength(0)
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(field().value).toBe('')
    expect(screen.getByTestId('assistant-message')).toHaveTextContent('Check this sheet')
    await ended()
    expect(answer()).toHaveTextContent('Hello!')
    expect(answer().dataset.state).toBe('answer')
    // The field had the keyboard: the line was left already, and isn't left again.
    expect(sheet.leaveLine).not.toHaveBeenCalled()
    expect(button(w.newChat)).toBeEnabled()
  })

  it('a suggested question sends itself, leaving the open line first', async () => {
    const fake = fakeRequest('messages/answer.http')
    const { sheet } = draw(fake.request)
    const drawn = sheet.now.mock.calls.length
    fireEvent.click(button(w.suggested[1]))
    expect(sheet.leaveLine).toHaveBeenCalled()
    // Left before the sheet is read for the Send.
    expect(sheet.leaveLine.mock.invocationCallOrder[0]).toBeLessThan(sheet.now.mock.invocationCallOrder[drawn])
    await ended()
    expect(JSON.parse(fake.sent[0].body!).messages).toEqual([{ role: 'user', content: 'What is missing?' }])
  })

  it('the first Send to an unconfirmed host asks once; Cancel sends nothing, Send confirms the host', async () => {
    const fake = fakeRequest('messages/answer.http')
    const { store } = draw(fake.request, { setup: { hosts: [] } })
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    const confirm = screen.getByTestId('assistant-first-request')
    expect(confirm).toHaveTextContent(w.first.send(HOST))
    expect(confirm).toHaveTextContent(w.keeps('Anthropic'))
    fireEvent.click(within(confirm).getByRole('button', { name: w.cancel }))
    expect(fake.sent).toHaveLength(0)
    expect(readSetup(store.read())?.hosts).toEqual([])
    expect(field().value).toBe('Check this sheet')

    fireEvent.keyDown(field(), { key: 'Enter' })
    fireEvent.click(within(screen.getByTestId('assistant-first-request')).getByRole('button', { name: w.first.sendButton }))
    await ended()
    expect(fake.sent).toHaveLength(1)
    expect(readSetup(store.read())?.hosts).toEqual([HOST])
    // Confirmed: the next Send asks nothing.
    typeIn('And now?')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(screen.queryByTestId('assistant-first-request')).toBeNull()
    await waitFor(() => expect(fake.sent).toHaveLength(2))
  })

  it('a typed address’s first Send says the app knows nothing about it', () => {
    draw(fakeRequest('chat/answer.http').request, {
      setup: { provider: 'other', address: 'https://llm.example.com/v1', model: 'local', key: '', hosts: [] },
    })
    typeIn('Hi')
    fireEvent.keyDown(field(), { key: 'Enter' })
    const confirm = screen.getByTestId('assistant-first-request')
    expect(confirm).toHaveTextContent(w.first.send('llm.example.com'))
    expect(confirm).toHaveTextContent(w.first.unknown)
  })
})

describe('waiting, Stop and time', () => {
  it('reads the sheet, Send becomes Stop, and Esc in the field stops it: what arrived stays', async () => {
    const fake = hanging('Half an answer')
    draw(fake.request)
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(answer()).toHaveTextContent(w.reading)
    expect(screen.queryByRole('button', { name: w.send })).toBeNull()
    expect(button(w.stop)).toBeInTheDocument()
    await waitFor(() => expect(answer()).toHaveTextContent('Half an answer'))
    expect(answer()).not.toHaveTextContent(w.reading)
    fireEvent.keyDown(field(), { key: 'Escape' })
    await ended()
    expect(fake.sent[0].signal.aborted).toBe(true)
    expect(answer()).toHaveTextContent('Half an answer')
    expect(answer()).toHaveTextContent(w.stopped)
    expect(button(w.send)).toBeInTheDocument()
  })

  it('Stop cancels it too', async () => {
    const fake = hanging()
    draw(fake.request)
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    fireEvent.click(button(w.stop))
    await ended()
    expect(answer()).toHaveTextContent(w.stopped)
  })

  it('after 30 seconds with nothing arriving the waiting line adds its hint, and nothing is cancelled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fake = hanging()
    draw(fake.request)
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(answer()).not.toHaveTextContent(w.stillWaiting(HOST))
    await act(() => vi.advanceTimersByTimeAsync(QUIET_MS + 10))
    expect(answer()).toHaveTextContent(w.reading)
    expect(answer()).toHaveTextContent(w.stillWaiting(HOST))
    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000))
    expect(fake.sent).toHaveLength(1)
    expect(fake.sent[0].signal.aborted).toBe(false)
    fireEvent.click(button(w.stop))
  })

  it('New chat stops an arriving answer and empties the list, asking nothing', async () => {
    const fake = hanging('Some')
    const { conversation } = draw(fake.request)
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    fireEvent.click(button(w.newChat))
    expect(fake.sent[0].signal.aborted).toBe(true)
    expect(conversation.state().entries).toEqual([])
    expect(screen.getByTestId('assistant-list')).toHaveTextContent(w.emptyAbout)
  })
})

describe('failures, each in section 13’s words', () => {
  const failWith = async (path: string | null, setup: Partial<Setup> = {}) => {
    const fake = fakeRequest(path)
    draw(fake.request, { setup })
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    return fake
  }

  it('a refused key, with the provider’s words and Try again', async () => {
    await failWith('messages/refused-key.http')
    expect(answer()).toHaveTextContent(w.refusedKey(HOST))
    expect(answer()).toHaveTextContent('Anthropic said: "')
    expect(within(answer()).getByRole('button', { name: w.tryAgain })).toBeInTheDocument()
    expect(within(answer()).queryByRole('button', { name: w.checkKey })).toBeNull()
  })

  it('the release’s default retired, and a typed model unknown', async () => {
    await failWith('messages/unknown-model.http')
    expect(answer()).toHaveTextContent(w.retired('Anthropic'))
  })

  it('a typed model unknown names it', async () => {
    await failWith('messages/unknown-model.http', { model: 'claude-made-up' })
    expect(answer()).toHaveTextContent(w.unknownModel('Anthropic', 'claude-made-up'))
  })

  it('no credit left, with where Anthropic’s is added', async () => {
    await failWith('messages/no-credit.http')
    expect(answer()).toHaveTextContent(w.noCredit)
    expect(answer()).toHaveTextContent(w.noCreditAnthropic)
  })

  it('any other error is quoted', async () => {
    await failWith('messages/stream-error.http')
    expect(answer()).toHaveTextContent('Anthropic said: "')
  })

  it('a cut-short answer keeps what arrived, with Try again, which replaces it', async () => {
    await failWith('messages/cut-short.http')
    expect(answer()).toHaveTextContent(w.cutShort)
    const kept = answer().textContent
    expect(kept).not.toBe(w.cutShort)
    fireEvent.click(within(answer()).getByRole('button', { name: w.tryAgain }))
    await ended()
    expect(screen.getAllByTestId('assistant-answer')).toHaveLength(1)
    expect(screen.getAllByTestId('assistant-message')).toHaveLength(1)
  })

  it('an answer that stops at the token cap with no text is cut short, never empty', async () => {
    await failWith('messages/max-tokens.http')
    expect(answer()).toHaveTextContent(w.cutShort)
  })

  it('nothing readable: Check key tells a refused key from no network', async () => {
    const fake = await failWith(null)
    expect(answer()).toHaveTextContent(w.noAnswer(HOST))
    expect(within(answer()).getByRole('button', { name: w.tryAgain })).toBeInTheDocument()
    // Check key again finds nothing: the origin the address must allow.
    fireEvent.click(within(answer()).getByRole('button', { name: w.checkKey }))
    await waitFor(() => expect(answer()).toHaveTextContent(w.noAnswerAgain(HOST, window.location.origin)))
    expect(fake.sent.at(-1)).toMatchObject({ method: 'GET', address: 'https://api.anthropic.com/v1/models' })
  })

  it('nothing readable, then Check key finds the key refused', async () => {
    const fake = fakeRequest(null)
    const refused = fakeRequest('messages/refused-key.http')
    let checking = false
    draw((address, init) => (checking ? refused.request(address, init) : fake.request(address, init)))
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    checking = true
    fireEvent.click(within(answer()).getByRole('button', { name: w.checkKey }))
    await waitFor(() => expect(answer()).toHaveTextContent(w.refusedKey(HOST)))
  })

  it('when the device says it is offline: "You’re offline.", with Try again only', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await failWith(null)
    expect(answer()).toHaveTextContent(w.offline)
    expect(within(answer()).queryByRole('button', { name: w.checkKey })).toBeNull()
    expect(within(answer()).getByRole('button', { name: w.tryAgain })).toBeInTheDocument()
  })
})

describe('the key button and Remove', () => {
  it('the key button opens the card in the field’s place; Remove keeps the conversation readable', async () => {
    const fake = fakeRequest('messages/answer.http')
    draw(fake.request)
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    fireEvent.click(button(w.keyButton))
    expect(screen.queryByRole('textbox', { name: w.placeholder })).toBeNull()
    expect(screen.getByText(w.savedKey('a1B2'))).toBeInTheDocument()
    fireEvent.click(button(w.remove))
    expect(screen.getByText(w.keyRemoved)).toBeInTheDocument()
    expect(answer()).toHaveTextContent('Hello!')
    // With no key, the key button no longer brings the field back.
    fireEvent.click(button(w.keyButton))
    expect(screen.queryByRole('textbox', { name: w.placeholder })).toBeNull()
  })
})

/** A request whose answer is `text`, whole, in Anthropic's stream. */
function answering(text: string) {
  const sent: Sent[] = []
  const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`
  const request: AssistantRequest = (address, init) => {
    sent.push({ address, ...init })
    const stream =
      event('content_block_delta', { type: 'content_block_delta', delta: { type: 'text_delta', text } }) +
      event('message_stop', { type: 'message_stop' })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(stream))
        controller.close()
      },
    })
    return Promise.resolve({ status: 200, headers: { get: () => null }, body })
  }
  return { request, sent }
}

describe("the answer's form", () => {
  // The Send's map: Pipe flow's third line, an element with no title, and a text.
  const mapped: SheetNow = {
    ...twoElements,
    listing: {
      ...listing,
      map: new Map([
        ['E1', { kind: 'element', anchorId: 'a-1', title: 'Pipe flow' }],
        ['E1:2', { kind: 'line', anchorId: 'a-1', line: 1, text: 'v = Q / A' }],
        ['E1:3', { kind: 'line', anchorId: 'a-1', line: 2, text: 'Re = rho*v*D/mu' }],
        ['E2', { kind: 'element', anchorId: 'a-2', title: null }],
        ['E2:1', { kind: 'line', anchorId: 'a-2', line: 0, text: 'x = 1' }],
        ['T1', { kind: 'text', textId: 't-1', text: 'Pump sizing, rev B' }],
      ]),
    },
    // Since the Send: line 2 was edited, and Element 2 was deleted.
    scene: {
      anchors: [{ id: 'a-1', source: 'Q = 30 L/s\nv = Q / (2 m^2)\nRe = rho*v*D/mu' }],
      texts: [{ id: 't-1', text: 'Pump sizing, rev B' }],
    },
    names: new Map([['a-1', 'Pipe flow']]),
  }
  const text = '**Units** are fine at [E1:3] and [T1]. Check [E1:2], [E2:1] and [E7:1].\n\n1. `A` is never defined in [E1].'

  it('draws the small Markdown, each reference a chip in the panel’s words', async () => {
    const { sheet } = draw(answering(text).request, { now: mapped })
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    const drawn = answer()
    expect(drawn.querySelector('strong')).toHaveTextContent('Units')
    expect(drawn.querySelector('ol li code')).toHaveTextContent('A')

    // A chip that jumps: the Problems row's jump, its line flashed; it never takes the keyboard.
    const line3 = within(drawn).getByRole('button', { name: 'Pipe flow, line 3' })
    expect(line3).toHaveAttribute('tabindex', '-1')
    expect(fireEvent.mouseDown(line3)).toBe(false)
    fireEvent.click(line3)
    expect(sheet.jump).toHaveBeenLastCalledWith({ id: 'a-1', line: 2 })
    fireEvent.click(within(drawn).getByRole('button', { name: 'Pump sizing, rev B' }))
    expect(sheet.jump).toHaveBeenLastCalledWith({ id: 't-1', line: null })
    fireEvent.click(within(drawn).getByRole('button', { name: 'Pipe flow' }))
    expect(sheet.jump).toHaveBeenLastCalledWith({ id: 'a-1', line: null })

    // Its line changed: it says so, and jumps to the element with no flash.
    fireEvent.click(within(drawn).getByRole('button', { name: w.changed('Pipe flow, line 2', 'line') }))
    expect(sheet.jump).toHaveBeenLastCalledWith({ id: 'a-1', line: null })

    // Its element is gone: struck through, and nothing to press.
    const gone = drawn.querySelector('[data-chip="E2:1"]')!
    expect(gone.tagName).toBe('S')
    expect(gone).toHaveTextContent('Element 2, line 1')
    // A label in no map is the text the model wrote.
    expect(drawn.querySelector('[data-chip="E7:1"]')).toBeNull()
    expect(drawn).toHaveTextContent('and [E7:1].')
    expect(sheet.jump).toHaveBeenCalledTimes(4)
  })

  it('is worded in Português when the app shows it', async () => {
    showLanguage('pt-BR')
    draw(answering(text).request, { now: mapped })
    const ptField = screen.getByRole('textbox', { name: ptBR.assistant.placeholder })
    fireEvent.change(ptField, { target: { value: 'Verifique' } })
    fireEvent.keyDown(ptField, { key: 'Enter' })
    await ended()
    expect(within(answer()).getByRole('button', { name: 'Pipe flow, linha 2 · alterada' })).toBeInTheDocument()
    expect(answer().querySelector('[data-chip="E2:1"]')).toHaveTextContent('Bloco 2, linha 1')
  })

  it('draws an answer as it arrives, holding back a label not yet whole', async () => {
    const { request } = hanging('**Units** at [E1:')
    draw(request, { now: mapped })
    typeIn('Check')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await waitFor(() => expect(answer().dataset.state).toBe('arriving'))
    expect(answer().querySelector('strong')).toHaveTextContent('Units')
    expect(answer()).not.toHaveTextContent('[E1:')
    fireEvent.click(button(w.stop))
    await ended()
  })

  it('"Sent with this" under a message opens the listing as it was sent, read-only', async () => {
    draw(answering('Fine.').request, { now: mapped })
    typeIn('Check this sheet')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    const under = button(w.sentWith(2, 5, 1))
    expect(under).toHaveAttribute('aria-expanded', 'false')
    expect(under).toHaveAttribute('tabindex', '-1')
    fireEvent.click(under)
    const opened = screen.getByRole('region', { name: w.sentHeading })
    expect(opened).toHaveTextContent(w.sentHeading)
    expect(within(opened).getByTestId('assistant-sent-listing').textContent).toBe(listing.text)
    expect(opened).toHaveTextContent(w.sentLast)
    // Read-only: nothing in it takes typing.
    expect(within(opened).queryByRole('textbox')).toBeNull()
    fireEvent.click(under)
    expect(screen.queryByRole('region', { name: w.sentHeading })).toBeNull()
  })

  it('"Sent with this" on an empty sheet says so, with nothing to open', async () => {
    draw(answering('Use `x = 0 .. 5`.').request, { now: { ...mapped, listing: { kind: 'empty' } } })
    typeIn('How do I write a range?')
    fireEvent.keyDown(field(), { key: 'Enter' })
    await ended()
    expect(screen.getByText(w.sentWithEmpty).tagName).toBe('P')
  })
})
