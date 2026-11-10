import { useMemo, useState } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { AppShell } from './shell/AppShell.tsx'
import { SheetCanvas, type SheetCanvasHandle } from './canvas/SheetCanvas.tsx'
import { sceneFileFor } from './canvas/sceneFile.ts'
import { MathOverlay } from './overlay/MathOverlay.tsx'
import { createDialogHost } from './file/dialogs.ts'
import { browserFileAccess, type FileAccess } from './file/fileAccess.ts'
import { FileChrome } from './file/FileChrome.tsx'
import { indexedDbRecovery, type RecoveryStore } from './file/recovery.ts'
import { createLineRelay, createSheetSession } from './file/sheetSession.ts'

export interface AppProps {
  /** The disk and the browser store; tests pass fakes. */
  files?: FileAccess
  recovery?: RecoveryStore
  /**
   * The untitled sheet's scene. The app starts empty, on the welcome screen
   * (docs/spec-v1.md section 8); tests pass a sheet to work on.
   */
  initialElements?: readonly ExcalidrawElement[]
}

/**
 * Composition root: decides what fills each slot of the shell, and wires the
 * sheet file to the canvas and the line edit. The side panel is not built yet,
 * so its slot is left empty.
 */
export default function App({ files, recovery, initialElements }: AppProps = {}) {
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
              canvasRoot={canvas.root}
              forwardWheel={canvas.forwardWheel}
              focusCanvas={canvas.focusCanvas}
              control={line}
              keepClean={file.session.keepClean}
            />
            <FileChrome session={file.session} dialogs={file.dialogs} canvasRoot={canvas.root} />
          </>
        )
      }
    />
  )
}
