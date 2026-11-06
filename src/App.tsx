import { useMemo, useState } from 'react'
import { AppShell } from './shell/AppShell.tsx'
import { SheetCanvas, type SheetCanvasHandle } from './canvas/SheetCanvas.tsx'
import { createMathAnchorElements } from './canvas/mathAnchor.ts'
import { sceneFileFor } from './canvas/sceneFile.ts'
import { MathOverlay } from './overlay/MathOverlay.tsx'
import { createDialogHost } from './file/dialogs.ts'
import { browserFileAccess, type FileAccess } from './file/fileAccess.ts'
import { FileChrome } from './file/FileChrome.tsx'
import { indexedDbRecovery, type RecoveryStore } from './file/recovery.ts'
import { createLineRelay, createSheetSession } from './file/sheetSession.ts'

// The untitled sheet starts with two math elements: inputs above, and a result
// below that uses them (#3). They load clean, so they never make the sheet
// dirty. Until Add math (#45), which removes them, duplicating an anchor
// (Ctrl+D) is the way to make a new one (#42, question 1).
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

export interface AppProps {
  /** The disk and the browser store; tests pass fakes. */
  files?: FileAccess
  recovery?: RecoveryStore
}

/**
 * Composition root: decides what fills each slot of the shell, and wires the
 * sheet file to the canvas and the line edit. The side panel is not built yet,
 * so its slot is left empty.
 */
export default function App({ files, recovery }: AppProps = {}) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  const [line] = useState(createLineRelay)

  const file = useMemo(() => {
    if (!canvas) return null
    const dialogs = createDialogHost((message) =>
      canvas.api.setToast({ message, closable: true, duration: 6000 }),
    )
    const session = createSheetSession({
      scene: sceneFileFor(canvas.api),
      files: files ?? browserFileAccess(),
      recovery: recovery ?? indexedDbRecovery(),
      dialogs,
      line,
    })
    return { session, dialogs }
  }, [canvas, files, recovery, line])

  const fileMenu = useMemo(
    () =>
      file && {
        open: () => void file.session.open(),
        save: () => void file.session.save(),
        saveAs: () => void file.session.saveAs(),
      },
    [file],
  )

  return (
    <AppShell
      canvas={
        <SheetCanvas
          initialElements={initialElements}
          onReady={setCanvas}
          fileMenu={fileMenu ?? undefined}
        />
      }
      overlay={
        canvas &&
        file && (
          <>
            <MathOverlay
              api={canvas.api}
              forwardWheel={canvas.forwardWheel}
              focusCanvas={canvas.focusCanvas}
              control={line}
            />
            <FileChrome session={file.session} dialogs={file.dialogs} canvasRoot={canvas.root} />
          </>
        )
      }
    />
  )
}
