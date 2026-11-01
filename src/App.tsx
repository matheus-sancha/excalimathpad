import { useState } from 'react'
import { AppShell } from './shell/AppShell.tsx'
import { SheetCanvas, type SheetCanvasHandle } from './canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from './canvas/mathAnchor.ts'
import { MathOverlay } from './overlay/MathOverlay.tsx'

// The sheet starts with two math elements: inputs above, and a result below
// that uses them (#3). No "add math" UI yet; duplicating an anchor (Ctrl+D)
// makes a new, empty one.
const INPUTS_ID = 'math-inputs'
const RESULT_ID = 'math-result'
const initialElements = createMathAnchorElements([
  { id: INPUTS_ID, x: 100, y: 100, width: 420, height: 72 },
  { id: RESULT_ID, x: 100, y: 200, width: 420, height: 48 },
])
const initialSources = {
  [INPUTS_ID]: 'R = 10 kohm\nI = 2 mA',
  [RESULT_ID]: 'U = I * R',
}

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
