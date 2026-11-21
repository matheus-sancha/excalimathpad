import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SheetCanvas, type ImageToolSlot, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { IMAGE_TOO_BIG, IMAGE_TOOL_SELECTOR, insertImage, MAX_IMAGE_BYTES, type PickedImage } from './imageTool.ts'
import { sceneLoaded } from '../test/excalidraw.ts'

/**
 * Contracts with Excalidraw's image tool (ADR 0001; docs/spec-v1.md section
 * 12a, Reach), on the canary `0.18.0-9fbeaed`: it is the menu item
 * `[data-testid="toolbar-image"]` of More tools, a click on it or the key 9
 * starts the tool and its file picker, and the takeover stops both before
 * Excalidraw hears them. An upgrade
 * that changes any of these fails here. Each takeover check has a control
 * without it, showing the press really does start Excalidraw's own tool.
 */

const PNG: PickedImage = { mimeType: 'image/png', bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]).buffer }

afterEach(() => vi.restoreAllMocks())

async function mount(imageTool?: ImageToolSlot) {
  let handle: SheetCanvasHandle | undefined
  const view = render(<SheetCanvas onReady={(h) => (handle = h)} imageTool={imageTool} />)
  await waitFor(() => expect(handle).toBeDefined())
  await sceneLoaded(handle!.api)
  return { api: handle!.api, root: handle!.root, container: view.container }
}

/** A slot whose picker resolves with `image`, heard on the page's body. */
function slot(image: PickedImage | null = null) {
  const pick = vi.fn(() => Promise.resolve(image))
  return { pick, slot: { keys: document.body, pick } satisfies ImageToolSlot }
}

const tool = () => document.querySelector<HTMLElement>(IMAGE_TOOL_SELECTOR)
const MORE_TOOLS = '.App-toolbar__extra-tools-dropdown'
/** Opens More tools, where the item is. */
const openMoreTools = () =>
  act(() => {
    document.querySelector<HTMLElement>('.App-toolbar__extra-tools-trigger')!.click()
  })
const pressKey9 = () =>
  fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: '9', code: 'Digit9' })

describe("Excalidraw's image tool (the seam)", () => {
  it('is a menu item marked toolbar-image in More tools, and not on the toolbar', async () => {
    await mount()
    expect(tool()).toBeNull()
    openMoreTools()
    expect(tool()).not.toBeNull()
    expect(tool()!.getAttribute('role')).toBe('menuitem')
    expect(tool()!.closest(MORE_TOOLS)).not.toBeNull()
  })

  it('control: a click on it starts the tool and its file picker', async () => {
    const { api } = await mount()
    const fileInput = vi.spyOn(HTMLInputElement.prototype, 'click')
    openMoreTools()
    act(() => {
      fireEvent.click(tool()!)
    })
    await waitFor(() => expect(api.getAppState().activeTool.type).toBe('image'))
    expect(fileInput.mock.contexts.some((input) => (input as HTMLInputElement).type === 'file')).toBe(true)
  })

  it('control: the key 9 starts it too', async () => {
    const { api } = await mount()
    act(() => {
      pressKey9()
    })
    await waitFor(() => expect(api.getAppState().activeTool.type).toBe('image'))
  })
})

describe('the takeover (in a vault)', () => {
  it('a click picks from the vault instead, and the tool stays as it was', async () => {
    const { pick, slot: imageTool } = slot()
    const { api } = await mount(imageTool)
    const fileInput = vi.spyOn(HTMLInputElement.prototype, 'click')
    openMoreTools()
    act(() => {
      // On the item's text, as a press lands: the takeover finds the item around it.
      fireEvent.click(tool()!.querySelector('.dropdown-menu-item__text')!)
    })
    expect(pick).toHaveBeenCalledTimes(1)
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
    expect(api.getAppState().activeTool.type).toBe('selection')
    // More tools closes, as it does when one of its items is chosen.
    expect(document.querySelector(`${MORE_TOOLS} .dropdown-menu-container`)).toBeNull()
    expect(fileInput.mock.contexts.filter((input) => (input as HTMLInputElement).type === 'file')).toEqual([])
  })

  it('the key 9 picks from the vault instead', async () => {
    const { pick, slot: imageTool } = slot()
    const { api } = await mount(imageTool)
    act(() => {
      pressKey9()
    })
    expect(pick).toHaveBeenCalledTimes(1)
    expect(api.getAppState().activeTool.type).toBe('selection')
  })

  it('9 typed in a field is only typing', async () => {
    const { pick, slot: imageTool } = slot()
    const { root } = await mount(imageTool)
    const field = root.appendChild(document.createElement('input'))
    fireEvent.keyDown(field, { key: '9' })
    expect(pick).not.toHaveBeenCalled()
  })

  it('a picked image is copied into the scene, selected, as one undo step', async () => {
    const image = class {
      naturalWidth = 400
      naturalHeight = 200
      onload: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', image)
    const { slot: imageTool } = slot(PNG)
    const { api } = await mount(imageTool)
    openMoreTools()
    act(() => {
      fireEvent.click(tool()!)
    })
    await waitFor(() => expect(api.getSceneElements()).toHaveLength(1))
    const [element] = api.getSceneElements()
    expect(element.type).toBe('image')
    const fileId = (element as { fileId: string }).fileId
    expect(fileId).toMatch(/^[0-9a-f]{40}$/)
    expect(api.getFiles()[fileId]).toMatchObject({ mimeType: 'image/png', dataURL: expect.stringMatching(/^data:image\/png;base64,/) })
    expect(element.width / element.height).toBeCloseTo(2)
    expect(api.getAppState().selectedElementIds).toEqual({ [element.id]: true })
    act(() => {
      fireEvent.keyDown(document.querySelector('.excalidraw')!, { key: 'z', code: 'KeyZ', ctrlKey: true })
    })
    expect(api.getSceneElements()).toHaveLength(0)
    vi.unstubAllGlobals()
  })

  it("an image over Excalidraw's 4 MB cap is refused with Excalidraw's own words", async () => {
    const { api } = await mount()
    await act(() =>
      insertImage(api, { mimeType: 'image/png', bytes: new ArrayBuffer(MAX_IMAGE_BYTES + 1) }, () =>
        Promise.resolve({ width: 1, height: 1 }),
      ),
    )
    expect(api.getSceneElements()).toHaveLength(0)
    expect(await screen.findByText(IMAGE_TOO_BIG)).toBeInTheDocument()
  })
})
