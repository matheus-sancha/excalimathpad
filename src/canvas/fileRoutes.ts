import { useEffect, useState } from 'react'

/**
 * Excalidraw's own routes into its scene file, taken over for the sheet file
 * (ADR 0004). This relies on behaviour that isn't public API (event phase,
 * class names), so it lives here with its contract tests
 * (`fileRoutes.excalidraw.test.tsx`), per ADR 0001.
 *
 * In Excalidraw 0.18, turning off `canvasActions` leaves three routes open, and
 * each would drop the sheet's block:
 * - Ctrl+Shift+S (`saveFileToDisk`) isn't in `canvasActions`, so it always runs.
 * - Ctrl+Shift+E opens the image export dialog outside the action manager.
 * - A dropped scene file replaces the scene, as an undo step.
 * Listeners on the window in the capture phase run before Excalidraw's
 * container hears a key or a drop, and before the line field does.
 */
export interface FileRouteHandlers {
  save: () => void
  saveAs: () => void
  open: () => void
  /** A dropped file Excalidraw would load as its scene. `handle` may be null. */
  openDropped: (file: File, handle: Promise<unknown>) => void
}

/** Files Excalidraw would load as its own scene if dropped, replacing the sheet. */
export function isSceneFileName(name: string): boolean {
  return /\.(excalimathpad|excalidraw|json)$/i.test(name)
}

type KeyRoute = keyof Omit<FileRouteHandlers, 'openDropped'> | 'swallow'

/** Which of the app's file keys this is, if any. */
export function fileKeyRoute(event: KeyboardEvent): KeyRoute | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  switch (event.key.toLowerCase()) {
    case 's':
      return event.shiftKey ? 'saveAs' : 'save'
    case 'o':
      return event.shiftKey ? null : 'open'
    case 'e':
      // Excalidraw's image export: nothing in the app answers it in M1.
      return event.shiftKey ? 'swallow' : null
    default:
      return null
  }
}

export function useFileRoutes(handlers: FileRouteHandlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const route = fileKeyRoute(event)
      if (!route) return
      event.preventDefault()
      event.stopPropagation()
      if (route !== 'swallow' && !event.repeat) handlers[route]()
    }
    const onDrop = (event: DragEvent) => {
      const transfer = event.dataTransfer
      const file = transfer?.files[0]
      if (!transfer || !file || !isSceneFileName(file.name)) return
      event.preventDefault()
      event.stopPropagation()
      // Only during the event: the handle lets Ctrl+S write back to the file.
      const item = Array.from(transfer.items ?? []).find(({ kind }) => kind === 'file') as
        | (DataTransferItem & { getAsFileSystemHandle?: () => Promise<unknown> })
        | undefined
      handlers.openDropped(
        file,
        item?.getAsFileSystemHandle?.().catch(() => null) ?? Promise.resolve(null),
      )
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('drop', onDrop, { capture: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
      window.removeEventListener('drop', onDrop, { capture: true })
    }
  }, [handlers])
}

/** Where something can sit to the right of the ☰ button, in stage coordinates. */
export interface BesideMenuBox {
  left: number
  top: number
  height: number
  /** Up to the toolbar, which would paint over anything wider. */
  maxWidth: number
}

const GAP_PX = 8

/**
 * Measures the space beside Excalidraw's ☰ button, from its rendered DOM:
 * `.main-menu-trigger` and `.App-toolbar` (contract-tested class names). Null
 * until both are laid out. `root` is the element the stage shares with the
 * canvas, so the box is in the overlay's coordinates.
 */
export function measureBesideMenu(root: HTMLElement): BesideMenuBox | null {
  const trigger = root.querySelector('.main-menu-trigger')?.getBoundingClientRect()
  const toolbar = root.querySelector('.App-toolbar')?.getBoundingClientRect()
  const origin = root.getBoundingClientRect()
  if (!trigger || !toolbar || trigger.width === 0) return null
  const left = trigger.right - origin.left + GAP_PX
  return {
    left,
    top: trigger.top - origin.top,
    height: trigger.height,
    maxWidth: Math.max(0, toolbar.left - origin.left - GAP_PX - left),
  }
}

/** `measureBesideMenu`, kept current as the window, sidebar or toolbar resize. */
export function useBesideMenu(root: HTMLElement | null): BesideMenuBox | null {
  const [box, setBox] = useState<BesideMenuBox | null>(null)
  useEffect(() => {
    if (!root) return
    const update = () =>
      setBox((current) => {
        const next = measureBesideMenu(root)
        return JSON.stringify(next) === JSON.stringify(current) ? current : next
      })
    const observer = new ResizeObserver(update)
    observer.observe(root)
    // The toolbar and trigger mount after the first paint, and fonts change their width.
    const watchUi = () => {
      root.querySelectorAll('.main-menu-trigger, .App-toolbar').forEach((el) => observer.observe(el))
      update()
    }
    const frame = requestAnimationFrame(watchUi)
    void document.fonts?.ready.then(watchUi)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [root])
  return box
}
