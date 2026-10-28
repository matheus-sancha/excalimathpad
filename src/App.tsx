import { useState } from 'react'
import { AppShell } from './shell/AppShell.tsx'
import { SheetCanvas, type SheetCanvasHandle } from './canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from './canvas/mathAnchor.ts'
import { MathOverlay } from './overlay/MathOverlay.tsx'

// Spike (#2): the sheet starts with one math element. No "add math" UI yet.
const SEED_ID = 'math-seed'
const initialElements = createMathAnchorElements([
  { id: SEED_ID, x: 100, y: 100, width: 420, height: 96 },
])
const initialSources = { [SEED_ID]: 'R = 10 kohm\nI = 2 mA\nI * R' }

/**
 * Composition root: decides what fills each slot of the shell. The side
 * panel is not built yet, so its slot is left empty.
 */
export default function App() {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)

  return (
    <AppShell
      canvas={<SheetCanvas initialElements={initialElements} onReady={setCanvas} />}
      overlay={
        canvas && (
          <MathOverlay
            api={canvas.api}
            forwardWheel={canvas.forwardWheel}
            initialSources={initialSources}
          />
        )
      }
    />
  )
}
