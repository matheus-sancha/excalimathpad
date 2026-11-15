import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { isPlacing } from '../canvas/addMath.ts'
import { sceneLoaded } from '../test/excalidraw.ts'

/**
 * ☰ → Math guide (docs/spec-v1.md section 8, Math guide, M4d), against the
 * real Excalidraw component: the item sits just above Excalidraw's Help, the
 * dialog opens at the top of the guide, inside Excalidraw's box, and closes on
 * Esc, ✕ or a click outside. A key in it is never the sheet's.
 */
async function mount() {
  let handle: SheetCanvasHandle | undefined
  render(<SheetCanvas onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  await sceneLoaded(handle!.api)
  return handle!
}

function menuItems(): string[] {
  return Array.from(document.querySelectorAll('.dropdown-menu .dropdown-menu-item__text'), (item) =>
    (item.textContent ?? '').trim(),
  )
}

async function openFromMenu() {
  fireEvent.click(screen.getByTestId('main-menu-trigger'))
  fireEvent.click(screen.getByTestId('math-guide-item'))
  return screen.findByRole('dialog', { name: 'Math guide' })
}

describe('☰ → Math guide', () => {
  it('sits just above Excalidraw’s Help', async () => {
    await mount()
    fireEvent.click(screen.getByTestId('main-menu-trigger'))
    const items = menuItems()
    expect(items.indexOf('Math guide')).toBeGreaterThanOrEqual(0)
    expect(items[items.indexOf('Math guide') + 1]).toBe('Help')
  })

  it('opens the guide inside Excalidraw’s box, at its contents list, with the keyboard', async () => {
    const handle = await mount()
    const dialog = await openFromMenu()
    expect(dialog.closest('.excalidraw')).toBe(handle.root.querySelector('.excalidraw'))
    expect(screen.queryByTestId('build-stamp')).toBeNull()
    const body = dialog.querySelector<HTMLElement>('.math-guide__body')!
    expect(body.scrollTop).toBe(0)
    expect(document.activeElement).toBe(body)
    const contents = Array.from(body.querySelectorAll('ol')[0].querySelectorAll('a'), (a) => a.textContent)
    expect(contents).toHaveLength(17)
    expect(contents[0]).toBe('A first sheet')
    expect(contents[16]).toBe('Common messages')
    // Every link goes to a heading inside the dialog.
    for (const link of body.querySelectorAll('a')) {
      expect(body.querySelector(`[id="math-guide-${link.getAttribute('href')!.slice(1)}"]`), link.textContent!).not.toBeNull()
    }
  })

  it('follows its own links inside the dialog, not through the page’s address', async () => {
    await mount()
    const dialog = await openFromMenu()
    const link = Array.from(dialog.querySelectorAll('a')).find((a) => a.textContent === 'Solve')!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    act(() => {
      link.dispatchEvent(click)
    })
    expect(click.defaultPrevented).toBe(true)
    expect(window.location.hash).toBe('')
  })

  it('closes on Esc, and a key in it reaches neither Excalidraw nor the sheet', async () => {
    const handle = await mount()
    const dialog = await openFromMenu()
    const body = dialog.querySelector('.math-guide__body')!
    // M in the dialog is no Add math, and R no rectangle tool.
    fireEvent.keyDown(body, { key: 'm', code: 'KeyM' })
    fireEvent.keyDown(body, { key: 'r', code: 'KeyR' })
    expect(isPlacing(handle.api.getAppState())).toBe(false)
    expect(handle.api.getAppState().activeTool.type).toBe('selection')
    fireEvent.keyDown(body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Math guide' })).toBeNull())
  })

  it('closes on ✕', async () => {
    await mount()
    await openFromMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Math guide' })).toBeNull())
  })

  it('closes on a click outside, but not on a press that started inside', async () => {
    await mount()
    const dialog = await openFromMenu()
    const backdrop = dialog.parentElement!
    // A text selection dragged out of the dialog: pressed inside, released outside.
    fireEvent.pointerDown(dialog)
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog', { name: 'Math guide' })).not.toBeNull()
    fireEvent.pointerDown(backdrop)
    fireEvent.click(backdrop)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Math guide' })).toBeNull())
  })

  it('opens from the handle too, as Obsidian’s Open Math guide does', async () => {
    const handle = await mount()
    act(() => handle.openMathGuide())
    expect(await screen.findByRole('dialog', { name: 'Math guide' })).not.toBeNull()
  })
})
