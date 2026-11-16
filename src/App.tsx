import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { AppShell } from './shell/AppShell.tsx'
import {
  SheetCanvas,
  type SheetCanvasHandle,
  type SheetPanelState,
  type SheetPanelTab,
} from './canvas/SheetCanvas.tsx'
import { isMathAnchor } from './canvas/mathAnchor.ts'
import { mathSelection } from './canvas/mathSelection.ts'
import { sceneFileFor } from './canvas/sceneFile.ts'
import { FOLLOW_MARGIN, jumpToAnchor, scrollIntoArea, SIDEBAR_DOCKS_ABOVE, visibleArea } from './canvas/selection.ts'
import { caretRow } from './overlay/caretRow.ts'
import {
  MathOverlay,
  type EditTarget,
  type EvaluatedElement,
  type FlashLine,
  type LineEditControl,
} from './overlay/MathOverlay.tsx'
import { sessionPanelMemory, type PanelMemory } from './panel/panelMemory.ts'
import { ConstantsTab, ProblemsTab, VariablesTab } from './panel/SheetPanel.tsx'
import { SymbolsTab } from './panel/SymbolsTab.tsx'
import type { SymbolInsert } from './math/symbols.ts'
import { FormatTab, type FormatActions } from './panel/FormatTab.tsx'
import { QuickKeys } from './panel/QuickKeys.tsx'
import { SettingsTab } from './panel/SettingsTab.tsx'
import { DEFAULT_SETTINGS, readSheet, type SheetSettings } from './file/sheetFormat.ts'
import { errorCount, type PanelTarget } from './panel/sheetPanel.ts'
import { createDialogHost } from './file/dialogs.ts'
import type { FileAccess } from './file/fileAccess.ts'
import { FileChrome } from './file/FileChrome.tsx'
import type { RecoveryStore } from './file/recovery.ts'
import { createLineRelay, createSheetSession, type KeptSheet } from './file/sheetSession.ts'
import { createVaultSheet, type VaultSheet, type VaultSheetData } from './file/vaultSheet.ts'
import { ignoreSceneDrops } from './canvas/fileRoutes.ts'
import type { PickedImage } from './canvas/imageTool.ts'
import type { ThemeMemory } from './canvas/theme.ts'
import { confineKeys } from './canvas/vaultKeys.ts'
import { bridgeWindow } from './canvas/popoutBridge.ts'
import { isInSheetPanel, keepPanelPresses } from './canvas/panelPresses.ts'
import { Boundary } from './failure/Boundary.tsx'
import { FAILURE_MESSAGES, sheetWords } from './failure/details.ts'
import { FailureContext, type FailureReport } from './failure/context.ts'
import { createFailureBox, type FailureBox } from './failure/failureBox.ts'
import { FailureScreen } from './failure/FailureScreen.tsx'

/**
 * What Obsidian's commands do in a sheet tab (docs/spec-v1.md section 8,
 * Inside an Obsidian tab): the same as the app's More tools items.
 */
export interface SheetCommands {
  addMath: () => void
  toggleMathSettings: () => void
  /** ☰ → Math guide (M4d). */
  openMathGuide: () => void
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
  /**
   * The file as the view holds it, read at each mount: as the view read it,
   * and after Reload the sheet as the view last wrote it. The view shows a
   * refusal itself.
   */
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
  /**
   * The view is on a phone (`Platform.isPhone`): the Sheet panel is a bottom
   * sheet (docs/spec-v1.md section 8, On a phone, M4d).
   */
  phone?: boolean
  /** What Obsidian runs on, for Copy details (section 4, Unexpected failures). */
  device?: 'desktop' | 'phone' | 'tablet'
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
    fail: () => KeptSheet | null
  }
  web: { session: ReturnType<typeof createSheetSession>; dialogs: ReturnType<typeof createDialogHost> } | null
  /** In a vault: the same sheet, as the view writes it back. */
  vault: VaultSheet | null
}

/** What passes from the sheet to the view's boundary (`createFailureBox`). */
type SheetBox = FailureBox<KeptSheet, readonly EvaluatedElement[]>

/**
 * The app, inside the view's boundary (docs/spec-v1.md section 4, Unexpected
 * failures). A failure outside every smaller boundary replaces the view with
 * the failure screen: the sheet file is told first, while the scene can still
 * be read, so it keeps the sheet and never writes again; Reload the sheet
 * mounts the sheet anew from what was kept.
 */
export default function App(props: AppProps) {
  const [box] = useState((): SheetBox => createFailureBox<KeptSheet, readonly EvaluatedElement[]>([]))
  const [attempt, setAttempt] = useState<{ count: number; resume: KeptSheet | null }>({ count: 0, resume: null })
  const inVault = props.vault !== undefined
  const device = props.vault?.device ?? null
  const report = useMemo(
    (): FailureReport => ({
      home: {
        version: __APP_VERSION__,
        stamp: __BUILD_STAMP__,
        home: inVault ? 'Obsidian plugin' : 'web',
        device: inVault ? device : null,
      },
      words: () => sheetWords(box.sheet(), box.open()),
    }),
    [box, inVault, device],
  )
  return (
    <FailureContext.Provider value={report}>
      <Boundary
        resetKeys={[attempt]}
        onFail={box.failed}
        fallback={(failure) => (
          <FailureScreen
            failure={failure}
            typing={box.typed()}
            // Kept nothing this time (it failed before the sheet loaded): the copy before it stands.
            onReload={() => setAttempt(({ count, resume }) => ({ count: count + 1, resume: box.kept() ?? resume }))}
          />
        )}
      >
        <Sheet key={attempt.count} {...props} box={box} resume={attempt.resume} />
      </Boundary>
    </FailureContext.Provider>
  )
}

/**
 * Composition root: decides what fills each slot of the shell, and wires the
 * sheet file to the canvas and the line edit, and the sheet's evaluation to the
 * Sheet panel, which lives in Excalidraw's sidebar (docs/spec-v1.md section 8).
 * The shell's own side-panel slot is left empty.
 */
function Sheet({
  files,
  recovery,
  panelMemory,
  vault,
  initialElements,
  box,
  resume,
}: AppProps & { box: SheetBox; resume: KeptSheet | null }) {
  const [canvas, setCanvas] = useState<SheetCanvasHandle | null>(null)
  const [line] = useState(() => createLineRelay<LineEditControl>())
  const [memory] = useState(() => panelMemory ?? sessionPanelMemory())

  const file = useMemo((): SheetFile | null => {
    if (!canvas) return null
    if (vault) {
      // Reload the sheet: what the failed view kept, in place of the file.
      const kept = resume && readSheet(resume.text)
      const sheet = createVaultSheet({
        scene: sceneFileFor(canvas.api),
        line,
        sheet: kept && kept.kind === 'sheet' ? { scene: kept.scene, settings: kept.settings } : vault.sheet,
        onUnwritten: vault.onUnwritten,
        unwrittenAtStart: (kept && kept.kind === 'sheet' && resume?.dirty) || false,
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
      resume,
    })
    return { sheet: session, web: { session, dialogs }, vault: null }
  }, [canvas, files, recovery, vault, line, resume])

  // The view's boundary tells the sheet file of a failure (section 4, Unexpected failures).
  useLayoutEffect(() => {
    box.file(file ? file.sheet.fail : null)
  }, [box, file])

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

  // A press in the Sheet panel keeps focus, so it never leaves the open line
  // (section 8): heard above React's root, on the page or the view's container.
  const canvasRoot = canvas?.root
  useEffect(() => {
    if (canvasRoot) return keepPanelPresses(canvasRoot, vaultContainer)
  }, [canvasRoot, vaultContainer])

  // Obsidian's Add math, Toggle Math settings and Open Math guide commands act on this tab.
  const handCommands = vault?.commands
  useEffect(() => {
    if (!handCommands || !canvas) return
    handCommands({
      addMath: canvas.addMath,
      toggleMathSettings: canvas.toggleSheetPanel,
      openMathGuide: canvas.openMathGuide,
    })
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
  const onEvaluated = useCallback(
    (next: readonly EvaluatedElement[]) => {
      box.evaluated(next)
      setSheet(next)
    },
    [box],
  )
  const [flash, setFlash] = useState<FlashLine | null>(null)
  const errors = sheet ? errorCount(sheet) : 0
  const wide = () => (canvas ? wideRoot(canvas.root) : false)

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
    canvas.showSheetPanel({ open: true, tab })
  }, [canvas, sheet, opened, memory])

  // An edit opens the panel on Format, and its end puts the panel back as it
  // was (section 8, M4d): closed if it was, else on its tab. A tab picked
  // during the edit stays while it lasts; closed during the edit, the panel
  // stays closed. What the app opens or restores itself is never remembered as
  // the user's choice: `automatic` is the state it asked for, until the panel
  // reports reaching it.
  const beforeEdit = useRef<SheetPanelState | null>(null)
  const automatic = useRef<SheetPanelState | null>(null)
  // An edit that ends from a press in the panel (its filter, a row's jump)
  // leaves the panel as it is: the user is working in it. Any key, or a press
  // anywhere else, ends that.
  const pressedInPanel = useRef(false)
  // The last press was a touch (section 4, Touch, M4d): told by the pointer,
  // not the device, so a mouse or a hovering pen on a tablet keeps hover.
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    if (!canvasRoot) return
    const scope: EventTarget = vaultContainer ?? canvasRoot.ownerDocument
    const onPress = (event: Event) => {
      pressedInPanel.current = isInSheetPanel(event.target)
      setTouch((event as PointerEvent).pointerType === 'touch')
    }
    const onKey = () => {
      pressedInPanel.current = false
    }
    scope.addEventListener('pointerdown', onPress, true)
    scope.addEventListener('keydown', onKey, true)
    return () => {
      scope.removeEventListener('pointerdown', onPress, true)
      scope.removeEventListener('keydown', onKey, true)
    }
  }, [canvasRoot, vaultContainer])
  const showAutomatically = useCallback(
    (next: SheetPanelState) => {
      if (!canvas) return
      const now = canvas.sheetPanel()
      if (now.open === next.open && (!next.open || now.tab === next.tab)) {
        canvas.showSheetPanel(next) // only the tab Math settings opens changes
        return
      }
      automatic.current = next
      canvas.showSheetPanel(next)
    },
    [canvas],
  )
  // What is open, for the Format tab (section 4, Format tab, M4d).
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const phone = vault?.phone ?? false
  const onEdit = useCallback(
    (target: EditTarget | null) => {
      setEditTarget(target)
      if (!canvas) return
      // The view follows the caret: as a line or the title opens, on Enter,
      // on ↑ and ↓ and while typing (section 4, While editing a line, 0.2.1).
      if (target) followCaret(canvas, phone)
      if (target && !beforeEdit.current) {
        beforeEdit.current = canvas.sheetPanel()
        showAutomatically({ open: true, tab: 'format' })
      } else if (!target && beforeEdit.current) {
        const before = beforeEdit.current
        beforeEdit.current = null
        if (pressedInPanel.current) return
        showAutomatically({ open: before.open && canvas.sheetPanel().open, tab: before.tab })
      }
    },
    [canvas, showAutomatically, phone],
  )

  // On a phone the keyboard and the sheet settle after the edit opens: the
  // caret is followed again each time the visible area changes.
  const editing = editTarget !== null
  useEffect(() => {
    if (!phone || !editing || !canvas) return
    const view = canvas.root.ownerDocument.defaultView
    const viewport = view?.visualViewport
    const clear = () => followCaret(canvas, true)
    viewport?.addEventListener('resize', clear)
    view?.addEventListener('resize', clear)
    return () => {
      viewport?.removeEventListener('resize', clear)
      view?.removeEventListener('resize', clear)
    }
  }, [phone, editing, canvas])

  // The one math element selected, alone: the Format tab's Edit opens it, as Enter does.
  const [selectedMath, setSelectedMath] = useState<string | null>(null)
  useEffect(() => {
    if (!canvas) return
    const read = () => {
      const { selectedElementIds } = canvas.api.getAppState()
      setSelectedMath(mathSelection(canvas.api) === 'one' ? Object.keys(selectedElementIds).find((id) => selectedElementIds[id]) ?? null : null)
    }
    read()
    return canvas.api.onChange(read)
  }, [canvas])

  // The Format tab's presses act on the open line or title (section 4, Format tab).
  const formatActions = useMemo(
    (): FormatActions => ({
      setFormat: (format) => line.current?.setFormat(format),
      setCommentFormat: (format) => line.current?.setCommentFormat(format),
      setTitleFormat: (format) => line.current?.setTitleFormat(format),
      moveTo: (target) => line.current?.moveTo(target),
      move: (direction) => line.current?.move(direction),
      // As Esc: the line leaves, and the keyboard goes back to the canvas.
      done: () => {
        line.current?.leaveLine()
        canvas?.focusCanvas()
      },
      edit: (anchorId) => line.current?.openLast(anchorId),
      setRules: (rows) => line.current?.setRules(rows),
      caretToRule: (index) => line.current?.caretToRule(index),
      addRule: (name) => line.current?.addRule(name),
    }),
    [line, canvas],
  )

  // A Symbols or Constants button (section 4, Symbols tab): into the open line,
  // else the one selected element's last line opens and takes it at its end.
  const canInsert = editTarget !== null || selectedMath !== null
  const insert = (symbol: SymbolInsert) => line.current?.insert(symbol, editTarget ? null : selectedMath)

  const jump = useCallback(
    (target: PanelTarget) => {
      if (!canvas) return
      jumpToAnchor(canvas.api, target.anchorId)
      setFlash({ ...target, key: Date.now() })
      // Floating over a small window, or a sheet on a phone, the panel gets out of the way.
      if (canvas.root.clientWidth <= SIDEBAR_DOCKS_ABOVE) {
        canvas.showSheetPanel({ open: false, tab: canvas.sheetPanel().tab })
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

  // Each panel tab has its own boundary (section 4, Unexpected failures),
  // tried again when what the tabs draw from changes.
  const tab = (content: ReactNode) => (
    <Boundary
      resetKeys={[sheet, editTarget, selectedMath, settings]}
      fallback={(failure) => (
        <p className="sheet-panel__failed" role="alert" title={failure.text}>
          {FAILURE_MESSAGES.tab}
        </p>
      )}
    >
      {content}
    </Boundary>
  )

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
          phone={phone}
          touch={touch}
          imageTool={imageTool ?? undefined}
          fileMenu={fileMenu ?? undefined}
          sheetPanel={{
            errors,
            format: tab(
              <FormatTab
                sheet={sheet ?? []}
                target={editTarget}
                selected={selectedMath}
                resultColor={settings.resultColor}
                touch={touch}
                actions={formatActions}
              />,
            ),
            // On touch, while a line or the title is open (section 4, Touch).
            quickKeys: touch && editing ? <QuickKeys onInsert={insert} /> : undefined,
            compact: editing,
            symbols: tab(<SymbolsTab canInsert={canInsert} onInsert={insert} />),
            variables: tab(<VariablesTab sheet={sheet ?? []} onJump={jump} />),
            problemsTab: tab(<ProblemsTab sheet={sheet ?? []} onJump={jump} />),
            settings: file && tab(<SettingsTab settings={settings} onChange={file.sheet.setSettings} />),
            constants: tab(<ConstantsTab settings={settings} canInsert={canInsert} onInsert={insert} />),
            // Remembered per home; a floating panel closes by itself, so
            // only a wide window's choice counts.
            onChange: (open, tab) => {
              // The panel an edit opens covers part of the canvas once it is
              // drawn: the caret is followed again in what is left.
              if (open && editing && canvas) followCaret(canvas, phone)
              const asked = automatic.current
              if (asked && asked.open === open && (!open || asked.tab === tab)) {
                // The line wraps short of the panel its edit opened (section 4, The field wraps).
                if (open && editing) line.current?.rewrap()
                automatic.current = null
                return
              }
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
              onEvaluated={onEvaluated}
              onEdit={onEdit}
              onTyped={box.typing}
              settings={settings}
              resultColor={settings.resultColor}
              touch={touch}
              phone={phone}
              onCaretRow={() => followCaret(canvas, phone)}
              flash={flash}
            />
            {web && <FileChrome session={web.session} dialogs={web.dialogs} canvasRoot={canvas.root} />}
          </>
        )
      }
    />
  )
}

/**
 * The follow rule (docs/spec-v1.md section 4, While editing a line, 0.2.1,
 * #191): once the edit has laid out, the canvas scrolls the least distance
 * that puts the caret's row inside the visible area less the margin. Only
 * while the open field has the keyboard, so typing in a Format tab field
 * doesn't move the view.
 */
function followCaret(canvas: SheetCanvasHandle, phone: boolean) {
  const document = canvas.root.ownerDocument
  document.defaultView?.requestAnimationFrame(() => {
    const field = canvas.root.closest('.app-shell__stage')?.querySelector<HTMLTextAreaElement>('.math-element__field')
    if (!field || document.activeElement !== field) return
    const area = visibleArea(canvas.root, phone)
    scrollIntoArea(canvas.api, caretRow(field, area.right - area.left - 2 * FOLLOW_MARGIN), area)
  })
}

/** A window wide enough for the panel to dock beside the canvas (section 8). */
function wideRoot(root: HTMLElement): boolean {
  return root.clientWidth > SIDEBAR_DOCKS_ABOVE
}
