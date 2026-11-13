import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { AppShell } from '../shell/AppShell.tsx'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'
import {
  clickOnCanvas,
  dragOnCanvas,
  linePoint,
  ROW_HEIGHT,
  ROW_TOP,
} from '../test/gestures.ts'
import { MathOverlay } from './MathOverlay.tsx'

/**
 * The unit slot against the real Excalidraw 0.18.1 (docs/spec-v1.md sections 5,
 * 6 and 14): the slot lets the press through, so Excalidraw selects and drags
 * as usual, and a click (the element unmoved) opens its field. jsdom has no
 * layout, so each slot's box is stubbed at scene x 300 to 340 on its row; the
 * scene is unscrolled at zoom 1, so client points equal scene points.
 */
const anchors = createMathAnchorElements([
  { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'p = 45430 Pa * 1 # gauge\nD = 102.3 mm' },
  { id: 'm2', x: 100, y: 200, width: 400, height: 48, source: 'U = 2 A * 3 ohm' },
])

function Harness({
  elements,
  overlay,
  onReady,
}: {
  elements: readonly ExcalidrawElement[]
  overlay: boolean
  onReady: (handle: SheetCanvasHandle) => void
}) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  return (
    <AppShell
      canvas={
        <SheetCanvas
          initialElements={elements}
          onReady={(handle) => {
            setCanvas(handle)
            onReady(handle)
          }}
        />
      }
      overlay={
        overlay &&
        canvas && (
          <MathOverlay
            api={canvas.api}
            canvasRoot={canvas.root}
            forwardWheel={canvas.forwardWheel}
            focusCanvas={canvas.focusCanvas}
          />
        )
      }
    />
  )
}

async function mount({ elements = anchors, overlay = true } = {}) {
  let handle: SheetCanvasHandle | undefined
  render(<Harness elements={elements} overlay={overlay} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  if (overlay) await screen.findAllByRole('list', { name: 'Lines' })
  const container = document.querySelector<HTMLElement>('.excalidraw')!
  return {
    api,
    ...undoControls(document),
    selected: () => Object.keys(api.getAppState().selectedElementIds),
    sourceOf: (id = 'm1') =>
      api.getSceneElements().find((e) => e.id === id)?.customData?.source as string,
    textElements: () => api.getSceneElements().filter((e) => e.type === 'text').length,
    editingText: () => api.getAppState().editingTextElement !== null,
    /** A key as Excalidraw hears it: on its container, where its handler is. */
    key: (key: string, target: Element = container) =>
      act(() => {
        fireEvent.keyDown(target, { key })
      }),
    positionOf: (id = 'm1') => {
      const element = api.getSceneElements().find((e) => e.id === id)!
      return { x: element.x, y: element.y }
    },
  }
}


/** Each slot's box on screen: scene x 300 to 340 on its element's row. */
function stubSlotBoxes() {
  const original = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const line = this.dataset.unitSlot
    const element = this.closest<HTMLElement>('[data-anchor-id]')
    if (line === undefined || !element) return original.call(this)
    const anchor = anchors.find((a) => a.id === element.dataset.anchorId)!
    const top = anchor.y + ROW_TOP + ROW_HEIGHT * Number(line)
    return DOMRect.fromRect({ x: anchor.x + 300, y: top, width: 40, height: ROW_HEIGHT })
  }
  onTestFinished(() => {
    HTMLElement.prototype.getBoundingClientRect = original
  })
}

const onSlot = (anchorId: string, n: number) => linePoint(anchorId, n, 320)
const unitField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Unit' })
const lineField = () => screen.queryByRole('textbox', { name: 'Line source' })

beforeEach(() => stubSlotBoxes())

describe('the unit slot (docs/spec-v1.md section 5)', () => {
  it('a click on a result’s unit opens its field and list, and the line stays typeset', async () => {
    await mount()

    clickOnCanvas(onSlot('m1', 1))

    expect(unitField()).toHaveFocus()
    expect(lineField()).toBeNull()
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options[0]).toBe('Sheet units45.43 kPa')
    expect(options).toContain('bar0.4543 bar')
  })

  it('choosing a unit writes it before the note, as one line commit', async () => {
    const { sourceOf, undo } = await mount()
    clickOnCanvas(onSlot('m1', 1))

    fireEvent.change(unitField()!, { target: { value: 'bar' } })
    fireEvent.keyDown(unitField()!, { key: 'Enter' })

    expect(sourceOf()).toBe('p = 45430 Pa * 1 in bar # gauge\nD = 102.3 mm')
    expect(unitField()).toBeNull()
    // A chosen unit has no mark (M4c): it reads like any other result.
    await waitFor(() => expect(document.querySelector('[data-anchor-id="m1"] .math-element__unit')).toHaveTextContent(/bar/))
    expect(document.querySelector('[data-anchor-id="m1"] .math-element__unit.is-chosen')).toBeNull()
    undo()
    expect(sourceOf()).toBe('p = 45430 Pa * 1 # gauge\nD = 102.3 mm')
  })

  it('↓ and Enter pick from the list; Sheet units, or an empty field, takes the unit off', async () => {
    const { sourceOf } = await mount({
      elements: createMathAnchorElements([
        { id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'p = 45430 Pa * 1 in bar # gauge\nD = 102.3 mm' },
      ]),
    })
    clickOnCanvas(onSlot('m1', 1))
    expect(unitField()).toHaveValue('bar')

    fireEvent.change(unitField()!, { target: { value: '' } })
    fireEvent.keyDown(unitField()!, { key: 'Enter' })
    expect(sourceOf()).toBe('p = 45430 Pa * 1 # gauge\nD = 102.3 mm')

    clickOnCanvas(onSlot('m1', 1))
    fireEvent.keyDown(unitField()!, { key: 'ArrowDown' })
    fireEvent.keyDown(unitField()!, { key: 'ArrowDown' })
    fireEvent.keyDown(unitField()!, { key: 'Enter' })
    expect(sourceOf()).toBe('p = 45430 Pa * 1 in kPa # gauge\nD = 102.3 mm')
  })

  it('accepts a typed unit expression; an unknown one turns the field red and isn’t applied', async () => {
    const { sourceOf } = await mount()
    clickOnCanvas(onSlot('m1', 1))

    fireEvent.change(unitField()!, { target: { value: 'xyz' } })
    fireEvent.keyDown(unitField()!, { key: 'Enter' })
    expect(unitField()).toHaveAttribute('aria-invalid', 'true')
    expect(sourceOf()).toBe('p = 45430 Pa * 1 # gauge\nD = 102.3 mm')

    fireEvent.change(unitField()!, { target: { value: 'kN/m^2' } })
    fireEvent.keyDown(unitField()!, { key: 'Enter' })
    expect(sourceOf()).toBe('p = 45430 Pa * 1 in kN/m^2 # gauge\nD = 102.3 mm')
  })

  it('Esc cancels and leaves the source as it was', async () => {
    const { sourceOf } = await mount()
    clickOnCanvas(onSlot('m1', 1))

    fireEvent.change(unitField()!, { target: { value: 'bar' } })
    fireEvent.keyDown(unitField()!, { key: 'Escape' })

    expect(unitField()).toBeNull()
    expect(sourceOf()).toBe('p = 45430 Pa * 1 # gauge\nD = 102.3 mm')
  })

  it('a drag that starts on a slot moves the element and opens nothing', async () => {
    const { positionOf } = await mount()
    const from = onSlot('m1', 1)

    await dragOnCanvas(from, { clientX: from.clientX + 40, clientY: from.clientY + 30 })

    expect(positionOf()).toEqual({ x: 140, y: 80 })
    expect(unitField()).toBeNull()
  })

  it('a plain input shows an empty slot on hover, and choosing shows its value converted', async () => {
    const { sourceOf } = await mount()
    act(() => {
      fireEvent.pointerMove(document.querySelector('canvas.interactive')!, { ...onSlot('m1', 2), buttons: 0 })
    })
    const slot = document.querySelector('[data-anchor-id="m1"] [data-unit-slot="1"]')
    expect(slot).toHaveClass('is-empty')
    expect(slot).toHaveClass('is-hovered')

    clickOnCanvas(onSlot('m1', 2))
    fireEvent.change(unitField()!, { target: { value: 'in' } })
    fireEvent.keyDown(unitField()!, { key: 'Enter' })

    expect(sourceOf()).toBe('p = 45430 Pa * 1 # gauge\nD = 102.3 mm in in')
    await waitFor(() =>
      expect(document.querySelectorAll('[data-anchor-id="m1"] .math-element__result')[1]).toHaveAttribute(
        'data-text',
        '4.028 in',
      ),
    )
  })
})
