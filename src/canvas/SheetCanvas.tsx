import { useCallback, useRef } from 'react'
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI, UIOptions } from '@excalidraw/excalidraw/types'
import '@excalidraw/excalidraw/index.css'

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
 * The drawing surface: the official, unforked Excalidraw component.
 * This is the only module (with `mathAnchor.ts`) that imports
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

  const handleApi = useCallback(
    (api: ExcalidrawImperativeAPI) => onReady?.({ api, forwardWheel, focusCanvas }),
    [onReady, forwardWheel, focusCanvas],
  )

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={handleApi}
        initialData={initialElements ? { elements: initialElements } : null}
        UIOptions={UI_OPTIONS}
      >
        <SheetMenu fileMenu={fileMenu} />
      </Excalidraw>
    </div>
  )
}

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
