import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Excalidraw, FONT_FAMILY, MainMenu, Sidebar, WelcomeScreen } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI, UIOptions } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { isPlacing, startPlacing } from './addMath.ts'
import { insertImage, measureIn, takeOverImageTool, type PickedImage } from './imageTool.ts'
import { markMathSelection, markTouch } from './mathSelection.ts'
import { SHEET_PANEL_TABS, SHEET_SIDEBAR_CLASS, type SheetPanelTab } from './panelPresses.ts'
import { BottomSheet } from './BottomSheet.tsx'
import { PanelResizeHandle } from './PanelResizeHandle.tsx'
import { PANEL_WIDTH, clampPanelWidth, docksAbove, type PanelWidthMemory } from './panelWidth.ts'
import { closeMoreTools, markMoreTools, useMoreToolsSlot } from './moreTools.ts'
import type { SheetTheme, ThemeMemory } from './theme.ts'
import { VAULT_CLASS } from './vaultItems.ts'
import { MathGuide } from '../guide/MathGuide.tsx'
import './SheetCanvas.css'

/**
 * Re-dispatches a wheel event that landed on something outside Excalidraw
 * (an overlay control) onto Excalidraw's canvas, so scroll/pinch over math
 * still pans and zooms. Excalidraw listens for `wheel` on its own container
 * and only acts on canvas/textarea targets inside it.
 */
export type ForwardWheel = (event: WheelEvent) => void

/** What modules outside the canvas (the math overlay) get to work with. */
export interface SheetCanvasHandle {
  /** Excalidraw's public imperative API: scene, app state, subscriptions. */
  api: ExcalidrawImperativeAPI
  forwardWheel: ForwardWheel
  /** Gives the keyboard to Excalidraw, which only hears keys inside its container. */
  focusCanvas: () => void
  /** The element Excalidraw fills, the same box as the overlay's stage. */
  root: HTMLElement
  /** Add math, as its More tools item does: placing starts and the canvas takes the keyboard. */
  addMath: () => void
  /** Math settings, as its More tools item does: the panel opens on its last tab, or closes. */
  toggleSheetPanel: () => void
  /** Whether the Sheet panel is open, and its tab: the one shown, or the one Math settings opens. */
  sheetPanel: () => SheetPanelState
  /**
   * Opens the panel on `tab`, or closes it with `tab` as the one Math settings
   * opens next (an edit's open and restore, section 8, M4d).
   */
  showSheetPanel: (state: SheetPanelState) => void
  /**
   * Whether the panel docks beside the sheet at the editor's width (section 8,
   * M4e): read from the docking width Excalidraw is given, so the two never
   * differ. Never on a phone, whose panel is the bottom sheet.
   */
  panelDocks: () => boolean
  /** ☰ → Math guide: opens the guide's dialog (section 8, Math guide, M4d). */
  openMathGuide: () => void
}

/** The Sheet panel's state: open or closed, and its tab. */
export interface SheetPanelState {
  open: boolean
  tab: SheetPanelTab
}

/** The ☰ menu's file items (docs/spec-v1.md section 8). */
export interface FileMenu {
  open: () => void
  save: () => void
  saveAs: () => void
  /** Print… (M5, section 11): the pages, through the browser's dialog. */
  print: () => void
}

export { SHEET_SIDEBAR_CLASS } from './panelPresses.ts'

/** Excalidraw's sidebar name for the Sheet panel. */
export const SHEET_PANEL = 'sheet'

export { SHEET_PANEL_TABS, type SheetPanelTab } from './panelPresses.ts'

/**
 * Each tab's name: its tooltip, its accessible name, the heading over its
 * content in the sidebar (M4e), and its label while active in the bottom sheet.
 */
const TAB_NAMES: Record<SheetPanelTab, string> = {
  format: 'Format',
  symbols: 'Symbols',
  variables: 'Variables',
  problems: 'Problems',
  constants: 'Constants',
  settings: 'Settings',
}

/** What fills the Sheet panel (docs/spec-v1.md section 8); the canvas draws its frame. */
export interface SheetPanelSlot {
  /** Errors (M4d: warnings alone show none): the badge on Math settings, More tools and Problems. */
  errors: number
  /** The open line's or title's format (M4d). */
  format?: ReactNode
  /** Buttons that type at the caret (M4d). */
  symbols?: ReactNode
  variables: ReactNode
  problemsTab: ReactNode
  settings?: ReactNode
  /** The built-in constants. */
  constants?: ReactNode
  /**
   * The pinned row above the tab icons, on touch while a line or the title is
   * open (section 4, Touch, M4d); unset, there is none.
   */
  quickKeys?: ReactNode
  /** A line or the title is open: on a phone the bottom sheet is short (section 8, On a phone). */
  compact?: boolean
  /** Opened, closed, or moved to another tab. */
  onChange?: (open: boolean, tab: SheetPanelTab) => void
  /**
   * Where the panel's width is remembered (section 8, M4e): read once, and
   * told the width each drag or key ends at. Unset, the width lasts as long
   * as the canvas.
   */
  width?: PanelWidthMemory
}

export interface SheetCanvasProps {
  /** Called once Excalidraw has mounted. */
  onReady?: (handle: SheetCanvasHandle) => void
  /** Scene to start with. */
  initialElements?: readonly ExcalidrawElement[]
  /** The app's file items, at the top of the ☰ menu. */
  fileMenu?: FileMenu
  /**
   * Print… in a vault on a computer (M5, section 8, Inside an Obsidian tab):
   * the first ☰ item, with no key. Unset, there is none.
   */
  print?: () => void
  /** Math settings: its More tools item and the panel. */
  sheetPanel?: SheetPanelSlot
  /**
   * Whether Excalidraw may load embeds (YouTube, Figma…) in iframes. The web
   * keeps Excalidraw's default; the plugin turns them off, since it makes no
   * request (docs/spec-v1.md section 12a, Data protection).
   */
  embeds?: boolean
  /**
   * Set in a vault: Excalidraw's image tool opens the vault's own picker
   * instead of the operating system's (docs/spec-v1.md section 12a, Reach).
   */
  imageTool?: ImageToolSlot
  /**
   * Set in an Obsidian tab: the items docs/spec-v1.md section 8 lists as
   * hidden in the plugin are hidden (`VAULT_CLASS`), and Excalidraw's AI items
   * are off.
   */
  vault?: boolean
  /**
   * Where light or dark is remembered: the canvas opens in the mode last
   * chosen, and tells the memory each change. Unset (the web), it opens light
   * and remembers nothing.
   */
  theme?: ThemeMemory
  /**
   * On a phone (the plugin's `Platform.isPhone`, section 8, On a phone, M4d)
   * the Sheet panel is a bottom sheet (`BottomSheet.tsx`) in place of
   * Excalidraw's sidebar; the handle and Math settings act on it the same way.
   */
  phone?: boolean
  /**
   * The last press in the view was a touch (section 4, Touch, M4d): the hint
   * for one math element names the taps.
   */
  touch?: boolean
}

/** The vault's image picker, and where the tool's key is heard. */
export interface ImageToolSlot {
  /** The view's own container. */
  keys: HTMLElement
  /** Lists the vault's images and reads the one picked; null when nothing is. */
  pick: () => Promise<PickedImage | null>
}

/**
 * Excalidraw's own open, save and export, turned off: its save drops the
 * sheet's block (ADR 0004). Its Ctrl+Shift+S and Ctrl+Shift+E ignore these, so
 * the file chrome takes those keys itself.
 */
const CANVAS_ACTIONS: UIOptions['canvasActions'] = { loadScene: false, saveToActiveFile: false, saveAsImage: false, export: false }

/**
 * New text starts in the Normal font, for headings and prose beside the math,
 * and can still switch to hand-drawn (docs/spec-v1.md section 4, Text on the
 * sheet). New shapes keep Excalidraw's defaults.
 */
const INITIAL_APP_STATE = { currentItemFontFamily: FONT_FAMILY.Nunito }

/**
 * The drawing surface: the official, unforked Excalidraw component.
 * The `src/canvas/` modules are the only ones that import
 * `@excalidraw/excalidraw` at runtime (ADR 0001).
 */
export function SheetCanvas({
  onReady,
  initialElements,
  fileMenu,
  print,
  sheetPanel,
  embeds = true,
  imageTool,
  vault = false,
  theme,
  phone = false,
  touch = false,
}: SheetCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The tab Math settings opens: the one last shown.
  const lastTab = useRef<SheetPanelTab>('variables')
  const [docked, setDocked] = useState(true)
  // The panel's width (section 8, M4e): the remembered one, read once, then
  // the drag handle's. It is the `--sheet-panel-width` this box hands down to
  // Excalidraw's `--right-sidebar-width` (`SheetCanvas.css`), and the docking
  // width follows it: one value, passed to Excalidraw and read by `panelDocks`.
  const widthMemory = sheetPanel?.width
  const [panelWidth, setPanelWidth] = useState(() => clampPanelWidth(widthMemory?.rememberedWidth() ?? PANEL_WIDTH))
  const docksAboveRef = useRef(docksAbove(panelWidth))
  const showPanelWidth = useCallback((width: number) => {
    docksAboveRef.current = docksAbove(width)
    setPanelWidth(width)
  }, [])
  const uiOptions = useMemo(
    (): Partial<UIOptions> => ({ canvasActions: CANVAS_ACTIONS, dockedSidebarBreakpoint: docksAbove(panelWidth) }),
    [panelWidth],
  )
  // On a phone the panel is the bottom sheet, whose state is held here.
  const [bottom, setBottom] = useState<SheetPanelState>({ open: false, tab: 'variables' })
  const bottomRef = useRef(bottom)
  const showBottom = useCallback((next: SheetPanelState) => {
    lastTab.current = next.tab
    bottomRef.current = next
    setBottom(next)
  }, [])
  // The bottom sheet reports each change, as Excalidraw's sidebar does.
  const onPanelChange = useRef(sheetPanel?.onChange)
  useLayoutEffect(() => {
    onPanelChange.current = sheetPanel?.onChange
  })
  const reported = useRef(bottom)
  useEffect(() => {
    if (reported.current === bottom) return
    reported.current = bottom
    onPanelChange.current?.(bottom.open, bottom.tab)
  }, [bottom])
  // The same box as `containerRef`, as state, for what waits on it.
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const moreTools = useMoreToolsSlot(root)
  // The Math guide's dialog (section 8, Math guide), from ☰ or Obsidian's command.
  const [guideOpen, setGuideOpen] = useState(false)
  const openMathGuide = useCallback(() => setGuideOpen(true), [])

  const forwardWheel = useCallback((event: WheelEvent) => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    // Stop the browser acting on it too (ctrl+wheel would zoom the page).
    event.preventDefault()
    canvas.dispatchEvent(new WheelEvent(event.type, event))
  }, [])

  const focusCanvas = useCallback(() => {
    containerRef.current?.querySelector<HTMLElement>('.excalidraw')?.focus()
  }, [])

  // The mode the canvas opens in: the one last chosen, else light. Read once.
  const [initialData] = useState(() => ({
    elements: initialElements ?? [],
    appState: { ...INITIAL_APP_STATE, theme: theme?.rememberedTheme() ?? 'light' },
  }))

  // Excalidraw hands out its API from its own constructor, which can run before
  // this container is attached. So the handle goes out from an effect, once both
  // exist, rather than from that callback.
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const onReadyRef = useRef(onReady)
  useLayoutEffect(() => {
    onReadyRef.current = onReady
  })
  useEffect(() => {
    const root = containerRef.current
    if (!api || !root) return
    const addMath = () => {
      startPlacing(api)
      // The keyboard goes to the canvas, so Esc cancels and M keeps placing.
      focusCanvas()
    }
    const toggleSheetPanel = phone
      ? () => showBottom({ open: !bottomRef.current.open, tab: lastTab.current })
      : () => api.toggleSidebar({ name: SHEET_PANEL, tab: lastTab.current })
    const sheetPanel = (): SheetPanelState => {
      if (phone) return { open: bottomRef.current.open, tab: lastTab.current }
      const open = api.getAppState().openSidebar
      const shown = open?.name === SHEET_PANEL
      return { open: shown, tab: shown && isPanelTab(open.tab) ? open.tab : lastTab.current }
    }
    const showSheetPanel = ({ open, tab }: SheetPanelState) => {
      lastTab.current = tab
      if (phone) showBottom({ open, tab })
      else if (open) api.toggleSidebar({ name: SHEET_PANEL, tab, force: true })
      else if (sheetPanel().open) api.toggleSidebar({ name: SHEET_PANEL, force: false })
    }
    const panelDocks = () => !phone && root.clientWidth > docksAboveRef.current
    onReadyRef.current?.({
      api,
      forwardWheel,
      focusCanvas,
      root,
      addMath,
      toggleSheetPanel,
      sheetPanel,
      showSheetPanel,
      panelDocks,
      openMathGuide,
    })
  }, [api, forwardWheel, focusCanvas, phone, showBottom, openMathGuide])

  // Excalidraw's own box, where the bottom sheet and the Math guide are drawn,
  // so they take its theme. Excalidraw has drawn it by the time its API is handed out.
  const excalidrawBox = useMemo(
    () => (api && root ? root.querySelector<HTMLElement>('.excalidraw') : null),
    [api, root],
  )

  // Excalidraw reads a new docking width after its render (`componentDidUpdate`)
  // and draws nothing again by itself, so the panel would dock or float one
  // render late: its public `refresh` draws it again. No scene change, no undo step.
  const drawnWidth = useRef(panelWidth)
  useEffect(() => {
    if (!api || drawnWidth.current === panelWidth) return
    drawnWidth.current = panelWidth
    api.refresh()
  }, [api, panelWidth])

  // A change of light or dark (☰ Dark mode, Alt+Shift+D) is remembered.
  useEffect(() => {
    if (!api || !theme) return
    let last: SheetTheme = api.getAppState().theme
    return api.onChange((_elements, appState) => {
      if (appState.theme === last) return
      last = appState.theme
      theme.rememberTheme(last)
    })
  }, [api, theme])

  // More tools' button shows placing and the error count while it is closed.
  const errors = sheetPanel?.errors ?? 0
  useEffect(() => {
    if (!api || !root) return
    const mark = () => markMoreTools(root, { placing: isPlacing(api.getAppState()), problems: errors })
    mark()
    return api.onChange(mark)
  }, [api, root, errors])

  // In a vault the image tool picks from the vault, and the picked image is copied in.
  useEffect(() => {
    if (!api || !root || !imageTool) return
    return takeOverImageTool(root, imageTool.keys, () => {
      void imageTool.pick().then((image) => image && insertImage(api, image, measureIn(root.ownerDocument)))
    })
  }, [api, root, imageTool])

  // The reduced panel and the hint, while only math is selected.
  useEffect(() => {
    const root = containerRef.current
    if (api && root) return markMathSelection(api, root)
  }, [api])
  useEffect(() => {
    const root = containerRef.current
    if (root) return markTouch(root, touch)
  }, [touch])

  // The tabs the panel has, in their order, each with what fills it.
  const panelTabs = sheetPanel
    ? SHEET_PANEL_TABS.flatMap((tab) => {
        const content = {
          format: sheetPanel.format,
          symbols: sheetPanel.symbols,
          variables: sheetPanel.variables,
          problems: sheetPanel.problemsTab,
          constants: sheetPanel.constants,
          settings: sheetPanel.settings,
        }[tab]
        return content ? [[tab, content] as const] : []
      })
    : []

  return (
    <div
      ref={(node) => {
        containerRef.current = node
        setRoot(node)
      }}
      className={vault ? VAULT_CLASS : undefined}
      style={{ width: '100%', height: '100%', ['--sheet-panel-width' as string]: `${panelWidth}px` }}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        UIOptions={uiOptions}
        aiEnabled={!vault}
        // `false` makes every embed invalid, so none loads its iframe.
        validateEmbeddable={embeds ? undefined : false}
        // Nothing is drawn top right: the app's items go into More tools.
        // This prop is where Excalidraw hands over its app state on each render.
        renderTopRightUI={(_isMobile, appState) =>
          api &&
          root &&
          moreTools &&
          createPortal(
            <>
              <div className="math-tools__heading">Math</div>
              <MoreToolsItem
                icon="∑"
                label="Add math"
                shortcut="M"
                pressed={isPlacing(appState)}
                title="Add math — M"
                onSelect={() => {
                  closeMoreTools(root)
                  startPlacing(api)
                  // The item would keep the keyboard: Esc and M go to the canvas.
                  focusCanvas()
                }}
              />
              {sheetPanel && (
                // `sidebar-trigger` on a wrapper with no box: a floating panel's
                // outside click ignores the item (Excalidraw checks `closest`),
                // rather than closing the panel the item then reopens. On the
                // item itself Excalidraw's button styles hid its label (#102).
                <div className="math-tools__trigger sidebar-trigger">
                  <MoreToolsItem
                    icon={<SettingsIcon />}
                    label="Math settings"
                    pressed={phone ? bottom.open : appState.openSidebar?.name === SHEET_PANEL}
                    title="Math settings: variables, problems and settings"
                    onSelect={() => {
                      closeMoreTools(root)
                      if (phone) showBottom({ open: !bottomRef.current.open, tab: lastTab.current })
                      else api.toggleSidebar({ name: SHEET_PANEL, tab: lastTab.current })
                    }}
                  >
                    {sheetPanel.errors > 0 && (
                      <span
                        className="math-tools__badge"
                        aria-label={`${sheetPanel.errors} ${sheetPanel.errors === 1 ? 'error' : 'errors'}`}
                      >
                        {sheetPanel.errors}
                      </span>
                    )}
                  </MoreToolsItem>
                </div>
              )}
            </>,
            moreTools,
          )
        }
      >
        <SheetMenu fileMenu={fileMenu} print={print} onMathGuide={openMathGuide} />
        <SheetWelcome fileMenu={fileMenu} />
        {sheetPanel && !phone && (
          <Sidebar
            name={SHEET_PANEL}
            docked={docked}
            onDock={setDocked}
            className={SHEET_SIDEBAR_CLASS}
            onStateChange={(state) => {
              const open = state?.name === SHEET_PANEL
              if (open && isPanelTab(state.tab)) lastTab.current = state.tab
              sheetPanel.onChange?.(open, lastTab.current)
            }}
          >
            {/* No key from a panel control reaches Excalidraw's shortcuts (section 8):
                a focused <select> or tab isn't a field to them, so Delete deleted the
                selected element. The panel's own handlers, inside, still run. A box
                with no box of its own (`display: contents`), so the layout is Excalidraw's. */}
            <div className="sheet-sidebar__keys" onKeyDown={(event) => event.stopPropagation()}>
            <PanelResizeHandle
              width={panelWidth}
              onWidth={showPanelWidth}
              onSettle={(width) => widthMemory?.rememberWidth(width)}
            />
            <Sidebar.Tabs>
              {sheetPanel.quickKeys}
              <Sidebar.Header>
                <Sidebar.TabTriggers>
                  {panelTabs.map(([tab]) => (
                    <Sidebar.TabTrigger
                      key={tab}
                      tab={tab}
                      className="excalidraw-button sidebar-tab-trigger sheet-tab"
                      title={TAB_NAMES[tab]}
                    >
                      <TabFace tab={tab} errors={sheetPanel.errors} />
                    </Sidebar.TabTrigger>
                  ))}
                </Sidebar.TabTriggers>
              </Sidebar.Header>
              {panelTabs.map(([tab, content]) => (
                <Sidebar.Tab key={tab} tab={tab}>
                  {/* The tabs are icons only (M4e): the shown tab's name is a heading over its content. */}
                  <h2 className="sheet-sidebar__heading">{TAB_NAMES[tab]}</h2>
                  {content}
                </Sidebar.Tab>
              ))}
            </Sidebar.Tabs>
            </div>
          </Sidebar>
        )}
      </Excalidraw>
      {guideOpen &&
        excalidrawBox &&
        createPortal(
          <MathGuide
            onClose={() => {
              setGuideOpen(false)
              focusCanvas()
            }}
          />,
          excalidrawBox,
        )}
      {sheetPanel &&
        phone &&
        bottom.open &&
        excalidrawBox &&
        createPortal(
          <BottomSheet
            tabs={panelTabs.map(([tab, content]) => ({
              tab,
              name: TAB_NAMES[tab],
              face: <TabFace tab={tab} errors={sheetPanel.errors} />,
              content,
            }))}
            active={bottom.tab}
            compact={sheetPanel.compact ?? false}
            quickKeys={sheetPanel.quickKeys}
            onTab={(tab) => showBottom({ open: true, tab })}
            onClose={() => showBottom({ open: false, tab: bottom.tab })}
          />,
          excalidrawBox,
        )}
    </div>
  )
}

/**
 * A tab trigger's face: its icon, its name (read on every tab; shown only on
 * the bottom sheet's active tab, the sidebar's tabs being icons only) and
 * Problems' badge.
 */
function TabFace({ tab, errors }: { tab: SheetPanelTab; errors: number }) {
  return (
    <>
      <TabIcon tab={tab} />
      <span className="sheet-tab__label">{TAB_NAMES[tab]}</span>
      {tab === 'problems' && errors > 0 && (
        <span className="sheet-tab__badge" aria-hidden="true">
          {errors}
        </span>
      )}
    </>
  )
}

function isPanelTab(tab: string | undefined): tab is SheetPanelTab {
  return (SHEET_PANEL_TABS as readonly (string | undefined)[]).includes(tab)
}

/**
 * A tab's icon (section 8, from M4d), drawn like Excalidraw's own: Format a
 * letter over a rule, Symbols π, Variables x =, Problems a warning sign,
 * Constants ∞, Settings the sliders of Math settings.
 */
function TabIcon({ tab }: { tab: SheetPanelTab }) {
  if (tab === 'settings') return <SettingsIcon />
  const paths: Record<Exclude<SheetPanelTab, 'settings'>, string> = {
    format: 'M7 16l5-11 5 11M8.8 12.2h6.4M5 20h14',
    symbols: 'M4 8.5c1-1.3 2-2 4-2h12M9 6.5c0 5-1 9-3 12M15 6.5v9c0 1.5.8 2.5 2.5 2.5',
    variables: 'M3.5 7l6 10M9.5 7l-6 10M13.5 10.5h7M13.5 14h7',
    problems: 'M12 4.5l8.5 15h-17zM12 10v4.5M12 17v.01',
    constants:
      'M12 12c-2-2.5-3.5-3.5-5.5-3.5a3.5 3.5 0 0 0 0 7c2 0 3.5-1 5.5-3.5s3.5-3.5 5.5-3.5a3.5 3.5 0 0 1 0 7c-2 0-3.5-1-5.5-3.5z',
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[tab]} />
    </svg>
  )
}

/** One item, in the dropdown's own markup so it takes Excalidraw's styles. */
function MoreToolsItem({
  icon,
  label,
  shortcut,
  pressed,
  title,
  onSelect,
  children,
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  pressed: boolean
  title: string
  onSelect: () => void
  children?: ReactNode
}) {
  const classes = ['dropdown-menu-item', 'dropdown-menu-item-base']
  if (pressed) classes.push('dropdown-menu-item--selected')
  return (
    <button type="button" className={classes.join(' ')} aria-pressed={pressed} title={title} onClick={onSelect}>
      <div className="dropdown-menu-item__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="dropdown-menu-item__text">
        {label}
        {children}
      </div>
      {shortcut && <div className="dropdown-menu-item__shortcut">{shortcut}</div>}
    </button>
  )
}

/** Math settings' icon: three sliders, drawn like Excalidraw's own tool icons. */
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h9m4 0h3M4 12h3m4 0h9M4 17h11m4 0h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  )
}

/**
 * Excalidraw's welcome screen, shown on an empty sheet: the app's name, the
 * hint for Add math, and Open… (docs/spec-v1.md section 8). Excalidraw's own
 * logo and collaboration items are left out.
 */
function SheetWelcome({ fileMenu }: { fileMenu?: FileMenu }) {
  return (
    <WelcomeScreen>
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo>Excalimathpad</WelcomeScreen.Center.Logo>
        <WelcomeScreen.Center.Heading>{WELCOME_HINT}</WelcomeScreen.Center.Heading>
        {fileMenu && (
          <WelcomeScreen.Center.Menu>
            <WelcomeScreen.Center.MenuItem onSelect={fileMenu.open} shortcut="Ctrl+O">
              Open…
            </WelcomeScreen.Center.MenuItem>
          </WelcomeScreen.Center.Menu>
        )}
      </WelcomeScreen.Center>
    </WelcomeScreen>
  )
}

export const WELCOME_HINT = 'Press M, or choose Add math under More tools, then click the sheet to place math'

/**
 * The ☰ menu: the app's file items first, then the Excalidraw items v1 keeps,
 * with Math guide just above Excalidraw's Help (M4d). Excalidraw's Open, Save
 * to… and Export image… are left out. Print… (M5, #81) is the web's file
 * item with Ctrl+P; in a vault on a computer it is the first item, with no
 * key (Ctrl+P is Obsidian's), and on a phone or tablet there is none.
 */
function SheetMenu({
  fileMenu,
  print,
  onMathGuide,
}: {
  fileMenu?: FileMenu
  print?: () => void
  onMathGuide: () => void
}) {
  return (
    <MainMenu>
      {!fileMenu && print && (
        <>
          <MainMenu.Item onSelect={print} data-testid="print-item">
            Print…
          </MainMenu.Item>
          <MainMenu.Separator />
        </>
      )}
      {fileMenu && (
        <>
          <MainMenu.Item onSelect={fileMenu.open} shortcut="Ctrl+O">
            Open…
          </MainMenu.Item>
          <MainMenu.Item onSelect={fileMenu.save} shortcut="Ctrl+S">
            Save
          </MainMenu.Item>
          <MainMenu.Item onSelect={fileMenu.saveAs} shortcut="Ctrl+Shift+S">
            Save as…
          </MainMenu.Item>
          <MainMenu.Item onSelect={fileMenu.print} shortcut="Ctrl+P" data-testid="print-item">
            Print…
          </MainMenu.Item>
          <MainMenu.Separator />
        </>
      )}
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.Item onSelect={onMathGuide} icon={<GuideIcon />} data-testid="math-guide-item">
        Math guide
      </MainMenu.Item>
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
      {/* Text, not an item: it takes no focus and no click (section 12, Hosted build). */}
      <div className="build-stamp" data-testid="build-stamp" title="This build">
        {__BUILD_STAMP__}
      </div>
    </MainMenu>
  )
}

/** The Math guide item's icon: an open book, drawn as Excalidraw's own menu icons are. */
function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5.5c2.5-1 5.5-1 9 1 3.5-2 6.5-2 9-1v13c-2.5-1-5.5-1-9 1-3.5-2-6.5-2-9-1z" />
      <path d="M12 6.5v13" />
    </svg>
  )
}
