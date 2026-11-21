import { act, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Excalidraw } from '@excalidraw/excalidraw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WorkspaceLeaf } from './obsidian.ts'
import App from '../../src/App.tsx'
import { MESSAGES } from '../../src/file/sheetSession.ts'
import { fakeFileAccess, fakeRecovery } from '../../src/test/files.ts'
import { linesOf, resultsOf } from '../../src/test/sheetView.ts'
import { hasLookbehind, NO_LOOKBEHIND, SheetView, VIEW_TYPE } from '../SheetView.ts'
import { pumpSheet, vaultWith } from './harness.ts'

const PUMP = 'Calcs/pump-sizing.excalimathpad'
const open: WorkspaceLeaf[] = []

afterEach(async () => {
  for (const leaf of open.splice(0)) await act(() => leaf.detach())
})

async function openPump(files: Record<string, string> = { [PUMP]: pumpSheet() }) {
  const vault = await vaultWith(files)
  const leaf = await act(() => vault.open(PUMP))
  open.push(leaf)
  return { vault, leaf, view: leaf.view as unknown as SheetView }
}

const mathElements = () => screen.queryAllByRole('list', { name: 'Lines' })

describe('the plugin (docs/spec-v1.md section 12a)', () => {
  it('registers its view for .excalimathpad files only', async () => {
    const { app } = await vaultWith({})
    expect([...app.extensions]).toEqual([['excalimathpad', VIEW_TYPE]])
    expect([...app.views.keys()]).toEqual([VIEW_TYPE])
  })

  it('opens the pump sheet in a tab and shows it as the web app does', async () => {
    const { leaf } = await openPump()
    expect(leaf.view).toBeInstanceOf(SheetView)
    await waitFor(() => expect(mathElements()).toHaveLength(1), { timeout: 10_000 })
    const [element] = mathElements()
    const lines = linesOf(element)
    expect(lines[0]).toBe('# Water at 20 C, 4" Sch 40 steel, between two open tanks')
    expect(lines).toContain('Q_op = solve Hp(Q) = Hs(Q), for Q = 1 L/s .. 30 L/s in L/s')
    // The reference's 4" results (docs/acceptance/pump-sizing.md).
    const results = resultsOf(element)
    expect(results).toContain('17.56 m')
    expect(results).toContain('18.81 L / s')
    expect(results).toContain('5.412 kW')
  })

  it('shows no file chrome in a vault: no file name, no window title, no ☰ file items', async () => {
    document.title = 'Obsidian'
    await openPump()
    await waitFor(() => expect(mathElements()).toHaveLength(1), { timeout: 10_000 })
    expect(screen.queryByTestId('file-name')).toBeNull()
    expect(document.title).toBe('Obsidian')
  })

  it('never writes the file while viewing it, or when its tab closes', async () => {
    const { vault, leaf } = await openPump()
    await waitFor(() => expect(mathElements()).toHaveLength(1), { timeout: 10_000 })
    await act(() => (leaf.view as unknown as SheetView).save())
    await act(() => leaf.detach())
    expect(vault.app.vault.writes).toEqual([])
  })

  it.each([
    ['newer', JSON.stringify({ type: 'excalidraw', elements: [], excalimathpad: { format: 99 } }), MESSAGES.newer],
    ['unreadable', 'not json at all', MESSAGES.notASheet],
  ])('refuses a %s file in the view, and never writes it', async (_kind, text, message) => {
    const { vault, leaf } = await openPump({ [PUMP]: text })
    expect(leaf.view?.containerEl).toHaveTextContent(message)
    expect(mathElements()).toHaveLength(0)
    await act(() => leaf.detach())
    expect(vault.app.vault.writes).toEqual([])
    expect(vault.app.vault.files.get(PUMP)).toBe(text)
  })
})

describe('the lookbehind check (section 12a; iOS below 16.4)', () => {
  it('finds lookbehind where the engine has it, and none where it throws', () => {
    expect(hasLookbehind()).toBe(true)
    expect(
      hasLookbehind(() => {
        throw new SyntaxError('Invalid regular expression: invalid group specifier name')
      }),
    ).toBe(false)
  })

  it('shows the message and neither opens nor writes the sheet', async () => {
    const vault = await vaultWith({ [PUMP]: pumpSheet() })
    const memory = {
      panel: { rememberedOpen: () => null, rememberOpen: () => {}, rememberedWidth: () => null, rememberWidth: () => {} },
      theme: { rememberedTheme: () => null, rememberTheme: () => {} },
      language: { rememberedLanguage: () => null, rememberLanguage: () => {} },
    }
    vault.app.views.set(VIEW_TYPE, (leaf) => new SheetView(leaf as never, memory, { lookbehind: () => false }) as never)
    const leaf = await act(() => vault.open(PUMP))
    open.push(leaf)
    expect(leaf.view?.containerEl).toHaveTextContent(NO_LOOKBEHIND)
    expect(mathElements()).toHaveLength(0)
    await act(() => leaf.detach())
    expect(vault.app.vault.writes).toEqual([])
  })
})

/** Each listener added to the global window or document while `run` runs. */
async function globalListeners(run: () => Promise<void>): Promise<string[]> {
  const added: string[] = []
  const spies = (
    [
      ['window', window],
      ['document', document],
      ['body', document.body],
    ] as const
  ).map(([name, target]) => {
    const original = target.addEventListener.bind(target)
    return vi.spyOn(target, 'addEventListener').mockImplementation((type, listener, options) => {
      const capture = typeof options === 'boolean' ? options : !!options?.capture
      added.push(`${name} ${type}${capture ? ' capture' : ''}`)
      original(type, listener, options)
    })
  })
  try {
    await run()
  } finally {
    spies.forEach((spy) => spy.mockRestore())
  }
  return added.sort()
}

/** `listeners` without one of each in `control`: what isn't Excalidraw's or React's own. */
function beyond(listeners: string[], control: string[]): string[] {
  const left = [...control]
  return listeners.filter((listener) => {
    const i = left.indexOf(listener)
    if (i < 0) return true
    left.splice(i, 1)
    return false
  })
}

describe('no global listener (section 12a: the view is confined to itself)', () => {
  // Control: the unforked Excalidraw alone, as SheetCanvas mounts it. What it
  // and React add on the window and document is theirs (a Verify first item).
  const control = () =>
    globalListeners(async () => {
      const host = document.body.appendChild(document.createElement('div'))
      const root = createRoot(host)
      await act(async () => root.render(createElement(Excalidraw, { handleKeyboardGlobally: false })))
      await waitFor(() => expect(host.querySelector('.excalidraw')).not.toBeNull())
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
      act(() => root.unmount())
      host.remove()
    })

  it('the plugin’s view adds none beyond Excalidraw’s own', async () => {
    const excalidraw = await control()
    const plugin = await globalListeners(async () => {
      await openPump()
      await waitFor(() => expect(mathElements()).toHaveLength(1), { timeout: 10_000 })
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    })
    expect(beyond(plugin, excalidraw)).toEqual([])
  })

  it('the same measure catches the web app’s own (the failing case)', async () => {
    const excalidraw = await control()
    const web = await globalListeners(async () => {
      render(createElement(App, { files: fakeFileAccess(), recovery: fakeRecovery() }))
      await screen.findByTestId('file-name')
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
    })
    expect(beyond(web, excalidraw)).toEqual(
      expect.arrayContaining([
        'document keydown capture',
        'window beforeunload',
        'window keydown capture',
        'window drop capture',
      ]),
    )
  })
})
