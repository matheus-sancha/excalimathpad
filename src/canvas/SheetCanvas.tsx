import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Excalidraw, FONT_FAMILY, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI, UIOptions } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'
import { isPlacing, startPlacing } from './addMath.ts'
import { markMathSelection } from './mathSelection.ts'
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

export interface SheetCanvasProps {
  /** Called once Excalidraw has mounted. */
  onReady?: (handle: SheetCanvasHandle) => void
  /** Scene to start with. */
  initialElements?: readonly ExcalidrawElement[]
  /** The app's file items, at the top of the ☰ menu. */
  fileMenu?: FileMenu
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
export function SheetCanvas({ onReady, initialElements, fileMenu }: SheetCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)

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

  // The reduced panel and the hint, while only math is selected.
  useEffect(() => {
    const root = containerRef.current
    if (api && root) return markMathSelection(api, root)
  }, [api])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ elements: initialElements ?? [], appState: INITIAL_APP_STATE }}
        UIOptions={UI_OPTIONS}
        renderTopRightUI={(_isMobile, appState) =>
          api && (
            <AddMathButton
              placing={isPlacing(appState)}
              onPress={() => {
                startPlacing(api)
                // The button would keep the keyboard: Esc and M go to the canvas.
                focusCanvas()
              }}
            />
          )
        }
      >
        <SheetMenu fileMenu={fileMenu} />
        <SheetWelcome fileMenu={fileMenu} />
      </Excalidraw>
    </div>
  )
}

/**
 * ∑ Add math, the primary button, top right (docs/spec-v1.md section 8). It
 * starts placing, the same as M; pressed again while placing, it keeps placing.
 */
function AddMathButton({ placing, onPress }: { placing: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      className="add-math-button"
      aria-pressed={placing}
      title="Add math — M"
      onClick={onPress}
    >
      <span aria-hidden="true">∑</span> Add math <kbd>M</kbd>
    </button>
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

export const WELCOME_HINT = 'Press M or click Add math, then click the sheet to place math'

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
    </MainMenu>
  )
}
