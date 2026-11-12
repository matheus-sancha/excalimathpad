import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SheetCanvas } from './SheetCanvas.tsx'
import { closeMoreTools } from './moreTools.ts'

/**
 * Contract tests on the real Excalidraw 0.18.1 (ADR 0001): `moreTools.ts`
 * draws the app's items into Excalidraw's More tools dropdown, which has no
 * public slot, so it leans on the dropdown's class names and on the button
 * that opens it. An upgrade that renames either fails here first.
 */
describe("Excalidraw's More tools dropdown", () => {
  const mount = async () => {
    const view = render(<SheetCanvas />)
    const trigger = await screen.findByTitle('More tools')
    return { root: view.container.firstElementChild as HTMLElement, trigger }
  }

  it('is opened by the button the app marks, and holds its items in the container the app appends to', async () => {
    const { trigger } = await mount()
    expect(trigger).toHaveClass('App-toolbar__extra-tools-trigger')

    fireEvent.click(trigger)

    const menu = document.querySelector('.App-toolbar__extra-tools-dropdown .dropdown-menu-container')
    expect(menu).not.toBeNull()
    expect(menu!.querySelector('.dropdown-menu-item.dropdown-menu-item-base .dropdown-menu-item__text')).not.toBeNull()
  })

  it("takes the app's items last, under Excalidraw's own, and keeps them through a re-render", async () => {
    const { trigger } = await mount()

    fireEvent.click(trigger)
    await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())

    const menu = document.querySelector('.App-toolbar__extra-tools-dropdown .dropdown-menu-container')!
    expect(menu.lastElementChild).toHaveClass('math-tools')
    const labels = Array.from(menu.querySelectorAll('.dropdown-menu-item__text'), (item) => item.textContent)
    expect(labels.slice(0, 3)).toEqual(['Frame tool', 'Web Embed', 'Laser pointer'])
    expect(labels.at(-1)).toBe('Add math')

    // Choosing the hand tool re-renders the toolbar with the dropdown open.
    act(() => {
      fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'h' })
    })
    expect(document.querySelectorAll('.math-tools')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Add math/ })).toBeInTheDocument()
  })

  it('closes from closeMoreTools, and is drawn afresh the next time it opens', async () => {
    const { root, trigger } = await mount()
    fireEvent.click(trigger)
    await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())

    act(() => closeMoreTools(root))
    await waitFor(() => expect(document.querySelector('.App-toolbar__extra-tools-dropdown')).toBeNull())
    // Closed already: a second call must not open it again.
    act(() => closeMoreTools(root))
    expect(document.querySelector('.App-toolbar__extra-tools-dropdown')).toBeNull()

    fireEvent.click(trigger)
    await waitFor(() => expect(document.querySelectorAll('.math-tools button')).toHaveLength(1))
  })
})
