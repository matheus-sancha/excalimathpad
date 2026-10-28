import { useState } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { NormalizedZoomValue } from '@excalidraw/excalidraw/types'
import { SheetCanvas, type SheetCanvasHandle } from '../canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from '../canvas/mathAnchor.ts'
import { AppShell } from '../shell/AppShell.tsx'
import { MathOverlay } from './MathOverlay.tsx'

/**
 * The overlay against the real Excalidraw (not the fake in
 * MathOverlay.test.tsx): proves Excalidraw fires onChange / onScrollChange
 * the way the overlay relies on. Same composition as App, with the handle
 * exposed to the test.
 */
const initialElements = createMathAnchorElements([
  { id: 'm1', x: 100, y: 50, width: 400, height: 96 },
])

function Harness({ onReady }: { onReady: (handle: SheetCanvasHandle) => void }) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  return (
    <AppShell
      canvas={
        <SheetCanvas
          initialElements={initialElements}
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
            forwardWheel={canvas.forwardWheel}
            initialSources={{ m1: 'I * R' }}
          />
        )
      }
    />
  )
}

const transformOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-anchor-id="${id}"]`)?.style.transform

describe('MathOverlay on real Excalidraw', () => {
  it('follows pan, zoom and a moved anchor via updateScene', async () => {
    let handle: SheetCanvasHandle | undefined
    render(<Harness onReady={(h) => (handle = h)} />)
    await screen.findByRole('textbox', { name: 'Math source' })
    const { api } = handle!

    act(() => {
      api.updateScene({
        appState: {
          scrollX: -40,
          scrollY: 25,
          zoom: { value: 2 as NormalizedZoomValue },
        },
      })
    })
    // (100 - 40) * 2, (50 + 25) * 2
    await waitFor(() =>
      expect(transformOf('m1')).toBe('translate(120px, 150px) scale(2)'),
    )

    act(() => {
      api.updateScene({
        elements: api
          .getSceneElements()
          .map((e) => (e.id === 'm1' ? { ...e, x: 300, y: 220 } : e)),
      })
    })
    // (300 - 40) * 2, (220 + 25) * 2
    await waitFor(() =>
      expect(transformOf('m1')).toBe('translate(520px, 490px) scale(2)'),
    )
  })
})
