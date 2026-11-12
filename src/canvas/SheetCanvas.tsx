import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Excalidraw, FONT_FAMILY, MainMenu, Sidebar, WelcomeScreen } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI, UIOptions } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { isPlacing, startPlacing } from './addMath.ts'
import { markMathSelection } from './mathSelection.ts'
import { closeMoreTools, markMoreTools, useMoreToolsSlot } from './moreTools.ts'
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
}

/** The ☰ menu's file items (docs/spec-v1.md section 8). */
export interface FileMenu {
  open: () => void
  save: () => void
  saveAs: () => void
}

/**
 * The Sheet panel's class: the overlay keeps its hover tips clear of it, since
 * the panel (docked or floating) covers the canvas's right edge.
 */
export const SHEET_SIDEBAR_CLASS = 'sheet-sidebar'

/** Excalidraw's sidebar name for the Sheet panel. */
export const SHEET_PANEL = 'sheet'

export type SheetPanelTab = 'variables' | 'problems' | 'settings' | 'constants'

/** What fills the Sheet panel (docs/spec-v1.md section 8); the canvas draws its frame. */
export interface SheetPanelSlot {
  /** Errors and warnings: the badge on Math Settings and on More tools. */
  problems: number
  variables: ReactNode
  problemsTab: ReactNode
  settings?: ReactNode
  /** The built-in constants. */
  constants?: ReactNode
  /** Opened, closed, or moved to another tab. */
  onChange?: (open: boolean, tab: SheetPanelTab) => void
}

export interface SheetCanvasProps {
  /** Called once Excalidraw has mounted. */
  onReady?: (handle: SheetCanvasHandle) => void
  /** Scene to start with. */
  initialElements?: readonly ExcalidrawElement[]
  /** The app's file items, at the top of the ☰ menu. */
  fileMenu?: FileMenu
  /** Math Settings: its More tools item and the panel. */
  sheetPanel?: SheetPanelSlot
}

/**
 * Excalidraw's own open, save and export, turned off: its save drops the
 * sheet's block (ADR 0004). Its Ctrl+Shift+S and Ctrl+Shift+E ignore these, so
 * the file chrome takes those keys itself.
 */
const UI_OPTIONS: Partial<UIOptions> = {
  canvasActions: { loadScene: false, saveToActiveFile: false, saveAsImage: false, export: false },
}

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
export function SheetCanvas({ onReady, initialElements, fileMenu, sheetPanel }: SheetCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // The tab Math Settings opens: the one last shown.
  const lastTab = useRef<SheetPanelTab>('variables')
  const [docked, setDocked] = useState(true)
  // The same box as `containerRef`, as state, for what waits on it.
  const [root, setRoot] = useState<HTMLElement | null>(null)
  const moreTools = useMoreToolsSlot(root)

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
    if (api && root) onReadyRef.current?.({ api, forwardWheel, focusCanvas, root })
  }, [api, forwardWheel, focusCanvas])

  // More tools' button shows placing and the problem count while it is closed.
  const problems = sheetPanel?.problems ?? 0
  useEffect(() => {
    if (!api || !root) return
    const mark = () => markMoreTools(root, { placing: isPlacing(api.getAppState()), problems })
    mark()
    return api.onChange(mark)
  }, [api, root, problems])

  // The reduced panel and the hint, while only math is selected.
  useEffect(() => {
    const root = containerRef.current
    if (api && root) return markMathSelection(api, root)
  }, [api])

  return (
    <div
      ref={(node) => {
        containerRef.current = node
        setRoot(node)
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ elements: initialElements ?? [], appState: INITIAL_APP_STATE }}
        UIOptions={UI_OPTIONS}
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
                <MoreToolsItem
                  icon={<SettingsIcon />}
                  label="Math Settings"
                  pressed={appState.openSidebar?.name === SHEET_PANEL}
                  title="Math Settings: variables, problems and settings"
                  // `sidebar-trigger`: a floating panel's outside click ignores
                  // it, rather than closing the panel the item then reopens.
                  className="sidebar-trigger"
                  onSelect={() => {
                    closeMoreTools(root)
                    api.toggleSidebar({ name: SHEET_PANEL, tab: lastTab.current })
                  }}
                >
                  {sheetPanel.problems > 0 && (
                    <span className="math-tools__badge" aria-label={`${sheetPanel.problems} problems`}>
                      {sheetPanel.problems}
                    </span>
                  )}
                </MoreToolsItem>
              )}
            </>,
            moreTools,
          )
        }
      >
        <SheetMenu fileMenu={fileMenu} />
        <SheetWelcome fileMenu={fileMenu} />
        {sheetPanel && (
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
            <Sidebar.Tabs>
              <Sidebar.Header>
                <Sidebar.TabTriggers>
                  <Sidebar.TabTrigger tab="variables">Variables</Sidebar.TabTrigger>
                  <Sidebar.TabTrigger tab="problems">Problems</Sidebar.TabTrigger>
                  {sheetPanel.settings && <Sidebar.TabTrigger tab="settings">Settings</Sidebar.TabTrigger>}
                  {sheetPanel.constants && <Sidebar.TabTrigger tab="constants">Constants</Sidebar.TabTrigger>}
                </Sidebar.TabTriggers>
              </Sidebar.Header>
              <Sidebar.Tab tab="variables">{sheetPanel.variables}</Sidebar.Tab>
              <Sidebar.Tab tab="problems">{sheetPanel.problemsTab}</Sidebar.Tab>
              {sheetPanel.settings && <Sidebar.Tab tab="settings">{sheetPanel.settings}</Sidebar.Tab>}
              {sheetPanel.constants && <Sidebar.Tab tab="constants">{sheetPanel.constants}</Sidebar.Tab>}
            </Sidebar.Tabs>
          </Sidebar>
        )}
      </Excalidraw>
    </div>
  )
}

function isPanelTab(tab: string | undefined): tab is SheetPanelTab {
  return tab === 'variables' || tab === 'problems' || tab === 'settings' || tab === 'constants'
}

/** One item, in the dropdown's own markup so it takes Excalidraw's styles. */
function MoreToolsItem({
  icon,
  label,
  shortcut,
  pressed,
  title,
  className,
  onSelect,
  children,
}: {
  icon: ReactNode
  label: string
  shortcut?: string
  pressed: boolean
  title: string
  className?: string
  onSelect: () => void
  children?: ReactNode
}) {
  const classes = ['dropdown-menu-item', 'dropdown-menu-item-base']
  if (pressed) classes.push('dropdown-menu-item--selected')
  if (className) classes.push(className)
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

/** Math Settings' icon: three sliders, drawn like Excalidraw's own tool icons. */
function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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
 * The ☰ menu: the app's file items first, then the Excalidraw items v1 keeps.
 * Excalidraw's Open, Save to… and Export image… are left out. Print… arrives
 * in M5.
 */
function SheetMenu({ fileMenu }: { fileMenu?: FileMenu }) {
  return (
    <MainMenu>
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
          <MainMenu.Separator />
        </>
      )}
      <MainMenu.DefaultItems.SearchMenu />
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
