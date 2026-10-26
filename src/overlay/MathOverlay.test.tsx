import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState } from '@excalidraw/excalidraw/types'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { MathOverlay, type SceneApi } from './MathOverlay.tsx'

/**
 * A fake of the slice of Excalidraw's API the overlay uses: a mutable scene
 * and viewport, plus the two subscriptions. Tests change it the way
 * Excalidraw would and fire the matching callback.
 */
function fakeScene(elements: ExcalidrawElement[]) {
  let scene = elements
  let view = { scrollX: 0, scrollY: 0, zoom: 1 }
  const changeListeners = new Set<() => void>()
  const scrollListeners = new Set<() => void>()
  const api: SceneApi = {
    getSceneElements: () => scene.filter((e) => !e.isDeleted) as never,
    getAppState: () =>
      ({
        scrollX: view.scrollX,
        scrollY: view.scrollY,
        zoom: { value: view.zoom },
      }) as unknown as AppState,
    onChange: (cb) => {
      changeListeners.add(cb as () => void)
      return () => changeListeners.delete(cb as () => void)
    },
    onScrollChange: (cb) => {
      scrollListeners.add(cb as () => void)
      return () => scrollListeners.delete(cb as () => void)
    },
  }
  return {
    api,
    updateElements(next: ExcalidrawElement[]) {
      scene = next
      act(() => changeListeners.forEach((cb) => cb()))
    },
    scrollTo(next: typeof view) {
      view = next
      act(() => scrollListeners.forEach((cb) => cb()))
    },
  }
}

const [anchor] = createMathAnchorElements([
  { id: 'm1', x: 100, y: 50, width: 400, height: 96 },
])
const [plainRect] = createMathAnchorElements([
  { id: 'r1', x: 0, y: 0, width: 10, height: 10 },
]).map((e) => ({ ...e, customData: undefined }))

const elementOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)

function renderOverlay(elements: ExcalidrawElement[], sources = {}) {
  const scene = fakeScene(elements)
  const forwardWheel = vi.fn()
  render(
    <MathOverlay api={scene.api} forwardWheel={forwardWheel} initialSources={sources} />,
  )
  return { scene, forwardWheel }
}

describe('MathOverlay', () => {
  it('places each math element at its anchor, ignoring other elements', () => {
    renderOverlay([anchor, plainRect])

    const el = elementOf('m1')!
    expect(el.style.transform).toBe('translate(100px, 50px) scale(1)')
    expect(el.style.width).toBe('400px')
    expect(el.style.height).toBe('96px')
    expect(elementOf('r1')).toBeNull()
  })

  it('follows the anchor when Excalidraw moves it', () => {
    const { scene } = renderOverlay([anchor])

    scene.updateElements([{ ...anchor, x: 300, y: 220 }])

    expect(elementOf('m1')!.style.transform).toBe('translate(300px, 220px) scale(1)')
  })

  it('stays glued to the scene position through pan and zoom', () => {
    const { scene } = renderOverlay([anchor])

    scene.scrollTo({ scrollX: -40, scrollY: 25, zoom: 2 })

    // (100 - 40) * 2, (50 + 25) * 2
    expect(elementOf('m1')!.style.transform).toBe('translate(120px, 150px) scale(2)')
  })

  it('removes the element when its anchor is deleted', () => {
    const { scene } = renderOverlay([anchor])

    scene.updateElements([{ ...anchor, isDeleted: true }])

    expect(elementOf('m1')).toBeNull()
  })

  it('evaluates the source and re-evaluates on edit', () => {
    renderOverlay([anchor], { m1: 'R = 10 kohm\nI = 2 mA\nI * R' })
    const results = screen.getByRole('list', { name: 'Results' })
    expect(results).toHaveTextContent('= 10 kohm= 2 mA= 20 V')

    fireEvent.change(screen.getByRole('textbox', { name: 'Math source' }), {
      target: { value: 'R = 10 kohm\nI = 2 mA\nR + I' },
    })

    expect(results).toHaveTextContent('Units do not match')
  })

  it('forwards wheel events over a math element to the canvas', () => {
    const { forwardWheel } = renderOverlay([anchor])

    fireEvent.wheel(screen.getByRole('textbox', { name: 'Math source' }), {
      deltaY: 50,
    })

    expect(forwardWheel).toHaveBeenCalledOnce()
  })
})
