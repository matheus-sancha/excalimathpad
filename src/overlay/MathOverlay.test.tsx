import { createRef, useRef, useState, useSyncExternalStore } from 'react'
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState } from '@excalidraw/excalidraw/types'
import { DARK_THEME_FILTER } from '../canvas/layers.ts'
import { createMathAnchorElements, NO_TITLE_FORMAT } from '../canvas/mathAnchor.ts'
import { linePoint } from '../test/gestures.ts'
import { fireResizeObservers, layOutBodies } from '../test/layout.ts'
import { linesOf, resultsOf as sheetResults } from '../test/sheetView.ts'
import { mathSelection } from '../canvas/mathSelection.ts'
import { NO_COMMENT_FORMAT, NO_FORMAT } from '../math/lineForm.ts'
import { FormatTab, type FormatActions } from '../panel/FormatTab.tsx'
import { FORMAT_HINTS } from '../panel/formatTab.ts'
import {
  MathOverlay,
  type EditTarget,
  type EvaluatedElement,
  type FlashLine,
  type LineEditControl,
  type MathOverlayProps,
  type SceneApi,
} from './MathOverlay.tsx'

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

/**
 * The overlay with the Sheet panel's Format tab beside it, wired as App wires
 * them (section 4, Format tab, M4d): the tab hears what is open and the sheet
 * as evaluated, and its presses reach the line edit through the control.
 */
function WithFormatTab({ props }: { props: MathOverlayProps }) {
  const control = useRef<LineEditControl>(null)
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [sheet, setSheet] = useState<readonly EvaluatedElement[]>([])
  const { api } = props
  const selected = useSyncExternalStore(
    (listener) => api.onChange(listener),
    () => {
      const { selectedElementIds } = api.getAppState()
      return mathSelection(api) === 'one' ? (Object.keys(selectedElementIds)[0] ?? null) : null
    },
  )
  const actions: FormatActions = {
    setFormat: (format) => control.current?.setFormat(format),
    setCommentFormat: (format) => control.current?.setCommentFormat(format),
    setTitleFormat: (format) => control.current?.setTitleFormat(format),
    moveTo: (to) => control.current?.moveTo(to),
    move: (direction) => control.current?.move(direction),
    done: () => {
      control.current?.leaveLine()
      props.focusCanvas()
    },
    edit: (anchorId) => control.current?.openLast(anchorId),
  }
  return (
    <>
      <MathOverlay
        {...props}
        control={control}
        onEdit={(next) => {
          setTarget(next)
          props.onEdit?.(next)
        }}
        onEvaluated={setSheet}
      />
      <aside aria-label="Format tab">
        <FormatTab sheet={sheet} target={target} selected={selected} actions={actions} />
      </aside>
    </>
  )
}

function renderOverlay(
  elements: ExcalidrawElement[],
  extra: Partial<MathOverlayProps> = {},
  { formatTab = false }: { formatTab?: boolean } = {},
) {
  const scene = fakeScene(elements)
  current = scene
  canvasRoot = document.body.appendChild(document.createElement('div'))
  onTestFinished(() => canvasRoot.remove())
  const forwardWheel = vi.fn()
  const focusCanvas = vi.fn()
  const overlay = (flash: FlashLine | null) => {
    const props: MathOverlayProps = {
      api: scene.api,
      canvasRoot,
      forwardWheel,
      focusCanvas,
      flash,
      ...extra,
    }
    return formatTab ? <WithFormatTab props={props} /> : <MathOverlay {...props} />
  }
  const view = render(overlay(null))
  /** A jump from the Sheet panel flashes a line, as App passes it; null clears it. */
  const setFlash = (flash: FlashLine | null) => view.rerender(overlay(flash))
  return { scene, forwardWheel, focusCanvas, setFlash, unmount: view.unmount }
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

    // Section 4, Typeset grid: a comment line takes its format (M4d).
    it('draws a formatted comment line in its format, with no gutter or result cell', () => {
      renderOverlay([anchorWith('@bold @L @upright @text-blue @yellow # Pumps and pipes\nx = 1')])

      const row = rowOf('m1', 1)
      expect(row).toHaveClass('is-comment', 'is-bold', 'is-size-L', 'is-upright', 'is-text-color', 'is-text-blue', 'is-yellow')
      expect(row).not.toHaveClass('is-underline')
      expect(cellOf(1, 'comment')).toHaveTextContent(/^Pumps and pipes$/)
      expect(cellOf(1, 'gutter')).toBeNull()
      expect(cellOf(1, 'result')).toBeNull()
    })

    it('draws a comment saved before M4d as before, its @ words as text', () => {
      renderOverlay([anchorWith('# call me @home\n@bold #')])

      expect(rowOf('m1', 1).className).toBe('math-element__row is-comment')
      expect(cellOf(1, 'comment')).toHaveTextContent(/^call me @home$/)
      // A clause with no comment text formats nothing: a spacer row.
      expect(rowOf('m1', 2).className).toBe('math-element__row is-blank')
    })

    it('marks a comment line’s clause error in the gutter, the comment still shown', () => {
      renderOverlay([anchorWith('@bold if x > 1 # Pumps')])

      expect(cellOf(1, 'gutter')).toHaveTextContent('●')
      expect(cellOf(1, 'gutter')).toHaveAttribute('data-tip', 'rules need a math line')
      expect(cellOf(1, 'comment')).toHaveTextContent('Pumps')
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
      expect(result).toHaveAttribute('data-tip', 'Units do not match')
      expect(result).toHaveAttribute('data-tip-when', 'capped')
      expect(cellOf(1, 'gutter')).toHaveAttribute('data-tip', 'Units do not match')
    })

    it('marks a warning with an amber ⚠ and its message on the mark while its element is edited; the value still shows', () => {
      renderOverlay([anchorWith('K = 2 * 2.7\nP = V * 2\nV = 1 A * 2 ohm')])
      openLine(3)

      const gutter = cellOf(1, 'gutter')!
      expect(gutter).toHaveTextContent('⚠')
      expect(gutter).toHaveClass('is-warning')
      expect(gutter).toHaveAttribute('data-tip', 'K shadows the unit K')
      expect(cellOf(1, 'result')).toHaveAttribute('data-text', '5.4')
      expect(cellOf(2, 'gutter')).toHaveAttribute(
        'data-tip',
        'V reads as the unit V here: the variable is defined below',
      )
    })

    it('typesets a solve line with its range or guess small after the equation, and the details on hover', () => {
      renderOverlay([anchorWith('x = solve x^2 = 2, for x = 0 .. 10\ny = x\nf(a) = solve u^2 = a, guess u = 1\nf_d = f(4)')])

      expect(cellOf(1, 'expression')).toHaveTextContent(/solve/)
      expect(rowOf('m1', 1).querySelector('.math-element__aside')).toHaveTextContent(/x=0…10/)
      expect(rowOf('m1', 3).querySelector('.math-element__aside')).toHaveTextContent(/guess/)
      const detailed = cellOf(1, 'result')!.querySelector<HTMLElement>('.math-element__detailed')!
      expect(detailed.dataset.tip).toMatch(/^Scan \+ Brent, roots found in 0 \.\. 10\n200 points\nRoot 1: 1\.41421356237\d*, residual .+/)
      expect(cellOf(4, 'result')!.querySelector<HTMLElement>('.math-element__detailed')!.dataset.tip).toMatch(
        /^Brent, \d+ iterations\nResidual: .+\nBracket: 1\.99999999\d* \.\. 2|^Brent, \d+ iterations\nResidual: .+\nBracket: 2/,
      )
      expect(detailed).toHaveAttribute('data-tip-when', 'details')
      // Not on a line that only uses the value, nor on a solve function's definition.
      expect(cellOf(2, 'result')!.querySelector('.math-element__detailed')).toBeNull()
      expect(rowOf('m1', 3).querySelector('[data-tip-when="details"]')).toBeNull()
      // A line that is just one call to a solve function has them.
      expect(cellOf(4, 'result')!.querySelector('.math-element__detailed')).not.toBeNull()
    })

    it('writes up to five roots out in one row, the unit in its slot, else the count; details on hover (#106)', () => {
      renderOverlay([
        anchorWith('x_r = solve x^3 - 6 m x^2 + 11 m^2 x = 6 m^3, for x = 0 m .. 10 m\ny = solve sin(y) = 0.5, for y = 0 .. 40'),
      ])

      const written = cellOf(1, 'result')!
      expect(written).toHaveAttribute('data-text', '1, 2, 3 m')
      expect(written.querySelectorAll('[data-unit-slot]')).toHaveLength(1)
      expect(written.querySelector<HTMLElement>('.math-element__detailed')!.dataset.tip).toMatch(
        /^Scan \+ Brent, roots found in 0 \.\. 10 m\n200 points\nRoot 1: 1 m, residual .+\nRoot 2: 2/,
      )
      const summary = cellOf(2, 'result')!
      expect(summary).toHaveTextContent(/^13 roots,/)
      expect(summary.querySelector('.math-element__detailed')).not.toBeNull()
    })

    it('lays a chosen width out as the body’s width, never below its content (M4c, #110)', () => {
      renderOverlay([
        createMathAnchorElements([{ id: 'm1', ...box, source: 'x = 2\n# a long comment', chosenWidth: 480 }])[0],
        createMathAnchorElements([{ id: 'm2', ...box, y: 400, source: 'y = 3' }])[0],
      ])

      const body = elementOf('m1')!.querySelector<HTMLElement>('.math-element__body')!
      expect(body).toHaveClass('has-chosen-width')
      expect(body.style.width).toBe('480px')
      expect(body.style.minWidth).toBe('max-content')
      const automatic = elementOf('m2')!.querySelector<HTMLElement>('.math-element__body')!
      expect(automatic).not.toHaveClass('has-chosen-width')
      expect(automatic.style.width).toBe('')
    })

    it('typesets a range with its step aside, and a list’s summary with its points on hover', () => {
      renderOverlay([anchorWith('x = 1 m .. 3 m step 1 m\ny = x * 2')])

      expect(rowOf('m1', 1).querySelector('.math-element__aside')).toHaveTextContent(/step/)
      const summary = cellOf(2, 'result')!.querySelector<HTMLElement>('.math-element__summary')!
      expect(cellOf(2, 'result')).toHaveClass('is-list')
      expect(summary.querySelector('.math-element__count')).toHaveTextContent('3 values,')
      expect(summary.dataset.tip).toBe('1: 2 m\n2: 4 m\n3: 6 m')
      // No unit slot on a list.
      expect(cellOf(2, 'result')!.querySelector('[data-unit-slot]')).toBeNull()
    })

    it('draws a table under its line, inside its row, with a unit slot per column header', () => {
      renderOverlay([anchorWith('x = 1 m .. 3 m step 1 m\nr(t) = t < 2 m ? nope : t\ntable(x, r(x), 2) # note')])

      const row = rowOf('m1', 3)
      const table = row.querySelector('.math-element__table')!
      expect(table).not.toBeNull()
      expect(table.querySelectorAll('thead th')).toHaveLength(3)
      expect(table.querySelectorAll('tbody tr')).toHaveLength(3)
      // Slots on the two columns with a unit, keyed by the line's index and the column.
      expect([...table.querySelectorAll<HTMLElement>('[data-unit-slot]')].map((slot) => slot.dataset.unitSlot)).toEqual([
        '2:0',
        '2:1',
      ])
      // Numbers split at the point, so a column lines up on it; a failed cell is a red — with its message.
      const first = table.querySelectorAll('tbody tr')[0]
      expect(first.querySelector('td.is-whole')).toHaveTextContent('1')
      expect(first.querySelector('td.is-failed')).toHaveAttribute('data-tip', 'in r(1 m): Undefined symbol nope')
      expect(cellOf(3, 'note')).toHaveTextContent('note')
    })

    it('draws a plot under its line: a placeholder of its size, then the chart, with a × per failed point', async () => {
      renderOverlay([anchorWith('x = -1 .. 3\nr(t) = t < 0 ? nope : t^2\nplot(x, r(x)), mark 2, size S')])

      const chart = rowOf('m1', 3).querySelector<HTMLElement>('.math-element__plot-chart')!
      expect(chart.style.width).toBe('360px')
      expect(chart.style.height).toBe('220px')
      expect(rowOf('m1', 3).querySelector('.math-element__plot-legend')).toHaveTextContent(/r/)
      await waitFor(() => expect(chart.querySelector('svg')).not.toBeNull(), { timeout: 5000 })
      expect(chart).not.toHaveClass('is-loading')
      const failed = chart.querySelectorAll<SVGElement>('.plot-failed text')
      expect(failed).toHaveLength(1)
      expect(failed[0].dataset.tip).toBe('in r(-1): Undefined symbol nope')
      expect(chart.textContent).toContain('2 = 2')
    })

    it('marks a list with failed points in the gutter, with the message on hover', () => {
      renderOverlay([anchorWith('x = -1 .. 1\nr(t) = t < 0 ? nope : t\ny = r(x)')])

      expect(cellOf(3, 'gutter')).toHaveTextContent('●')
      expect(cellOf(3, 'gutter')).toHaveAttribute(
        'data-tip',
        '1 of 3 points failed. At x = -1: in r(-1): Undefined symbol nope',
      )
      expect(cellOf(3, 'result')).toHaveTextContent(/2 of 3 values/)
    })

    it('shows the error mark, not the warning, on a line with both', () => {
      renderOverlay([anchorWith('K = 1 m + 1 s')])

      expect(cellOf(1, 'gutter')).toHaveTextContent('●')
      expect(cellOf(1, 'gutter')).not.toHaveClass('is-warning')
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

    it('ArrowDown stays put, and writes nothing, on the last line', () => {
      const { scene } = renderOverlay([anchorWith('a = 1\nb = 2')])
      const last = openLine(2)
      type(last, 'typed')

      fireEvent.keyDown(last, { key: 'ArrowDown' })

      expect(openField()).toBe(last)
      expect(last.value).toBe('typed')
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
      // Long results are cut to fit; the full text shows on hover (data-tip).
      expect(document.querySelector('[data-tip="I is defined below"].math-element__result')).toHaveClass(
        'is-error',
      )

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

describe('line format (docs/spec-v1.md section 4: bold, underline, highlight)', () => {
  it('draws a typeset row with its format, and hides the clause', () => {
    renderOverlay([anchorWith('x = 2 m * 3 @bold @underline @yellow # tripled\ny = 1')])

    expect(rowOf('m1', 1)).toHaveClass('is-bold', 'is-underline', 'is-yellow')
    expect(rowOf('m1', 1).textContent).not.toContain('@')
    expect(resultsOf('m1')).toContain('6 m')
    expect(rowOf('m1', 2)).not.toHaveClass('is-bold', 'is-underline', 'is-yellow')
  })

  it('draws a line’s text colour on its row, beside a highlight (M4c, #107)', () => {
    renderOverlay([anchorWith('x = 2 m * 3 @text-red @yellow # tripled\ny = 1\nz = q @text-red')])

    expect(rowOf('m1', 1)).toHaveClass('is-text-color', 'is-text-red', 'is-yellow')
    expect(rowOf('m1', 2)).not.toHaveClass('is-text-color')
    // An error keeps its own colour: the stylesheet leaves `.is-error` alone.
    expect(rowOf('m1', 3).querySelector('.math-element__result')).toHaveClass('is-error')
  })

  it('draws a rule’s format as a plain one would, its warning in the gutter, and a table row it made true (#109)', () => {
    renderOverlay([
      anchorWith('v = 4 m/s @text-red if v > 3 m/s\nw = 1 m/s @bold @text-red if w > 3 kg\nx = 1 .. 3\ntable(x) @yellow if x > 2'),
    ])

    expect(rowOf('m1', 1)).toHaveClass('is-text-red')
    expect(rowOf('m1', 2)).toHaveClass('is-bold')
    expect(rowOf('m1', 2)).not.toHaveClass('is-text-red')
    const rows = rowOf('m1', 4).querySelectorAll('tbody tr')
    expect([...rows].map((row) => row.classList.contains('is-yellow'))).toEqual([false, false, true])
    // A rule's ⚠ follows the rule of Problems: only while its element is edited (M4d).
    expect(rowOf('m1', 2).querySelector('[data-tip]')).toBeNull()
    openLine(3)
    expect(rowOf('m1', 2).querySelector('[data-tip]')?.getAttribute('data-tip')).toContain('if w > 3 kg: Units do not match')
  })

  it('draws no bar beside the open line: formatting is the Format tab’s (M4d)', () => {
    renderOverlay([anchorWith('x = 2 @bold')])
    openLine(1)

    expect(screen.queryByRole('toolbar')).toBeNull()
    expect(screen.queryAllByRole('button')).toEqual([])
  })

  it('Ctrl+B and Ctrl+U toggle bold and underline from the field; Ctrl+I does nothing on a math line', () => {
    const { scene } = renderOverlay([anchorWith('x = 2')])
    openLine(1)

    const bold = createEvent.keyDown(openField()!, { key: 'b', ctrlKey: true })
    fireEvent(openField()!, bold)
    expect(bold.defaultPrevented).toBe(true)
    fireEvent.keyDown(openField()!, { key: 'u', ctrlKey: true })
    expect(scene.sourceOf('m1')).toBe('x = 2 @bold @underline')

    fireEvent.keyDown(openField()!, { key: 'B', ctrlKey: true })
    expect(scene.sourceOf('m1')).toBe('x = 2 @underline')

    const writes = scene.sourceWrites()
    fireEvent.keyDown(openField()!, { key: 'i', ctrlKey: true })
    expect(scene.sourceWrites()).toBe(writes)
    expect(scene.sourceOf('m1')).toBe('x = 2 @underline')
  })

  it('on a comment line, Ctrl+B and Ctrl+U toggle bold and underline, and Ctrl+I writes or removes @upright, caret kept', () => {
    const { scene } = renderOverlay([anchorWith('# Pumps')])
    const field = openLine(1)
    field.setSelectionRange(4, 4)

    fireEvent.keyDown(field, { key: 'i', ctrlKey: true })
    expect(scene.sourceOf('m1')).toBe('@upright # Pumps')
    // Still after `Pu`, in the comment text.
    expect(openField()!.selectionStart).toBe(13)

    fireEvent.keyDown(openField()!, { key: 'b', ctrlKey: true })
    fireEvent.keyDown(openField()!, { key: 'u', ctrlKey: true })
    expect(scene.sourceOf('m1')).toBe('@bold @upright @underline # Pumps')
    fireEvent.keyDown(openField()!, { key: 'i', ctrlKey: true })
    expect(scene.sourceOf('m1')).toBe('@bold @underline # Pumps')
    expect(openField()).toHaveFocus()
  })

  it('a blank line takes no format key', () => {
    const { scene } = renderOverlay([anchorWith('x = 1\n')])
    openLine(2)

    fireEvent.keyDown(openField()!, { key: 'b', ctrlKey: true })

    expect(scene.sourceWrites()).toBe(0)
  })
})

// Section 4, Format tab (M4d): the only place to format a line or a title.
describe('the Format tab (docs/spec-v1.md section 4, Format tab, M4d)', () => {
  const tab = () => screen.getByRole('complementary', { name: 'Format tab' })
  const tabButton = (name: string | RegExp) => within(tab()).getByRole('button', { name })
  const rowNames = () => within(tab()).queryAllByRole('group').map((group) => group.getAttribute('aria-label'))
  const caption = () => within(tab()).queryByText(/ — /)
  const sample = () => within(tab()).queryByRole('region', { name: 'Sample' })
  /** A press as the browser sends it: the mousedown that must not take focus, then the click. */
  const press = (button: HTMLElement) => {
    const down = createEvent.mouseDown(button)
    fireEvent(button, down)
    fireEvent.click(button)
    return down
  }
  const withTab = (source: string, extra: Partial<MathOverlayProps> = {}) =>
    renderOverlay([anchorWith(source)], extra, { formatTab: true })
  const titledWithTab = (title: string, source = 'x = 2') =>
    renderOverlay([createMathAnchorElements([{ id: 'm1', ...box, source, title }])[0]], {}, { formatTab: true })
  const titleField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Title' })
  const titleFormatOf = (scene: ReturnType<typeof fakeScene>) => scene.elementOf('m1').customData?.titleFormat

  it('with nothing open, shows the hint, and Edit only while one math element is selected', () => {
    const { scene } = withTab('x = 2\ny = 3')

    expect(tab()).toHaveTextContent(FORMAT_HINTS.nothingOpen)
    expect(within(tab()).queryByRole('button', { name: /^Edit/ })).toBeNull()

    scene.select('m1')
    scene.updateElements([scene.elementOf('m1')])
    const edit = tabButton(/^Edit/)
    expect(press(edit).defaultPrevented).toBe(true)

    // As Enter does: the element's last line opens.
    expect(openField()).toHaveValue('y = 3')
    expect(openField()).toHaveFocus()
  })

  it('names what is open in its caption, as the Variables tab names it', () => {
    titledWithTab('Pipe flow', 'Q = 2 L/s\n# inputs\n')
    openLine(1)
    expect(caption()).toHaveTextContent('Math line — Pipe flow, line 1')
    openLine(2)
    expect(caption()).toHaveTextContent('Comment line — Pipe flow, line 2')
    fireEvent.keyDown(openField()!, { key: 'ArrowUp' })
    fireEvent.keyDown(openField()!, { key: 'ArrowUp' })
    expect(caption()).toHaveTextContent('Title — Pipe flow')
    cleanup()

    withTab('x = 2')
    openLine(1)
    expect(caption()).toHaveTextContent('Math line — Element 1, line 1')
  })

  it('draws the open line in its sample as the sheet draws it: typeset, with its result, note and rules, live', () => {
    withTab('v = 2 m/s * 2 @bold @text-red if v > 3 m/s # speed')
    const field = openLine(1)
    const row = () => sample()!.querySelector('.math-element__row')!

    expect(row()).toHaveClass('is-bold', 'is-text-red')
    expect(row().querySelector('.math-element__result')).toHaveAttribute('data-text', '4 m / s')
    expect(row().querySelector('.math-element__note')).toHaveTextContent('speed')
    expect(row().textContent).not.toContain('@')

    type(field, 'v = 1 m/s * 2 @bold @text-red if v > 3 m/s # speed')
    expect(row()).not.toHaveClass('is-text-red')
    expect(row().querySelector('.math-element__result')).toHaveAttribute('data-text', '2 m / s')
  })

  it('says when a true rule sets a property over the buttons, which still show the plain format', () => {
    withTab('v = 4 m/s @text-blue @text-red if v > 3 m/s @text-orange if v > 1 m/s @yellow if v > 5 m/s')
    const field = openLine(1)

    expect(within(tab()).getAllByText(/^A rule sets/).map((note) => note.textContent)).toEqual([
      'A rule sets the text colour while v > 3 m/s.',
    ])
    expect(tabButton('Text blue')).toHaveAttribute('aria-pressed', 'true')

    type(field, 'v = 1 m/s @text-blue @text-red if v > 3 m/s')
    expect(within(tab()).queryByText(/^A rule sets/)).toBeNull()
  })

  it('shows a math line’s rows, Style, Text and Highlight, with its format pressed', () => {
    withTab('x = 2 @bold @green\ny = 1')
    openLine(1)

    expect(rowNames()).toEqual(['Style', 'Text', 'Highlight'])
    expect(within(within(tab()).getByRole('group', { name: 'Style' })).getAllByRole('button').map((b) => b.title)).toEqual([
      'Bold (Ctrl+B)',
      'Underline (Ctrl+U)',
    ])
    expect(tabButton('Bold (Ctrl+B)')).toHaveAttribute('aria-pressed', 'true')
    expect(tabButton('Underline (Ctrl+U)')).toHaveAttribute('aria-pressed', 'false')
    expect(tabButton('Highlight green')).toHaveAttribute('aria-pressed', 'true')
    expect(tabButton('Highlight red')).toHaveAttribute('aria-pressed', 'false')
    expect(tabButton('No text colour')).toHaveAttribute('aria-pressed', 'true')
    expect(within(within(tab()).getByRole('group', { name: 'Text' })).getAllByRole('button')).toHaveLength(7)
    expect(within(within(tab()).getByRole('group', { name: 'Highlight' })).getAllByRole('button')).toHaveLength(6)
  })

  it('a press writes the clause as one line commit, and the line stays open on it, focused', () => {
    const { scene } = withTab('x = 2 # two')
    openLine(1)

    const down = press(tabButton('Bold (Ctrl+B)'))

    // The press never takes the keyboard from the field: a blur would leave the line.
    expect(down.defaultPrevented).toBe(true)
    expect(tabButton('Bold (Ctrl+B)')).toHaveAttribute('tabindex', '-1')
    expect(scene.sourceOf('m1')).toBe('x = 2 @bold # two')
    expect(scene.sourceWrites()).toBe(1)
    const field = openField()!
    expect(field.value).toBe('x = 2 @bold # two')
    expect(field).toHaveFocus()
    expect(rowOf('m1', 1)).toHaveClass('is-bold')
    expect(tabButton('Bold (Ctrl+B)')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps the caret where it was in the code', () => {
    withTab('x = 2 # two')
    const field = openLine(1)
    field.setSelectionRange(3, 3)

    press(tabButton('Highlight blue'))

    expect(openField()!.selectionStart).toBe(3)
  })

  it('writes what is typed with the format, not the scene’s line', () => {
    const { scene } = withTab('x = 2')
    type(openLine(1), 'x = 5')

    press(tabButton('Underline (Ctrl+U)'))

    expect(scene.sourceOf('m1')).toBe('x = 5 @underline')
  })

  it('pressing a pressed button takes the format off, and No highlight clears the colour', () => {
    const { scene } = withTab('x = 2 @bold @red')
    openLine(1)

    press(tabButton('Bold (Ctrl+B)'))
    expect(scene.sourceOf('m1')).toBe('x = 2 @red')

    press(tabButton('No highlight'))
    expect(scene.sourceOf('m1')).toBe('x = 2')
    expect(rowOf('m1', 1)).not.toHaveClass('is-red')
  })

  it('a text colour writes @text-<name> before the highlight and the note; the pressed one takes it off', () => {
    const { scene } = withTab('x = 2 @yellow # two')
    openLine(1)

    press(tabButton('Text red'))
    expect(scene.sourceOf('m1')).toBe('x = 2 @text-red @yellow # two')
    expect(scene.sourceWrites()).toBe(1)
    expect(tabButton('Text red')).toHaveAttribute('aria-pressed', 'true')
    expect(openField()).toHaveFocus()

    press(tabButton('Text red'))
    expect(scene.sourceOf('m1')).toBe('x = 2 @yellow # two')
    press(tabButton('Text blue'))
    press(tabButton('No text colour'))
    expect(scene.sourceOf('m1')).toBe('x = 2 @yellow # two')
  })

  it('leaves every rule as typed when it writes', () => {
    const { scene } = withTab('v = 4 @text-red if v > 3')
    openLine(1)

    press(tabButton('Bold (Ctrl+B)'))
    expect(scene.sourceOf('m1')).toBe('v = 4 @bold @text-red if v > 3')
  })

  it('follows a clause typed by hand, live', () => {
    withTab('x = 2')

    type(openLine(1), 'x = 2 @gray')

    expect(rowOf('m1', 1)).toHaveClass('is-gray')
    expect(tabButton('Highlight gray')).toHaveAttribute('aria-pressed', 'true')
  })

  it('a comment line has Style (B, I pressed, U), Size, Text and Highlight; Italic off writes @upright', () => {
    const { scene } = withTab('# Pumps')
    const field = openLine(1)
    field.setSelectionRange(7, 7)

    expect(rowNames()).toEqual(['Style', 'Size', 'Text', 'Highlight'])
    expect(tabButton('Italic (Ctrl+I)')).toHaveAttribute('aria-pressed', 'true')
    expect(tabButton('Size M')).toHaveAttribute('aria-pressed', 'true')

    press(tabButton('Italic (Ctrl+I)'))
    expect(scene.sourceOf('m1')).toBe('@upright # Pumps')
    expect(tabButton('Italic (Ctrl+I)')).toHaveAttribute('aria-pressed', 'false')
    press(tabButton('Size XL'))
    press(tabButton('Highlight blue'))
    press(tabButton('Text green'))
    press(tabButton('Bold (Ctrl+B)'))
    expect(scene.sourceOf('m1')).toBe('@bold @upright @XL @text-green @blue # Pumps')
    expect(scene.sourceWrites()).toBe(5)
    // The caret stays at the end of the comment text, and the line is open on it.
    expect(openField()).toHaveFocus()
    expect(openField()!.selectionStart).toBe(openField()!.value.length)
    expect(sample()!.querySelector('.math-element__row')).toHaveClass('is-bold', 'is-upright', 'is-size-XL', 'is-blue')

    // The pressed size takes it off, back to M.
    press(tabButton('Size XL'))
    expect(scene.sourceOf('m1')).toBe('@bold @upright @text-green @blue # Pumps')
  })

  it('a blank line, or a clause with no comment text, shows the sample and takes no format', () => {
    withTab('x = 1\n\n@bold')
    for (const n of [2, 3]) {
      openLine(n)
      expect(sample()).not.toBeNull()
      expect(tab()).toHaveTextContent(FORMAT_HINTS.noFormat)
      expect(rowNames()).toEqual([])
    }
  })

  it('the link moves the edit: Add title ↑, Edit title ↑ from any line, First line ↓ on the title', () => {
    const { scene } = withTab('x = 2\ny = 3')
    openLine(2)
    expect(press(tabButton('Add title ↑')).defaultPrevented).toBe(true)
    expect(titleField()).toHaveFocus()
    type(titleField()!, 'Inputs')

    press(tabButton('First line ↓'))
    expect(scene.elementOf('m1').customData?.title).toBe('Inputs')
    expect(openField()).toHaveValue('x = 2')
    expect(openField()).toHaveFocus()

    fireEvent.keyDown(openField()!, { key: 'ArrowDown' })
    press(tabButton('Edit title ↑'))
    expect(titleField()).toHaveValue('Inputs')
  })

  it('↑ and ↓ move the edit as the keys do, from the first line to the title and back; Done leaves as Esc', () => {
    const { scene, focusCanvas } = withTab('x = 2\ny = 3')
    openLine(2)

    press(tabButton('Up (↑)'))
    expect(openField()).toHaveValue('x = 2')
    press(tabButton('Up (↑)'))
    expect(titleField()).toHaveFocus()
    press(tabButton('Down (↓)'))
    press(tabButton('Down (↓)'))
    expect(openField()).toHaveValue('y = 3')
    type(openField()!, 'y = 4')

    press(tabButton('Done (Esc)'))
    expect(openField()).toBeNull()
    expect(scene.sourceOf('m1')).toBe('x = 2\ny = 4')
    expect(focusCanvas).toHaveBeenCalled()
    expect(tab()).toHaveTextContent(FORMAT_HINTS.nothingOpen)
  })

  it('the title has Style (B pressed by default), Size, Align, Text and Highlight; each press is one write beside it', () => {
    const { scene } = titledWithTab('Pump @ 50 Hz #2')
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })

    expect(rowNames()).toEqual(['Style', 'Size', 'Align', 'Text', 'Highlight'])
    // Bold is on without a format; pressing it stores "not bold".
    expect(tabButton('Bold (Ctrl+B)')).toHaveAttribute('aria-pressed', 'true')
    press(tabButton('Bold (Ctrl+B)'))
    expect(titleFormatOf(scene)).toBe('regular')
    press(tabButton('Size XL'))
    press(tabButton('Centre'))
    press(tabButton('Text red'))
    press(tabButton('Highlight yellow'))
    expect(titleFormatOf(scene)).toBe('regular centre XL text-red yellow')
    expect(titleField()).toHaveFocus()
    expect(sample()!.querySelector('.math-element__title')).toHaveClass('is-regular', 'is-size-XL', 'is-align-centre', 'is-text-red', 'is-yellow')
    expect(sample()).toHaveTextContent('Pump @ 50 Hz #2')

    // The pressed alignment takes it off, back to the left; no text colour is black.
    press(tabButton('Centre'))
    press(tabButton('No text colour'))
    expect(titleFormatOf(scene)).toBe('regular XL yellow')

    // Ctrl+I from the field; the text stays exactly as typed.
    fireEvent.keyDown(titleField()!, { key: 'i', ctrlKey: true })
    expect(titleFormatOf(scene)).toBe('regular italic XL yellow')
    fireEvent.keyDown(titleField()!, { key: 'Escape' })
    expect(scene.elementOf('m1').customData?.title).toBe('Pump @ 50 Hz #2')
  })
})

describe('a warning at rest (docs/spec-v1.md section 4, Problems, M4d)', () => {
  const gutterOf = (id: string, n: number) => rowOf(id, n).querySelector<HTMLElement>('.math-element__gutter')!
  /** A mark that is shown: its glyph, amber, with its message on hover. */
  const shown = (gutter: HTMLElement, message: string) => {
    expect(gutter).toHaveTextContent('⚠')
    expect(gutter).toHaveClass('is-warning')
    expect(gutter).toHaveAttribute('data-tip', message)
  }
  /** A hidden mark: the gutter cell stays in its column, empty, with no hover. */
  const hidden = (gutter: HTMLElement) => {
    expect(gutter).toHaveTextContent('')
    expect(gutter).not.toHaveClass('is-warning')
    expect(gutter).not.toHaveAttribute('data-tip')
  }
  const WARNED = 'K = 2 * 2.7\nx = 3'
  const K = 'K shadows the unit K'
  const above = (id: string, source: string) =>
    createMathAnchorElements([{ id, x: 100, y: -300, width: 400, height: 96, source }])[0]

  it('hides a ⚠ at rest, keeping its gutter cell and the value, and shows it once a line of the element opens', () => {
    renderOverlay([anchorWith(WARNED)])

    hidden(gutterOf('m1', 1))
    expect(rowOf('m1', 1).querySelector('.math-element__result')).toHaveAttribute('data-text', '5.4')

    openLine(2)
    shown(gutterOf('m1', 1), K)

    fireEvent.keyDown(openField()!, { key: 'Escape' })
    expect(openField()).toBeNull()
    hidden(gutterOf('m1', 1))
  })

  it('shows the ⚠ on the open line itself, live as it is typed', () => {
    renderOverlay([anchorWith('x = 3')])
    const field = openLine(1)

    type(field, 'K = 3')

    shown(gutterOf('m1', 1), K)
  })

  it('a selected element is not being edited: its ⚠ stays hidden', () => {
    const { scene } = renderOverlay([anchorWith(WARNED)])

    scene.select('m1')
    scene.updateElements([scene.elementOf('m1')])

    hidden(gutterOf('m1', 1))
  })

  it('shows the element’s ⚠ while its title is open', () => {
    renderOverlay([createMathAnchorElements([{ id: 'm1', ...box, source: WARNED, title: 'Pipe flow' }])[0]])
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus()
    expect(openField()).toBeNull()
    shown(gutterOf('m1', 1), K)
  })

  it('keeps other elements’ ⚠ hidden while one is edited, even a warning the edit causes there', () => {
    // m2 sits above m1, so it reads first: V defined in m1 is "defined below" for it.
    const { setFlash } = renderOverlay([anchorWith('x = 3'), above('m2', 'K = 1\nP = V * 2')])
    const field = openLine(1)

    type(field, 'V = 2 A * 1 ohm')

    hidden(gutterOf('m2', 1))
    hidden(gutterOf('m2', 2))
    // The warning the edit caused is there: a jump to it shows it.
    setFlash({ anchorId: 'm2', line: 1, key: 1 })
    shown(gutterOf('m2', 2), 'V reads as the unit V here: the variable is defined below')
    hidden(gutterOf('m2', 1))
  })

  it('a jump’s flash shows that line’s ⚠ while it lasts, and opens nothing', () => {
    const { setFlash } = renderOverlay([anchorWith('K = 2 * 2.7\nm = 3\nx = 4')])

    setFlash({ anchorId: 'm1', line: 1, key: 1 })

    expect(rowOf('m1', 2)).toHaveClass('is-flash')
    shown(gutterOf('m1', 2), 'm shadows the unit m')
    hidden(gutterOf('m1', 1))
    expect(openField()).toBeNull()

    setFlash(null)
    hidden(gutterOf('m1', 2))
  })

  it('an error’s ● always shows, at rest and selected', () => {
    renderOverlay([anchorWith('K = 1 m + 1 s')])

    expect(gutterOf('m1', 1)).toHaveTextContent('●')
    expect(gutterOf('m1', 1)).toHaveAttribute('data-tip', 'Units do not match')
  })

  it('keeps a gutter cell on every math row, at rest and while editing, so rows don’t shift when an edit opens', () => {
    renderOverlay([anchorWith(WARNED)])
    const cells = () => [1, 2].map((n) => rowOf('m1', n).firstElementChild)

    expect(cells().map((cell) => cell?.className)).toEqual(['math-element__gutter', 'math-element__gutter'])
    openLine(2)
    expect(cells().map((cell) => cell?.classList.contains('math-element__gutter'))).toEqual([true, true])
  })
})

describe('title (docs/spec-v1.md section 4: an optional header on the element)', () => {
  const header = () => elementOf('m1')!.querySelector<HTMLElement>('[data-title]')
  const titleField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Title' })
  const titled = (title: string, source = 'x = 2') =>
    createMathAnchorElements([{ id: 'm1', ...box, source, title }])[0]
  const titleOf = (scene: ReturnType<typeof fakeScene>) =>
    scene.elementOf('m1').customData?.title as string | undefined

  it('shows no header on an element without a title', () => {
    renderOverlay([anchorWith('x = 2')])

    expect(header()).toBeNull()
  })

  it('shows the title in a header above the lines, as plain text', () => {
    renderOverlay([titled('Pipe flow = 2 * 3')])

    expect(header()).toHaveTextContent('Pipe flow = 2 * 3')
    expect(header()!.querySelector('.katex')).toBeNull()
    // Before the lines in the body, so it is above them and counts toward the size.
    const body = elementOf('m1')!.querySelector('.math-element__body')!
    expect(body.firstElementChild).toBe(header())
    // Never evaluated: the sheet has one line.
    expect(resultsOf('m1')).toBe('')
  })

  it('↑ on the first line opens the title, adding the header', () => {
    const { scene } = renderOverlay([anchorWith('x = 2')])
    const first = openLine(1)
    type(first, 'x = 5')

    fireEvent.keyDown(first, { key: 'ArrowUp' })

    // The line was left, so it is written; the title isn't in the scene yet.
    expect(scene.sourceOf('m1')).toBe('x = 5')
    expect(titleField()).toHaveFocus()
    expect(titleField()!.value).toBe('')
    expect(header()).not.toBeNull()
    expect(titleOf(scene)).toBeUndefined()
  })

  it('looks as before with no format, and emptying the title removes its format', () => {
    const { scene } = renderOverlay([
      createMathAnchorElements([{ id: 'm1', ...box, source: 'x = 2', title: 'Inputs' }]).map((element) => ({
        ...element,
        customData: { ...element.customData, titleFormat: 'L' },
      }))[0],
    ])
    expect(header()).toHaveClass('is-bold', 'is-size-L', 'is-align-left', 'is-text-black')

    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })
    type(titleField()!, '')
    fireEvent.keyDown(titleField()!, { key: 'Escape' })

    expect(scene.elementOf('m1').customData).not.toHaveProperty('titleFormat')
    expect(scene.elementOf('m1').customData).not.toHaveProperty('title')
  })

  it('Esc keeps what was typed, as one write, trimmed', () => {
    const { scene } = renderOverlay([anchorWith('x = 2')])
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })
    scene.updateScene.mockClear()

    type(titleField()!, '  Pipe flow ')
    fireEvent.keyDown(titleField()!, { key: 'Escape' })

    expect(titleOf(scene)).toBe('Pipe flow')
    expect(scene.sourceOf('m1')).toBe('x = 2')
    expect(header()).toHaveTextContent('Pipe flow')
    expect(titleField()).toBeNull()
  })

  it.each(['Enter', 'ArrowDown'])('%s keeps the title and goes to the first line', (key) => {
    const { scene } = renderOverlay([anchorWith('x = 2\ny = 3')])
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })
    type(titleField()!, 'Inputs')

    fireEvent.keyDown(titleField()!, { key })

    expect(titleOf(scene)).toBe('Inputs')
    expect(openField()!.value).toBe('x = 2')
    // Enter in the title never splits a line.
    expect(scene.sourceOf('m1')).toBe('x = 2\ny = 3')
  })

  it('an empty title removes the header and the stored title', () => {
    const { scene } = renderOverlay([titled('Pipe flow')])
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })

    type(titleField()!, '   ')
    fireEvent.keyDown(titleField()!, { key: 'Escape' })

    expect(header()).toBeNull()
    expect(scene.elementOf('m1').customData).not.toHaveProperty('title')
    expect(scene.elementOf('m1').isDeleted).toBe(false)
  })

  it('a title left unchanged writes nothing', () => {
    const { scene } = renderOverlay([titled('Pipe flow')])
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })
    scene.updateScene.mockClear()

    fireEvent.keyDown(titleField()!, { key: 'Escape' })

    expect(scene.updateScene).not.toHaveBeenCalled()
  })

  it('keeps an element that holds only a title', () => {
    const { scene } = renderOverlay([titled('Notes', '')])

    fireEvent.keyDown(openLine(1), { key: 'Escape' })

    expect(scene.elementOf('m1').isDeleted).toBe(false)
  })

  it('removes an element left with no title and no text', () => {
    const { scene } = renderOverlay([anchorWith('')])
    fireEvent.keyDown(openLine(1), { key: 'ArrowUp' })

    fireEvent.keyDown(titleField()!, { key: 'Escape' })

    expect(scene.elementOf('m1').isDeleted).toBe(true)
  })

  it('reads anything but a string as no title, and a title as one line', () => {
    const [bad] = createMathAnchorElements([{ id: 'm1', ...box, source: 'x = 2' }])
    renderOverlay([{ ...bad, customData: { ...bad.customData, title: 42 } }])
    expect(header()).toBeNull()
    cleanup()

    renderOverlay([{ ...bad, customData: { ...bad.customData, title: 'Pipe\nflow' } }])
    expect(header()).toHaveTextContent('Pipe flow')
  })
})

// Section 14, Panel controls that act on the open line (M4d): what the Sheet
// panel reaches through the control, and what it hears of the edit.
describe('the line edit, as the Sheet panel reaches it', () => {
  function withControl(source: string) {
    const control = createRef<LineEditControl>()
    const edits: (EditTarget | null)[] = []
    const rendered = renderOverlay([anchorWith(source)], { control, onEdit: (target) => edits.push(target) })
    return { ...rendered, control: () => control.current!, edits }
  }

  it('reports what is open on each change, and null when the edit ends', () => {
    const { edits } = withControl('x = 2\ny = 3')
    expect(edits).toEqual([null])

    const field = openLine(2)
    type(field, 'y = 34')
    fireEvent.keyDown(openField()!, { key: 'Escape' })

    expect(edits).toEqual([
      null,
      { anchorId: 'm1', lineIndex: 1, text: 'y = 3' },
      { anchorId: 'm1', lineIndex: 1, text: 'y = 34' },
      null,
    ])
  })

  it('setFormat writes the open line’s plain format as one line commit, the line kept open, the caret in the code', () => {
    const { scene, control } = withControl('v = 4 @text-red if v > 3 # speed')
    const field = openLine(1)
    field.setSelectionRange(5, 5)

    act(() => control().setFormat({ ...NO_FORMAT, bold: true }))

    expect(scene.sourceOf('m1')).toBe('v = 4 @bold @text-red if v > 3 # speed')
    expect(scene.sourceWrites()).toBe(1)
    expect(openField()).toHaveValue('v = 4 @bold @text-red if v > 3 # speed')
    expect(openField()!.selectionStart).toBe(5)
  })

  it('moveTo goes to the title and back to the first line; setTitleFormat formats the open title', () => {
    const { scene, control, edits } = withControl('x = 2\ny = 3')
    openLine(2)

    act(() => control().setTitleFormat({ ...NO_TITLE_FORMAT, italic: true }))
    expect(scene.elementOf('m1').customData?.titleFormat).toBeUndefined()
    act(() => control().moveTo('title'))
    expect(edits.at(-1)).toMatchObject({ lineIndex: 'title' })
    act(() => control().setTitleFormat({ ...NO_TITLE_FORMAT, italic: true }))
    expect(scene.elementOf('m1').customData?.titleFormat).toBe('italic')
    act(() => control().moveTo('first'))
    expect(edits.at(-1)).toMatchObject({ lineIndex: 0, text: 'x = 2' })
  })

  it('insert types at the caret, over the selection, and the sheet runs it', () => {
    const { control } = withControl('a = 2\nb = a + 3')
    const field = openLine(2)
    field.setSelectionRange(5, 5)

    act(() => control().insert('*2'))

    expect(openField()).toHaveValue('b = a*2 + 3')
    expect(openField()!.selectionStart).toBe(7)
    expect(resultsOf('m1')).toContain('7')
  })

  it('openLast opens an element’s last line, as Enter does; setCommentFormat formats an open comment line', () => {
    const { scene, control } = withControl('x = 2\n# Pumps')
    act(() => control().openLast('m1'))
    expect(openField()).toHaveValue('# Pumps')

    act(() => control().setCommentFormat({ ...NO_COMMENT_FORMAT, size: 'L' }))
    expect(scene.sourceOf('m1')).toBe('x = 2\n@L # Pumps')
    expect(openField()).toHaveValue('@L # Pumps')
    act(() => control().setFormat({ ...NO_FORMAT, bold: true }))
    expect(scene.sourceWrites()).toBe(1)
  })

  it('does nothing with nothing open', () => {
    const { scene, control } = withControl('x = 2')
    act(() => {
      control().setFormat({ ...NO_FORMAT, bold: true })
      control().setCommentFormat({ ...NO_COMMENT_FORMAT, bold: true })
      control().insert('rho')
      control().moveTo('title')
      control().move('up')
    })
    expect(scene.sourceWrites()).toBe(0)
    expect(openField()).toBeNull()
  })
})
