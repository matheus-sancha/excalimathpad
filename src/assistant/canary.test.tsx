import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import App from '../App.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { failureDetails, failureOf } from '../failure/details.ts'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { en } from '../text/en.ts'
import { fakeRequest } from './fixtures/load.ts'
import { sessionSetupStore, type AssistantPorts, type AssistantRequestInit } from './ports.ts'
import { readSetup } from './setup.ts'

/**
 * The canary key on the web (docs/spec-v1.md section 12a, Storage only in the
 * vault, with one exception; section 14, 0.7.0, The key is never logged,
 * thrown or shown): a key saved through the card, in the real app, shows
 * nowhere but the store's entry and the request's header, through a Show
 * models, a Check key and a Send. Not in a request's address or body, the
 * sheet file, the recovery copy, a failure's text (what Copy details and
 * Report this error carry), the console or any text on screen.
 */
const CANARY = 'sk-canary-9f3c7e21d8b64a05-a1B2'

const HOME = { version: '0', stamp: 'dev', home: 'web', device: null } as const

const copied: string[] = []
const logged: unknown[][] = []

beforeEach(() => {
  copied.length = 0
  logged.length = 0
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: (text: string) => Promise.resolve(void copied.push(text)) },
  })
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...said: unknown[]) => void logged.push(said))
  }
})
afterEach(() => vi.restoreAllMocks())

/** Everything a canary could hide in: text, attributes and every field's value. */
const onScreen = () =>
  document.documentElement.outerHTML +
  Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'), (field) => field.value).join('\n')

it('a key saved through the card shows nowhere but the store’s entry and a request’s header', async () => {
  const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => 1440 })
  onTestFinished(() => void Object.defineProperty(Element.prototype, 'clientWidth', client))

  const store = sessionSetupStore()
  // The model list for Show models and Check key, an answer for a Send.
  const models = fakeRequest('messages/models.http')
  const answer = fakeRequest('messages/answer.http')
  const request = vi.fn<AssistantPorts['request']>((address, init) =>
    (init.method === 'GET' ? models : answer).request(address, init),
  )
  // The tab's next draw fails once `broken` is set: how Copy details and Report this error come up.
  let broken = false
  const ports: AssistantPorts = {
    request,
    get store() {
      if (broken) throw new Error('The assistant tab failed')
      return store
    },
  }
  const files = fakeFileAccess()
  const recovery = fakeRecovery()
  const panelMemory = { rememberedOpen: () => false, rememberOpen: () => {}, rememberedWidth: () => null, rememberWidth: () => {} }
  const elements = createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'a = 2\nb = a + 1', title: 'Pipe flow' }])
  render(<App files={files} recovery={recovery} initialElements={elements} panelMemory={panelMemory} assistant={ports} />)
  await screen.findByTestId('file-name')
  await screen.findAllByRole('list', { name: 'Lines' })

  // Open the tab, paste the key, look at it with the eye, and save.
  fireEvent.click(await screen.findByTitle('More tools'))
  await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: /^Math assistant/ }))
  const tab = await screen.findByTestId('assistant-tab')
  const key = within(tab).getByLabelText<HTMLInputElement>(en.assistant.key, { selector: 'input' })
  fireEvent.change(key, { target: { value: CANARY } })
  fireEvent.click(within(tab).getByRole('button', { name: en.assistant.showKey }))
  fireEvent.click(within(tab).getByRole('button', { name: en.assistant.save }))
  // Saved, the tab holds the conversation; the key button opens the card again.
  fireEvent.click(await within(tab).findByRole('button', { name: en.assistant.keyButton }))
  await within(tab).findByText('Saved key ending a1B2')

  // The one place it is kept.
  expect(readSetup(store.read())?.key).toBe(CANARY)
  expect(request).not.toHaveBeenCalled()
  expect(onScreen()).not.toContain(CANARY)

  // Show models (the first request to the host asks), Check key, then a Send.
  fireEvent.click(within(tab).getByRole('button', { name: en.assistant.showModels }))
  fireEvent.click(within(tab).getByRole('button', { name: en.assistant.first.continueButton }))
  await within(tab).findByRole('combobox', { name: en.assistant.showModels })
  fireEvent.click(within(tab).getByRole('button', { name: en.assistant.checkKey }))
  await within(tab).findByText(en.assistant.accepted('api.anthropic.com'))
  fireEvent.click(within(tab).getByRole('button', { name: en.assistant.keyButton }))
  const field = within(tab).getByRole('textbox', { name: en.assistant.placeholder })
  fireEvent.change(field, { target: { value: 'Check this sheet' } })
  fireEvent.keyDown(field, { key: 'Enter' })
  await waitFor(() => expect(within(tab).getByTestId('assistant-answer')).toHaveAttribute('data-state', 'answer'))

  // Each request has the key in its header, and nowhere else.
  expect(request.mock.calls.map(([address, init]) => `${init.method} ${address}`)).toEqual([
    'GET https://api.anthropic.com/v1/models',
    'GET https://api.anthropic.com/v1/models',
    'POST https://api.anthropic.com/v1/messages',
  ])
  for (const [address, init] of request.mock.calls) {
    expect(init.headers.authorization).toBe(`Bearer ${CANARY}`)
    const { headers, ...rest } = init as AssistantRequestInit
    const others = Object.entries(headers).filter(([name]) => name !== 'authorization')
    expect(JSON.stringify([address, rest, others])).not.toContain(CANARY)
  }
  expect(onScreen()).not.toContain(CANARY)

  // The sheet file, saved, and the recovery copy.
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
  await waitFor(() => expect(files.disk.size + files.saveAs.mock.calls.length).toBeGreaterThan(0))
  expect(JSON.stringify([...files.disk])).not.toContain(CANARY)
  expect(JSON.stringify(files.saveAs.mock.calls)).not.toContain(CANARY)
  expect(JSON.stringify(recovery.current())).not.toContain(CANARY)
  expect(JSON.stringify(recovery.write.mock.calls)).not.toContain(CANARY)

  // The tab fails: its notice carries the failure's raw text, what Copy details and
  // Report this error are made from (`failureOf`), and no key is in it.
  broken = true
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Constants' }))
  fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Math assistant' }))
  const notice = await screen.findByText(en.failure.tab)
  expect(notice).toHaveAttribute('title', 'Error: The assistant tab failed')
  expect(failureDetails('tab', failureOf(new Error(notice.title)), HOME, [], 'en')).not.toContain(CANARY)
  expect(onScreen()).not.toContain(CANARY)
  expect(copied.join('\n')).not.toContain(CANARY)

  // The console, whatever React and the boundary said of the failure.
  expect(JSON.stringify(logged.map((said) => said.map(String)))).not.toContain(CANARY)
})

describe('the canary itself', () => {
  it('would be found: the same reading sees a key left on screen', () => {
    render(<p>{CANARY}</p>)
    expect(onScreen()).toContain(CANARY)
  })
})
