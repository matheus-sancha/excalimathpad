import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState } from '@excalidraw/excalidraw/types'
import { DARK_THEME_FILTER } from '../canvas/layers.ts'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { linePoint } from '../test/gestures.ts'
import { fireResizeObservers, layOutBodies } from '../test/layout.ts'
import { linesOf, resultsOf as sheetResults } from '../test/sheetView.ts'
import { MathOverlay, type SceneApi } from './MathOverlay.tsx'

/**
 * A fake of the slice of Excalidraw's API the overlay uses: a mutable scene,
 * viewport and selection, plus the two subscriptions. Tests change it the way
 * Excalidraw would and fire the matching callback. It does no hit-testing:
 * `select` stands in for the click Excalidraw would have handled.
 */
function fakeScene(elements: ExcalidrawElement[]) {
  let scene = elements
  let view = { scrollX: 0, scrollY: 0, zoom: 1 }
  let selectedElementIds: Record<string, true> = {}
  let tool: { type: string; customType?: string | null } = { type: 'selection' }
  let theme = 'light'
  let busy: Partial<AppState> = {}
  const changeListeners = new Set<() => void>()
  const scrollListeners = new Set<() => void>()
  const pointerUpListeners = new Set<(...args: unknown[]) => void>()
  const sources = () => JSON.stringify(scene.map((e) => e.customData?.source))
  // A line commit takes several updates; only one of them changes a source.
  let sourceWrites = 0
  const updateScene = vi.fn((data: { elements?: unknown; appState?: Partial<AppState> }) => {
    const before = sources()
    if (data.elements) scene = data.elements as ExcalidrawElement[]
    if (data.appState?.selectedElementIds) {
      selectedElementIds = { ...data.appState.selectedElementIds }
    }
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
        offsetLeft: 0,
        offsetTop: 0,
        activeTool: tool,
        selectedElementIds,
        theme,
        ...busy,
      }) as unknown as AppState,
    onChange: (cb) => {
      changeListeners.add(cb as () => void)
      return () => changeListeners.delete(cb as () => void)
    },
    onScrollChange: (cb) => {
      scrollListeners.add(cb as () => void)
      return () => scrollListeners.delete(cb as () => void)
    },
    onPointerUp: (cb) => {
      pointerUpListeners.add(cb as never)
      return () => pointerUpListeners.delete(cb as never)
    },
    updateScene: updateScene as never,
    setActiveTool: ((next: typeof tool) => {
      tool = next
      act(() => changeListeners.forEach((cb) => cb()))
    }) as never,
    setCursor: () => {},
  }
  return {
    api,
    updateScene,
    sourceWrites: () => sourceWrites,
    sourceOf: (id: string) => scene.find((e) => e.id === id)?.customData?.source as string,
    listenerCount: () => changeListeners.size + scrollListeners.size + pointerUpListeners.size,
    updateElements(next: ExcalidrawElement[]) {
      scene = next
      act(() => changeListeners.forEach((cb) => cb()))
    },
    scrollTo(next: typeof view) {
      view = next
      act(() => scrollListeners.forEach((cb) => cb()))
    },
    select(...ids: string[]) {
      selectedElementIds = Object.fromEntries(ids.map((id) => [id, true as const]))
    },
    selected: () => Object.keys(selectedElementIds),
    setTool(next: string) {
      tool = { type: next }
    },
    tool: () => tool,
    /** Excalidraw's app state while a gesture or editor is under way, or `{}` once idle. */
    setBusy(next: Partial<AppState>) {
      busy = next
      act(() => changeListeners.forEach((cb) => cb()))
    },
    /** Excalidraw lets go of a press, with the state it kept from the press. */
    pointerUp(pointerDownState: unknown) {
      act(() => pointerUpListeners.forEach((cb) => cb(tool, pointerDownState)))
    },
    elementOf: (id: string) => scene.find((e) => e.id === id)!,
    setTheme(next: 'light' | 'dark') {
      theme = next
      act(() => changeListeners.forEach((cb) => cb()))
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

/** Stands in for the box Excalidraw fills, where the gestures listen. */
let canvasRoot: HTMLElement
let current: ReturnType<typeof fakeScene>

function renderOverlay(elements: ExcalidrawElement[]) {
  const scene = fakeScene(elements)
  current = scene
  canvasRoot = document.body.appendChild(document.createElement('div'))
  onTestFinished(() => canvasRoot.remove())
  const forwardWheel = vi.fn()
  const focusCanvas = vi.fn()
  const view = render(
    <MathOverlay
      api={scene.api}
      canvasRoot={canvasRoot}
      forwardWheel={forwardWheel}
      focusCanvas={focusCanvas}
    />,
  )
  return { scene, forwardWheel, focusCanvas, unmount: view.unmount }
}

const resultsOf = (id: string) => sheetResults(elementOf(id))

/** Excalidraw's first click selected the element; the double-click opens line `n`. */
function openLine(n: number, id = 'm1') {
  current.select(id)
  fireEvent.doubleClick(canvasRoot, linePoint(id, n))
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Line source' })
}

const rowOf = (id: string, n: number) =>
  elementOf(id)!.querySelector<HTMLElement>(`[data-line="${n - 1}"]`)!

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
    // About the anchor's centre, whatever the content measures.
    expect(body.style.transformOrigin).toBe('200px 48px')
  })

  it('removes the element when its anchor is deleted', () => {
    const { scene } = renderOverlay([anchor])

    scene.updateElements([{ ...anchor, isDeleted: true }])

    expect(elementOf('m1')).toBeNull()
  })

  it('evaluates the source from the anchor and re-evaluates on each keystroke', () => {
    renderOverlay([anchorWith('R = 10 kohm\nI = 2 mA\nI * R')])
    expect(resultsOf('m1')).toBe('20 V')

    type(openLine(3), 'R + I')

    expect(resultsOf('m1')).toBe('Units do not match')
  })

  it('re-evaluates when the source in the scene changes, as an undo does', () => {
    const { scene } = renderOverlay([anchorWith('I = 2 mA\nI * 2')])
    expect(resultsOf('m1')).toBe('4 mA')

    scene.updateElements([anchorWith('I = 3 mA\nI * 2')])

    expect(resultsOf('m1')).toBe('6 mA')
    expect(rowOf('m1', 1)).toHaveAccessibleName('I = 3 mA')
  })

  it('keeps each result in its own line’s row', () => {
    renderOverlay([anchorWith('a = 1\nb = 2 * a\n\nd = 4 * b')])

    expect(linesOf(elementOf('m1')!)).toEqual(['a = 1', 'b = 2 * a', '', 'd = 4 * b'])
    expect(sheetResults(rowOf('m1', 2))).toBe('2')
    expect(sheetResults(rowOf('m1', 3))).toBe('')
    expect(sheetResults(rowOf('m1', 4))).toBe('8')
  })

  // docs/spec-v1.md section 4: Typeset grid, Problems, While editing a line.
  describe('typeset grid', () => {
    const cellOf = (n: number, cell: string) =>
      rowOf('m1', n).querySelector<HTMLElement>(`.math-element__${cell}`)

    it('typesets a value with KaTeX, without a leading =', () => {
      renderOverlay([anchorWith('x = 2 * 3 m')])

      expect(cellOf(1, 'name')!.querySelector('.katex')).not.toBeNull()
      expect(cellOf(1, 'defines')!.querySelector('.katex')).not.toBeNull()
      expect(cellOf(1, 'expression')!.querySelector('.katex')).not.toBeNull()
      const result = cellOf(1, 'result')!
      expect(result.querySelector('.katex')).not.toBeNull()
      expect(result.dataset.text).toBe('6 m')
      expect(result.textContent).not.toContain('=')
    })

    it('has no name or ≔ for a bare expression, so it starts at the left edge', () => {
      renderOverlay([anchorWith('2 * 4')])

      expect(cellOf(1, 'equation')).not.toBeNull()
      expect(cellOf(1, 'name')).toBeNull()
      expect(cellOf(1, 'defines')).toBeNull()
      expect(cellOf(1, 'expression')!.querySelector('.katex')).not.toBeNull()
      expect(cellOf(1, 'result')!.dataset.text).toBe('8')
    })

    // Each line is its own display, flush left (#62): CSS lays them out, and
    // jsdom does none, so Chromium holds the alignment itself.
    it('keeps name, ≔ and expression in one equation cell, in that order', () => {
      renderOverlay([anchorWith('R_1 = 10 kohm\nU = R_1 * 2 mA')])

      for (const n of [1, 2]) {
        const equation = cellOf(n, 'equation')!
        expect(Array.from(equation.children).map((part) => part.className)).toEqual([
          'math-element__name',
          'math-element__defines',
          'math-element__expression',
        ])
        // The row holds one equation, and the results sit beside it, not inside.
        expect(rowOf('m1', n).querySelectorAll('.math-element__equation')).toHaveLength(1)
        expect(equation.querySelector('.math-element__result')).toBeNull()
      }
    })

    it('leaves a plain input’s result cell empty and keeps its note in the note column', () => {
      renderOverlay([anchorWith('D = 102.3 mm # 4" Sch 40')])

      expect(cellOf(1, 'result')).toBeEmptyDOMElement()
      expect(cellOf(1, 'note')).toHaveTextContent('4" Sch 40')
    })

    it('shows a comment line as one text cell, with no result cell', () => {
      renderOverlay([anchorWith('# Water at 20 C\nx = 1')])

      expect(rowOf('m1', 1)).toHaveClass('is-comment')
      expect(cellOf(1, 'comment')).toHaveTextContent('Water at 20 C')
      expect(cellOf(1, 'result')).toBeNull()
    })

    it('keeps a blank line and a bare # as spacer rows', () => {
      renderOverlay([anchorWith('a = 1\n\n#\nb = 2')])

      for (const n of [2, 3]) {
        expect(rowOf('m1', n)).toHaveClass('is-blank')
        expect(cellOf(n, 'expression')).toBeNull()
      }
    })

    it('marks an error in the gutter, with its message in the result cell and on hover', () => {
      renderOverlay([anchorWith('x = 1 m + 2 s')])

      expect(cellOf(1, 'gutter')).toHaveTextContent('●')
      const result = cellOf(1, 'result')!
      expect(result).toHaveClass('is-error')
      expect(result).toHaveTextContent('Units do not match')
      expect(result).toHaveAttribute('title', 'Units do not match')
    })

    it('shows a line that doesn’t parse as its raw source, # part included, with no note cell', () => {
      renderOverlay([anchorWith('x = (1 + # oops')])

      expect(cellOf(1, 'gutter')).toHaveTextContent('●')
      expect(cellOf(1, 'raw')).toHaveTextContent('x = (1 + # oops')
      expect(cellOf(1, 'note')).toBeNull()
    })

    it('opens the field over the name, ≔ and expression cells, with the live result as text', () => {
      renderOverlay([anchorWith('x = 2 # two\ny = x * 3 m')])

      const field = openLine(2)
      type(field, 'y = x * 4 m')

      const cell = cellOf(2, 'field-cell')!
      expect(cell).toContainElement(field)
      // A hidden copy of the typed text widens the cell as you type.
      expect(cellOf(2, 'field-text')).toHaveTextContent('y = x * 4 m')
      expect(field.value).toBe('y = x * 4 m')
      const result = cellOf(2, 'result')!
      expect(result).toHaveTextContent('8 m')
      expect(result.querySelector('.katex')).toBeNull()
      expect(cellOf(2, 'note')).toBeNull()
    })

    it('keeps the note in the field while its line is edited', () => {
      renderOverlay([anchorWith('x = 2 # two')])

      expect(openLine(1).value).toBe('x = 2 # two')
      expect(cellOf(1, 'note')).toBeNull()
    })

    it('gives the field its minimum width only in an element with no source', () => {
      renderOverlay([anchorWith('x = 2')])
      openLine(1)
      expect(cellOf(1, 'field-cell')).not.toHaveClass('is-empty-element')
      cleanup()

      renderOverlay([anchorWith('')])
      openLine(1)
      expect(cellOf(1, 'field-cell')).toHaveClass('is-empty-element')
    })

    it('gives the field its minimum width once an element is emptied', () => {
      const { scene } = renderOverlay([anchorWith('x = 2\n')])
      const field = openLine(1)
      // Still has source until the line is written.
      type(field, '')
      expect(cellOf(1, 'field-cell')).not.toHaveClass('is-empty-element')

      // Down commits the line; the edit is still inside the element.
      fireEvent.keyDown(field, { key: 'ArrowDown' })
      expect(scene.sourceOf('m1')).toBe('\n')

      expect(cellOf(2, 'field-cell')).toHaveClass('is-empty-element')
    })

    it('draws its rows at the anchor’s opacity, the edited row at full (section 4)', () => {
      renderOverlay([{ ...anchorWith('x = 2\ny = 3'), opacity: 40 }])

      expect(elementOf('m1')!.style.getPropertyValue('--math-opacity')).toBe('0.4')

      // The stylesheet lifts the editing row back to full opacity by this class.
      openLine(1)
      expect(rowOf('m1', 1)).toHaveClass('is-editing')
      expect(rowOf('m1', 2)).not.toHaveClass('is-editing')
    })

    it('still evaluates an element at opacity 0', () => {
      renderOverlay([{ ...anchorWith('x = 2 m * 3'), opacity: 0 }])

      expect(elementOf('m1')!.style.getPropertyValue('--math-opacity')).toBe('0')
      expect(resultsOf('m1')).toBe('6 m')
    })

    it('darkens with Excalidraw’s own filter in its dark theme (#50)', () => {
      const { scene } = renderOverlay([anchorWith('x = 2')])
      const overlay = elementOf('m1')!.parentElement!
      expect(overlay.style.filter).toBe('')

      scene.setTheme('dark')
      expect(overlay.style.filter).toBe(DARK_THEME_FILTER)

      scene.setTheme('light')
      expect(overlay.style.filter).toBe('')
    })
  })

  // docs/spec-v1.md section 4, Size, and section 14: newElementWith + NEVER.
  describe('size', () => {
    const NEVER = 'NEVER'
    const sizeWrites = () =>
      current.updateScene.mock.calls.filter(([data]) => (data as { captureUpdate?: string }).captureUpdate === NEVER)

    function layOut(width: number, height: number) {
      onTestFinished(layOutBodies(() => ({ width, height })))
    }

    it('sizes the anchor to its content, top-left in place, with no undo step', () => {
      layOut(260, 120)
      const { scene } = renderOverlay([anchorWith('x = 1')])

      expect(sizeWrites()).toHaveLength(1)
      expect(scene.elementOf('m1')).toMatchObject({ x: 100, y: 50, width: 260, height: 120 })
    })

    it('writes once: the next render finds the anchor fits', () => {
      layOut(260, 120)
      const { scene } = renderOverlay([anchorWith('x = 1')])
      scene.scrollTo({ scrollX: 5, scrollY: 0, zoom: 1 })

      expect(sizeWrites()).toHaveLength(1)
    })

    it('writes nothing within half a pixel', () => {
      layOut(400.5, 96)
      renderOverlay([anchorWith('x = 1')])

      expect(sizeWrites()).toHaveLength(0)
    })

    it('writes nothing for content that isn’t laid out (0 × 0)', () => {
      renderOverlay([anchorWith('x = 1')])

      expect(sizeWrites()).toHaveLength(0)
    })

    it('runs each size write through keepClean, so a clean sheet stays clean', () => {
      layOut(260, 120)
      const keepClean = vi.fn((write: () => void) => write())
      const scene = fakeScene([anchorWith('x = 1')])
      current = scene
      canvasRoot = document.body.appendChild(document.createElement('div'))
      onTestFinished(() => canvasRoot.remove())
      render(
        <MathOverlay
          api={scene.api}
          canvasRoot={canvasRoot}
          forwardWheel={vi.fn()}
          focusCanvas={vi.fn()}
          keepClean={keepClean}
        />,
      )

      expect(keepClean).toHaveBeenCalledTimes(1)
      expect(scene.elementOf('m1').width).toBe(260)
    })

    it('waits while Excalidraw is busy, and writes at its next change once idle', () => {
      layOut(260, 120)
      const { scene } = renderOverlay([anchorWith('x = 1')])
      scene.updateElements([anchorWith('x = 1')])
      current.updateScene.mockClear()

      scene.setBusy({ isResizing: true })
      scene.updateElements([anchorWith('x = 2')])
      expect(sizeWrites()).toHaveLength(0)

      scene.setBusy({})
      expect(sizeWrites()).toHaveLength(1)
      expect(scene.elementOf('m1').width).toBe(260)
    })

    it('measures again when a body’s size changes, as when fonts load', () => {
      let width = 260
      onTestFinished(layOutBodies(() => ({ width, height: 120 })))
      const { scene } = renderOverlay([anchorWith('x = 1')])
      expect(scene.elementOf('m1').width).toBe(260)

      width = 280
      fireResizeObservers()

      expect(scene.elementOf('m1').width).toBe(280)
    })

    it('grows while a line is typed, keeping the same field', () => {
      let width = 260
      onTestFinished(layOutBodies(() => ({ width, height: 48 })))
      const { scene } = renderOverlay([anchorWith('x = 1')])
      const field = openLine(1)

      width = 340
      type(field, 'x = 1 + 2 + 3')

      expect(scene.elementOf('m1').width).toBe(340)
      expect(openField()).toBe(field)
      expect(document.activeElement).toBe(field)
      expect(current.sourceWrites()).toBe(0)
    })

    it('snaps a resize handle back to where the anchor was, x and y too', () => {
      layOut(400, 96)
      const { scene } = renderOverlay([anchorWith('x = 1')])
      const original = scene.elementOf('m1')

      // The top-right handle: Excalidraw moved y as well as the size.
      scene.updateElements([{ ...original, y: 5, width: 600, height: 141 }])
      scene.pointerUp({
        resize: { isResizing: true, handleType: 'ne' },
        originalElements: new Map([['m1', original]]),
      })

      expect(scene.elementOf('m1')).toMatchObject({ x: 100, y: 50, width: 400, height: 96 })
    })

    it('leaves the rotate handle’s work alone', () => {
      layOut(400, 96)
      const { scene } = renderOverlay([anchorWith('x = 1')])
      const original = scene.elementOf('m1')
      scene.updateElements([{ ...original, angle: 1 } as ExcalidrawElement])
      current.updateScene.mockClear()

      scene.pointerUp({
        resize: { isResizing: true, handleType: 'rotation' },
        originalElements: new Map([['m1', original]]),
      })

      expect(scene.elementOf('m1').angle).toBe(1)
      expect(sizeWrites()).toHaveLength(0)
    })
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

  describe('gestures', () => {
    const press = (point: { clientX: number; clientY: number }) =>
      fireEvent.pointerDown(canvasRoot, { ...point, button: 0 })
    const click = (point: { clientX: number; clientY: number }) => {
      press(point)
      fireEvent.click(canvasRoot, point)
    }

    it('takes no pointer events: rows are typeset text, not controls', () => {
      renderOverlay([anchorWith('a = 1\nb = 2')])

      expect(within(elementOf('m1')!).queryAllByRole('button')).toEqual([])
      expect(within(elementOf('m1')!).queryAllByRole('textbox')).toEqual([])
      expect(rowOf('m1', 2)).toHaveAccessibleName('b = 2')
    })

    it('a double-click on a selected element edits the line under it, caret at the end', () => {
      renderOverlay([anchorWith('a = 1\nb = 22\nc = 3')])
      current.select('m1')

      const notStopped = fireEvent.doubleClick(canvasRoot, linePoint('m1', 2))

      expect(notStopped).toBe(false)
      const field = openField()!
      expect(field.value).toBe('b = 22')
      expect(field.selectionStart).toBe(6)
      expect(document.activeElement).toBe(field)
    })

    it('a double-click below the last row edits the last line', () => {
      renderOverlay([anchorWith('a = 1\nb = 2')])
      current.select('m1')

      // Past the two rows, still inside the 96-unit anchor.
      fireEvent.doubleClick(canvasRoot, linePoint('m1', 3.5))

      expect(openField()!.value).toBe('b = 2')
    })

    it('finds the line through pan and zoom', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2\nc = 3')])
      scene.scrollTo({ scrollX: -40, scrollY: 25, zoom: 1.5 })
      current.select('m1')

      fireEvent.doubleClick(canvasRoot, linePoint('m1', 3))

      expect(openField()!.value).toBe('c = 3')
    })

    it('leaves a double-click to Excalidraw when the element is not selected', () => {
      renderOverlay([anchorWith('a = 1')])

      const notStopped = fireEvent.doubleClick(canvasRoot, linePoint('m1', 1))

      expect(notStopped).toBe(true)
      expect(openField()).toBeNull()
    })

    it('leaves a double-click to Excalidraw with another tool', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      current.select('m1')
      scene.setTool('rectangle')

      fireEvent.doubleClick(canvasRoot, linePoint('m1', 1))

      expect(openField()).toBeNull()
    })

    it('a double-click on a locked element with nothing selected edits it', () => {
      renderOverlay([{ ...anchorWith('a = 1'), locked: true }])

      const notStopped = fireEvent.doubleClick(canvasRoot, linePoint('m1', 1))

      expect(notStopped).toBe(false)
      expect(openField()!.value).toBe('a = 1')
    })

    it('Enter on one selected element edits its last line, caret at the end', () => {
      renderOverlay([anchorWith('a = 1\nb = 22')])
      current.select('m1')

      const notStopped = fireEvent.keyDown(document.body, { key: 'Enter' })

      expect(notStopped).toBe(false)
      expect(openField()!.value).toBe('b = 22')
      expect(openField()!.selectionStart).toBe(6)
    })

    it('Enter with a modifier, or with nothing selected, stays Excalidraw’s', () => {
      renderOverlay([anchorWith('a = 1')])

      fireEvent.keyDown(document.body, { key: 'Enter' })
      current.select('m1')
      fireEvent.keyDown(document.body, { key: 'Enter', shiftKey: true })

      expect(openField()).toBeNull()
    })

    it('Esc with a math element in the selection deselects, with no undo step', () => {
      const { scene } = renderOverlay([anchorWith('a = 1'), plainRect])
      current.select('m1', 'r1')

      const notStopped = fireEvent.keyDown(document.body, { key: 'Escape' })

      expect(notStopped).toBe(false)
      expect(scene.selected()).toEqual([])
      expect(scene.updateScene).toHaveBeenLastCalledWith(
        expect.objectContaining({ captureUpdate: 'NEVER' }),
      )
    })

    // Found in #43: the deselect stole Esc from the open-file question.
    it('leaves keys from the app’s own UI alone, such as a dialog', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      current.select('m1')
      const dialog = document.body.appendChild(document.createElement('div'))
      onTestFinished(() => dialog.remove())

      const notStopped = fireEvent.keyDown(dialog, { key: 'Escape' })

      expect(notStopped).toBe(true)
      expect(scene.selected()).toEqual(['m1'])
    })

    it('Esc with only drawings selected stays Excalidraw’s', () => {
      const { scene } = renderOverlay([anchorWith('a = 1'), plainRect])
      current.select('r1')

      fireEvent.keyDown(document.body, { key: 'Escape' })

      expect(scene.selected()).toEqual(['r1'])
    })

    it('the first Esc leaves the line and keeps the selection; the second deselects', () => {
      const { scene } = renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)

      fireEvent.keyDown(field, { key: 'Escape' })
      expect(openField()).toBeNull()
      expect(scene.selected()).toEqual(['m1'])

      fireEvent.keyDown(document.body, { key: 'Escape' })
      expect(scene.selected()).toEqual([])
    })

    it('a press outside the element writes the line once and leaves', () => {
      const { scene, focusCanvas } = renderOverlay([anchorWith('a = 1')])
      type(openLine(1), 'a = 2')

      click({ clientX: 5, clientY: 5 })

      expect(openField()).toBeNull()
      expect(scene.sourceWrites()).toBe(1)
      expect(scene.sourceOf('m1')).toBe('a = 2')
      expect(focusCanvas).toHaveBeenCalled()
    })

    it('a click on another line of the element moves the edit there, one write', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      type(openLine(1), 'a = 9')

      click(linePoint('m1', 2))

      expect(scene.sourceWrites()).toBe(1)
      expect(scene.sourceOf('m1')).toBe('a = 9\nb = 2')
      expect(openField()!.value).toBe('b = 2')
    })

    it('a double-click on another line while editing opens it with the caret at the end', () => {
      renderOverlay([anchorWith('a = 1\nb = 22')])
      openLine(1)

      // The double-click's first click moves the edit; its second lands in the field.
      click(linePoint('m1', 2))
      const field = openField()!
      const notPrevented = fireEvent.mouseDown(field, { detail: 2 })

      expect(notPrevented).toBe(false)
      expect(field.value).toBe('b = 22')
      expect(field.selectionStart).toBe(6)
      expect(field.selectionEnd).toBe(6)
    })

    it('a double-click made inside the field stays the browser’s own', () => {
      renderOverlay([anchorWith('a = 1')])
      const field = openLine(1)

      expect(fireEvent.mouseDown(field, { detail: 1 })).toBe(true)
      expect(fireEvent.mouseDown(field, { detail: 2 })).toBe(true)
    })

    it('a click on a drawing on top of the edited element leaves the edit left', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2'), plainRect])
      type(openLine(1), 'a = 9')
      const at = linePoint('m1', 2)

      press(at)
      // Excalidraw's press selected the drawing above the anchor.
      scene.select('r1')
      fireEvent.click(canvasRoot, at)

      expect(openField()).toBeNull()
      expect(scene.sourceOf('m1')).toBe('a = 9\nb = 2')
    })

    it('a press that turns into a drag leaves the edit and opens nothing', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      type(openLine(1), 'a = 9')
      const at = linePoint('m1', 2)

      press(at)
      // Excalidraw moves the anchor before the click arrives.
      scene.updateElements([{ ...anchorWith('a = 9\nb = 2'), x: 160 }])
      fireEvent.click(canvasRoot, at)

      expect(openField()).toBeNull()
      expect(scene.sourceOf('m1')).toBe('a = 9\nb = 2')
    })

    it('a click on another element while editing only leaves', () => {
      const [first, second] = createMathAnchorElements([
        { id: 'm1', x: 0, y: 0, width: 100, height: 50, source: 'a = 1' },
        { id: 'm2', x: 0, y: 100, width: 100, height: 50, source: 'b = 2' },
      ])
      renderOverlay([first, second])
      openLine(1, 'm1')

      click(linePoint('m2', 1))

      expect(openField()).toBeNull()
    })

    it('stops listening when unmounted', () => {
      const { unmount } = renderOverlay([anchorWith('a = 1')])
      current.select('m1')
      const at = linePoint('m1', 1)
      unmount()

      expect(fireEvent.keyDown(document.body, { key: 'Enter' })).toBe(true)
      expect(fireEvent.doubleClick(canvasRoot, at)).toBe(true)
    })
  })

  describe('across elements (one sheet, reading order)', () => {
    const [inputs, uses] = createMathAnchorElements([
      { id: 'inputs', x: 100, y: 50, width: 400, height: 72, source: 'R = 10 kohm\nI = 2 mA' },
      { id: 'uses', x: 100, y: 200, width: 400, height: 48, source: 'U = I * R' },
    ])

    it('recalculates a later element while an earlier one is typed in', () => {
      renderOverlay([inputs, uses])
      expect(resultsOf('uses')).toBe('20 V')

      type(openLine(2, 'inputs'), 'I = 4 mA')

      expect(resultsOf('uses')).toBe('40 V')
    })

    it('re-evaluates in the new order when an anchor moves above another', () => {
      const { scene } = renderOverlay([inputs, uses])

      scene.updateElements([inputs, { ...uses, y: 0 }])

      expect(resultsOf('uses')).toBe('I is defined below')
      // Long results are cut to fit; the full text stays in the title.
      expect(screen.getByTitle('I is defined below')).toHaveClass('is-error')

      scene.updateElements([inputs, uses])
      expect(resultsOf('uses')).toBe('20 V')
    })

    it('loses the inputs when their element is deleted, and gets them back on undo', () => {
      const { scene } = renderOverlay([inputs, uses])

      scene.updateElements([{ ...inputs, isDeleted: true }, uses])
      expect(resultsOf('uses')).toBe('Undefined symbol I')

      // Excalidraw's undo brings the anchor back, with its source in it.
      scene.updateElements([inputs, uses])
      expect(resultsOf('uses')).toBe('20 V')
    })
  })

  it('unsubscribes from Excalidraw when unmounted', () => {
    const { scene, unmount } = renderOverlay([anchor])
    // The scene and the scroll, sizes waiting on an idle change, snap-back, and
    // the placing click.
    expect(scene.listenerCount()).toBe(5)

    unmount()

    expect(scene.listenerCount()).toBe(0)
  })

  it('forwards wheel events over the line field to the canvas', () => {
    const { forwardWheel } = renderOverlay([anchor])

    fireEvent.wheel(openLine(1), { deltaY: 50 })

    expect(forwardWheel).toHaveBeenCalledOnce()
  })
})

describe('Add math and empty removal (docs/spec-v1.md sections 4 and 8)', () => {
  const pressOnCanvas = (key: string) => fireEvent.keyDown(canvasRoot, { key })
  const placeAt = (x: number, y: number) => current.pointerUp({ origin: { x, y }, resize: { isResizing: false }, originalElements: new Map() })
  const newAnchor = () => current.api.getSceneElementsIncludingDeleted().find(({ id }) => id !== 'm1')!
  const ghost = () => screen.queryByTestId('placing-ghost')
  /** The pointer over Excalidraw's canvas, inside the box it fills. */
  const moveOverCanvas = (clientX: number, clientY: number) => {
    const canvas = canvasRoot.querySelector('canvas') ?? canvasRoot.appendChild(document.createElement('canvas'))
    fireEvent.pointerMove(canvas, { clientX, clientY })
  }

  it('M starts placing, and the click places a selected element with its first line open', () => {
    const { scene } = renderOverlay([anchor])
    scene.select('m1')

    pressOnCanvas('m')
    expect(scene.tool()).toEqual({ type: 'custom', customType: 'add-math' })
    // Placing isn't in the scene.
    expect(scene.api.getSceneElementsIncludingDeleted()).toHaveLength(1)

    placeAt(300, 400)

    const placed = newAnchor()
    expect(placed).toMatchObject({ x: 300, y: 400, customData: { kind: 'math', source: '' } })
    expect(scene.tool()).toEqual({ type: 'selection' })
    expect(scene.selected()).toEqual([placed.id])
    const field = openField()!
    expect(field).toHaveFocus()
    expect(field.value).toBe('')
    expect(field.closest('[data-anchor-id]')).toHaveAttribute('data-anchor-id', placed.id)
  })

  it('writes the element and its selection in one update, so Add math is one undo step', () => {
    const { scene } = renderOverlay([anchor])
    pressOnCanvas('m')
    scene.updateScene.mockClear()

    placeAt(300, 400)

    expect(scene.updateScene).toHaveBeenCalledTimes(1)
    expect(scene.updateScene.mock.calls[0][0]).toMatchObject({
      appState: { selectedElementIds: { [newAnchor().id]: true } },
      captureUpdate: 'IMMEDIATELY',
    })
  })

  it('Esc while placing cancels, and adds nothing', () => {
    const { scene } = renderOverlay([anchor])
    pressOnCanvas('m')

    pressOnCanvas('Escape')

    expect(scene.tool()).toEqual({ type: 'selection' })
    expect(scene.updateScene).not.toHaveBeenCalled()
  })

  it('a click with another tool places nothing', () => {
    const { scene } = renderOverlay([anchor])
    scene.setTool('rectangle')

    placeAt(300, 400)

    expect(scene.api.getSceneElementsIncludingDeleted()).toHaveLength(1)
  })

  it('shows the ghost box at the pointer only while placing', () => {
    renderOverlay([anchor])
    moveOverCanvas(40, 60)
    expect(ghost()).toBeNull()

    pressOnCanvas('m')
    moveOverCanvas(40, 60)
    expect(ghost()).toHaveStyle({ transform: 'translate(40px, 60px) scale(1)', width: '305px' })

    placeAt(40, 60)
    expect(ghost()).toBeNull()
  })

  it('keeps a new element once its line has text', () => {
    const { scene } = renderOverlay([anchor])
    pressOnCanvas('m')
    placeAt(300, 400)

    type(openField()!, 'a = 1')
    fireEvent.keyDown(openField()!, { key: 'Escape' })

    expect(newAnchor()).toMatchObject({ isDeleted: false, customData: { source: 'a = 1' } })
    expect(scene.selected()).toEqual([newAnchor().id])
  })

  it.each([
    ['nothing', ''],
    ['only spaces', '   '],
  ])('removes a new element left with %s, and deselects it', (_, text) => {
    const { scene } = renderOverlay([anchor])
    pressOnCanvas('m')
    placeAt(300, 400)

    type(openField()!, text)
    fireEvent.keyDown(openField()!, { key: 'Escape' })

    expect(newAnchor().isDeleted).toBe(true)
    expect(scene.selected()).toEqual([])
    expect(openField()).toBeNull()
  })

  // Undo then brings it back with its text: the removal is the only step (#45, answer 2).
  it('removes an emptied element without touching its source', () => {
    const { scene } = renderOverlay([anchorWith('x = 2')])
    const field = openLine(1)
    type(field, '')
    scene.updateScene.mockClear()

    fireEvent.keyDown(field, { key: 'Escape' })

    expect(scene.elementOf('m1').isDeleted).toBe(true)
    expect(scene.sourceOf('m1')).toBe('x = 2')
    expect(scene.sourceWrites()).toBe(0)
    expect(elementOf('m1')).toBeNull()
  })

  it('removes an empty element when the edit leaves it for another element', () => {
    const [other] = createMathAnchorElements([{ id: 'm2', ...box, y: 300, source: 'y = 1' }])
    const { scene } = renderOverlay([anchorWith(''), other])
    openLine(1)

    openLine(1, 'm2')

    expect(scene.elementOf('m1').isDeleted).toBe(true)
    expect(openField()!.value).toBe('y = 1')
  })

  it('keeps an element that holds only a comment', () => {
    const { scene } = renderOverlay([anchorWith('')])
    const field = openLine(1)
    type(field, '# inputs')

    fireEvent.keyDown(field, { key: 'Escape' })

    expect(scene.elementOf('m1').isDeleted).toBe(false)
    expect(scene.sourceOf('m1')).toBe('# inputs')
  })

  it('keeps an empty element while the edit moves between its lines', () => {
    const { scene } = renderOverlay([anchorWith('\n')])
    const field = openLine(1)

    fireEvent.keyDown(field, { key: 'ArrowDown' })

    expect(scene.elementOf('m1').isDeleted).toBe(false)
    expect(openField()).not.toBeNull()
  })
})
