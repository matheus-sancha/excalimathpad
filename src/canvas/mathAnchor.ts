import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
} from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { FORMAT_COLORS, TEXT_COLORS, type FormatColor, type TextColor } from '../math/lineForm.ts'

/**
 * A math element's anchor: a plain Excalidraw rectangle marked with
 * `customData.kind === "math"`, whose `customData.source` holds the element's
 * lines. Excalidraw owns its position, rotation, selection, deletion and undo;
 * the app writes the source, once per line commit (ADR 0002).
 */
export const MATH_ANCHOR_KIND = 'math'

/** White at 1/255 alpha: invisible, yet not transparent to Excalidraw's hit-testing. */
export const ANCHOR_BACKGROUND = '#ffffff01'

/**
 * An anchor's style is fixed, except its opacity (docs/spec-v1.md section 4,
 * Selected math element): a thin, dashed grey border with sharp corners, and
 * the fill that takes clicks. New anchors are created with it, and
 * `anchorStyle.ts` writes it back whenever something changes it.
 */
export const ANCHOR_STYLE = {
  strokeColor: '#868e96',
  strokeStyle: 'dashed',
  strokeWidth: 1,
  // Looks transparent, but Excalidraw tests the inside of a shape only when
  // its background isn't, so a click or drag anywhere inside selects or
  // moves the anchor (ADR 0002, #28). A contract test pins it.
  backgroundColor: ANCHOR_BACKGROUND,
  fillStyle: 'solid',
  roughness: 0,
  roundness: null,
} as const

/** What the overlay needs from an anchor, in scene coordinates. */
export interface MathAnchor {
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Radians, clockwise, around the element's centre (Excalidraw's rule). */
  angle: number
  /** The element's lines. The scene holds the only stored copy. */
  source: string
  /** Excalidraw's lock: it holds the position only, and the lines still edit (#43). */
  locked: boolean
  /**
   * The element's optional title, shown as a header above its lines; empty for
   * none. Stored beside the source, in `customData.title`.
   */
  title: string
  /** 0 to 100, Excalidraw's scale. The element's math is drawn at it (section 4). */
  opacity: number
  /**
   * The width set with the resize handles (section 4, Chosen width, M4c), in
   * scene units; null for an automatic element. Stored in `customData.width`.
   */
  chosenWidth: number | null
  /** How the title looks (section 4, Title format, M4c). Stored in `customData.titleFormat`. */
  titleFormat: TitleFormat
}

/** A title's format (section 4, Title format): set only from the title's bar. */
export interface TitleFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  align: 'left' | 'centre' | 'right'
  size: 'S' | 'M' | 'L' | 'XL'
  color: TextColor
  highlight: FormatColor | null
}

/** A title with no format: bold, black, M and at the left, as before M4c. */
export const NO_TITLE_FORMAT: TitleFormat = {
  bold: true,
  italic: false,
  underline: false,
  align: 'left',
  size: 'M',
  color: 'black',
  highlight: null,
}

const TITLE_ALIGNS = ['left', 'centre', 'right'] as const
const TITLE_SIZES = ['S', 'M', 'L', 'XL'] as const

/**
 * A title's format as a file holds it: a string of words, only those that
 * differ from no format, such as `"L centre text-red"` (`regular`, `italic`,
 * `underline`; `centre`, `right`; `S`, `L`, `XL`; `text-<colour>`; a highlight).
 * A string and not an object: Excalidraw compares `customData` one level deep
 * when it records a step, so a nested object would add an empty undo step to
 * every later write of the anchor (`mathAnchor.excalidraw.test.tsx`). Anything
 * unreadable is the default.
 */
function readTitleFormat(element: ExcalidrawElement): TitleFormat {
  const stored: unknown = element.customData?.titleFormat
  if (typeof stored !== 'string') return NO_TITLE_FORMAT
  let format = NO_TITLE_FORMAT
  for (const word of stored.split(/\s+/)) {
    if (word === 'regular') format = { ...format, bold: false }
    else if (word === 'italic' || word === 'underline') format = { ...format, [word]: true }
    else if ((TITLE_ALIGNS as readonly string[]).includes(word)) format = { ...format, align: word as TitleFormat['align'] }
    else if ((TITLE_SIZES as readonly string[]).includes(word)) format = { ...format, size: word as TitleFormat['size'] }
    else if (word.startsWith('text-') && (TEXT_COLORS as readonly string[]).includes(word.slice(5))) {
      format = { ...format, color: word.slice(5) as TextColor }
    } else if ((FORMAT_COLORS as readonly string[]).includes(word)) format = { ...format, highlight: word as FormatColor }
  }
  return format
}

/** The words of `format` that differ from no format, as a file stores them; null when none does. */
function storedTitleFormat(format: TitleFormat): string | null {
  const words = [
    format.bold ? null : 'regular',
    format.italic ? 'italic' : null,
    format.underline ? 'underline' : null,
    format.align === 'left' ? null : format.align,
    format.size === 'M' ? null : format.size,
    format.color === 'black' ? null : `text-${format.color}`,
    format.highlight,
  ].filter((word) => word !== null)
  return words.length === 0 ? null : words.join(' ')
}

function sameTitleFormat(a: TitleFormat, b: TitleFormat): boolean {
  return (Object.keys(a) as (keyof TitleFormat)[]).every((key) => a[key] === b[key])
}

export function isMathAnchor(element: ExcalidrawElement): boolean {
  return (
    !element.isDeleted &&
    element.type === 'rectangle' &&
    element.customData?.kind === MATH_ANCHOR_KIND
  )
}

/** A hand-edited file can hold anything here; anything but a string is no source. */
function readSource(element: ExcalidrawElement): string {
  const source: unknown = element.customData?.source
  return typeof source === 'string' ? source : ''
}

/** A chosen width is a positive number; anything else is automatic. */
function readChosenWidth(element: ExcalidrawElement): number | null {
  const width: unknown = element.customData?.width
  return typeof width === 'number' && Number.isFinite(width) && width > 0 ? width : null
}

/** As for the source: anything but a string is no title. A title is one line. */
function readTitle(element: ExcalidrawElement): string {
  const title: unknown = element.customData?.title
  return typeof title === 'string' ? title.replace(/\s*[\r\n]+\s*/g, ' ').trim() : ''
}

export function toMathAnchor(element: ExcalidrawElement): MathAnchor {
  const { id, x, y, width, height, angle, locked, opacity } = element
  return {
    id,
    x,
    y,
    width,
    height,
    angle,
    locked,
    opacity,
    source: readSource(element),
    title: readTitle(element),
    chosenWidth: readChosenWidth(element),
    titleFormat: readTitleFormat(element),
  }
}

/** True when two anchors would be drawn and evaluated identically. */
export function sameAnchor(a: MathAnchor, b: MathAnchor): boolean {
  return (
    a.id === b.id &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.angle === b.angle &&
    a.locked === b.locked &&
    a.opacity === b.opacity &&
    a.source === b.source &&
    a.title === b.title &&
    a.chosenWidth === b.chosenWidth &&
    sameTitleFormat(a.titleFormat, b.titleFormat)
  )
}

/** Builds the scene elements for new anchors (e.g. for `initialData`). */
export function createMathAnchorElements(
  anchors: ReadonlyArray<
    Omit<MathAnchor, 'angle' | 'source' | 'locked' | 'opacity' | 'title' | 'chosenWidth' | 'titleFormat'> & {
      source?: string
      title?: string
      locked?: boolean
      chosenWidth?: number
    }
  >,
) {
  return convertToExcalidrawElements(
    anchors.map(({ id, x, y, width, height, source = '', locked = false, title, chosenWidth }) => ({
      type: 'rectangle' as const,
      id,
      x,
      y,
      width,
      height,
      ...ANCHOR_STYLE,
      locked,
      customData: {
        kind: MATH_ANCHOR_KIND,
        source,
        ...(title ? { title } : {}),
        ...(chosenWidth ? { width: chosenWidth } : {}),
      },
    })),
    // Keep our ids: callers refer to their anchors by them.
    { regenerateIds: false },
  )
}

/** The slice of Excalidraw's API a source write needs. */
export type SourceWriteApi = Pick<
  ExcalidrawImperativeAPI,
  'getSceneElementsIncludingDeleted' | 'updateScene'
>

/**
 * The only way source enters the scene. A call that changes the source adds
 * exactly one step for that source to Excalidraw's undo stack; a call that
 * changes nothing, or names no live anchor, writes nothing and adds no step.
 * Returns whether it wrote.
 *
 * Each of these fails silently if dropped (docs/spec-v1.md section 14):
 * - `newElementWith` gives a new `versionNonce`; a plain spread isn't recorded.
 * - `IMMEDIATELY` is the only safe capture. After `EVENTUALLY` or the default,
 *   later updates to that anchor drop off the undo stack.
 * - `recordPendingChange` comes first, or the write can add no step at all.
 *
 * The list stays the whole scene, deleted elements included: a source write has
 * no reason to change anything but its own anchor.
 */
export function writeAnchorSource(
  api: SourceWriteApi,
  anchorId: string,
  source: string,
): boolean {
  return writeAnchorData(api, anchorId, (anchor) =>
    readSource(anchor) === source ? null : { ...anchor.customData, source },
  )
}

/**
 * Sets or clears a math element's title (docs/spec-v1.md section 4), under
 * the same rules as a source write: one undo step when it changes, nothing
 * when it doesn't. An empty title removes the key, so an element without a
 * title is stored as it always was.
 */
export function writeAnchorTitle(api: SourceWriteApi, anchorId: string, title: string): boolean {
  const next = title.replace(/\s*[\r\n]+\s*/g, ' ').trim()
  return writeAnchorData(api, anchorId, (anchor) => {
    if (readTitle(anchor) === next) return null
    const { title: _old, titleFormat: _format, ...rest } = anchor.customData ?? {}
    // Emptying the title removes its format with it (section 4, Title format).
    return next ? { ...rest, title: next, ...(_format === undefined ? {} : { titleFormat: _format }) } : rest
  })
}

/**
 * Sets a title's format (section 4, Title format, M4c), from the title's bar:
 * one undo step when it changes, under the same rules as a source write.
 * `customData.titleFormat` holds only what differs from no format, and no key
 * at all for none, so a title without a format is stored as it always was.
 */
export function writeAnchorTitleFormat(api: SourceWriteApi, anchorId: string, format: TitleFormat): boolean {
  return writeAnchorData(api, anchorId, (anchor) => {
    if (sameTitleFormat(readTitleFormat(anchor), format)) return null
    const { titleFormat: _old, ...rest } = anchor.customData ?? {}
    const stored = storedTitleFormat(format)
    return stored === null ? rest : { ...rest, titleFormat: stored }
  })
}

/** One captured write of an anchor's `customData`; `change` returns null for no change. */
function writeAnchorData(
  api: SourceWriteApi,
  anchorId: string,
  change: (anchor: ExcalidrawElement) => Record<string, unknown> | null,
): boolean {
  const anchor = api.getSceneElementsIncludingDeleted().find(({ id }) => id === anchorId)
  if (!anchor || !isMathAnchor(anchor)) return false
  const customData = change(anchor)
  if (!customData) return false
  const committed = recordPendingChange(api, anchor)
  api.updateScene({
    elements: withElement(api, newElementWith(committed, { customData })),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  return true
}

/** The slice of Excalidraw's API a removal needs. */
export type RemoveApi = SourceWriteApi & Pick<ExcalidrawImperativeAPI, 'getAppState'>

/**
 * Removes a math element left with no text (docs/spec-v1.md section 4), as
 * exactly one undo step. Its source isn't touched, so undo brings the element
 * back as the scene last held it: an emptied element with its text, a new one
 * as an empty box. It leaves the selection in the same write, so the removal
 * and the deselect are one step. Returns whether it removed.
 */
export function removeAnchor(api: RemoveApi, anchorId: string): boolean {
  const anchor = api.getSceneElementsIncludingDeleted().find(({ id }) => id === anchorId)
  if (!anchor || !isMathAnchor(anchor)) return false
  const committed = recordPendingChange(api, anchor)
  const { [anchorId]: _removed, ...selectedElementIds } = api.getAppState().selectedElementIds
  api.updateScene({
    elements: withElement(api, newElementWith(committed, { isDeleted: true })),
    appState: { selectedElementIds },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  return true
}

/**
 * Records, as its own undo step, any change Excalidraw made to the anchor
 * without capturing it: its arrow-key nudge and its Link editor do this. Adds no
 * step if there is none, though `version` still goes up. Returns the anchor as
 * the scene now holds it.
 *
 * While the anchor's `version` is ahead of Excalidraw's last captured copy,
 * `updateScene` swaps it for that copy before capturing, so a write lands in the
 * scene but records nothing, and undo can't reach it. No public call flushes
 * this, and `updateScene` compares against the scene's current version. So the
 * first update parks the version at 0 without capturing, and the second captures
 * with the version one above where it was. Only this anchor is recorded, so a
 * nudge of several elements can split (docs/spec-v1.md section 6).
 *
 * That comparison isn't public API, and upstream has already dropped it, so this
 * has to change at the next Excalidraw upgrade: `mathAnchor.excalidraw.test.tsx`
 * fails then. Removing this likely means a nudge and the next line share one undo
 * step, unless upstream's new store offers something better (spec section 14).
 */
function recordPendingChange(api: SourceWriteApi, anchor: ExcalidrawElement) {
  api.updateScene({ elements: withElement(api, { ...anchor, version: 0 }) })
  const committed = newElementWith(anchor, {}, true)
  api.updateScene({
    elements: withElement(api, committed),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
  return committed
}

function withElement(api: SourceWriteApi, next: ExcalidrawElement) {
  return api
    .getSceneElementsIncludingDeleted()
    .map((element) => (element.id === next.id ? next : element))
}
