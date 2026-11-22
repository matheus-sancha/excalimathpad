import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Platform, type WorkspaceLeaf } from './obsidian.ts'
import { assistantPorts } from '../assistant.ts'
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
  vi.restoreAllMocks()
})

describe('the ports the view passes', () => {
  it('are none with the switch off, and none on a phone or a tablet', () => {
    expect(assistantPorts(false, false)).toBeUndefined()
    expect(assistantPorts(false, true)).toBeUndefined()
    expect(assistantPorts(true, true)).toBeUndefined()
  })

  it('with the switch on, on a computer: a request through the window’s own fetch, as it was asked', async () => {
    const answer = new Response('data: [DONE]\n\n', { status: 200 })
    const fetched = vi.fn<typeof window.fetch>(() => Promise.resolve(answer))
    vi.stubGlobal('fetch', fetched)
    const ports = assistantPorts(true, false)!
    // Nothing is asked for by making the ports.
    expect(fetched).not.toHaveBeenCalled()

    const { signal } = new AbortController()
    const init = { method: 'POST' as const, headers: { authorization: 'Bearer canary' }, body: '{}', signal }
    await expect(ports.request('https://api.example.com/v1/chat/completions', init)).resolves.toBe(answer)
    expect(fetched.mock.calls).toEqual([['https://api.example.com/v1/chat/completions', init]])
    vi.unstubAllGlobals()
  })

  it('a store that keeps nothing beyond the view, until the setup has its entry', () => {
    const { store } = assistantPorts(true, false)!
    expect(store.read()).toBeNull()
    store.write('{"provider":"anthropic"}')
    expect(store.read()).toBe('{"provider":"anthropic"}')
    expect(assistantPorts(true, false)!.store.read()).toBeNull()
    store.remove()
    expect(store.read()).toBeNull()
  })
})

describe('the Math assistant in a sheet tab', () => {
  async function openPump(assistant: boolean | undefined) {
    const vault = await vaultWith({ [PUMP]: pumpSheet() })
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
})
