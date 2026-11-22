import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, notices, obsidian, Platform, type WorkspaceLeaf } from './obsidian.ts'
import { assistantPorts, SETUP_ENTRY } from '../assistant.ts'
import { SheetView, VIEW_TYPE } from '../SheetView.ts'
import { pumpSheet, vaultWith } from './harness.ts'

/**
 * The Math assistant's ports in a vault (docs/spec-v1.md section 14, 0.7.0):
 * passed only in a build with the switch on, and never on a phone or a
 * tablet, where there is then no tab and no More tools item.
 */
const PUMP = 'Calcs/pump-sizing.excalimathpad'
const open: WorkspaceLeaf[] = []

afterEach(async () => {
  for (const leaf of open.splice(0)) await act(() => leaf.detach())
  Platform.isMobile = false
  Platform.isTablet = false
  obsidian.apiVersion = '1.15.1'
  vi.restoreAllMocks()
})

describe('the ports the view passes', () => {
  it('are none with the switch off, and none on a phone or a tablet', () => {
    const app = new App()
    expect(assistantPorts(false, false, app as never)).toBeUndefined()
    expect(assistantPorts(false, true, app as never)).toBeUndefined()
    expect(assistantPorts(true, true, app as never)).toBeUndefined()
    expect(app.secretStorage.calls).toEqual([])
  })

  it('with the switch on, on a computer: a request through the window’s own fetch, as it was asked', async () => {
    const answer = new Response('data: [DONE]\n\n', { status: 200 })
    const fetched = vi.fn<typeof window.fetch>(() => Promise.resolve(answer))
    vi.stubGlobal('fetch', fetched)
    const ports = assistantPorts(true, false, new App() as never)!
    // Nothing is asked for by making the ports.
    expect(fetched).not.toHaveBeenCalled()

    const { signal } = new AbortController()
    const init = { method: 'POST' as const, headers: { authorization: 'Bearer canary' }, body: '{}', signal }
    await expect(ports.request('https://api.example.com/v1/chat/completions', init)).resolves.toBe(answer)
    expect(fetched.mock.calls).toEqual([['https://api.example.com/v1/chat/completions', init]])
    vi.unstubAllGlobals()
  })
})

/**
 * The setup's store in a vault (section 12a, Storage only in the vault, with
 * one exception): one entry of Obsidian's secret storage, behind 1.11.4.
 */
describe('the setup’s store in a vault', () => {
  it('is one entry, excalimathpad-assistant, in Obsidian’s secret storage', () => {
    const app = new App()
    const store = assistantPorts(true, false, app as never)!.store!
    // Making the ports reads and writes nothing.
    expect(app.secretStorage.calls).toEqual([])
    expect(store.read()).toBeNull()
    store.write('{"provider":"anthropic"}')
    expect([...app.secretStorage.secrets]).toEqual([['excalimathpad-assistant', '{"provider":"anthropic"}']])
    expect(store.read()).toBe('{"provider":"anthropic"}')
    expect(SETUP_ENTRY).toBe('excalimathpad-assistant')
  })

  it('has no delete: Forget this setup writes the entry empty, which reads as no setup', () => {
    const app = new App()
    const store = assistantPorts(true, false, app as never)!.store!
    store.write('{"provider":"anthropic"}')
    store.remove()
    expect([...app.secretStorage.secrets]).toEqual([['excalimathpad-assistant', '']])
    expect(store.read()).toBeNull()
  })

  it('is the same store for every sheet tab of one Obsidian, and another for another', () => {
    const app = new App()
    expect(assistantPorts(true, false, app as never)!.store).toBe(assistantPorts(true, false, app as never)!.store)
    expect(assistantPorts(true, false, new App() as never)!.store).not.toBe(assistantPorts(true, false, app as never)!.store)
  })

  it('lets the storage’s own error through, for the card to say', () => {
    const app = new App()
    const store = assistantPorts(true, false, app as never)!.store!
    app.secretStorage.failNext = new Error('The keychain is locked')
    expect(() => store.write('{}')).toThrow('The keychain is locked')
  })

  it('on an Obsidian older than 1.11.4 there is no store, and the storage is never called', () => {
    obsidian.apiVersion = '1.11.3'
    const app = new App()
    const ports = assistantPorts(true, false, app as never)!
    expect(ports.store).toBeNull()
    expect(app.secretStorage.calls).toEqual([])
  })
})

describe('the Math assistant in a sheet tab', () => {
  let vault: Awaited<ReturnType<typeof vaultWith>>
  async function openPump(assistant: boolean | undefined) {
    vault = await vaultWith({ [PUMP]: pumpSheet() })
    const memory = {
      panel: { rememberedOpen: () => null, rememberOpen: () => {}, rememberedWidth: () => null, rememberWidth: () => {} },
      theme: { rememberedTheme: () => null, rememberTheme: () => {} },
      language: { rememberedLanguage: () => null, rememberLanguage: () => {} },
    }
    if (assistant !== undefined) {
      vault.app.views.set(VIEW_TYPE, (leaf) => new SheetView(leaf as never, memory, { assistant }) as never)
    }
    const leaf = await act(() => vault.open(PUMP))
    open.push(leaf)
    await waitFor(() => expect(screen.queryAllByRole('list', { name: 'Lines' })).toHaveLength(1), { timeout: 10_000 })
    fireEvent.click(await screen.findByTitle('More tools'))
    await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
    return Array.from(document.querySelectorAll('.math-tools .dropdown-menu-item__text'), (item) => item.textContent)
  }

  it('is off in a build from main: no More tools item', async () => {
    expect(__ASSISTANT__).toBe(false)
    expect(await openPump(undefined)).toEqual(['Add math', 'Math settings'])
  })

  it('has its item on a computer with the switch on', async () => {
    expect(await openPump(true)).toEqual(['Add math', 'Math settings', 'Math assistant'])
  })

  it('has none on a tablet, switch on or not', async () => {
    Platform.isMobile = true
    Platform.isTablet = true
    expect(await openPump(true)).toEqual(['Add math', 'Math settings'])
  })

  /** The tab, opened from its More tools item. */
  async function openTab() {
    fireEvent.click(screen.getByRole('button', { name: /^Math assistant/ }))
    return screen.findByTestId('assistant-tab')
  }

  it('on an Obsidian older than 1.11.4 the tab says it needs 1.11.4, and the storage is never called', async () => {
    obsidian.apiVersion = '1.11.3'
    await openPump(true)
    const tab = await openTab()
    expect(tab).toHaveTextContent(/^The Math assistant needs Obsidian 1\.11\.4 or later\.$/)
    expect(tab.querySelector('input, select, button')).toBeNull()
    expect(vault.app.secretStorage.calls).toEqual([])
    // The rest of the plugin works as before.
    expect(screen.queryAllByRole('list', { name: 'Lines' })).toHaveLength(1)
  })

  it('a canary key saved through the card shows nowhere but the secret storage’s entry', async () => {
    const CANARY = 'sk-canary-9f3c7e21d8b64a05-a1B2'
    const logged: unknown[][] = []
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation((...said: unknown[]) => void logged.push(said))
    }
    const fetched = vi.fn<typeof window.fetch>(() => Promise.reject(new Error('no request is made')))
    vi.stubGlobal('fetch', fetched)
    await openPump(true)
    const tab = await openTab()
    // In Obsidian the card says where the key is kept.
    expect(tab).toHaveTextContent("Kept on this device only, in Obsidian's keychain.")

    fireEvent.change(within(tab).getByLabelText('API key', { selector: 'input' }), { target: { value: CANARY } })
    fireEvent.click(within(tab).getByRole('button', { name: 'Show the key' }))
    fireEvent.click(within(tab).getByRole('button', { name: 'Save' }))
    // Saved, the tab holds the conversation; the key button opens the card again.
    fireEvent.click(await within(tab).findByRole('button', { name: 'Provider and key' }))
    await within(tab).findByText('Saved key ending a1B2')

    // The one entry, and the one place the key is.
    const { secrets } = vault.app.secretStorage
    expect([...secrets.keys()]).toEqual(['excalimathpad-assistant'])
    expect(JSON.parse(secrets.get('excalimathpad-assistant')!)).toMatchObject({ provider: 'anthropic', key: CANARY })
    expect(fetched).not.toHaveBeenCalled()

    // Close the sheet tab: its last save, and the plugin's memory, are written.
    const fields = () => Array.from(document.querySelectorAll('input, textarea'), (field) => (field as HTMLInputElement).value)
    expect(document.documentElement.outerHTML + fields().join('\n')).not.toContain(CANARY)
    for (const leaf of open.splice(0)) await act(() => leaf.detach())
    await act(() => vault.app.workspace.quit())
    const written = JSON.stringify({
      data: (vault.recorded as unknown as { dataJson: unknown }).dataJson,
      writes: vault.app.vault.writes,
      creates: vault.app.vault.creates,
      notices,
    })
    expect(written).not.toContain(CANARY)
    expect(JSON.stringify(logged.map((said) => said.map(String)))).not.toContain(CANARY)
    vi.unstubAllGlobals()

    // Another sheet tab of the same Obsidian reads the same setup; Remove writes the entry
    // again without the key, and Forget this setup writes it empty.
    const leaf = await act(() => vault.open(PUMP))
    open.push(leaf)
    await waitFor(() => expect(screen.queryAllByRole('list', { name: 'Lines' })).toHaveLength(1), { timeout: 10_000 })
    fireEvent.click(await screen.findByTitle('More tools'))
    await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
    const again = await openTab()
    fireEvent.click(within(again).getByRole('button', { name: 'Provider and key' }))
    expect(within(again).getByText('Saved key ending a1B2')).toBeInTheDocument()
    fireEvent.click(within(again).getByRole('button', { name: 'Remove' }))
    expect(secrets.get('excalimathpad-assistant')).not.toContain(CANARY)
    expect(JSON.parse(secrets.get('excalimathpad-assistant')!)).toMatchObject({ provider: 'anthropic', key: '' })
    expect(again).toHaveTextContent('Key removed from this device.')
    fireEvent.click(within(again).getByRole('button', { name: 'Forget this setup' }))
    expect([...secrets]).toEqual([['excalimathpad-assistant', '']])
  })
})
