import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
  const sources = () => JSON.stringify(scene.map((e) => e.customData?.source))
  // A line commit takes several updates; only one of them changes a source.
  let sourceWrites = 0
  const updateScene = vi.fn((data: { elements?: unknown }) => {
    const before = sources()
    if (data.elements) scene = data.elements as ExcalidrawElement[]
    if (sources() !== before) sourceWrites++
    act(() => changeListeners.forEach((cb) => cb()))
  })
  const api: SceneApi = {
    getSceneElements: () => scene.filter((e) => !e.isDeleted) as never,
    getSceneElementsIncludingDeleted: () => scene as never,
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
    updateScene: updateScene as never,
  }
  return {
    api,
    updateScene,
    sourceWrites: () => sourceWrites,
    sourceOf: (id: string) => scene.find((e) => e.id === id)?.customData?.source as string,
    listenerCount: () => changeListeners.size + scrollListeners.size,
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

const box = { x: 100, y: 50, width: 400, height: 96 }
const [anchor] = createMathAnchorElements([{ id: 'm1', ...box }])
const [plainRect] = createMathAnchorElements([
  { id: 'r1', x: 0, y: 0, width: 10, height: 10 },
]).map((e) => ({ ...e, customData: undefined }))

const anchorWith = (source: string) =>
  createMathAnchorElements([{ id: 'm1', ...box, source }])[0]

const elementOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)

function renderOverlay(elements: ExcalidrawElement[]) {
  const scene = fakeScene(elements)
  const forwardWheel = vi.fn()
  const focusCanvas = vi.fn()
  const view = render(
    <MathOverlay api={scene.api} forwardWheel={forwardWheel} focusCanvas={focusCanvas} />,
  )
  return { scene, forwardWheel, focusCanvas, unmount: view.unmount }
}

const resultsOf = (id: string) =>
  elementOf(id)!.querySelector('.math-element__results')!.textContent!.trim()

function openLine(n: number, id = 'm1') {
  fireEvent.click(within(elementOf(id)!).getByRole('button', { name: `Edit line ${n}` }))
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Line source' })
}

function type(field: HTMLInputElement, text: string) {
  fireEvent.input(field, { target: { value: text } })
}

const openField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Line source' })

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

  it('rotates the body about its centre with the anchor', () => {
    const { scene } = renderOverlay([anchor])

    scene.updateElements([{ ...anchor, angle: Math.PI / 2 } as ExcalidrawElement])

    const el = elementOf('m1')!
    // Position stays the unrotated top-left; the body turns about its centre,
    // which is Excalidraw's rotation rule.
    expect(el.style.transform).toBe('translate(100px, 50px) scale(1)')
    const body = el.querySelector<HTMLElement>('.math-element__body')!
    expect(body.style.transform).toBe(`rotate(${Math.PI / 2}rad)`)
  })

  it('removes the element when its anchor is deleted', () => {
    const { scene } = renderOverlay([anchor])

    scene.updateElements([{ ...anchor, isDeleted: true }])

    expect(elementOf('m1')).toBeNull()
  })

  it('evaluates the source from the anchor and re-evaluates on each keystroke', () => {
    renderOverlay([anchorWith('R = 10 kohm\nI = 2 mA\nI * R')])
    expect(resultsOf('m1')).toBe('= 20 V')

    type(openLine(3), 'R + I')

    expect(resultsOf('m1')).toBe('Units do not match')
  })

  it('re-evaluates when the source in the scene changes, as an undo does', () => {
    const { scene } = renderOverlay([anchorWith('I = 2 mA\nI * 2')])
    expect(resultsOf('m1')).toBe('= 4 mA')

    scene.updateElements([anchorWith('I = 3 mA\nI * 2')])

    expect(resultsOf('m1')).toBe('= 6 mA')
    expect(screen.getByRole('button', { name: 'Edit line 1' })).toHaveTextContent('I = 3 mA')
  })

  it('keeps one row per line beside one result per line', () => {
    renderOverlay([anchorWith('a = 1\nb = 2\n\nd = 4')])
    const lines = within(screen.getByRole('list', { name: 'Lines' })).getAllByRole('listitem')
    const results = within(screen.getByRole('list', { name: 'Results' })).getAllByRole('listitem')

    expect(lines).toHaveLength(4)
    expect(results).toHaveLength(4)
  })

  describe('line edit', () => {
    it('shows the line in a field with the caret at the end', () => {
      renderOverlay([anchorWith('a = 1\nb = 2')])

      const field = openLine(2)

      expect(field.value).toBe('b = 2')
      expect(document.activeElement).toBe(field)
      expect(field.selectionStart).toBe(5)
      expect(field.selectionEnd).toBe(5)
    })

    it('writes nothing for keystrokes', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)

      type(field, 'a = 12')
      type(field, 'a = 123')

      expect(scene.sourceWrites()).toBe(0)
      expect(scene.sourceOf('m1')).toBe('a = 1')
    })

    it('never sets the field while typing, which would clear its text undo', () => {
      renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      type(field, 'a = 12')
      const setValue = vi.spyOn(field, 'value', 'set')

      act(() => field.dispatchEvent(new Event('input', { bubbles: true })))

      expect(setValue).not.toHaveBeenCalled()
      // Nor React's rewrite of the value attribute, from a changing defaultValue.
      expect(field.getAttribute('value')).toBe('a = 1')
    })

    it('Esc writes the typed line once, ends the edit and gives the keyboard back', () => {
      const { scene, focusCanvas } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      type(field, 'a = 2')

      fireEvent.keyDown(field, { key: 'Escape' })

      expect(openField()).toBeNull()
      expect(scene.sourceWrites()).toBe(1)
      expect(scene.sourceOf('m1')).toBe('a = 2')
      expect(focusCanvas).toHaveBeenCalledOnce()
    })

    it('a line left unchanged writes nothing', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])

      fireEvent.keyDown(openLine(1), { key: 'ArrowDown' })
      fireEvent.keyDown(openField()!, { key: 'Escape' })

      expect(scene.sourceWrites()).toBe(0)
    })

    it('blur writes the typed line and ends the edit', () => {
      const { scene, focusCanvas } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      type(field, 'a = 2')

      act(() => field.blur())

      expect(openField()).toBeNull()
      expect(scene.sourceWrites()).toBe(1)
      expect(scene.sourceOf('m1')).toBe('a = 2')
      expect(focusCanvas).not.toHaveBeenCalled()
    })

    // The field stays the active element while the window is away.
    it('stays open when only the window lost focus', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      type(field, 'a = 2')

      fireEvent.blur(field)

      expect(openField()).toBe(field)
      expect(scene.sourceWrites()).toBe(0)
    })

    it('ArrowUp and ArrowDown stay put, and write nothing, at the ends', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      const first = openLine(1)
      type(first, 'typed')

      fireEvent.keyDown(first, { key: 'ArrowUp' })

      expect(openField()).toBe(first)
      expect(first.value).toBe('typed')
      expect(scene.sourceWrites()).toBe(0)
    })

    it('Enter splits at the caret and continues at the start of the new line', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      field.setSelectionRange(3, 3)

      fireEvent.keyDown(field, { key: 'Enter' })

      expect(scene.sourceWrites()).toBe(1)
      expect(scene.sourceOf('m1')).toBe('a =\n 1')
      const next = openField()!
      expect(next).not.toBe(field)
      expect(next.value).toBe(' 1')
      expect(next.selectionStart).toBe(0)
    })

    it('Enter with a selection replaces the selection', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      field.setSelectionRange(1, 3)

      fireEvent.keyDown(field, { key: 'Enter' })

      expect(scene.sourceOf('m1')).toBe('a\n 1')
      expect(openField()!.value).toBe(' 1')
    })

    // Enter ends an IME's composition; it isn't the user's Enter.
    it('leaves keys alone during IME composition', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)

      const notPrevented = fireEvent.keyDown(field, { key: 'Enter', isComposing: true })

      expect(notPrevented).toBe(true)
      expect(openField()).toBe(field)
      expect(scene.sourceWrites()).toBe(0)
    })

    it('Backspace over a selection from the start deletes it, without a join', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      const field = openLine(2)
      field.setSelectionRange(0, 3)

      const notPrevented = fireEvent.keyDown(field, { key: 'Backspace' })

      expect(notPrevented).toBe(true)
      expect(openField()).toBe(field)
      expect(scene.sourceWrites()).toBe(0)
    })

    it('Backspace at the start joins, with the caret at the join', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      const field = openLine(2)
      field.setSelectionRange(0, 0)

      fireEvent.keyDown(field, { key: 'Backspace' })

      expect(scene.sourceWrites()).toBe(1)
      expect(scene.sourceOf('m1')).toBe('a = 1b = 2')
      const joined = openField()!
      expect(joined.value).toBe('a = 1b = 2')
      expect(joined.selectionStart).toBe(5)
    })

    it('Backspace elsewhere stays the field’s own', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      const field = openLine(2)

      const notPrevented = fireEvent.keyDown(field, { key: 'Backspace' })

      expect(notPrevented).toBe(true)
      expect(scene.sourceWrites()).toBe(0)
    })

    it('Backspace on the first line stays the field’s own', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      field.setSelectionRange(0, 0)

      fireEvent.keyDown(field, { key: 'Backspace' })

      expect(openField()).toBe(field)
      expect(scene.sourceWrites()).toBe(0)
    })

    it('holds at most one line in source form across the sheet', () => {
      const [first, second] = createMathAnchorElements([
        { id: 'm1', x: 0, y: 0, width: 100, height: 50, source: 'a = 1' },
        { id: 'm2', x: 0, y: 100, width: 100, height: 50, source: 'b = 2' },
      ])
      const { scene } = renderOverlay([first, second])
      type(openLine(1, 'm1'), 'a = 9')

      const next = openLine(1, 'm2')

      expect(screen.getAllByRole('textbox', { name: 'Line source' })).toEqual([next])
      expect(scene.sourceOf('m1')).toBe('a = 9')
    })

    it('drops the edit, writing nothing, when its anchor has gone', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)
      type(field, 'a = 2')

      scene.updateElements([{ ...anchorWith('a = 1'), isDeleted: true }])
      fireEvent.keyDown(field, { key: 'Escape' })

      expect(openField()).toBeNull()
      expect(scene.sourceWrites()).toBe(0)
    })
  })

  describe('across elements (one sheet, reading order)', () => {
    const [inputs, uses] = createMathAnchorElements([
      { id: 'inputs', x: 100, y: 50, width: 400, height: 72, source: 'R = 10 kohm\nI = 2 mA' },
      { id: 'uses', x: 100, y: 200, width: 400, height: 48, source: 'U = I * R' },
    ])

    it('recalculates a later element while an earlier one is typed in', () => {
      renderOverlay([inputs, uses])
      expect(resultsOf('uses')).toBe('= 20 V')

      type(openLine(2, 'inputs'), 'I = 4 mA')

      expect(resultsOf('uses')).toBe('= 40 V')
    })

    it('re-evaluates in the new order when an anchor moves above another', () => {
      const { scene } = renderOverlay([inputs, uses])

      scene.updateElements([inputs, { ...uses, y: 0 }])

      expect(resultsOf('uses')).toBe('I is defined below')
      // Long results are cut to fit; the full text stays in the title.
      expect(screen.getByTitle('I is defined below')).toHaveClass('is-error')

      scene.updateElements([inputs, uses])
      expect(resultsOf('uses')).toBe('= 20 V')
    })

    it('loses the inputs when their element is deleted, and gets them back on undo', () => {
      const { scene } = renderOverlay([inputs, uses])

      scene.updateElements([{ ...inputs, isDeleted: true }, uses])
      expect(resultsOf('uses')).toBe('Undefined symbol I')

      // Excalidraw's undo brings the anchor back, with its source in it.
      scene.updateElements([inputs, uses])
      expect(resultsOf('uses')).toBe('= 20 V')
    })
  })

  it('unsubscribes from Excalidraw when unmounted', () => {
    const { scene, unmount } = renderOverlay([anchor])
    expect(scene.listenerCount()).toBe(2)

    unmount()

    expect(scene.listenerCount()).toBe(0)
  })

  it('forwards wheel events over a math element to the canvas', () => {
    const { forwardWheel } = renderOverlay([anchor])

    fireEvent.wheel(screen.getByRole('button', { name: 'Edit line 1' }), {
      deltaY: 50,
    })

    expect(forwardWheel).toHaveBeenCalledOnce()
  })
})
