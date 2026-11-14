import { FuzzySuggestModal, type App, type TFile } from 'obsidian'
import type { PickedImage } from '../src/canvas/imageTool.ts'

/**
 * The vault image picker (docs/spec-v1.md section 12a, Data protection: Reach):
 * Excalidraw's image tool opens it in place of the operating system's file
 * picker. It lists the vault's image files by name and path, and reads only
 * the one the user picks; nothing else in the vault is opened.
 */

/** The image types Excalidraw 0.18 places (`IMAGE_MIME_TYPES`), by extension. */
export const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/** What the picker's field says before anything is typed. */
export const PICK_IMAGE_PLACEHOLDER = 'Pick an image from the vault to place on the sheet'

/** Opens the picker; resolves with the picked image's bytes, or null when it closes without a pick. */
export function pickVaultImage(app: App): Promise<PickedImage | null> {
  return new Promise((resolve) => new VaultImageModal(app, resolve).open())
}

class VaultImageModal extends FuzzySuggestModal<TFile> {
  private settled = false
  private readonly resolve: (image: PickedImage | null) => void

  constructor(app: App, resolve: (image: PickedImage | null) => void) {
    super(app)
    this.resolve = resolve
    this.setPlaceholder(PICK_IMAGE_PLACEHOLDER)
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((file) => mimeTypeOf(file) !== null)
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    this.settled = true
    const mimeType = mimeTypeOf(file)
    if (!mimeType) return this.resolve(null)
    this.app.vault.readBinary(file).then(
      (bytes) => this.resolve({ mimeType, bytes }),
      () => this.resolve(null),
    )
  }

  onClose(): void {
    // Obsidian closes the modal before it calls `onChooseItem`, so a pick is
    // waited for before this counts as closing without one.
    window.setTimeout(() => {
      if (!this.settled) this.resolve(null)
    }, 0)
  }
}

function mimeTypeOf(file: TFile): string | null {
  return IMAGE_TYPES[file.extension.toLowerCase()] ?? null
}
