import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { AppShell } from './shell/AppShell.tsx'
import {
  SHEET_PANEL,
  SheetCanvas,
  type SheetCanvasHandle,
  type SheetPanelTab,
} from './canvas/SheetCanvas.tsx'
import { isMathAnchor } from './canvas/mathAnchor.ts'
import { sceneFileFor } from './canvas/sceneFile.ts'
import { jumpToAnchor, SIDEBAR_DOCKS_ABOVE } from './canvas/selection.ts'
import { MathOverlay, type EvaluatedElement, type FlashLine } from './overlay/MathOverlay.tsx'
import { sessionPanelMemory, type PanelMemory } from './panel/panelMemory.ts'
import { ConstantsTab, ProblemsTab, VariablesTab } from './panel/SheetPanel.tsx'
import { SettingsTab } from './panel/SettingsTab.tsx'
import { DEFAULT_SETTINGS, type SheetSettings } from './file/sheetFormat.ts'
import { errorCount, type PanelTarget } from './panel/sheetPanel.ts'
import { createDialogHost } from './file/dialogs.ts'
import type { FileAccess } from './file/fileAccess.ts'
import { FileChrome } from './file/FileChrome.tsx'
import type { RecoveryStore } from './file/recovery.ts'
import { createLineRelay, createSheetSession } from './file/sheetSession.ts'
import { createVaultSheet, type VaultSheet, type VaultSheetData } from './file/vaultSheet.ts'
import { ignoreSceneDrops } from './canvas/fileRoutes.ts'
import type { PickedImage } from './canvas/imageTool.ts'
import type { ThemeMemory } from './canvas/theme.ts'
import { confineKeys } from './canvas/vaultKeys.ts'
import { bridgeWindow } from './canvas/popoutBridge.ts'

/**
 * What Obsidian's commands do in a sheet tab (docs/spec-v1.md section 8,
 * Inside an Obsidian tab): the same as the app's More tools items.
 */
export interface SheetCommands {
  addMath: () => void
  toggleMathSettings: () => void
}

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
  /**
   * Hands the view the sheet it writes back, once the canvas is up, and null
   * as the app goes (docs/spec-v1.md section 7, A sheet in a vault).
   */
  connect: (sheet: VaultSheet | null) => void
  /** The sheet now differs from its file: the view asks Obsidian to save. */
  onUnwritten: () => void
  /** The vault's image picker, for Excalidraw's image tool (section 12a, Reach). */
  pickImage: () => Promise<PickedImage | null>
  /** Light or dark, kept in the plugin's `data.json` (section 8, Inside an Obsidian tab). */
  theme: ThemeMemory
  /** Hands the view what its commands do, once the canvas is up, and null as the app goes. */
  commands: (commands: SheetCommands | null) => void
  /**
   * Calls `listener` each time Obsidian moves the view to another window (a
   * pop-out, or back); returns the function that stops.
   */
  onWindowMigrated: (listener: () => void) => () => void
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
  /** In a vault: the same sheet, as the view writes it back. */
  vault: VaultSheet | null
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
    if (vault) {
      const sheet = createVaultSheet({
        scene: sceneFileFor(canvas.api),
        line,
        sheet: vault.sheet,
        onUnwritten: vault.onUnwritten,
      })
      return { sheet, web: null, vault: sheet }
    }
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
    return { sheet: session, web: { session, dialogs }, vault: null }
  }, [canvas, files, recovery, vault, line])

  // In a vault the sheet loads once Excalidraw is ready and the view writes it
  // back; the web's file chrome starts its own.
  const vaultSheet = file?.vault ?? null
  useEffect(() => {
    if (!vault || !vaultSheet) return
    const detach = vaultSheet.attach()
    vault.connect(vaultSheet)
    void vaultSheet.start()
    return () => {
      detach()
      vault.connect(null)
    }
  }, [vault, vaultSheet])

  // In a vault the tab's file is the sheet: a dropped sheet file is ignored.
  // Obsidian's core keys reach Obsidian, and Excalidraw's export and palette
  // keys stop at the view (section 8, Inside an Obsidian tab).
  const vaultContainer = vault?.container
  useEffect(() => {
    if (!vaultContainer) return
    const stopDrops = ignoreSceneDrops(vaultContainer)
    const stopKeys = confineKeys(vaultContainer)
    return () => {
      stopDrops()
      stopKeys()
    }
  }, [vaultContainer])

  // In a pop-out window, Excalidraw's own listeners are the main window's: the
  // bridge carries the pop-out's events and dialogs across (section 8).
  const [migrations, setMigrations] = useState(0)
  const onWindowMigrated = vault?.onWindowMigrated
  useEffect(() => onWindowMigrated?.(() => setMigrations((n) => n + 1)), [onWindowMigrated])
  useEffect(() => {
    if (vaultContainer) return bridgeWindow(vaultContainer)
  }, [vaultContainer, migrations])

  // Obsidian's Add math and Toggle Math settings commands act on this tab.
  const handCommands = vault?.commands
  useEffect(() => {
    if (!handCommands || !canvas) return
    handCommands({ addMath: canvas.addMath, toggleMathSettings: canvas.toggleSheetPanel })
    return () => handCommands(null)
  }, [handCommands, canvas])
  const imageTool = useMemo(
    () => vault && { keys: vault.container, pick: vault.pickImage },
    [vault],
  )

  // The sheet's settings: the file's, changed from the Settings tab.
  const settings = useSyncExternalStore(
    useCallback((listener: () => void) => file?.sheet.subscribe(listener) ?? (() => {}), [file]),
    () => file?.sheet.getState().settings ?? DEFAULT_SETTINGS,
  )

  // The sheet as last evaluated, for the Sheet panel; null until the first run.
  const [sheet, setSheet] = useState<readonly EvaluatedElement[] | null>(null)
  const [flash, setFlash] = useState<FlashLine | null>(null)
  const errors = sheet ? errorCount(sheet) : 0
  const wide = () => (canvas?.root.clientWidth ?? 0) > SIDEBAR_DOCKS_ABOVE

  // The opened sheet: its start has loaded it (the vault's file, or on the web
  // the recovery copy once answered). `start` is the sheet's own, run once.
  const [opened, setOpened] = useState(false)
  useEffect(() => {
    if (!file) return
    let live = true
    void file.sheet.start().then(() => live && setOpened(true))
    return () => {
      live = false
    }
  }, [file])

  // At launch, on a wide window, the panel opens unless it was last closed:
  // on Problems if the opened sheet has an error, else on Variables (M4d:
  // warnings alone don't open Problems). It waits for the opened sheet and for
  // an evaluation of all its math, since the first runs before the scene loads.
  const launched = useRef(false)
  useEffect(() => {
    if (!canvas || !sheet || !opened || launched.current) return
    if (sheet.length !== canvas.api.getSceneElements().filter(isMathAnchor).length) return
    launched.current = true
    if (memory.rememberedOpen() === false || canvas.root.clientWidth <= SIDEBAR_DOCKS_ABOVE) return
    const tab: SheetPanelTab = errorCount(sheet) > 0 ? 'problems' : 'variables'
    canvas.api.toggleSidebar({ name: SHEET_PANEL, tab, force: true })
  }, [canvas, sheet, opened, memory])

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
          vault={!!vault}
          theme={vault?.theme}
          imageTool={imageTool ?? undefined}
          fileMenu={fileMenu ?? undefined}
          sheetPanel={{
            errors,
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
