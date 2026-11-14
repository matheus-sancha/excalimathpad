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
import { sessionPanelMemory, type PanelMemory } from './panel/panelMemory.ts'
import { ConstantsTab, ProblemsTab, VariablesTab } from './panel/SheetPanel.tsx'
import { SettingsTab } from './panel/SettingsTab.tsx'
import { DEFAULT_SETTINGS, type SheetSettings } from './file/sheetFormat.ts'
import { problemCount, type PanelTarget } from './panel/sheetPanel.ts'
import { createDialogHost } from './file/dialogs.ts'
import type { FileAccess } from './file/fileAccess.ts'
import { FileChrome } from './file/FileChrome.tsx'
import type { RecoveryStore } from './file/recovery.ts'
import { createLineRelay, createSheetSession } from './file/sheetSession.ts'
import { createVaultSheet, type VaultSheetData } from './file/vaultSheet.ts'

/**
 * A sheet in a vault (M4d, docs/spec-v1.md section 12a): what the plugin's view
 * hands App. With it there is no file chrome, no file keys or drops and no ☰
 * file items; Obsidian's tab owns the file.
 */
export interface VaultHome {
  /**
   * The view's own container. The app's own key and pointer listeners bind
   * here, never to the global window or document, so each tab hears only
   * itself and a pop-out window works.
   */
  container: HTMLElement
  /** The file as the view read it; the view shows a refusal itself. */
  sheet: VaultSheetData
}

export interface AppProps {
  /**
   * The web app's disk and browser store (`src/main.tsx` gives the browser's;
   * tests pass fakes). Needed unless `vault` is set, and never imported here,
   * so the plugin's bundle holds no IndexedDB or file pickers.
   */
  files?: FileAccess
  recovery?: RecoveryStore
  /** Where the Sheet panel's open state is kept. Unset: for this page only. */
  panelMemory?: PanelMemory
  /** Set inside an Obsidian view: the sheet is the vault's file. */
  vault?: VaultHome
  /**
   * The untitled sheet's scene. The app starts empty, on the welcome screen
   * (docs/spec-v1.md section 8); tests pass a sheet to work on.
   */
  initialElements?: readonly ExcalidrawElement[]
}

/** The sheet App shows: the web's session with its file chrome, or a vault's file. */
interface SheetFile {
  sheet: {
    getState: () => { settings: SheetSettings }
    subscribe: (listener: () => void) => () => void
    setSettings: (next: SheetSettings) => void
    keepClean: (write: () => void) => void
    start: () => Promise<void>
  }
  web: { session: ReturnType<typeof createSheetSession>; dialogs: ReturnType<typeof createDialogHost> } | null
}

/**
 * Composition root: decides what fills each slot of the shell, and wires the
 * sheet file to the canvas and the line edit, and the sheet's evaluation to the
 * Sheet panel, which lives in Excalidraw's sidebar (docs/spec-v1.md section 8).
 * The shell's own side-panel slot is left empty.
 */
export default function App({ files, recovery, panelMemory, vault, initialElements }: AppProps) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  const [line] = useState(createLineRelay)
  const [memory] = useState(() => panelMemory ?? sessionPanelMemory())

  const file = useMemo((): SheetFile | null => {
    if (!canvas) return null
    if (vault) return { sheet: createVaultSheet(sceneFileFor(canvas.api), vault.sheet), web: null }
    if (!files || !recovery) throw new Error('App needs files and recovery, or a vault')
    const dialogs = createDialogHost((message) =>
      canvas.api.setToast({ message, closable: true, duration: 6000 }),
    )
    const session = createSheetSession({
      scene: sceneFileFor(canvas.api),
      files,
      recovery,
      dialogs,
      line,
    })
    return { sheet: session, web: { session, dialogs } }
  }, [canvas, files, recovery, vault, line])

  // In a vault the sheet loads once Excalidraw is ready; the web's file chrome starts its own.
  useEffect(() => {
    if (file && !file.web) void file.sheet.start()
  }, [file])

  // The sheet's settings: the file's, changed from the Settings tab.
  const settings = useSyncExternalStore(
    useCallback((listener: () => void) => file?.sheet.subscribe(listener) ?? (() => {}), [file]),
    () => file?.sheet.getState().settings ?? DEFAULT_SETTINGS,
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
    if (memory.rememberedOpen() === false || canvas.root.clientWidth <= SIDEBAR_DOCKS_ABOVE) return
    const tab: SheetPanelTab = problemCount(sheet) > 0 ? 'problems' : 'variables'
    canvas.api.toggleSidebar({ name: SHEET_PANEL, tab, force: true })
  }, [canvas, sheet, memory])

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
  // stays until the next click. Either way, the next click clears it: on the
  // page on the web, inside the view in a vault.
  const clickScope = vault?.container
  useEffect(() => {
    if (!flash) return
    const view = clickScope?.ownerDocument.defaultView ?? window
    const scope: EventTarget = clickScope ?? window
    const clear = () => setFlash(null)
    const reduced = view.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const timer = reduced ? undefined : view.setTimeout(clear, 1500)
    scope.addEventListener('pointerdown', clear, { capture: true, once: true })
    return () => {
      view.clearTimeout(timer)
      scope.removeEventListener('pointerdown', clear, { capture: true })
    }
  }, [flash, clickScope])

  const web = file?.web
  const fileMenu = useMemo(
    () =>
      web && {
        open: () => void web.session.open(),
        save: () => void web.session.save(),
        saveAs: () => void web.session.saveAs(),
      },
    [web],
  )

  return (
    <AppShell
      canvas={
        <SheetCanvas
          initialElements={initialElements}
          onReady={setCanvas}
          embeds={!vault}
          fileMenu={fileMenu ?? undefined}
          sheetPanel={{
            problems,
            variables: <VariablesTab sheet={sheet ?? []} onJump={jump} />,
            problemsTab: <ProblemsTab sheet={sheet ?? []} onJump={jump} />,
            settings: file && <SettingsTab settings={settings} onChange={file.sheet.setSettings} />,
            constants: <ConstantsTab settings={settings} />,
            // Remembered per home; a floating panel closes by itself, so
            // only a wide window's choice counts.
            onChange: (open) => {
              if (wide()) memory.rememberOpen(open)
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
              keyScope={vault?.container}
              forwardWheel={canvas.forwardWheel}
              focusCanvas={canvas.focusCanvas}
              control={line}
              keepClean={file.sheet.keepClean}
              onEvaluated={setSheet}
              settings={settings}
              resultColor={settings.resultColor}
              flash={flash}
            />
            {web && <FileChrome session={web.session} dialogs={web.dialogs} canvasRoot={canvas.root} />}
          </>
        )
      }
    />
  )
}
