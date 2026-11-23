import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import App from '../App.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { en } from '../text/en.ts'
import { fakeRequest, type Sent } from './fixtures/load.ts'
import { sessionSetupStore, type AssistantPorts, type AssistantRequest } from './ports.ts'
import { setupText } from './setup.ts'

/**
 * The conversation in the real app, against the real Excalidraw (docs/spec-v1.md section 8,
 * Math assistant, The conversation; section 12a, Network only for the Math assistant, only on
 * a press; section 14, 0.7.0): held above the tab, so it outlives the tab and the panel; the
 * field passes no key to Excalidraw and leaves the open line; a Send carries the sheet as it
 * is; only a press makes a request; and another sheet opened ends it.
 */
const w = en.assistant
const KEY = 'sk-test-9f3c7e21d8b64a05-a1B2'

function editorWidth(width: number) {
  const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => width })
  onTestFinished(() => void Object.defineProperty(Element.prototype, 'clientWidth', client))
}

const sheet = () =>
  createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'a = 2\nb = a + 1', title: 'Pipe flow' }])

/** The app with a saved setup for Anthropic, its host confirmed, and `request` as its port. */
async function start(request: AssistantRequest, files = fakeFileAccess()) {
  editorWidth(1440)
  const store = sessionSetupStore()
  store.write(
    setupText({ provider: 'anthropic', address: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', key: KEY, hosts: ['api.anthropic.com'] }),
  )
  const record = vi.fn(request)
  const ports: AssistantPorts = { request: record, store }
  const panelMemory = { rememberedOpen: () => false, rememberOpen: () => {}, rememberedWidth: () => null, rememberWidth: () => {} }
  render(<App files={files} recovery={fakeRecovery()} initialElements={sheet()} panelMemory={panelMemory} assistant={ports} />)
  await screen.findByTestId('file-name')
  await screen.findAllByRole('list', { name: 'Lines' })
  return { request: record, files }
}

async function openTab() {
  if (!document.querySelector('.math-tools')) fireEvent.click(await screen.findByTitle('More tools'))
  await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /^Math assistant/ }))
  return screen.findByTestId('assistant-tab')
}
const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: w.placeholder })
const lineField = () => screen.queryByRole<HTMLTextAreaElement>('textbox', { name: 'Line source' })
const answers = () => screen.queryAllByTestId('assistant-answer')
const mathElements = () => screen.queryAllByRole('list', { name: 'Lines' })
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)))
const listingOf = (sent: Sent) => (JSON.parse(sent.body!) as { system: { text: string }[] }).system[2]?.text ?? null

async function send(text: string) {
  fireEvent.change(field(), { target: { value: text } })
  fireEvent.keyDown(field(), { key: 'Enter' })
}

/** A request that answers `first` and waits until it is aborted, or until `finish` ends it. */
function slow(first: string) {
  const sent: Sent[] = []
  let finish = () => {}
  const request: AssistantRequest = (address, init) => {
    sent.push({ address, ...init })
    const encoder = new TextEncoder()
    const delta = (text: string) =>
      encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })}\n\n`)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(delta(first))
        finish = () => {
          controller.enqueue(delta(' and the rest.'))
          controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'))
          controller.close()
        }
        init.signal.addEventListener('abort', () => controller.error(init.signal.reason))
      },
    })
    return Promise.resolve({ status: 200, headers: { get: () => null }, body })
  }
  return { request, sent, finish: () => finish() }
}

describe('the conversation lives above the tab', () => {
  it('survives switching the panel’s tab and closing the panel, and an answer keeps arriving while hidden', async () => {
    const answer = slow('Half')
    await start(answer.request)
    await openTab()
    await send('Check this sheet')
    await waitFor(() => expect(answers()[0]).toHaveTextContent('Half'))

    // Another tab shows: Excalidraw removes the chat's content, and the answer goes on arriving.
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Variables' }))
    await waitFor(() => expect(screen.queryByTestId('assistant-tab')).toBeNull())
    await act(async () => answer.finish())
    await settle()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Math assistant' }))
    const tab = await screen.findByTestId('assistant-tab')
    expect(within(tab).getByTestId('assistant-message')).toHaveTextContent('Check this sheet')
    expect(answers()[0]).toHaveTextContent('Half and the rest.')
    expect(answers()[0].dataset.state).toBe('answer')

    // The panel closed and opened again: still there.
    fireEvent.click(await screen.findByTitle('More tools'))
    await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /^Math assistant/ }))
    await waitFor(() => expect(screen.queryByTestId('assistant-tab')).toBeNull())
    await openTab()
    expect(answers()[0]).toHaveTextContent('Half and the rest.')
    expect(answer.sent).toHaveLength(1)
  })

  it('ends when another sheet is opened here', async () => {
    const files = fakeFileAccess()
    const { request } = await start(fakeRequest('messages/answer.http').request, files)
    await openTab()
    await send('Check this sheet')
    await waitFor(() => expect(answers()[0]?.dataset.state).toBe('answer'))
    expect(request).toHaveBeenCalledTimes(1)

    // Open another sheet (Ctrl+O); the sheet is clean after its answer, so nothing is asked.
    files.open.mockResolvedValue({ name: 'Other.excalidraw', text: JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {} }), handle: null })
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'o', ctrlKey: true, bubbles: true, cancelable: true }))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    await waitFor(() => expect(screen.getByTestId('file-name')).toHaveTextContent('Other'))
    await waitFor(() => expect(screen.queryByTestId('assistant-message')).toBeNull())
    expect(screen.getByTestId('assistant-list')).toHaveTextContent(w.emptyAbout)
  })
})

describe('the field', () => {
  it('passes no key to Excalidraw with a math element selected: m r 1 d, Delete, Backspace', async () => {
    await start(fakeRequest('messages/answer.http').request)
    await openTab()
    const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
    fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
    field().focus()

    for (const [key, code] of [['m', 'KeyM'], ['r', 'KeyR'], ['1', 'Digit1'], ['d', 'KeyD'], ['Delete', 'Delete'], ['Backspace', 'Backspace']])
      fireEvent.keyDown(field(), { key, code })
    await settle()

    expect(mathElements()).toHaveLength(1)
    expect(document.querySelector('[data-testid="toolbar-rectangle"]')).not.toBeChecked()
    expect(document.querySelector('.math-placing')).toBeNull()
    expect(field()).toHaveFocus()
    // The control: the same key on the canvas deletes the selected math.
    fireEvent.keyDown(excalidraw, { key: 'Delete', code: 'Delete' })
    await waitFor(() => expect(mathElements()).toHaveLength(0))
  })

  it('leaves the open line, and the next Send carries the sheet as fixed', async () => {
    const fake = fakeRequest('messages/answer.http')
    await start(fake.request)
    await openTab()
    await send('Check this sheet')
    await waitFor(() => expect(answers()[0]?.dataset.state).toBe('answer'))
    expect(listingOf(fake.sent[0])).toContain('  1 | a = 2')

    // Fix a line, then press in the chat's field: the line is left, and the Send reads it.
    const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
    fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
    fireEvent.keyDown(excalidraw, { key: 'Enter', code: 'Enter' })
    await waitFor(() => expect(lineField()).not.toBeNull())
    const before = lineField()!.value
    fireEvent.input(lineField()!, { target: { value: `${before} + 3` } })
    act(() => field().focus())
    await waitFor(() => expect(lineField()).toBeNull())
    await send('And now?')
    await waitFor(() => expect(answers()[1]?.dataset.state).toBe('answer'))
    expect(listingOf(fake.sent[0])).not.toContain(`| ${before} + 3`)
    expect(listingOf(fake.sent[1])).toContain(`| ${before} + 3`)
  })
})

describe('only a press makes a request', () => {
  it('opening the tab, typing, the key card, an answer arriving and time passing make none', async () => {
    const { request } = await start(fakeRequest('messages/answer.http').request)
    await openTab()
    fireEvent.change(field(), { target: { value: 'Typed, not sent' } })
    fireEvent.click(screen.getByRole('button', { name: w.keyButton }))
    fireEvent.click(screen.getByRole('button', { name: w.keyButton }))
    await settle()
    expect(request).not.toHaveBeenCalled()

    fireEvent.keyDown(field(), { key: 'Enter' })
    await waitFor(() => expect(answers()[0]?.dataset.state).toBe('answer'))
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)))
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages')
  })
})

describe('a chip in the real app', () => {
  /** A request whose answer is `text`, whole. */
  const answering = (text: string): AssistantRequest => () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const delta = JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text } })
        controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${delta}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n`))
        controller.close()
      },
    })
    return Promise.resolve({ status: 200, headers: { get: () => null }, body })
  }

  it('is the Problems row’s jump: the line flashes, nothing opens, and a docked panel stays on the chat', async () => {
    await start(answering('Look at [E1:2] in [E1].'))
    await openTab()
    await send('Check this sheet')
    await waitFor(() => expect(answers()[0].dataset.state).toBe('answer'))
    fireEvent.click(within(answers()[0]).getByRole('button', { name: 'Pipe flow, line 2' }))

    await waitFor(() => expect(document.querySelector('[data-anchor-id="m1"] [data-line="1"]')).toHaveClass('is-flash'))
    expect(lineField()).toBeNull()
    expect(screen.getByTestId('assistant-tab')).toBeInTheDocument()
    // A jump adds no undo step and leaves the sheet clean.
    expect(document.title).toBe('Untitled')

    // An element's chip selects it and flashes no line.
    fireEvent.pointerDown(window)
    await waitFor(() => expect(document.querySelector('.is-flash')).toBeNull())
    fireEvent.click(within(answers()[0]).getByRole('button', { name: 'Pipe flow' }))
    await settle()
    expect(document.querySelector('.is-flash')).toBeNull()
    expect(lineField()).toBeNull()
  })

  it('is struck through once its element is deleted from the canvas', async () => {
    await start(answering('See [E1:2].'))
    await openTab()
    await send('Check this sheet')
    await waitFor(() => expect(answers()[0].dataset.state).toBe('answer'))
    expect(within(answers()[0]).getByRole('button', { name: 'Pipe flow, line 2' })).toBeInTheDocument()

    // The element deleted from the canvas: the chip goes nowhere.
    const [element] = mathElements()
    fireEvent.click(within(answers()[0]).getByRole('button', { name: 'Pipe flow, line 2' }))
    await settle()
    expect(element).toBeInTheDocument()
    fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'Delete' })
    await waitFor(() => expect(mathElements()).toHaveLength(0))
    await waitFor(() => expect(answers()[0].querySelector('[data-chip="E1:2"]')?.tagName).toBe('S'))
  })
})
