/**
 * The names the plugin gives the files it creates (docs/spec-v1.md section 7,
 * A sheet in a vault). Pure: `taken` says whether a vault path is in use, so
 * the plugin never overwrites a file.
 */
import { SHEET_EXTENSION } from '../src/file/sheetFormat.ts'

/** `folder/name.ext` for a folder path as Obsidian gives it (`/` is the root). */
export function inFolder(folder: string, file: string): string {
  return folder === '/' || folder === '' ? file : `${folder}/${file}`
}

/**
 * The first free path for `base` in `folder`: `base.excalimathpad`, then
 * `base 1.excalimathpad`, `base 2.excalimathpad`…, as Obsidian names a new note.
 */
export function freeSheetPath(folder: string, base: string, taken: (path: string) => boolean): string {
  for (let n = 0; ; n++) {
    const path = inFolder(folder, `${n === 0 ? base : `${base} ${n}`}${SHEET_EXTENSION}`)
    if (!taken(path)) return path
  }
}

/** A new sheet's name, before its number: `Untitled.excalimathpad`, `Untitled 1.excalimathpad`… */
export const NEW_SHEET_BASE = 'Untitled'

/**
 * The name, without extension, of a busy tab's own version after an outside
 * change: `pump-sizing (conflict 2026-11-14 1532)`, in local time.
 */
export function conflictBase(basename: string, at: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  const date = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
  return `${basename} (conflict ${date} ${two(at.getHours())}${two(at.getMinutes())})`
}
