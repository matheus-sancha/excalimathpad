import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import App from '../App.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { en } from '../text/en.ts'
import { ptBR } from '../text/ptBR.ts'
import type { AssistantPorts } from './ports.ts'

/**
 * The Math assistant's place (docs/spec-v1.md section 8, Math assistant, Its
 * place; Sheet panel; App chrome), against the real Excalidraw: the seventh
 * tab, the third More tools item, and an edit that keeps the chat. The
 * assistant is there only where App is handed its ports (section 14, 0.7.0).
 */

/** Ports that record every request and every write: this issue makes none. */
function fakePorts() {
  const request = vi.fn<AssistantPorts['request']>(() => Promise.reject(new Error('no request is made')))
  const store = { read: vi.fn(() => null), write: vi.fn(), remove: vi.fn() }
  return { request, store } satisfies AssistantPorts
}

const sheet = () =>
  createMathAnchorElements([{ id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'a = 2\nb = a + 1', title: 'Pipe flow' }])

/** The canvas's box is `width` px wide (jsdom's is 0): what the panel's docking is read from. */
function editorWidth(width: number) {
  const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!
  Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get: () => width })
  onTestFinished(() => {
    Object.defineProperty(Element.prototype, 'clientWidth', client)
  })
}

/** The app on a wide editor, where the panel docks, its panel last closed. */
async function start(assistant?: AssistantPorts) {
  editorWidth(1440)
  const panelMemory = { rememberedOpen: () => false, rememberOpen: () => {}, rememberedWidth: () => null, rememberWidth: () => {} }
  render(<App files={fakeFileAccess()} recovery={fakeRecovery()} initialElements={sheet()} panelMemory={panelMemory} assistant={assistant} />)
  await screen.findByTestId('file-name')
  await waitFor(() => expect(document.title).toBe('Untitled'))
  await screen.findAllByRole('list', { name: 'Lines' })
}

async function moreTools() {
  if (!document.querySelector('.math-tools')) fireEvent.click(await screen.findByTitle('More tools'))
  await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
  return Array.from(document.querySelectorAll('.math-tools .dropdown-menu-item__text'), (label) => label.textContent)
}
const item = async (name: RegExp) => {
  await moreTools()
  return screen.getByRole('button', { name })
}
const panel = () => document.querySelector('.sheet-sidebar')
const tabs = () => screen.queryAllByRole('tab')
const selected = () => screen.getByRole('tab', { selected: true }).textContent
const lineField = () => screen.queryByRole<HTMLTextAreaElement>('textbox', { name: 'Line source' })
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)))

/** Opens the one element's line by keyboard, and leaves it by its blur (as `App.test.tsx` does). */
async function editLine() {
  const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
  fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
  await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
  fireEvent.keyDown(excalidraw, { key: 'Enter', code: 'Enter' })
  await waitFor(() => expect(lineField()).not.toBeNull())
}
const leave = () => act(() => lineField()!.blur())

describe('with no ports (the assistant is off, or the device is a phone or a tablet)', () => {
  it('has no Math assistant tab and no More tools item', async () => {
    await start()

    expect(await moreTools()).toEqual(['Add math', 'Math settings'])
    fireEvent.click(await item(/^Math settings/))
    await waitFor(() => expect(tabs()).toHaveLength(6))
    expect(tabs().map((tab) => tab.title)).not.toContain('Math assistant')
    expect(screen.queryByTestId('assistant-tab')).toBeNull()
  })
})

describe('with the ports', () => {
  it('has a seventh tab, last, a speech bubble with its name as tooltip and as the heading over its content', async () => {
    const ports = fakePorts()
    await start(ports)
    fireEvent.click(await item(/^Math settings/))
    await waitFor(() => expect(tabs()).toHaveLength(7))

    expect(tabs().map((tab) => tab.title)).toEqual([
      'Format',
      'Symbols',
      'Variables',
      'Problems',
      'Constants',
      'Settings',
      'Math assistant',
    ])
    const tab = screen.getByRole('tab', { name: 'Math assistant' })
    expect(tab).toBe(tabs()[6])
    expect(tab.querySelector('svg path')).not.toBeNull()

    fireEvent.mouseDown(tab)
    await waitFor(() => expect(selected()).toBe('Math assistant'))
    expect(screen.getByRole('heading', { name: 'Math assistant' })).toBeInTheDocument()
    // With no setup saved, the tab holds the setup card, and has asked for nothing.
    expect(within(screen.getByTestId('assistant-tab')).getByRole('combobox', { name: 'Provider' })).toHaveValue('anthropic')
    expect(ports.request).not.toHaveBeenCalled()
    expect(ports.store.write).not.toHaveBeenCalled()
  })

  it('has a third More tools item, under Math settings, that opens the panel on the tab and closes it when the tab shows', async () => {
    await start(fakePorts())
    expect(await moreTools()).toEqual(['Add math', 'Math settings', 'Math assistant'])
    expect(await item(/^Math assistant/)).toHaveAttribute('aria-pressed', 'false')

    // Closed: it opens the panel on Math assistant, and More tools closes.
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(selected()).toBe('Math assistant'))
    expect(document.querySelector('.math-tools')).toBeNull()
    expect(await item(/^Math assistant/)).toHaveAttribute('aria-pressed', 'true')
    expect(await item(/^Math settings/)).toHaveAttribute('aria-pressed', 'true')

    // Showing: it closes the panel.
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(panel()).toBeNull())
    expect(document.querySelector('.math-tools')).toBeNull()

    // Open on another tab: it switches to Math assistant, and doesn't read as pressed before.
    fireEvent.click(await item(/^Math settings/))
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Constants' }))
    await waitFor(() => expect(selected()).toBe('Constants'))
    expect(await item(/^Math assistant/)).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(selected()).toBe('Math assistant'))

    // Math settings then closes it, and opens it again on the tab last shown.
    fireEvent.click(await item(/^Math settings/))
    await waitFor(() => expect(panel()).toBeNull())
    fireEvent.click(await item(/^Math settings/))
    await waitFor(() => expect(selected()).toBe('Math assistant'))
  })

  it('an edit keeps the chat: a line opened while the tab shows leaves the panel on it, and Format is one press away', async () => {
    await start(fakePorts())
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(selected()).toBe('Math assistant'))

    await editLine()
    await settle()
    expect(selected()).toBe('Math assistant')

    // A press on Format's tab keeps the line open.
    const format = screen.getByRole('tab', { name: 'Format' })
    fireEvent.pointerDown(format)
    fireEvent.mouseDown(format)
    fireEvent.click(format)
    await waitFor(() => expect(selected()).toBe('Format'))
    expect(lineField()).not.toBeNull()

    // The edit's end puts the panel back as it was: on the chat.
    fireEvent.keyDown(lineField()!, { key: 'Shift' })
    leave()
    await waitFor(() => expect(selected()).toBe('Math assistant'))
    expect(lineField()).toBeNull()
  })

  it('keeps the chat as the edit moves up to the title', async () => {
    await start(fakePorts())
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(selected()).toBe('Math assistant'))

    await editLine()
    const title = () => screen.queryByRole('textbox', { name: 'Title' })
    for (let presses = 0; presses < 3 && !title(); presses++) fireEvent.keyDown(lineField()!, { key: 'ArrowUp' })
    expect(title()).not.toBeNull()
    await settle()
    expect(selected()).toBe('Math assistant')
    act(() => title()!.blur())
    await settle()
    expect(selected()).toBe('Math assistant')
  })

  it('from any other tab, and with the panel closed, an edit opens Format and restores as before', async () => {
    await start(fakePorts())
    expect(panel()).toBeNull()
    await editLine()
    await waitFor(() => expect(selected()).toBe('Format'))
    leave()
    await waitFor(() => expect(panel()).toBeNull())

    fireEvent.click(await item(/^Math settings/))
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Constants' }))
    await waitFor(() => expect(selected()).toBe('Constants'))
    await editLine()
    await waitFor(() => expect(selected()).toBe('Format'))
    // The chat picked during an edit stays while it lasts, as any tab does.
    const assistant = screen.getByRole('tab', { name: 'Math assistant' })
    fireEvent.pointerDown(assistant)
    fireEvent.mouseDown(assistant)
    fireEvent.click(assistant)
    await waitFor(() => expect(selected()).toBe('Math assistant'))
    expect(lineField()).not.toBeNull()
    fireEvent.keyDown(lineField()!, { key: 'Shift' })
    leave()
    await waitFor(() => expect(selected()).toBe('Constants'))
  })

  it('makes no request and stores nothing, whatever is opened, and reads the setup once', async () => {
    const ports = fakePorts()
    await start(ports)
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(selected()).toBe('Math assistant'))
    await editLine()
    leave()
    fireEvent.click(await item(/^Math assistant/))
    await waitFor(() => expect(panel()).toBeNull())

    expect(ports.request).not.toHaveBeenCalled()
    expect(ports.store.read).toHaveBeenCalledTimes(1)
    expect(ports.store.write).not.toHaveBeenCalled()
    expect(ports.store.remove).not.toHaveBeenCalled()
  })
})

describe('the tab’s name and the item, in both text tables (section 13, Math assistant)', () => {
  it('are Math assistant and Assistente de cálculo', () => {
    expect([en.panel.tabs.assistant, en.tools.assistant]).toEqual(['Math assistant', 'Math assistant'])
    expect([ptBR.panel.tabs.assistant, ptBR.tools.assistant]).toEqual(['Assistente de cálculo', 'Assistente de cálculo'])
  })
})

describe('the build-time switch (section 14, 0.7.0, Off until it is proved)', () => {
  it('is off in this run, as in a build from main', () => {
    expect(__ASSISTANT__).toBe(false)
  })
})
