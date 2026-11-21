import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, onTestFinished } from 'vitest'
import App from '../App.tsx'
import { fakeFileAccess, fakeRecovery } from '../test/files.ts'
import { undoControls } from '../test/excalidraw.ts'
import { sampleSheet } from '../test/sheets.ts'
import { doubleClickLine } from '../test/gestures.ts'
import { resultsOf } from '../test/sheetView.ts'
import type { LanguageMemory, SheetLanguage } from './language.ts'

/**
 * ☰ → Language (docs/spec-v1.md section 8, Language, 0.5.0), in the web home,
 * against the real Excalidraw component: the row sits just below Dark mode,
 * English is shown until a language is chosen, Português translates
 * Excalidraw's own text and leaves the app's own in English, and a choice is
 * remembered per device. It is never the sheet's: no undo step, no dirty mark.
 * No key on the row reaches Excalidraw (section 14). The plugin's home is in
 * `plugin/test/tab.test.ts`.
 */

/** A language memory that starts at `language` and lists what it is told. */
function fakeLanguageMemory(language: SheetLanguage | null = null) {
  const told: SheetLanguage[] = []
  const memory: LanguageMemory & { told: SheetLanguage[] } = {
    told,
    rememberedLanguage: () => language,
    rememberLanguage: (next) => void told.push(next),
  }
  return memory
}

async function renderApp(props: Partial<Parameters<typeof App>[0]> = {}) {
  render(<App files={fakeFileAccess()} recovery={fakeRecovery()} {...props} />)
  await screen.findByTestId('file-name')
  await waitFor(() => expect(document.title).toBe('Untitled'))
}

const openMenu = () => fireEvent.click(screen.getByTestId('main-menu-trigger'))
const languageSelect = () => screen.getByTestId<HTMLSelectElement>('language-select')
const rectangleTool = () => document.querySelector('[data-testid="toolbar-rectangle"]')!.closest('label')!
const mathElements = () => screen.queryAllByRole('list', { name: 'Lines' })
const ANCHOR = 'math-inputs'

/** Each ☰ entry's text, items and the Language row alike, in their order. */
function menuEntries(): string[] {
  return Array.from(
    document.querySelectorAll('.dropdown-menu .dropdown-menu-item__text, .dropdown-menu .language-row__label'),
    (entry) => (entry.textContent ?? '').trim(),
  )
}

async function choose(language: SheetLanguage) {
  await act(async () => {
    fireEvent.change(languageSelect(), { target: { value: language } })
  })
}

/** Waits for Excalidraw to have drawn its toolbar in `language`. */
async function shownIn(language: SheetLanguage) {
  const rectangle = language === 'pt-BR' ? /^Retângulo/ : /^Rectangle/
  await waitFor(() => expect(rectangleTool().title).toMatch(rectangle))
}

describe('☰ → Language (section 8, Language)', () => {
  it('is a row just below Dark mode and above Canvas background, with English and Português (Brasil)', async () => {
    await renderApp()
    openMenu()
    const entries = menuEntries()
    const row = entries.indexOf('Language')
    expect(entries[row - 1]).toBe('Dark mode')
    // Canvas background is a custom entry of Excalidraw's with no item text: it follows the row.
    expect(screen.getByTestId('language-row').nextElementSibling?.textContent).toMatch(/Canvas background/)
    expect(Array.from(languageSelect().options, (option) => [option.value, option.textContent])).toEqual([
      ['en', 'English'],
      ['pt-BR', 'Português (Brasil)'],
    ])
  })

  it('is English until chosen, whatever the browser’s language', async () => {
    const languages = Object.getOwnPropertyDescriptor(Navigator.prototype, 'languages')!
    Object.defineProperty(Navigator.prototype, 'languages', { configurable: true, get: () => ['pt-BR', 'pt'] })
    Object.defineProperty(Navigator.prototype, 'language', { configurable: true, get: () => 'pt-BR' })
    onTestFinished(() => {
      Object.defineProperty(Navigator.prototype, 'languages', languages)
      delete (Navigator.prototype as { language?: string }).language
    })
    await renderApp({ language: fakeLanguageMemory() })
    await shownIn('en')
    openMenu()
    expect(languageSelect().value).toBe('en')
  })

  it('translates Excalidraw’s own text and leaves the app’s own in English', async () => {
    const memory = fakeLanguageMemory()
    await renderApp({ language: memory })
    openMenu()
    await choose('pt-BR')
    await shownIn('pt-BR')

    expect(memory.told).toEqual(['pt-BR'])
    // Excalidraw's own ☰ items are in Portuguese; the app's and the row's label stay English.
    const entries = menuEntries()
    expect(entries).toContain('Modo escuro')
    expect(entries).toEqual(expect.arrayContaining(['Open…', 'Save', 'Save as…', 'Print…', 'Math guide', 'Language']))
    expect(languageSelect().value).toBe('pt-BR')
    // More tools keeps the app's two items in English.
    fireEvent.click(document.querySelector('.App-toolbar__extra-tools-trigger')!)
    await waitFor(() => expect(screen.getByRole('button', { name: /Add math/ })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Math settings/ })).toBeInTheDocument()
    expect(document.querySelector('.math-tools__heading')?.textContent).toBe('Math')
  })

  it('opens in the language last chosen, and back to English when it is chosen', async () => {
    const memory = fakeLanguageMemory('pt-BR')
    await renderApp({ language: memory })
    await shownIn('pt-BR')
    openMenu()
    expect(languageSelect().value).toBe('pt-BR')
    await choose('en')
    await shownIn('en')
    expect(memory.told).toEqual(['en'])
  })

  it('is no undo step and never makes the sheet dirty, and leaves the results as they are', async () => {
    await renderApp({ language: fakeLanguageMemory(), initialElements: sampleSheet() })
    await waitFor(() => expect(mathElements()).toHaveLength(2))
    const results = () => resultsOf(document)
    const before = results()
    const undo = undoControls(document)
    const couldUndo = undo.canUndo()

    openMenu()
    await choose('pt-BR')
    await shownIn('pt-BR')

    expect(document.title).toBe('Untitled')
    expect(screen.getByTestId('file-name').textContent).not.toMatch('●')
    expect(undo.canUndo()).toBe(couldUndo)
    expect(results()).toEqual(before)
  })

  it('passes no key to Excalidraw: Delete on the focused row doesn’t delete the selection (section 14)', async () => {
    await renderApp({ language: fakeLanguageMemory(), initialElements: sampleSheet() })
    await waitFor(() => expect(mathElements()).toHaveLength(2))
    const excalidraw = document.querySelector<HTMLElement>('.excalidraw')!
    fireEvent.keyDown(excalidraw, { key: 'a', code: 'KeyA', ctrlKey: true })
    await waitFor(() => expect(document.querySelector('[data-math-selection]')).not.toBeNull())
    openMenu()
    const select = languageSelect()
    select.focus()

    fireEvent.keyDown(select, { key: 'Delete', code: 'Delete' })
    fireEvent.keyDown(select, { key: 'r', code: 'KeyR' })
    fireEvent.keyDown(select, { key: 'm', code: 'KeyM' })

    expect(mathElements()).toHaveLength(2)
    expect(document.querySelector('[data-testid="toolbar-rectangle"]')).not.toBeChecked()
    expect(document.querySelector('[data-math-placing]')).toBeNull()
    // The control: the same key on the canvas deletes the selected math.
    fireEvent.keyDown(excalidraw, { key: 'Delete', code: 'Delete' })
    await waitFor(() => expect(mathElements()).toHaveLength(0))
  })

  it('leaves an open line when ☰ is pressed, and redraws at once with the menu still open', async () => {
    await renderApp({ language: fakeLanguageMemory(), initialElements: sampleSheet() })
    await waitFor(() => expect(mathElements()).toHaveLength(2))
    doubleClickLine(ANCHOR, 0)
    const field = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Line source' })

    // ☰ is a press on Excalidraw's UI: the line is left before anything is chosen.
    fireEvent.pointerDown(screen.getByTestId('main-menu-trigger'))
    openMenu()
    await waitFor(() => expect(field.isConnected).toBe(false))
    await choose('pt-BR')
    await shownIn('pt-BR')
    expect(menuEntries()).toContain('Modo escuro')
    expect(languageSelect()).toBeInTheDocument()
  })
})
