import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { AppShell } from './shell/AppShell.tsx'
import {
  SHEET_PANEL,
  SheetCanvas,
  type SheetCanvasHandle,
  type SheetPanelTab,
} from './canvas/SheetCanvas.tsx'
import { sceneFileFor } from './canvas/sceneFile.ts'
import { jumpToAnchor, SIDEBAR_DOCKS_ABOVE } from './canvas/selection.ts'
import { MathOverlay, type EvaluatedElement, type FlashLine } from './overlay/MathOverlay.tsx'
import { rememberedOpen, rememberOpen } from './panel/panelMemory.ts'
import { ConstantsTab, ProblemsTab, VariablesTab } from './panel/SheetPanel.tsx'
import { SettingsTab } from './panel/SettingsTab.tsx'
import { DEFAULT_SETTINGS } from './file/sheetFormat.ts'
import { problemCount, type PanelTarget } from './panel/sheetPanel.ts'
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
 * sheet file to the canvas and the line edit, and the sheet's evaluation to the
 * Sheet panel, which lives in Excalidraw's sidebar (docs/spec-v1.md section 8).
 * The shell's own side-panel slot is left empty.
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

  // The sheet's settings: the file's, changed from the Settings tab.
  const settings = useSyncExternalStore(
    useCallback((listener: () => void) => file?.session.subscribe(listener) ?? (() => {}), [file]),
    () => file?.session.getState().settings ?? DEFAULT_SETTINGS,
  )

  // The sheet as last evaluated, for the Sheet panel; null until the first run.
  const [sheet, setSheet] = useState<readonly EvaluatedElement[] | null>(null)
  const [flash, setFlash] = useState<FlashLine | null>(null)
  const problems = sheet ? problemCount(sheet) : 0
  const wide = () => (canvas?.root.clientWidth ?? 0) > SIDEBAR_DOCKS_ABOVE

  // At launch, on a wide window, the panel opens unless it was last closed:
  // on Problems if the sheet has any, else on Variables.
  const launched = useRef(false)
  useEffect(() => {
    if (!canvas || !sheet || launched.current) return
    launched.current = true
    if (rememberedOpen() === false || canvas.root.clientWidth <= SIDEBAR_DOCKS_ABOVE) return
    const tab: SheetPanelTab = problemCount(sheet) > 0 ? 'problems' : 'variables'
    canvas.api.toggleSidebar({ name: SHEET_PANEL, tab, force: true })
  }, [canvas, sheet])

  const jump = useCallback(
    (target: PanelTarget) => {
      if (!canvas) return
      jumpToAnchor(canvas.api, target.anchorId)
      setFlash({ ...target, key: Date.now() })
      // Floating over a small window, the panel gets out of the way.
      if (canvas.root.clientWidth <= SIDEBAR_DOCKS_ABOVE) {
        canvas.api.toggleSidebar({ name: SHEET_PANEL, force: false })
      }
      canvas.focusCanvas()
    },
    [canvas],
  )

  // The flash lasts about 1.5 s; with reduced motion it is an outline that
  // stays until the next click. Either way, the next click clears it.
  useEffect(() => {
    if (!flash) return
    const clear = () => setFlash(null)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timer = reduced ? undefined : window.setTimeout(clear, 1500)
    window.addEventListener('pointerdown', clear, { capture: true, once: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', clear, { capture: true })
    }
  }, [flash])

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
          sheetPanel={{
            problems,
            variables: <VariablesTab sheet={sheet ?? []} onJump={jump} />,
            problemsTab: <ProblemsTab sheet={sheet ?? []} onJump={jump} />,
            settings: file && <SettingsTab settings={settings} onChange={file.session.setSettings} />,
            constants: <ConstantsTab settings={settings} />,
            // Remembered per browser; a floating panel closes by itself, so
            // only a wide window's choice counts.
            onChange: (open) => {
              if (wide()) rememberOpen(open)
            },
          }}
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
              onEvaluated={setSheet}
              settings={settings}
              resultColor={settings.resultColor}
              flash={flash}
            />
            <FileChrome session={file.session} dialogs={file.dialogs} canvasRoot={canvas.root} />
          </>
        )
      }
    />
  )
}
