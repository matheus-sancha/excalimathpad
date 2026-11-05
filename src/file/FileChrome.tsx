import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX } from '../canvas/layers.ts'
import type { DialogHost, PendingDialog } from './dialogs.ts'
import type { SheetFileHandle } from './fileAccess.ts'
import { displayName, isSceneFileName, type SheetSession } from './sheetSession.ts'
import './FileChrome.css'

export interface FileChromeProps {
  session: SheetSession
  dialogs: DialogHost
}

/**
 * The sheet file's part of the screen (docs/spec-v1.md sections 7 and 8): the
 * file name beside the ☰ button, the window title, the two questions, and the
 * routes into Excalidraw's own file handling that the app takes over.
 */
export function FileChrome({ session, dialogs }: FileChromeProps) {
  const { name, dirty } = useSyncExternalStore(session.subscribe, session.getState)
  const pending = useSyncExternalStore(dialogs.subscribe, dialogs.getPending)

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

  useFileKeys(session)
  useSheetDrop(session)

  return (
    <>
      <div
        className="file-name"
        data-testid="file-name"
        style={{ zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX }}
      >
        {dirty ? '● ' : ''}
        {name ?? 'Untitled'}
      </div>
      {pending && createPortal(<FileDialog dialog={pending} />, document.body)}
    </>
  )
}

/**
 * Ctrl+S, Ctrl+Shift+S, Ctrl+O and Ctrl+Shift+E, taken on the window in the
 * capture phase, before Excalidraw's container or the line field hears them.
 * Excalidraw's own Ctrl+Shift+S and Ctrl+Shift+E run even with its file items
 * turned off, and its save drops the block (ADR 0004).
 */
function useFileKeys(session: SheetSession) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const run =
        key === 's'
          ? () => (event.shiftKey ? session.saveAs() : session.save())
          : key === 'o' && !event.shiftKey
            ? () => session.open()
            : key === 'e' && event.shiftKey
              ? () => {}
              : null
      if (!run) return
      event.preventDefault()
      event.stopPropagation()
      if (!event.repeat) void run()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [session])
}

/**
 * A sheet or drawing dropped on the canvas opens through Open (#42, question 2):
 * otherwise Excalidraw replaces the scene and drops the block. Images and
 * library files stay Excalidraw's.
 */
function useSheetDrop(session: SheetSession) {
  useEffect(() => {
    const onDrop = (event: DragEvent) => {
      const transfer = event.dataTransfer
      const file = transfer?.files[0]
      if (!transfer || !file || !isSceneFileName(file.name)) return
      event.preventDefault()
      event.stopPropagation()
      // Only during the event: the handle lets Ctrl+S write back to the file.
      const item = Array.from(transfer.items).find(({ kind }) => kind === 'file') as
        | (DataTransferItem & { getAsFileSystemHandle?: () => Promise<unknown> })
        | undefined
      const handle = item?.getAsFileSystemHandle?.().catch(() => null) ?? Promise.resolve(null)
      void Promise.all([file.text(), handle]).then(([text, found]) =>
        session.open({ name: file.name, text, handle: asFileHandle(found) }),
      )
    }
    window.addEventListener('drop', onDrop, { capture: true })
    return () => window.removeEventListener('drop', onDrop, { capture: true })
  }, [session])
}

function asFileHandle(value: unknown): SheetFileHandle | null {
  return typeof value === 'object' && value !== null && (value as { kind?: string }).kind === 'file'
    ? (value as SheetFileHandle)
    : null
}

const LABELS = {
  restore: 'Restore',
  discard: 'Discard',
  save: 'Save',
  'dont-save': "Don't save",
  cancel: 'Cancel',
} as const

function FileDialog({ dialog }: { dialog: PendingDialog }) {
  const firstRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => firstRef.current?.focus(), [dialog])

  const answer = (choice: string) => (dialog.answer as (choice: string) => void)(choice)

  return (
    <div className="file-dialog__backdrop">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="file-dialog-title"
        className="file-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && dialog.kind === 'save-changes') answer('cancel')
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
              onClick={() => answer(choice)}
            >
              {LABELS[choice]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
