import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import { SheetCanvas, type SheetCanvasHandle } from './SheetCanvas.tsx'
import { hasAnchorStyle, restoreAnchorStyles } from './anchorStyle.ts'
import { createMathAnchorElements } from './mathAnchor.ts'
import { sceneLoaded, undoControls } from '../test/excalidraw.ts'
import { clickOnCanvas } from '../test/gestures.ts'

/**
 * The style restore against the real Excalidraw 0.18.1 (docs/spec-v1.md
 * sections 4, 6 and 17): what a `NEVER` restore from `onChange` leaves on the
 * undo stack after Excalidraw's own paste styles. `without the restore` is the
 * control. The scene is unscrolled at zoom 1, so client points equal scene
 * points.
 */
const RED = '#e03131'
const drawing = (id: string, y: number, strokeColor: string) => ({
  type: 'rectangle' as const,
  id,
  x: 100,
  y,
  width: 200,
  height: 100,
  strokeColor,
  backgroundColor: '#ffc9c9',
  strokeWidth: 4,
})

const scene = () => [
  ...createMathAnchorElements([{ id: 'm1', x: 100, y: 50, width: 400, height: 72, source: 'a = 1' }]),
  ...convertToExcalidrawElements([drawing('red', 300, RED), drawing('plain', 450, '#1e1e1e')], {
    regenerateIds: false,
  }),
]

const onMath = { clientX: 200, clientY: 80 }
const onRed = { clientX: 200, clientY: 350 }
const onPlain = { clientX: 200, clientY: 500 }

async function mount({ restore }: { restore: boolean }) {
  let handle: SheetCanvasHandle | undefined
  render(<SheetCanvas initialElements={scene()} onReady={(h) => (handle = h)} />)
  await waitFor(() => expect(handle).toBeDefined())
  const { api } = handle!
  await sceneLoaded(api)
  if (restore) api.onChange(() => restoreAnchorStyles(api))
  const container = document.querySelector<HTMLElement>('.excalidraw')!
  const element = (id: string) => api.getSceneElements().find((e) => e.id === id)!
  const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))
  /** Excalidraw's copy styles (Ctrl+Alt+C) and paste styles (Ctrl+Alt+V). */
  const styles = async (code: 'KeyC' | 'KeyV') => {
    act(() => {
      fireEvent.keyDown(container, { key: code === 'KeyC' ? 'c' : 'v', code, ctrlKey: true, altKey: true })
    })
    await settle()
  }
  const controls = undoControls(document)
  /** Undoes everything, and says how many steps that took. */
  const undoAll = async () => {
    let steps = 0
    while (controls.canUndo() && steps < 20) {
      controls.undo()
      await settle()
      steps++
    }
    return steps
  }
  return {
    api,
    element,
    styles,
    settle,
    undoAll,
    ...controls,
    selected: () => Object.keys(api.getAppState().selectedElementIds),
  }
}

/** Copies the red drawing's styles, then selects the math element. */
async function copyRedThenSelectMath(scene: Awaited<ReturnType<typeof mount>>) {
  clickOnCanvas(onRed)
  await scene.styles('KeyC')
  clickOnCanvas(onMath)
  expect(scene.selected()).toEqual(['m1'])
}

describe('paste styles on a math element alone', () => {
  it('without the restore, restyles the anchor and adds an undo step', async () => {
    const scene = await mount({ restore: false })
    await copyRedThenSelectMath(scene)

    await scene.styles('KeyV')

    expect(scene.element('m1').strokeColor).toBe(RED)
    // Selecting the drawing, selecting the anchor, and the paste.
    expect(await scene.undoAll()).toBe(3)
  })

  it('with it, keeps the fixed style and adds no undo step', async () => {
    const scene = await mount({ restore: true })
    await copyRedThenSelectMath(scene)

    await scene.styles('KeyV')

    expect(hasAnchorStyle(scene.element('m1'))).toBe(true)
    // Only the two selection steps: no empty entry is left behind (section 17).
    expect(await scene.undoAll()).toBe(2)
    expect(hasAnchorStyle(scene.element('m1'))).toBe(true)
  })

  it('with it, redo brings back only the selection', async () => {
    const scene = await mount({ restore: true })
    await copyRedThenSelectMath(scene)
    await scene.styles('KeyV')
    const steps = await scene.undoAll()

    for (let i = 0; i < steps; i++) {
      scene.redo()
      await scene.settle()
    }

    expect(scene.selected()).toEqual(['m1'])
    expect(hasAnchorStyle(scene.element('m1'))).toBe(true)
  })
})

describe('a style change on math and a drawing together', () => {
  it('reaches only the drawing, and undo takes the drawing’s change back', async () => {
    const scene = await mount({ restore: true })
    clickOnCanvas(onRed)
    await scene.styles('KeyC')
    clickOnCanvas(onMath)
    act(() => {
      fireEvent.pointerDown(document.querySelector('canvas.interactive')!, {
        ...onPlain,
        shiftKey: true,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      })
    })
    act(() => {
      fireEvent.pointerUp(document.querySelector('canvas.interactive')!, {
        ...onPlain,
        shiftKey: true,
        button: 0,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true,
      })
    })
    expect(scene.selected().sort()).toEqual(['m1', 'plain'])

    await scene.styles('KeyV')

    expect(scene.element('plain').strokeColor).toBe(RED)
    expect(hasAnchorStyle(scene.element('m1'))).toBe(true)

    scene.undo()
    await scene.settle()

    expect(scene.element('plain').strokeColor).toBe('#1e1e1e')
    expect(hasAnchorStyle(scene.element('m1'))).toBe(true)
  })
})
