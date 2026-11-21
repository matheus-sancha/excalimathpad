import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { BinaryFileData, DataURL, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { FileId } from '@excalidraw/excalidraw/element/types'
import { closeMoreTools } from './moreTools.ts'

/**
 * Excalidraw's image tool, taken over in a vault (M4d, docs/spec-v1.md section
 * 12a, Data protection: Reach). Excalidraw opens the operating system's file
 * picker from inside `setActiveTool`, which can read any file on the disk; the
 * plugin may read only one image the user picks from the vault. So a press on
 * the tool, or its key `9`, is stopped before Excalidraw hears it, the vault's
 * own picker opens instead, and the picked image is copied into the sheet as
 * Excalidraw stores any image (a `files` entry and an image element).
 *
 * This relies on behaviour that isn't public API (the tool's
 * `data-testid="toolbar-image"`, and its numeric key). Since the canary
 * (`0.18.0-9fbeaed`) the tool is "Insert image", a menu item of More tools; on
 * 0.18.1 it was a radio inside a `label.ToolIcon` on the toolbar. So it lives
 * here with its contract tests
 * (`imageTool.excalidraw.test.tsx`), per ADR 0001. Images dropped or pasted on
 * the canvas stay Excalidraw's: the user handed those over themselves.
 */

/** An image the user picked, as its bytes. */
export interface PickedImage {
  mimeType: string
  bytes: ArrayBuffer
}

/** The tool's item in More tools, as Excalidraw marks it. */
export const IMAGE_TOOL_SELECTOR = '[data-testid="toolbar-image"]'

/** Excalidraw's own cap on an image file (`MAX_ALLOWED_FILE_BYTES`, 4 MiB). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/** Excalidraw's own words for an image over the cap. */
export const IMAGE_TOO_BIG = 'File is too big. Maximum allowed size is 4MB.'

/**
 * Stops the image tool's press and key and calls `pick` instead. `keys` is
 * where key presses are heard: the vault view's own container. Returns the way
 * to stop.
 */
export function takeOverImageTool(root: HTMLElement, keys: EventTarget, pick: () => void): () => void {
  const isTool = (target: EventTarget | null) => {
    const element = target as Element | null
    if (typeof element?.closest !== 'function' || !root.contains(element)) return false
    // The press lands on the item or on its icon, text or key inside it.
    return !!element.closest(IMAGE_TOOL_SELECTOR)
  }
  // The item's click is what starts the tool; stopped here it never reaches Excalidraw's menu,
  // which then stays open, so More tools is closed as choosing an item closes it.
  const onClick = (event: Event) => {
    if (!isTool(event.target)) return
    event.preventDefault()
    event.stopPropagation()
    closeMoreTools(root)
    pick()
  }
  const onKeyDown = (event: Event) => {
    const key = event as KeyboardEvent
    if (key.key !== '9' || key.ctrlKey || key.metaKey || key.altKey || key.repeat) return
    const target = key.target as HTMLElement | null
    if (!target || !root.contains(target) || isTyping(target)) return
    key.preventDefault()
    key.stopPropagation()
    pick()
  }
  root.addEventListener('click', onClick, true)
  keys.addEventListener('keydown', onKeyDown, true)
  return () => {
    root.removeEventListener('click', onClick, true)
    keys.removeEventListener('keydown', onKeyDown, true)
  }
}

function isTyping(target: HTMLElement): boolean {
  const name = target.nodeName
  return name === 'INPUT' || name === 'TEXTAREA' || name === 'SELECT' || target.isContentEditable
}

export type ImageApi = Pick<
  ExcalidrawImperativeAPI,
  'addFiles' | 'getAppState' | 'getSceneElementsIncludingDeleted' | 'updateScene' | 'setToast'
>

/** An image's natural size in pixels; null when it can't be decoded. */
export type MeasureImage = (dataURL: string) => Promise<{ width: number; height: number } | null>

/**
 * Places `image` at the centre of the view, sized as Excalidraw's own tool
 * sizes a click-placed image, and selects it: one undo step. An image over
 * Excalidraw's cap is refused with Excalidraw's own words.
 */
export async function insertImage(api: ImageApi, image: PickedImage, measure: MeasureImage): Promise<void> {
  if (image.bytes.byteLength > MAX_IMAGE_BYTES) {
    api.setToast({ message: IMAGE_TOO_BIG, closable: true, duration: 6000 })
    return
  }
  const id = (await fileIdOf(image.bytes)) as FileId
  const dataURL = `data:${image.mimeType};base64,${base64(image.bytes)}` as DataURL
  const natural = (await measure(dataURL)) ?? { width: 100, height: 100 }
  const state = api.getAppState()
  const zoom = state.zoom.value
  // Excalidraw's `initializeImageDimensions`, for an image placed by a click.
  const fit = Math.min(Math.max(state.height - 120, 160), Math.floor(state.height * 0.5) / zoom)
  const naturalHeight = natural.height || 100
  // A view with no height yet (still laying out) has nothing to fit to.
  const height = fit > 0 ? Math.min(naturalHeight, fit) : naturalHeight
  const width = height * ((natural.width || 100) / naturalHeight)
  const centreX = state.width / 2 / zoom - state.scrollX
  const centreY = state.height / 2 / zoom - state.scrollY
  const now = Date.now()
  const file: BinaryFileData = { id, mimeType: image.mimeType as BinaryFileData['mimeType'], dataURL, created: now, lastRetrieved: now }
  api.addFiles([file])
  const [element] = convertToExcalidrawElements([
    { type: 'image', fileId: id, status: 'saved', x: centreX - width / 2, y: centreY - height / 2, width, height },
  ])
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), element],
    appState: { selectedElementIds: { [element.id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
}

/** Decodes an image in `doc`'s window for its natural size. */
export function measureIn(doc: Document): MeasureImage {
  return (dataURL) =>
    new Promise((resolve) => {
      const view = doc.defaultView
      if (!view) return resolve(null)
      const img = new view.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = dataURL
    })
}

/** The file's SHA-1, in hex, as Excalidraw names an image it stores: the same image twice is one file. */
async function fileIdOf(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < view.length; i += chunk) {
    binary += String.fromCharCode(...view.subarray(i, i + chunk))
  }
  return btoa(binary)
}
