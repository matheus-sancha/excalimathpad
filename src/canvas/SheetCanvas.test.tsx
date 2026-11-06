import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements, isMathAnchor } from './mathAnchor.ts'

async function mount(props: Parameters<typeof SheetCanvas>[0] = {}) {
  const onReady = vi.fn<(handle: SheetCanvasHandle) => void>()
  const view = render(<SheetCanvas {...props} onReady={onReady} />)
  await waitFor(() => expect(onReady).toHaveBeenCalled())
  return { ...view, handle: onReady.mock.calls[0][0] }
}

describe('SheetCanvas', () => {
  it('hands its imperative API to the caller once mounted', async () => {
    const { handle } = await mount()

    // What the overlay relies on: scene + viewport state + subscriptions.
    expect(handle.api.getSceneElements()).toEqual([])
    expect(handle.api.getAppState().zoom.value).toBe(1)
    expect(typeof handle.api.onScrollChange).toBe('function')
    expect(typeof handle.api.onChange).toBe('function')
  })

  it('hands out the handle once, with the container it fills as its root', async () => {
    const onReady = vi.fn<(handle: SheetCanvasHandle) => void>()
    const { container, rerender } = render(<SheetCanvas onReady={onReady} />)
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    // A new onReady on a re-render doesn't hand the handle out again.
    rerender(<SheetCanvas onReady={(handle) => onReady(handle)} />)

    expect(onReady).toHaveBeenCalledOnce()
    const { root } = onReady.mock.calls[0][0]
    expect(root).toBe(container.firstElementChild)
    expect(root.querySelector('.excalidraw')).not.toBeNull()
  })

  it('starts with the given elements, math anchors recognisable', async () => {
    const initialElements = createMathAnchorElements([
      { id: 'm1', x: 10, y: 20, width: 300, height: 100 },
    ])
    const { handle } = await mount({ initialElements })

    const elements = handle.api.getSceneElements()
    expect(elements.map((e) => e.id)).toEqual(['m1'])
    expect(isMathAnchor(elements[0])).toBe(true)
    expect(elements[0]).toMatchObject({ x: 10, y: 20, width: 300, height: 100 })
  })

  it('gives the keyboard to Excalidraw on request', async () => {
    const { handle, container } = await mount()

    handle.focusCanvas()

    expect(document.activeElement).toBe(container.querySelector('.excalidraw'))
  })

  it('forwards a wheel event onto the canvas, so Excalidraw scrolls', async () => {
    const { handle, container } = await mount()
    const canvas = container.querySelector('canvas')!
    const seen = vi.fn()
    canvas.addEventListener('wheel', seen)
    const before = handle.api.getAppState().scrollY

    const original = new WheelEvent('wheel', {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    })
    handle.forwardWheel(original)

    expect(original.defaultPrevented).toBe(true)
    expect(seen).toHaveBeenCalledOnce()
    expect(seen.mock.calls[0][0].deltaY).toBe(100)
    await waitFor(() =>
      expect(handle.api.getAppState().scrollY).not.toBe(before),
    )
  })
})
