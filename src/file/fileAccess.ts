import { SHEET_EXTENSION } from './sheetFormat.ts'

/**
 * Reading and writing sheet files on disk (docs/spec-v1.md section 7). Chrome and
 * Edge on desktop use the File System Access API, which can write back to the
 * file it opened. Elsewhere Open is a file input and Save a download, with no
 * write-back (untested in v1).
 */

/** A file the app can write back to. Opaque outside this module. */
export interface SheetFileHandle {
  readonly kind: 'file'
  readonly name: string
}

/** A file the user picked or dropped. `handle` is null where write-back isn't possible. */
export interface PickedFile {
  name: string
  text: string
  handle: SheetFileHandle | null
}

export interface SavedFile {
  name: string
  handle: SheetFileHandle | null
}

export interface FileAccess {
  /** Null when the user cancels the picker. */
  open(): Promise<PickedFile | null>
  /** Writes back to a file. Throws with a readable message when that fails. */
  save(handle: SheetFileHandle, text: string): Promise<void>
  /** Asks for a new file. Null when the user cancels. */
  saveAs(suggestedName: string, text: string): Promise<SavedFile | null>
  /** Reads a file again from its handle, as it is on disk now. */
  read(handle: SheetFileHandle): Promise<PickedFile>
}

/** What the picker offers. Plain drawings open too, as format 1 sheets. */
const PICKER_TYPES = [
  {
    description: 'Excalimathpad sheet',
    accept: { 'application/json': [SHEET_EXTENSION, '.excalidraw'] },
  },
]

// The File System Access API isn't in TypeScript's DOM types yet.
interface WritableHandle extends SheetFileHandle {
  getFile(): Promise<File>
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
}

interface PickerWindow {
  showOpenFilePicker(options: object): Promise<WritableHandle[]>
  showSaveFilePicker(options: object): Promise<WritableHandle>
}

export function hasFileSystemAccess(target: object = window): boolean {
  return 'showOpenFilePicker' in target && 'showSaveFilePicker' in target
}

/** The browser's file access: the File System Access API where it exists. */
export function browserFileAccess(target: Window = window): FileAccess {
  return hasFileSystemAccess(target)
    ? fileSystemAccess(target as unknown as PickerWindow)
    : fallbackAccess(target.document)
}

function fileSystemAccess(picker: PickerWindow): FileAccess {
  return {
    async open() {
      const handles = await cancellable(() =>
        picker.showOpenFilePicker({ types: PICKER_TYPES, multiple: false, id: 'sheet' }),
      )
      const handle = handles?.[0]
      if (!handle) return null
      return readHandle(handle)
    },
    async save(handle, text) {
      await writeHandle(handle as WritableHandle, text)
    },
    read: readHandle,
    async saveAs(suggestedName, text) {
      const handle = await cancellable(() =>
        picker.showSaveFilePicker({ types: PICKER_TYPES, suggestedName, id: 'sheet' }),
      )
      if (!handle) return null
      await writeHandle(handle, text)
      return { name: handle.name, handle }
    },
  }
}

/** Reads a file from its handle: picked, dropped, or restored from the recovery copy. */
export async function readHandle(handle: SheetFileHandle): Promise<PickedFile> {
  const file = await (handle as WritableHandle).getFile()
  return { name: file.name, text: await file.text(), handle }
}

async function writeHandle(handle: WritableHandle, text: string) {
  // A handle restored from the recovery copy starts without write permission.
  if (handle.queryPermission && (await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    const granted = await handle.requestPermission?.({ mode: 'readwrite' })
    if (granted !== 'granted') throw new Error('permission to write the file was refused')
  }
  const writable = await handle.createWritable()
  await writable.write(text)
  await writable.close()
}

/** Runs a picker; a cancelled one gives null, any other failure throws. */
async function cancellable<T>(pick: () => Promise<T>): Promise<T | null> {
  try {
    return await pick()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

function fallbackAccess(document: Document): FileAccess {
  return {
    open: () =>
      new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = `${SHEET_EXTENSION},.excalidraw,application/json`
        input.addEventListener('change', async () => {
          const file = input.files?.[0]
          resolve(file ? { name: file.name, text: await file.text(), handle: null } : null)
        })
        input.addEventListener('cancel', () => resolve(null))
        input.click()
      }),
    async save() {
      throw new Error('this browser cannot write back to a file')
    },
    async read() {
      throw new Error('this browser cannot read a file again')
    },
    async saveAs(suggestedName, text) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = suggestedName
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      return { name: suggestedName, handle: null }
    },
  }
}
