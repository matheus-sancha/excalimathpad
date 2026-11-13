import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { AppShell } from '../shell/AppShell.tsx'
import { sceneLoaded } from '../test/excalidraw.ts'
import {
  clickOnCanvas,
  dragOnCanvas,
  interactiveCanvas,
  linePoint,
  ROW_HEIGHT,
  ROW_TOP,
  type ClientPoint,
} from '../test/gestures.ts'
import { TIP_DELAY_MS } from './HoverTip.tsx'
import { MathOverlay } from './MathOverlay.tsx'

/**
 * A problem's message on hover, against the real Excalidraw 0.18.1
 * (docs/spec-v1.md sections 4 and 14): the overlay takes no pointer events, so
 * the gestures find the gutter mark or capped error cell under the pointer from
 * its box and draw the message as a tip. The press still goes to Excalidraw,
 * which selects and drags. jsdom has no layout, so each mark's box is stubbed
 * on its row: the gutter at scene x 14 to 24 in from the element's edge, the
 * result cell at 200 to 520. The scene is unscrolled at zoom 1, so client
 * points equal scene points.
 */
const anchors = createMathAnchorElements([
  {
    id: 'm1',
    x: 100,
    y: 50,
    width: 560,
    height: 96,
    source: 'K = 2 * 2.7\nx = 1 m + 2 s\nD = 102.3 mm',
  },
  { id: 'm2', x: 100, y: 250, width: 560, height: 48, source: 'y = 3 kg + 1 s' },
  { id: 'm3', x: 100, y: 400, width: 560, height: 48, source: 'x = solve x^2 = 2, for x = 0 .. 10' },
  { id: 'm4', x: 100, y: 550, width: 560, height: 48, source: 'n = 1 .. 3' },
])

const WARNING = 'K shadows the unit K'
const ERROR = 'Units do not match'

function Harness({
  elements,
  onReady,
}: {
  elements: readonly ExcalidrawElement[]
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

async function mount() {
  let handle: SheetCanvasHandle | undefined
  render(<Harness elements={anchors} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  await screen.findAllByRole('list', { name: 'Lines' })
  return {
    api,
    root: handle!.root,
    selected: () => Object.keys(api.getAppState().selectedElementIds),
    positionOf: (id = 'm1') => {
      const element = api.getSceneElements().find((e) => e.id === id)!
      return { x: element.x, y: element.y }
    },
  }
}

/**
 * Each mark's box on screen, on its row: the gutter 14 to 24 in, the result
 * cell 200 to 520. An error cell reads as cut short while `capped` holds.
 */
function stubMarkBoxes() {
  const proto = HTMLElement.prototype
  const original = {
    rect: proto.getBoundingClientRect,
    scroll: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')!,
    client: Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!,
  }
  const layout = { capped: true }
  const cell = (element: Element) => {
    if (!(element instanceof HTMLElement) || element.dataset.tip === undefined) return null
    const row = element.closest<HTMLElement>('[data-line]')
    const block = element.closest<HTMLElement>('[data-anchor-id]')
    if (!row || !block) return null
    const anchor = anchors.find((a) => a.id === block.dataset.anchorId)!
    const top = anchor.y + ROW_TOP + ROW_HEIGHT * Number(row.dataset.line)
    return element.classList.contains('math-element__gutter')
      ? DOMRect.fromRect({ x: anchor.x + 14, y: top, width: 10, height: ROW_HEIGHT })
      : DOMRect.fromRect({ x: anchor.x + 200, y: top, width: 320, height: ROW_HEIGHT })
  }
  proto.getBoundingClientRect = function (this: HTMLElement) {
    return cell(this) ?? original.rect.call(this)
  }
  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      return cell(this) ? (layout.capped ? 640 : 120) : original.scroll.get!.call(this)
    },
  })
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) {
      return cell(this) ? 320 : original.client.get!.call(this)
    },
  })
  onTestFinished(() => {
    proto.getBoundingClientRect = original.rect
    Object.defineProperty(Element.prototype, 'scrollWidth', original.scroll)
    Object.defineProperty(Element.prototype, 'clientWidth', original.client)
  })
  return layout
}

const onGutter = (anchorId: string, n: number) => linePoint(anchorId, n, 19)
const onResult = (anchorId: string, n: number) => linePoint(anchorId, n, 360)
const offMarks = (anchorId: string, n: number) => linePoint(anchorId, n, 100)

/** A pointer moving with no button down, as Excalidraw's canvas hears it. */
function hover(point: ClientPoint) {
  act(() => {
    fireEvent.pointerMove(interactiveCanvas(), { ...point, buttons: 0, pointerType: 'mouse' })
  })
}

const tip = () => screen.queryByRole('tooltip')
const rest = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

let layout: { capped: boolean }
beforeEach(() => {
  layout = stubMarkBoxes()
})

describe('a problem’s message on hover (docs/spec-v1.md section 4, Problems)', () => {
  it('shows a warning ⚠’s message after a short rest, and hides it when the pointer leaves', async () => {
    await mount()

    hover(onGutter('m1', 1))
    expect(tip()).toBeNull()
    await rest(TIP_DELAY_MS / 2)
    expect(tip()).toBeNull()
    await waitFor(() => expect(tip()).toHaveTextContent(WARNING))

    hover(offMarks('m1', 1))
    expect(tip()).toBeNull()
  })

  it('shows an error ●’s message, and moves straight to the next mark while one shows', async () => {
    await mount()

    hover(onGutter('m1', 2))
    await waitFor(() => expect(tip()).toHaveTextContent(ERROR))

    hover(onGutter('m1', 1))
    expect(tip()).toHaveTextContent(WARNING)
  })

  it('shows a capped error cell’s whole text; one that fits shows none', async () => {
    await mount()

    hover(onResult('m2', 1))
    await waitFor(() => expect(tip()).toHaveTextContent(ERROR))
    hover(offMarks('m2', 1))

    layout.capped = false
    hover(onResult('m2', 1))
    await rest(TIP_DELAY_MS * 2)
    expect(tip()).toBeNull()
  })

  it('a pointer that leaves before the rest shows nothing', async () => {
    await mount()

    hover(onGutter('m1', 1))
    await rest(TIP_DELAY_MS / 2)
    hover(offMarks('m1', 3))
    await rest(TIP_DELAY_MS)

    expect(tip()).toBeNull()
  })

  it('a press on a mark still selects its element, and the message goes', async () => {
    const { selected } = await mount()
    hover(onGutter('m1', 1))
    await waitFor(() => expect(tip()).not.toBeNull())

    clickOnCanvas(onGutter('m1', 1))

    expect(selected()).toEqual(['m1'])
    expect(tip()).toBeNull()
  })

  it('a drag that starts on a mark moves the element and shows nothing', async () => {
    const { positionOf } = await mount()
    const from = onGutter('m1', 2)

    await dragOnCanvas(from, { clientX: from.clientX + 40, clientY: from.clientY + 30 })
    await rest(TIP_DELAY_MS * 2)

    expect(positionOf()).toEqual({ x: 140, y: 80 })
    expect(tip()).toBeNull()
  })

  it('hides when the pointer leaves the canvas', async () => {
    const { root } = await mount()
    hover(onGutter('m1', 1))
    await waitFor(() => expect(tip()).not.toBeNull())

    act(() => {
      fireEvent.pointerLeave(root)
    })

    expect(tip()).toBeNull()
  })

  it('is screen only: nothing of it reaches the scene', async () => {
    const { api } = await mount()
    const before = JSON.stringify(api.getSceneElements())
    hover(onGutter('m1', 1))
    await waitFor(() => expect(tip()).not.toBeNull())

    expect(JSON.stringify(api.getSceneElements())).toBe(before)
    expect(tip()).toHaveClass('math-hover-tip')
  })
})

describe('a solve’s details on hover (docs/spec-v1.md section 4, Solve details)', () => {
  it('shows the method, the range searched and the root over a solved value', async () => {
    await mount()

    hover(onResult('m3', 1))
    await waitFor(() => expect(tip()).toHaveTextContent(/^Scan \+ Brent, roots found in 0 \.\. 10/))
    expect(tip()).toHaveTextContent('Root 1: 1.41421356237')

    hover(offMarks('m3', 1))
    expect(tip()).toBeNull()
  })

  it('lets Excalidraw select and drag from the value, and shows nothing during the drag', async () => {
    const { selected, positionOf } = await mount()
    hover(onResult('m3', 1))
    await waitFor(() => expect(tip()).not.toBeNull())

    clickOnCanvas(onResult('m3', 1))
    expect(selected()).toEqual(['m3'])
    expect(tip()).toBeNull()

    const from = onResult('m3', 1)
    await dragOnCanvas(from, { clientX: from.clientX + 40, clientY: from.clientY + 30 })
    await rest(TIP_DELAY_MS * 2)
    expect(positionOf('m3')).toEqual({ x: 140, y: 430 })
    expect(tip()).toBeNull()
  })
})

describe('a list’s points on hover (docs/spec-v1.md section 10)', () => {
  it('shows the points with their index over the summary', async () => {
    await mount()

    hover(onResult('m4', 1))
    await waitFor(() => expect(tip()).toHaveTextContent('1: 1'))
    expect(tip()?.textContent).toBe('1: 1\n2: 2\n3: 3')
  })
})
