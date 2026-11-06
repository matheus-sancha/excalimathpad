/**
 * The sheet file's own part: the `excalimathpad` block next to Excalidraw's
 * scene JSON (ADR 0004, docs/spec-v1.md section 7). Pure, and free of
 * Excalidraw: the scene half is `src/canvas/sceneFile.ts`.
 */

/** The format this app writes. A file with a higher one is refused. */
export const FORMAT = 1

/** The file extension of a sheet, and what Save as suggests. */
export const SHEET_EXTENSION = '.excalimathpad'

export type UnitSystemName = 'si-prefixed' | 'si-base' | 'uscs'

export interface SheetSettings {
  units: {
    system: UnitSystemName
    /** Kind → unit. Non-empty makes the system Custom. */
    custom: Record<string, string>
  }
  /** Significant digits, 2 to 15. */
  digits: number
  page: { size: 'A4' | 'Letter'; orientation: 'portrait' | 'landscape' }
}

export const DEFAULT_SETTINGS: SheetSettings = {
  units: { system: 'si-prefixed', custom: {} },
  digits: 4,
  page: { size: 'A4', orientation: 'portrait' },
}

/** The file as parsed JSON: Excalidraw's keys plus, maybe, our block. */
export type SheetData = Record<string, unknown>

/**
 * One step from format `n` to `n + 1`, at index `n - 1`. Pure: it gets the whole
 * file, so a step can change elements as well as the block, and returns it with
 * `excalimathpad.format` raised by one.
 */
export type Migration = (data: SheetData) => SheetData

/** v1 is format 1, so there is nothing to upgrade yet. */
export const MIGRATIONS: readonly Migration[] = []

export type ReadSheet =
  /** `scene` is Excalidraw's part, ready for its `restore`. */
  | { kind: 'sheet'; scene: SheetData; settings: SheetSettings }
  | { kind: 'newer' }
  | { kind: 'not-a-sheet' }

/**
 * Reads a file's text. Never throws: anything that isn't a sheet or an
 * Excalidraw drawing is `not-a-sheet`, and a format above `FORMAT` is `newer`.
 * A drawing with no block opens as format 1 with default settings.
 */
export function readSheet(
  text: string,
  migrations: readonly Migration[] = MIGRATIONS,
  current: number = FORMAT,
): ReadSheet {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { kind: 'not-a-sheet' }
  }
  if (!isRecord(data) || data.type !== 'excalidraw' || !Array.isArray(data.elements)) {
    return { kind: 'not-a-sheet' }
  }

  let sheet: SheetData = data
  const block = data.excalimathpad
  if (block === undefined) {
    sheet = { ...data, excalimathpad: { format: 1 } }
  } else if (!isRecord(block) || !isFormat(block.format)) {
    return { kind: 'not-a-sheet' }
  } else if (block.format > current) {
    return { kind: 'newer' }
  }

  for (let format = formatOf(sheet); format < current; format++) {
    const step = migrations[format - 1]
    if (!step) return { kind: 'not-a-sheet' }
    sheet = step(sheet)
  }

  const { excalimathpad, ...scene } = sheet
  const settings = isRecord(excalimathpad) ? excalimathpad.settings : undefined
  return { kind: 'sheet', scene, settings: readSettings(settings) }
}

/**
 * Adds the block to Excalidraw's own serialized scene. Keeps Excalidraw's keys
 * as they are, so a renamed file still opens as a drawing.
 */
export function writeSheet(sceneJson: string, settings: SheetSettings): string {
  const scene = JSON.parse(sceneJson) as SheetData
  return JSON.stringify(
    { ...scene, excalimathpad: { format: FORMAT, settings } },
    null,
    2,
  )
}

/** A setting missing from a file, or one this app can't read, takes its default. */
export function readSettings(value: unknown): SheetSettings {
  const settings = isRecord(value) ? value : {}
  const units = isRecord(settings.units) ? settings.units : {}
  const page = isRecord(settings.page) ? settings.page : {}
  const defaults = DEFAULT_SETTINGS
  return {
    units: {
      system: oneOf(units.system, ['si-prefixed', 'si-base', 'uscs'], defaults.units.system),
      custom: readCustom(units.custom),
    },
    digits:
      Number.isInteger(settings.digits) &&
      (settings.digits as number) >= 2 &&
      (settings.digits as number) <= 15
        ? (settings.digits as number)
        : defaults.digits,
    page: {
      size: oneOf(page.size, ['A4', 'Letter'], defaults.page.size),
      orientation: oneOf(page.orientation, ['portrait', 'landscape'], defaults.page.orientation),
    },
  }
}

function readCustom(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback
}

function formatOf(data: SheetData): number {
  return (data.excalimathpad as { format: number }).format
}

function isFormat(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
