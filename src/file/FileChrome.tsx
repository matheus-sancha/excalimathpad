import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useBesideMenu, useFileRoutes, type FileRouteHandlers } from '../canvas/fileRoutes.ts'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX } from '../canvas/layers.ts'
import type { Choice, DialogHost, PendingDialog } from './dialogs.ts'
import type { SheetFileHandle } from './fileAccess.ts'
import { displayName, type SheetSession } from './sheetSession.ts'
import './FileChrome.css'

export interface FileChromeProps {
  session: SheetSession
  dialogs: DialogHost
  /** The element the canvas fills, to place the name beside Excalidraw's ☰ button. */
  canvasRoot: HTMLElement | null
}

/**
 * The sheet file's part of the screen (docs/spec-v1.md sections 7 and 8): the
 * file name beside the ☰ button, the window title, the two questions and the
 * leave prompt. The keys and drops it answers are taken from Excalidraw by
 * `src/canvas/fileRoutes.ts`.
 */
export function FileChrome({ session, dialogs, canvasRoot }: FileChromeProps) {
  const { name, dirty } = useSyncExternalStore(session.subscribe, session.getState)
  const pending = useSyncExternalStore(dialogs.subscribe, dialogs.getPending)
  const besideMenu = useBesideMenu(canvasRoot)

  useEffect(() => {
    const detach = session.attach()
    void session.start()
    return detach
  }, [session])

  useEffect(() => {
    document.title = `${dirty ? '● ' : ''}${displayName(name)}`
  }, [name, dirty])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // A line still being typed counts, as it does for Open.
      session.commitPending()
      if (!session.getState().dirty) return
      event.preventDefault()
      // Older Chromium still asks only when this is set.
      event.returnValue = ''
    }
    const onPageHide = () => session.flushRecovery()
    window.addEventListener('beforeunload', onBeforeUnload)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [session])

  const routes = useMemo<FileRouteHandlers>(
    () => ({
      save: () => void session.save(),
      saveAs: () => void session.saveAs(),
      open: () => void session.open(),
      openDropped: (file, handle) =>
        void session.open(async () => ({
          name: file.name,
          text: await file.text(),
          handle: asFileHandle(await handle),
        })),
    }),
    [session],
  )
  useFileRoutes(routes)

  return (
    <>
      <div
        className="file-name"
        data-testid="file-name"
        style={{
          zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX,
          // Hidden until Excalidraw's ☰ button is laid out.
          visibility: besideMenu ? undefined : 'hidden',
          left: besideMenu?.left,
          top: besideMenu?.top,
          height: besideMenu?.height,
          lineHeight: besideMenu ? `${besideMenu.height}px` : undefined,
          maxWidth: besideMenu?.maxWidth,
        }}
      >
        {dirty ? '● ' : ''}
        {name ?? 'Untitled'}
      </div>
      {pending && createPortal(<FileDialog dialog={pending} />, document.body)}
    </>
  )
}

function asFileHandle(value: unknown): SheetFileHandle | null {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'file'
    ? (value as SheetFileHandle)
    : null
}

const LABELS: Record<Choice, string> = {
  restore: 'Restore',
  discard: 'Discard',
  save: 'Save',
  'dont-save': "Don't save",
  cancel: 'Cancel',
}

function FileDialog({ dialog }: { dialog: PendingDialog }) {
  const firstRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => firstRef.current?.focus(), [dialog])

  return (
    <div className="file-dialog__backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="file-dialog-title"
        className="file-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && dialog.escape) dialog.answer(dialog.escape)
        }}
      >
        <p id="file-dialog-title" className="file-dialog__title">
          {dialog.title}
        </p>
        <div className="file-dialog__buttons">
          {dialog.choices.map((choice, i) => (
            <button
              key={choice}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              className={i === 0 ? 'file-dialog__primary' : undefined}
              onClick={() => dialog.answer(choice)}
            >
              {LABELS[choice]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
