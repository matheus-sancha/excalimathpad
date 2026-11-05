import { useState } from 'react'
import { AppShell } from './shell/AppShell.tsx'
import { SheetCanvas, type SheetCanvasHandle } from './canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from './canvas/mathAnchor.ts'
import { MathOverlay } from './overlay/MathOverlay.tsx'

// The sheet starts with two math elements: inputs above, and a result below
// that uses them (#3). No "add math" UI yet; duplicating an anchor (Ctrl+D)
// makes a new one with the same source.
const initialElements = createMathAnchorElements([
  {
    id: 'math-inputs',
    x: 100,
    y: 100,
    width: 420,
    height: 72,
    source: 'R = 10 kohm\nI = 2 mA',
  },
  { id: 'math-result', x: 100, y: 200, width: 420, height: 48, source: 'U = I * R' },
])

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
            focusCanvas={canvas.focusCanvas}
          />
        )
      }
    />
  )
}
