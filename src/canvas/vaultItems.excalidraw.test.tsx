import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { VAULT_CLASS, VAULT_HIDDEN } from './vaultItems.ts'
import { confineKeys } from './vaultKeys.ts'
import { sceneLoaded } from '../test/excalidraw.ts'

/**
 * Contract tests on the real Excalidraw 0.18.1 (ADR 0001; docs/spec-v1.md
 * section 14, Hidden items in the plugin). Excalidraw has no prop for Web
 * Embed, Mermaid to Excalidraw, Browse libraries or Copy to clipboard as SVG,
 * so `SheetCanvas.css` hides them by the selectors in `VAULT_HIDDEN`. jsdom
 * applies no stylesheet, so each test checks the selector picks exactly the
 * item, and that the CSS hides that selector under `VAULT_CLASS`. An upgrade
 * that renames one fails here first.
 */

// Excalidraw offers Copy as PNG and SVG only where the clipboard can take
// them, and decides as it loads; jsdom has no clipboard, so one is stubbed first.
vi.hoisted(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: () => Promise.resolve(), write: () => Promise.resolve() },
  })
  Object.assign(window, { ClipboardItem: class {} })
})

const stops: (() => void)[] = []
afterEach(() => stops.splice(0).forEach((stop) => stop()))

async function mount(vault = true) {
  let handle: SheetCanvasHandle | undefined
  const view = render(
    <SheetCanvas
      vault={vault}
      onReady={(h) => (handle = h)}
      initialElements={[
        {
          id: 'box',
          type: 'rectangle',
          x: 100,
          y: 100,
          width: 80,
          height: 60,
          angle: 0,
          strokeColor: '#1e1e1e',
          backgroundColor: 'transparent',
          fillStyle: 'solid',
          strokeWidth: 2,
          strokeStyle: 'solid',
          roughness: 1,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: 1,
          version: 1,
          versionNonce: 1,
          isDeleted: false,
          boundElements: null,
          updated: 1,
          link: null,
          locked: false,
          index: 'a0',
        } as never,
      ]}
    />,
  )
  await waitFor(() => expect(handle).toBeDefined())
  await sceneLoaded(handle!.api)
  return { ...handle!, box: view.container.firstElementChild as HTMLElement }
}

// Read from disk: the tests' CSS handling hands an import nothing.
const css = readFileSync('src/canvas/SheetCanvas.css', 'utf8').replace(/\s+/g, ' ')
const hiddenByCss = (selector: string) => css.includes(`.${VAULT_CLASS} ${selector}`)
const labelOf = (item: Element) => item.textContent?.trim()

describe('Excalidraw’s items hidden in the plugin (section 8, Inside an Obsidian tab)', () => {
  it('marks the canvas’s box in a vault only', async () => {
    const { box } = await mount()
    expect(box).toHaveClass(VAULT_CLASS)
    act(() => {
      document.body.replaceChildren()
    })
    const web = await mount(false)
    expect(web.box).not.toHaveClass(VAULT_CLASS)
  })

  it('hides every selector it names', () => {
    for (const selector of Object.values(VAULT_HIDDEN)) expect(hiddenByCss(selector)).toBe(true)
    expect(css).toMatch(/display: none/)
  })

  it('Web Embed and Mermaid to Excalidraw, in More tools, and the Generate heading over them', async () => {
    await mount()
    fireEvent.click(await screen.findByTitle('More tools'))
    await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
    const items = Array.from(document.querySelectorAll(VAULT_HIDDEN.embedAndMermaid), labelOf)
    expect(items).toEqual(['Web Embed', 'Mermaid to Excalidraw'])
    const headings = Array.from(document.querySelectorAll(VAULT_HIDDEN.generateHeading), labelOf)
    expect(headings).toEqual(['Generate'])
    // The rest stays: Excalidraw's other tools, the canary's new ones among them, and the app's own items.
    const kept = Array.from(
      document.querySelectorAll('.App-toolbar__extra-tools-dropdown .dropdown-menu-item'),
    ).filter((item) => !item.matches(VAULT_HIDDEN.embedAndMermaid))
    expect(kept.map((item) => item.querySelector('.dropdown-menu-item__text')?.textContent)).toEqual([
      'Insert image',
      'Frame tool',
      'Draw to shape',
      'Laser pointer',
      'Bucket fill',
      'Lasso selection',
      'Add math',
    ])
  })

  it('has no AI items in a vault', async () => {
    await mount()
    fireEvent.click(await screen.findByTitle('More tools'))
    expect(document.querySelector('[data-testid="toolbar-magicframe"]')).toBeNull()
  })

  it('Browse libraries, in the library', async () => {
    const { api } = await mount()
    act(() => api.toggleSidebar({ name: 'default', tab: 'library', force: true }))
    await waitFor(() => expect(document.querySelector(VAULT_HIDDEN.browseLibraries)).not.toBeNull())
    expect(Array.from(document.querySelectorAll(VAULT_HIDDEN.browseLibraries), labelOf)).toEqual(['Browse libraries'])
  })

  it('Copy to clipboard as SVG, in the context menu (Copy to clipboard as PNG stays)', async () => {
    await mount()
    // On the empty canvas: the menu that offers both copies with nothing selected.
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.interactive')!
    fireEvent.contextMenu(canvas, { clientX: 600, clientY: 500 })
    await waitFor(() => expect(document.querySelector('.context-menu')).not.toBeNull())
    expect(Array.from(document.querySelectorAll(VAULT_HIDDEN.copyAsSvg), labelOf)).toEqual(['Copy to clipboard as SVG'])
    expect(document.querySelector('.context-menu [data-testid="copyAsPng"]')).not.toBeNull()
  })
})

describe('Excalidraw’s command palette and export keys in a vault (section 8)', () => {
  const press = (init: KeyboardEventInit) =>
    act(() => {
      fireEvent.keyDown(document.querySelector('.excalidraw')!, init)
    })

  it.each([
    ['Ctrl+/', { ctrlKey: true, key: '/' }],
    ['Ctrl+Shift+P', { ctrlKey: true, shiftKey: true, key: 'P' }],
  ])('%s opens no palette, without the confinement too: the package renders none', async (_name, init) => {
    const { api } = await mount()
    press(init)
    expect(api.getAppState().openDialog).toBeNull()
    stops.push(confineKeys(document.body))
    press(init)
    expect(api.getAppState().openDialog).toBeNull()
  })

  it('Ctrl+Shift+E opens no image export once confined (control: without, it does)', async () => {
    const { api } = await mount()
    stops.push(confineKeys(document.body))
    press({ ctrlKey: true, shiftKey: true, key: 'E' })
    expect(api.getAppState().openDialog).toBeNull()
    stops.shift()!()
    press({ ctrlKey: true, shiftKey: true, key: 'E' })
    expect(api.getAppState().openDialog).toEqual({ name: 'imageExport' })
  })

  it('Ctrl+P that Obsidian took shows no toast of Excalidraw’s (control: unconfined, it does)', async () => {
    const { api } = await mount()
    const obsidian = (event: KeyboardEvent) => event.preventDefault()
    window.addEventListener('keydown', obsidian, true)
    stops.push(() => window.removeEventListener('keydown', obsidian, true))
    press({ ctrlKey: true, key: 'p' })
    expect(api.getAppState().toast?.message).toMatch(/command palette/i)
    act(() => api.setToast(null))
    stops.push(confineKeys(document.body))
    press({ ctrlKey: true, key: 'p' })
    expect(api.getAppState().toast).toBeNull()
  })
})
