import { act, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements } from './mathAnchor.ts'
import {
  fileKeyRoute,
  measureBesideMenu,
  useFileRoutes,
  type FileRouteHandlers,
} from './fileRoutes.ts'
import { sceneLoaded } from '../test/excalidraw.ts'

/**
 * Contracts with Excalidraw 0.18's file routes and layout (ADR 0001): the
 * routes the app takes over still exist, the takeover still runs first, and
 * the class names the file name is placed by still render. An upgrade that
 * changes any of these fails here.
 */
const initialElements = createMathAnchorElements([
  { id: 'm1', x: 100, y: 100, width: 300, height: 60, source: 'a = 1' },
])

function Routes({ handlers }: { handlers: FileRouteHandlers }) {
  useFileRoutes(handlers)
  return null
}

async function mount({ takeOver }: { takeOver: boolean }) {
  let handle: SheetCanvasHandle | undefined
  const handlers = {
    save: vi.fn(),
    saveAs: vi.fn(),
    open: vi.fn(),
    openDropped: vi.fn<FileRouteHandlers['openDropped']>(),
  }
  render(
    <>
      <SheetCanvas initialElements={initialElements} onReady={(h) => (handle = h)} />
      {takeOver && <Routes handlers={handlers} />}
    </>,
  )
  await waitFor(() => expect(handle).toBeDefined())
  await sceneLoaded(handle!.api)
  const root = handle!.root.querySelector<HTMLElement>('.excalidraw')!
  const press = (key: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      shiftKey,
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      root.dispatchEvent(event)
    })
    return event
  }
  const drop = (file: File) => {
    const event = new Event('drop', { bubbles: true, cancelable: true })
    // What Excalidraw's drop handler reads from a real DataTransfer.
    const files = Object.assign([file], { item: (i: number) => [file][i] ?? null })
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        files,
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        types: ['Files'],
        getData: () => '',
      },
    })
    act(() => {
      root.dispatchEvent(event)
    })
    return event
  }
  return { api: handle!.api, handle: handle!, handlers, press, drop }
}

const exportDialogOpen = (api: SheetCanvasHandle['api']) =>
  api.getAppState().openDialog?.name === 'imageExport'

const sceneFile = () =>
  new File(
    [JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} })],
    'other.excalimathpad',
    { type: 'application/json' },
  )

describe('the routes Excalidraw 0.18 leaves open', () => {
  it('Ctrl+Shift+E opens its image export, with its file items turned off', async () => {
    const { api, press } = await mount({ takeOver: false })

    press('E', true)

    await waitFor(() => expect(exportDialogOpen(api)).toBe(true))
  })

  it('a dropped scene file replaces the scene', async () => {
    const { api, drop } = await mount({ takeOver: false })
    expect(api.getSceneElements()).toHaveLength(1)

    drop(sceneFile())

    await waitFor(() => expect(api.getSceneElements()).toHaveLength(0))
  })
})

describe('useFileRoutes on the real Excalidraw', () => {
  it('answers Ctrl+S, Ctrl+Shift+S and Ctrl+O before Excalidraw hears them', async () => {
    const { handlers, press, handle } = await mount({ takeOver: true })
    const heard = vi.fn()
    handle.root.querySelector('.excalidraw')!.addEventListener('keydown', heard)

    expect(press('s').defaultPrevented).toBe(true)
    expect(press('S', true).defaultPrevented).toBe(true)
    expect(press('o').defaultPrevented).toBe(true)

    expect(handlers.save).toHaveBeenCalledOnce()
    expect(handlers.saveAs).toHaveBeenCalledOnce()
    expect(handlers.open).toHaveBeenCalledOnce()
    expect(heard).not.toHaveBeenCalled()
  })

  it('swallows Ctrl+Shift+E, so the image export never opens', async () => {
    const { api, press } = await mount({ takeOver: true })

    expect(press('E', true).defaultPrevented).toBe(true)

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(exportDialogOpen(api)).toBe(false)
  })

  it('takes a dropped scene file, and Excalidraw keeps its scene', async () => {
    const { api, handlers, drop } = await mount({ takeOver: true })
    const file = sceneFile()

    expect(drop(file).defaultPrevented).toBe(true)

    expect(handlers.openDropped).toHaveBeenCalledWith(file, expect.any(Promise))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(api.getSceneElements()).toHaveLength(1)
  })

  it('leaves other drops, such as images, to Excalidraw', async () => {
    const { handlers, drop } = await mount({ takeOver: true })

    drop(new File(['x'], 'photo.png', { type: 'image/png' }))

    expect(handlers.openDropped).not.toHaveBeenCalled()
  })
})

describe('fileKeyRoute', () => {
  const key = (key: string, mods: Partial<KeyboardEventInit> = {}) =>
    fileKeyRoute(new KeyboardEvent('keydown', { key, ctrlKey: true, ...mods }))

  it.each([
    ['s', {}, 'save'],
    ['S', { shiftKey: true }, 'saveAs'],
    ['o', {}, 'open'],
    ['E', { shiftKey: true }, 'swallow'],
    ['s', { metaKey: true, ctrlKey: false }, 'save'],
  ] as const)('%s %o is %s', (k, mods, route) => {
    expect(key(k, mods)).toBe(route)
  })

  it.each([
    ['s', { ctrlKey: false }],
    ['s', { altKey: true }],
    ['O', { shiftKey: true }],
    ['e', {}],
    ['z', {}],
  ] as const)('%s %o is none of them', (k, mods) => {
    expect(key(k, mods)).toBeNull()
  })
})

describe('measureBesideMenu on the real Excalidraw', () => {
  it('finds the ☰ button and the toolbar by the class names it relies on', async () => {
    const { handle } = await mount({ takeOver: false })

    expect(handle.root.querySelector('.main-menu-trigger')).not.toBeNull()
    expect(handle.root.querySelector('.App-toolbar')).not.toBeNull()
  })

  it('puts the box right of the ☰ button and stops it short of the toolbar', async () => {
    const { handle } = await mount({ takeOver: false })
    const rect = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect
    vi.spyOn(handle.root, 'getBoundingClientRect').mockReturnValue(rect(10, 20, 1000, 700))
    vi.spyOn(handle.root.querySelector('.main-menu-trigger')!, 'getBoundingClientRect').mockReturnValue(
      rect(26, 36, 36, 36),
    )
    vi.spyOn(handle.root.querySelector('.App-toolbar')!, 'getBoundingClientRect').mockReturnValue(
      rect(300, 32, 400, 44),
    )

    // Trigger right edge 62 → 52 in the root, plus an 8 px gap; toolbar at 290, less 8.
    expect(measureBesideMenu(handle.root)).toEqual({ left: 60, top: 16, height: 36, maxWidth: 222 })
  })

  it('is null before Excalidraw lays out (jsdom)', async () => {
    const { handle } = await mount({ takeOver: false })

    expect(measureBesideMenu(handle.root)).toBeNull()
  })
})
