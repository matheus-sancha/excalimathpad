import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { convertToExcalidrawElements, FONT_FAMILY } from '@excalidraw/excalidraw'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { createMathAnchorElements } from './mathAnchor.ts'
import { MATH_HINT } from './mathSelection.ts'
import { sceneLoaded } from '../test/excalidraw.ts'
import { clickOnCanvas } from '../test/gestures.ts'

/**
 * The reduced panel and the hint (docs/spec-v1.md sections 4 and 14) rest on
 * Excalidraw 0.18.1's own DOM, which isn't public API. jsdom doesn't apply the
 * stylesheet, so these pin what `SheetCanvas.css` relies on: the order of the
 * panel's children, the one class among them, and where the hint's text is.
 * An upgrade that moves them fails here.
 */
const scene = () => [
  ...createMathAnchorElements([
    { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'a = 1' },
    { id: 'm2', x: 100, y: 200, width: 400, height: 48, source: 'b = 2' },
  ]),
  ...convertToExcalidrawElements(
    [{ type: 'rectangle', id: 'r1', x: 100, y: 350, width: 200, height: 100, backgroundColor: '#ffc9c9' }],
    { regenerateIds: false },
  ),
]

const onM1 = { clientX: 200, clientY: 80 }
const onM2 = { clientX: 200, clientY: 220 }
const onDrawing = { clientX: 200, clientY: 400 }
const onNothing = { clientX: 700, clientY: 500 }

/**
 * jsdom lays nothing out, so Excalidraw measures its container as 0 wide and
 * picks its phone layout, which has no side panel. Give the container a
 * desktop size, as in the browsers v1 targets.
 */
beforeEach(() => {
  const measure = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('excalidraw-container')
      ? new DOMRect(0, 0, 1280, 800)
      : measure.call(this)
  })
})

afterEach(() => vi.restoreAllMocks())

async function mount() {
  let handle: SheetCanvasHandle | undefined
  render(<SheetCanvas initialElements={scene()} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  await sceneLoaded(handle!.api)
  return handle!
}

/** A click with Shift held, which adds to Excalidraw's selection. */
function shiftClick(point: { clientX: number; clientY: number }) {
  const canvas = document.querySelector('canvas.interactive')!
  const event = { ...point, shiftKey: true, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true }
  act(() => {
    fireEvent.pointerDown(canvas, { ...event, buttons: 1 })
  })
  act(() => {
    fireEvent.pointerUp(canvas, event)
  })
}

/** The panel's sections, by their titles, in order. Opacity's has the class. */
function panelSections() {
  const column = document.querySelector('.App-menu__left .panelColumn')!
  return Array.from(column.children).map((child) => ({
    title: child.querySelector('legend, h3')?.textContent?.trim() ?? child.textContent?.trim() ?? '',
    isOpacity: child.matches('label.control-label'),
  }))
}

describe('the selection mark', () => {
  it('is absent with nothing selected', async () => {
    const { root } = await mount()

    expect(root.dataset.mathSelection).toBeUndefined()
  })

  it('is "one" for one math element, and goes when it is deselected', async () => {
    const { root } = await mount()

    clickOnCanvas(onM1)
    expect(root.dataset.mathSelection).toBe('one')

    clickOnCanvas(onNothing)
    expect(root.dataset.mathSelection).toBeUndefined()
  })

  it('is "several" for several math elements', async () => {
    const { root } = await mount()
    clickOnCanvas(onM1)

    shiftClick(onM2)

    expect(root.dataset.mathSelection).toBe('several')
  })

  // The full panel: its styles reach the drawings, and opacity the math too.
  it('is absent for a drawing, and for math with a drawing', async () => {
    const { root } = await mount()

    clickOnCanvas(onDrawing)
    expect(root.dataset.mathSelection).toBeUndefined()

    shiftClick(onM1)
    expect(root.dataset.mathSelection).toBeUndefined()
  })

  it('carries the hint’s text for the stylesheet', async () => {
    const { root } = await mount()

    expect(root.style.getPropertyValue('--math-hint')).toBe(JSON.stringify(MATH_HINT))
    expect(MATH_HINT).toBe('Double-click a line or press Enter to edit')
  })
})

describe('Excalidraw’s panel, as the reduced panel’s CSS needs it (section 14)', () => {
  it('lists every style section before Opacity, the only child with a class of its own', async () => {
    await mount()
    clickOnCanvas(onM1)

    const sections = panelSections()
    const opacity = sections.findIndex(({ isOpacity }) => isOpacity)

    expect(sections.filter(({ isOpacity }) => isOpacity)).toHaveLength(1)
    expect(sections[opacity].title).toContain('Opacity')
    expect(sections.slice(0, opacity).map(({ title }) => title)).toEqual([
      'Stroke',
      'Background',
      'Fill',
      'Stroke width',
      'Stroke style',
      'Sloppiness',
      'Edges',
    ])
    expect(sections.slice(opacity + 1).map(({ title }) => title)).toEqual(['Layers', 'Actions'])
  })

  it('adds Align after Opacity for several elements', async () => {
    await mount()
    clickOnCanvas(onM1)
    shiftClick(onM2)

    const sections = panelSections()
    const opacity = sections.findIndex(({ isOpacity }) => isOpacity)

    expect(sections.slice(opacity + 1).map(({ title }) => title)).toEqual(['Layers', 'Align', 'Actions'])
  })
})

describe('Excalidraw’s hint, as its replacement needs it (section 14)', () => {
  it('is one span in .HintViewer for one selected element', async () => {
    await mount()

    clickOnCanvas(onM1)

    const hint = document.querySelector('.HintViewer')!
    expect(hint.children).toHaveLength(1)
    expect(hint.firstElementChild!.tagName).toBe('SPAN')
    // What it says by itself, which is wrong for a math element.
    expect(hint).toHaveTextContent('Press Enter to add text')
  })

  it('isn’t shown for several elements, so there is nothing to replace', async () => {
    await mount()
    clickOnCanvas(onM1)

    shiftClick(onM2)

    expect(document.querySelector('.HintViewer')).toBeNull()
  })
})

describe('text on the sheet (section 4)', () => {
  it('new text starts in the Normal font', async () => {
    const { api } = await mount()

    expect(api.getAppState().currentItemFontFamily).toBe(FONT_FAMILY.Nunito)
  })
})
