import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type Ref,
} from 'react'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { ABOVE_DRAWING_BELOW_UI_Z_INDEX, DARK_THEME_FILTER } from '../canvas/layers.ts'
import { isPlacing } from '../canvas/addMath.ts'
import {
  isMathAnchor,
  NO_TITLE_FORMAT,
  removeAnchor,
  sameAnchor,
  toMathAnchor,
  writeAnchorSource,
  writeAnchorTitle,
  writeAnchorTitleFormat,
  type MathAnchor,
  type TitleFormat,
} from '../canvas/mathAnchor.ts'
import { SHEET_SIDEBAR_CLASS, type ForwardWheel } from '../canvas/SheetCanvas.tsx'
import {
  DEFAULT_DISPLAY,
  evaluateSheet,
  isDisplayUnit,
  listConstants,
  splitLines,
  type SheetBlock,
  type SheetLine,
} from '../math/evaluate.ts'
import {
  caretAfterFormat,
  lineFormats,
  pressCommentFormat,
  pressFormat,
  pressRules,
  storeFormats,
  type RuleRow,
  writeDisplayUnit,
  type CommentFormat,
  type LineFormat,
  type TextColor,
} from '../math/lineForm.ts'
import { writeArgumentUnit } from '../math/tableLine.ts'
import { writePlotClauses, type PlotClause } from '../math/plotLine.ts'
import type { DisplaySettings } from '../math/display.ts'
import type { SymbolInsert } from '../math/symbols.ts'
import { assignedName, type RenamePlan, type RenameTarget } from '../math/rename.ts'
import {
  applyLineMove,
  startLineEdit,
  TITLE_LINE,
  withTypedFormat,
  withTypedLine,
  type LineEdit,
  type LineMove,
} from './lineEdit.ts'
import type { RowBox } from './lineHit.ts'
import { HoverTip, useHoverTip, type TipTarget } from './HoverTip.tsx'
import { MathElementView } from './MathElementView.tsx'
import { FailedElement } from './FailedElement.tsx'
import { Boundary } from '../failure/Boundary.tsx'
import { TEXT_COLOR_VALUES } from './textColors.ts'
import { PlacingGhost } from './PlacingGhost.tsx'
import { readingOrder } from './readingOrder.ts'
import { followOffers, noteCommit, type FollowedOffer, type RenameOffer } from './renameOffer.ts'
import { OfferCard } from './OfferCard.tsx'
import { constantSuggestions, functionSuggestions, sheetNames, suggest, unitSuggestions, type Suggested } from './suggest.ts'
import { useWords } from '../text/words.ts'
import { isPlainAt, planInsert } from './symbolInsert.ts'
import { fieldRoom, wrapWidthTo } from './wrapRoom.ts'
import type { OpenField } from './caretRow.ts'
import { FOLLOW_MARGIN, visibleArea } from '../canvas/selection.ts'
import { useAnchorSizes } from './useAnchorSizes.ts'
import { GEAR, useSheetGestures, type SlotTarget } from './useSheetGestures.ts'
import type { Viewport } from './viewport.ts'
import './MathOverlay.css'

/** The slice of Excalidraw's API the overlay uses. */
export type SceneApi = Pick<
  ExcalidrawImperativeAPI,
  | 'getSceneElements'
  | 'getSceneElementsIncludingDeleted'
  | 'getAppState'
  | 'onChange'
  | 'onScrollChange'
  | 'onPointerUp'
  | 'updateScene'
  | 'setActiveTool'
  | 'setCursor'
>

/**
 * What the app outside the overlay may do to the line edit: the sheet file
 * saves with it, and the Sheet panel's controls act on the open line or title
 * (docs/spec-v1.md section 14, Panel controls that act on the open line, M4d).
 * Each one does nothing when there is nothing it can act on.
 */
export interface LineEditControl {
  /** Writes the typed line to the scene, as a line commit, and keeps it open. */
  commitLine(): void
  /** Writes the typed line and closes the edit. */
  leaveLine(): void
  /** Whether a line or the title is open for typing (an outside change in a vault asks). */
  isOpen(): boolean
  /**
   * The open math line's plain format, as the Format tab writes it (section 4,
   * Format tab, Writes): the line's stored format, with the typed text, in one
   * write and one undo step. The field, its text and its caret are left alone,
   * unless plain words were typed in the line: they move out with the press,
   * on a new field with the caret in the code.
   */
  setFormat(format: LineFormat): void
  /** The open comment line's format: the same, a caret in the comment text keeping its place. */
  setCommentFormat(format: CommentFormat): void
  /** The open title's format: one undo step, the title kept open. */
  setTitleFormat(format: TitleFormat): void
  /** Moves the edit to the element's title, or from the title to its first line. */
  moveTo(target: 'title' | 'first'): void
  /** Moves the edit as ↑ or ↓ in the field do: from the first line to the title and back. */
  move(direction: 'up' | 'down'): void
  /** Opens the element's last line, as Enter on a selected element does (section 4, Gestures). */
  openLast(anchorId: string): void
  /**
   * The open math line's rules, as the Rules list writes them (section 4,
   * Rules list, M4e): every row goes to the line's stored format, with the
   * typed text, in one write and one undo step, the line kept open. The field
   * is left alone, unless rules were typed in the line: they move out with the
   * write, on a new field with the caret in the code.
   */
  setRules(rows: readonly RuleRow[]): void
  /**
   * The same rows while a condition is being typed in its field: nothing is
   * written, and the sheet runs from them, so the rule's live state follows
   * the field. They are written by `saveRules`, by the next press, or when the
   * edit leaves the line. Rules typed in the line are written at once, as
   * `setRules` does, since they move out of its text.
   */
  typeRules(rows: readonly RuleRow[]): void
  /** Writes what `typeRules` holds: a condition saved, one undo step. Nothing when nothing was typed. */
  saveRules(): void
  /** The suggestions the open line's field offers, for a condition's text and caret; null for none. */
  suggest(text: string, caret: number): Suggested | null
  /**
   * Measures the open line's wrap width again (section 4, While editing a
   * line, The field wraps, M4e): the panel the edit opened has been drawn,
   * and covers part of what was the visible area when the line opened.
   */
  rewrap(): void
  /**
   * A Symbols or Constants button (section 4, What a click inserts, M4d): types
   * the insert at the open field's caret, by its mode, as typing does, so the
   * field's Ctrl+Z takes it back. An open title or comment line takes it as
   * plain text. With nothing open, `anchorId` (the one math element selected)
   * opens its last line and inserts at its end; null does nothing.
   */
  insert(insert: SymbolInsert, anchorId?: string | null): void
  /**
   * The answer to a rename's offer (section 4, The offer, on a committed
   * line), from its card or a phone's row: Keep writes nothing and keeps an
   * open line as it is; Rename leaves the open line first, as a click on the
   * canvas does, then hands the rename to `onRenameOffer`.
   */
  answerOffer(key: number, answer: 'rename' | 'keep'): void
}

/** A rename an offer's Rename asks for: written as the form's Rename is (section 4, Renaming a name). */
export interface OfferRename {
  target: RenameTarget
  newName: string
  plan: RenamePlan
}

/** The offers waiting, newest last, for a phone's row (section 8, On a phone). */
export interface OffersShown {
  followed: readonly FollowedOffer[]
  /** The scene's blocks in reading order, as JSON, for the card's check. */
  blocks: string
  titles: ReadonlyMap<string, string | null>
}

/** What is open, for the Sheet panel (section 8): a line or the title, and its typed text. */
export interface EditTarget {
  anchorId: string
  lineIndex: number | 'title'
  text: string
  /**
   * The open line's stored format (section 3, Where a line's format lives,
   * M4e), as a condition being typed in the Rules list has it; empty for none
   * and for the title.
   */
  stored: string
}

export interface MathOverlayProps {
  api: SceneApi
  /** The box Excalidraw fills, where the gestures listen (`SheetCanvasHandle.root`). */
  canvasRoot: HTMLElement
  /** Where the gestures hear keys: unset on the web (the page), the view's container in a vault. */
  keyScope?: HTMLElement
  forwardWheel: ForwardWheel
  /** Gives the keyboard back to Excalidraw, so its Ctrl+Z works after Esc. */
  focusCanvas: () => void
  control?: Ref<LineEditControl>
  /**
   * Runs a size write so it doesn't make a clean sheet dirty
   * (`SheetSession.keepClean`, docs/spec-v1.md section 4, Size).
   */
  keepClean?: (write: () => void) => void
  /** Each evaluation of the sheet, in reading order, for the Sheet panel (section 8). */
  onEvaluated?: (sheet: readonly EvaluatedElement[]) => void
  /**
   * What is open, on each change: an edit starting, moving, each keystroke,
   * and null when it ends (section 8, An edit opens the panel on Format, M4d).
   */
  onEdit?: (target: EditTarget | null) => void
  /**
   * The open line's or title's text at each change, as it is set and before
   * it is drawn, and null with none open (section 4, Unexpected failures: the
   * failure screen shows the line being typed).
   */
  onTyped?: (text: string | null) => void
  /** The lines a jump from the panel or a rename flashes. */
  flash?: FlashLines | null
  /** How results show: the sheet's unit system and Digits (section 5). */
  settings?: DisplaySettings
  /** The sheet's result colour (section 4, Colours and rules, M4c). */
  resultColor?: TextColor
  /**
   * The last press was a touch (section 4, Touch, M4d): a selected math
   * element shows what hover reveals, its unit slots outlined and each plot's ⚙.
   */
  touch?: boolean
  /** A phone's layout (section 8, On a phone): the Sheet panel is a bottom sheet, which takes none of the width. */
  phone?: boolean
  /** ↑ or ↓ moved the caret between the rows of the open, wrapped field (section 4): the view follows it. */
  onCaretRow?: () => void
  /** An offer's Rename (section 4, The offer, on a committed line): the plan to write, one undo step. */
  onRenameOffer?: (rename: OfferRename) => void
  /**
   * The offers waiting, on each change (section 8, On a phone): with `phone`
   * the overlay draws no card, and the bottom sheet shows the newest as a row.
   */
  onOffers?: (offers: OffersShown) => void
}

/** One math element as evaluated: what the Sheet panel lists. */
export interface EvaluatedElement {
  anchorId: string
  title: string | null
  /** How the title looks, for the Format tab's sample (section 4, Title format). */
  titleFormat: TitleFormat
  lines: readonly SheetLine[]
  /** The element's lines as text, the typed line in place. */
  source: string
  /** The lines' stored formats, as the anchor holds them (section 7, M4e). */
  formats?: string
}

/**
 * The lines to flash, at once: one for a jump from the panel, every changed
 * line after a rename (section 4, Renaming a name, 0.5.0). A new `key` flashes
 * them again.
 */
export interface FlashLines {
  lines: readonly { anchorId: string; line: number }[]
  key: number
}

interface SceneSnapshot {
  viewport: Viewport
  anchors: readonly MathAnchor[]
  /** Excalidraw's theme: in dark, math darkens with the canvas's own filter. */
  dark: boolean
  /** Add math is waiting for its click (docs/spec-v1.md section 8). */
  placing: boolean
  /** The selected math elements' ids, sorted and joined by spaces: on touch they show their slots. */
  selected: string
}

/**
 * Renders every math element over the canvas, glued to its anchor's scene
 * position. Re-reads the scene whenever Excalidraw reports a change (element
 * moved, resized, deleted, undone) or a scroll/zoom.
 *
 * Owns the sheet's evaluation (ADR 0003): every element's source runs in
 * reading order, in one scope, synchronously on every keystroke and whenever a
 * source or the order changes. A drag that does not change the order does not
 * re-evaluate.
 *
 * Source lives in the anchors (ADR 0002). The one thing held here is the line
 * edit: the typed text stays in memory, the sheet runs from it, and the scene
 * gets it once, at the line commit (docs/spec-v1.md section 6). Holding a single
 * edit is what keeps at most one line across the sheet in source form.
 *
 * Lines open from the gestures (`useSheetGestures`): a double-click on a line,
 * Enter on a selected element, a click on another line while editing, and the
 * click that places a new element. An element left with no text is removed. The
 * overlay itself takes no pointer events except the open field, so its hovers
 * (the unit slots, a problem's message) are found from the pointer's moves.
 */
export function MathOverlay({
  api,
  canvasRoot,
  keyScope,
  forwardWheel,
  focusCanvas,
  control,
  keepClean = runNow,
  onEvaluated,
  onEdit,
  onTyped,
  flash = null,
  settings = DEFAULT_DISPLAY,
  resultColor = 'blue',
  touch = false,
  phone = false,
  onCaretRow,
  onRenameOffer,
  onOffers,
}: MathOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const store = useMemo(() => createSceneStore(api), [api])
  const { viewport, anchors, dark, placing, selected } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  // Selected by touch, an element shows what hover would (section 4, Touch).
  const revealed = new Set(touch && selected ? selected.split(' ') : [])

  const [edit, setEdit] = useState<LineEdit | null>(null)
  // Events read the latest edit from here: a field being removed can report its
  // blur while the render that removed it is still committing.
  const editRef = useRef(edit)
  // The name the open line assigned when its edit opened (section 4, The offer): a
  // commit that changes it makes the offer, even when a save or a press wrote the line before.
  const opened = useRef<{ anchorId: string; line: number; name: string | null } | null>(null)
  const changeEdit = (next: LineEdit | null) => {
    const was = opened.current
    if (!next || next.lineIndex === TITLE_LINE) opened.current = null
    else if (was?.anchorId !== next.anchorId || was.line !== next.lineIndex) {
      const anchor = findAnchor(next.anchorId)
      opened.current = {
        anchorId: next.anchorId,
        line: next.lineIndex,
        name: anchor ? nameAt(anchor.source, anchor.formats, next.lineIndex) : null,
      }
    }
    editRef.current = next
    // Before the render: if that render fails, the failure screen still has the text.
    onTyped?.(next?.text ?? null)
    setEdit(next)
  }
  // An insert that opened a line waits for its field (section 4, With no line open).
  const pendingInsert = useRef<SymbolInsert | null>(null)

  const typedSourceOf = (anchor: MathAnchor) =>
    edit?.anchorId === anchor.id ? withTypedLine(anchor.source, edit) : anchor.source

  // A condition being typed in the Rules list is read as the line's text is (section 4, Rules list).
  const typedFormatsOf = (anchor: MathAnchor) =>
    edit?.anchorId === anchor.id ? withTypedFormat(anchor.source, anchor.formats, edit) : anchor.formats

  // A string, so moves that keep the order and the sources keep the memo below.
  const sheetKey = JSON.stringify(
    readingOrder(anchors).map((id): SheetBlock => {
      const anchor = anchors.find((candidate) => candidate.id === id)
      return { id, source: anchor ? typedSourceOf(anchor) : '', formats: anchor ? typedFormatsOf(anchor) : '' }
    }),
  )
  const lines = useMemo(
    () => evaluateSheet(JSON.parse(sheetKey) as SheetBlock[], settings),
    [sheetKey, settings],
  )
  // The suggestions' details are in the language shown (0.6.0), so they are made again when it changes.
  const w = useWords()
  const constantNames = useMemo(() => constantSuggestions(listConstants(settings), w), [settings, w])
  const functionNames = useMemo(() => functionSuggestions(w), [w])
  const unitNames = useMemo(() => unitSuggestions(w), [w])

  // The panel's view of the same run: titles name elements, so they count too.
  const titlesKey = JSON.stringify(anchors.map(({ id, title, titleFormat }) => [id, { title, titleFormat }]))
  const onEvaluatedRef = useRef(onEvaluated)
  useEffect(() => {
    onEvaluatedRef.current = onEvaluated
  })
  useEffect(() => {
    const titles = new Map(JSON.parse(titlesKey) as [string, { title: string; titleFormat: TitleFormat }][])
    const blocks = JSON.parse(sheetKey) as SheetBlock[]
    onEvaluatedRef.current?.(
      blocks.map(({ id: anchorId, source, formats }) => ({
        anchorId,
        source,
        formats,
        title: titles.get(anchorId)?.title || null,
        titleFormat: titles.get(anchorId)?.titleFormat ?? NO_TITLE_FORMAT,
        lines: lines.get(anchorId) ?? [],
      })),
    )
  }, [lines, sheetKey, titlesKey])

  // What is open, for the panel: reported after each render that changed it.
  const onEditRef = useRef(onEdit)
  useEffect(() => {
    onEditRef.current = onEdit
  })
  const findAnchor = (anchorId: string) =>
    store.getSnapshot().anchors.find(({ id }) => id === anchorId)

  const editStored = storedFormat(anchors, edit)
  const editKey = edit && JSON.stringify([edit.anchorId, edit.lineIndex, edit.text, editStored])
  useEffect(() => {
    const current = editRef.current
    onEditRef.current?.(
      current && {
        anchorId: current.anchorId,
        lineIndex: current.lineIndex === TITLE_LINE ? 'title' : current.lineIndex,
        text: current.text,
        stored: storedFormat(store.getSnapshot().anchors, current),
      },
    )
  }, [editKey, store])

  // The field wraps (section 4, While editing a line, M4e): the room the open
  // line's field has, measured when the line opens and kept until it closes,
  // so a pan or a resize during the edit doesn't re-wrap. The line is drawn
  // once without it, measured, and drawn again before the browser paints.
  const [wrap, setWrap] = useState<{ anchorId: string; lineIndex: number; room: number | null } | null>(null)
  const measureWrap = () => {
    const current = editRef.current
    const cell = overlayRef.current?.querySelector<HTMLElement>('.math-element__field-cell:not(.is-title)')
    const element = cell?.closest<HTMLElement>('.math-element')
    const anchor = current && findAnchor(current.anchorId)
    if (!current || !cell || !element || !anchor) return setWrap(null)
    const wrapWidth =
      anchor.chosenWidth ??
      wrapWidthTo(
        element.getBoundingClientRect().left,
        visibleArea(canvasRoot, phone).right,
        FOLLOW_MARGIN,
        store.getSnapshot().viewport.zoom,
      )
    setWrap({ anchorId: current.anchorId, lineIndex: current.lineIndex, room: fieldRoom(cell, wrapWidth) })
  }
  const openAnchorId = edit?.anchorId
  const openLineIndex = edit?.lineIndex
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- measured once, as the line opens.
  useLayoutEffect(measureWrap, [openAnchorId, openLineIndex])
  const wrapRoom =
    wrap && edit && wrap.anchorId === edit.anchorId && wrap.lineIndex === edit.lineIndex ? wrap.room : null

  // The offers waiting (section 4, The offer, on a committed line): UI state,
  // followed on the scene as it is after each change, so a line being typed
  // doesn't drop one. Rename and Keep answer them; nothing else writes.
  const [offers, setOffers] = useState<readonly RenameOffer[]>([])
  const offerKey = useRef(0)
  const sceneBlocks = JSON.stringify(
    readingOrder(anchors).map((id): SheetBlock => {
      const anchor = anchors.find((candidate) => candidate.id === id)
      return { id, source: anchor?.source ?? '', formats: anchor?.formats ?? '' }
    }),
  )
  const { checked, followed } = useMemo(
    () => ({ checked: offers, followed: followOffers(offers, JSON.parse(sceneBlocks) as SheetBlock[]) }),
    [offers, sceneBlocks],
  )
  const followedRef = useRef(followed)
  useEffect(() => {
    followedRef.current = followed
    // An offer gone (or moved with its line) is gone from the state too; one made since is kept.
    const kept = new Map(followed.map(({ offer }) => [offer.key, offer]))
    const seen = new Set(checked.map(({ key }) => key))
    setOffers((now) => {
      const next = now.flatMap((offer) => (!seen.has(offer.key) ? [offer] : (kept.get(offer.key) ?? [])))
      return sameOffers(now, next) ? now : next
    })
  }, [checked, followed])
  const titles = useMemo(
    () => new Map((JSON.parse(titlesKey) as [string, { title: string }][]).map(([id, { title }]) => [id, title || null])),
    [titlesKey],
  )
  const onOffersRef = useRef(onOffers)
  useEffect(() => {
    onOffersRef.current = onOffers
  })
  useEffect(() => {
    onOffersRef.current?.({ followed, blocks: sceneBlocks, titles })
  }, [followed, sceneBlocks, titles])
  const cards = useRef(new Map<number, HTMLDivElement>())
  // Each card beside its line, or under it where there is no room to its right.
  useLayoutEffect(() => placeCards(overlayRef.current, canvasRoot, phone, followed, cards.current))

  const answerOffer = (key: number, answer: 'rename' | 'keep') => {
    const waiting = followedRef.current.find(({ offer }) => offer.key === key)
    if (!waiting) return
    setOffers((now) => now.filter((offer) => offer.key !== key))
    if (answer === 'keep') return
    // The open line is committed first, as its own step; the rename is planned on the scene it leaves.
    moveEdit({ kind: 'leave' })
    const blocks = readingOrder(store.getSnapshot().anchors).flatMap((id): SheetBlock[] => {
      const anchor = findAnchor(id)
      return anchor ? [{ id, source: anchor.source, formats: anchor.formats }] : []
    })
    const plan = followOffers([waiting.offer], blocks)[0]?.plan
    const { anchorId, line, from, to } = waiting.offer
    if (plan) onRenameOffer?.({ target: { id: anchorId, line, name: from }, newName: to, plan })
  }

  // The unit slots (section 5): the hovered row, and the slot whose field is open.
  const [slotHover, setSlotHover] = useState<SlotTarget | null>(null)
  const [unitEdit, setUnitEdit] = useState<SlotTarget | null>(null)
  const hoverRow = (target: SlotTarget | null) =>
    setSlotHover((current) =>
      current?.anchorId === target?.anchorId && current?.line === target?.line ? current : target,
    )

  // A problem's message under the pointer (section 4, Problems). It is placed
  // where its mark was, so a scroll, zoom or scene change takes it away.
  const { tip, hover: hoverTip, showNow: showTip } = useHoverTip()
  useEffect(() => {
    hoverTip(null)
  }, [viewport, anchors, hoverTip])

  /** Writes the slot's choice into the line's source, as one line commit; the line stays typeset. */
  const applyUnit = (anchorId: string, lineIndex: number, unit: string | null, column?: number) => {
    setUnitEdit(null)
    focusCanvas()
    const anchor = findAnchor(anchorId)
    if (!anchor) return
    const sourceLines = splitLines(anchor.source)
    if (lineIndex >= sourceLines.length) return
    const written =
      column === undefined
        ? writeDisplayUnit(sourceLines[lineIndex], unit)
        : writeArgumentUnit(sourceLines[lineIndex], column, unit)
    if (written === sourceLines[lineIndex]) return
    sourceLines[lineIndex] = written
    writeAnchorSource(api, anchorId, sourceLines.join('\n'))
  }

  /** Writes a plot's clauses from its popover, as one line commit; the popover stays open. */
  const applyPlot = (anchorId: string, lineIndex: number, clauses: PlotClause[]) => {
    const anchor = findAnchor(anchorId)
    if (!anchor) return
    const sourceLines = splitLines(anchor.source)
    if (lineIndex >= sourceLines.length) return
    const written = writePlotClauses(sourceLines[lineIndex], clauses)
    if (written === sourceLines[lineIndex]) return
    sourceLines[lineIndex] = written
    writeAnchorSource(api, anchorId, sourceLines.join('\n'))
  }

  /**
   * Every line commit goes through here, so each one is written exactly once.
   * An element left with no text is removed instead, as its own one step.
   */
  const moveEdit = (move: LineMove) => {
    const current = editRef.current
    if (!current) return
    const anchor = findAnchor(current.anchorId)
    if (!anchor) {
      changeEdit(null)
      return
    }
    // A condition typed and not yet saved goes with the line, in its one write.
    const next = applyLineMove(
      anchor.source,
      current,
      move,
      anchor.title,
      withTypedFormat(anchor.source, anchor.formats, current),
    )
    if (next.remove) removeAnchor(api, current.anchorId)
    else {
      // A move changes the line or the title, never both: one write, one step.
      // The line's text and its format go in that one write (section 7).
      writeAnchorSource(api, current.anchorId, next.source, next.formats)
      writeAnchorTitle(api, current.anchorId, next.title)
      // A line left as one line's edit, its name changed, makes the offer (section 4).
      if (makesOffer(move, current)) {
        const was = opened.current
        const before =
          was?.anchorId === current.anchorId && was.line === current.lineIndex
            ? was.name
            : nameAt(anchor.source, anchor.formats, current.lineIndex)
        const commit = {
          anchorId: current.anchorId,
          line: current.lineIndex,
          before,
          after: nameAt(next.source, next.formats, current.lineIndex),
        }
        setOffers((offers) => noteCommit(offers, commit, ++offerKey.current))
      }
    }
    changeEdit(next.edit)
  }

  /**
   * A press in the Format tab or a format key on the open line (section 4,
   * Format tab, Writes): `write` gives the line's text and its stored format
   * after the press, and both go to the scene in one write, one undo step,
   * with any condition typed in the Rules list and not yet saved. The field is
   * left alone, with its text undo, unless the press changed the line's text
   * (a clause typed in it moved out): then the line stays open on a new field,
   * the caret where `caretAfterFormat` puts it.
   */
  const pressLine = (write: (text: string, stored: string) => { text: string; stored: string }) => {
    const current = editRef.current
    const live = current && findAnchor(current.anchorId)
    if (!current || !live || current.lineIndex === TITLE_LINE) return
    const sourceLines = splitLines(live.source)
    if (current.lineIndex >= sourceLines.length) return
    const entries = lineFormats(live.formats, sourceLines.length)
    const next = write(current.text, current.stored ?? entries[current.lineIndex])
    const same = next.text === sourceLines[current.lineIndex] && next.stored === entries[current.lineIndex]
    sourceLines[current.lineIndex] = next.text
    entries[current.lineIndex] = next.stored
    if (!same) writeAnchorSource(api, current.anchorId, sourceLines.join('\n'), storeFormats(entries))
    if (next.text === current.text) {
      // The scene holds what was being typed in the Rules list.
      if (current.stored !== undefined) changeEdit({ ...current, stored: undefined })
      return
    }
    const caret = openField(overlayRef.current)?.selectionStart ?? next.text.length
    changeEdit({
      ...current,
      text: next.text,
      caret: caretAfterFormat(current.text, next.text, caret),
      revision: (current.revision ?? 0) + 1,
      stored: undefined,
    })
  }
  const setFormat = (format: LineFormat) => pressLine((text, stored) => pressFormat(text, stored, format))
  const setCommentFormat = (format: CommentFormat) =>
    pressLine((text, stored) => pressCommentFormat(text, stored, format))

  const openLine = (anchorId: string, lineIndex: number) => {
    moveEdit({ kind: 'leave' })
    const anchor = findAnchor(anchorId)
    if (anchor) changeEdit(startLineEdit(anchor.source, anchorId, lineIndex, anchor.title))
  }

  /** Types an insert into the open field, the caret where its plan puts it. */
  const typeInsert = (insert: SymbolInsert) => {
    const field = openField(overlayRef.current)
    const current = editRef.current
    if (!field || !current) return
    const value = field.value
    const start = field.selectionStart ?? value.length
    const plain = current.lineIndex === TITLE_LINE || isPlainAt(value, start)
    const planned = planInsert(value, start, field.selectionEnd ?? start, insert, plain)
    field.focus()
    field.setSelectionRange(planned.from, planned.to)
    // `insertText` keeps the field's own Ctrl+Z, as an accepted suggestion does;
    // where it isn't there, the text is written and the field told.
    if (!field.ownerDocument.execCommand?.('insertText', false, planned.text)) {
      field.setRangeText(planned.text, planned.from, planned.to, 'end')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    }
    field.setSelectionRange(planned.caret, planned.caret)
  }

  useImperativeHandle(control, () => ({
    // Saving during an edit writes what's on screen, and the field stays open.
    commitLine() {
      const current = editRef.current
      const anchor = current && findAnchor(current.anchorId)
      if (!current || !anchor) return
      if (current.lineIndex === TITLE_LINE) writeAnchorTitle(api, current.anchorId, current.text)
      else {
        writeAnchorSource(
          api,
          current.anchorId,
          withTypedLine(anchor.source, current),
          withTypedFormat(anchor.source, anchor.formats, current),
        )
      }
    },
    leaveLine: () => moveEdit({ kind: 'leave' }),
    isOpen: () => editRef.current !== null,
    setFormat,
    setCommentFormat,
    setTitleFormat(format) {
      const current = editRef.current
      if (current?.lineIndex === TITLE_LINE) writeAnchorTitleFormat(api, current.anchorId, format)
    },
    moveTo(target) {
      const current = editRef.current
      if (!current) return
      if (target === 'title') {
        if (current.lineIndex !== TITLE_LINE) moveEdit({ kind: 'title' })
      } else if (current.lineIndex === TITLE_LINE) moveEdit({ kind: 'down' })
    },
    move(direction) {
      if (editRef.current) moveEdit({ kind: direction })
    },
    openLast(anchorId) {
      const anchor = findAnchor(anchorId)
      if (anchor) openLine(anchorId, splitLines(anchor.source).length - 1)
    },
    setRules(rows) {
      pressLine((text, stored) => pressRules(text, stored, rows))
    },
    typeRules(rows) {
      const current = editRef.current
      const live = current && findAnchor(current.anchorId)
      if (!current || !live || current.lineIndex === TITLE_LINE) return
      const stored = storedFormat([live], current)
      const next = pressRules(current.text, stored, rows)
      // Rules typed in the line move out of its text: written at once.
      if (next.text !== current.text) return pressLine(() => next)
      if (next.stored !== stored) changeEdit({ ...current, stored: next.stored })
    },
    saveRules() {
      if (editRef.current?.stored !== undefined) pressLine((text, stored) => ({ text, stored }))
    },
    suggest: (text, caret) => suggestRef.current?.(text, caret) ?? null,
    rewrap: measureWrap,
    answerOffer,
    insert(insert, anchorId = null) {
      if (editRef.current) return typeInsert(insert)
      const anchor = anchorId === null ? undefined : findAnchor(anchorId)
      if (!anchor) return
      pendingInsert.current = insert
      openLine(anchor.id, splitLines(anchor.source).length - 1)
    },
  }))

  // After the field opened for an insert has mounted and put its caret at the
  // end (its own layout effect runs first), the insert is typed into it.
  useLayoutEffect(() => {
    const insert = pendingInsert.current
    pendingInsert.current = null
    if (insert) typeInsert(insert)
  })

  useSheetGestures({
    api,
    canvasRoot,
    keyScope,
    anchors: () => store.getSnapshot().anchors,
    rowsOf: (anchorId) => rowsOf(overlayRef.current, anchorId),
    headerOf: (anchorId) => headerOf(overlayRef.current, anchorId),
    edit: () => editRef.current,
    openLine,
    leaveLine: () => moveEdit({ kind: 'leave' }),
    focusCanvas,
    slotAt: (clientX, clientY) => slotAt(overlayRef.current, clientX, clientY),
    hoverRow,
    tipAt: (clientX, clientY) => tipAt(overlayRef.current, clientX, clientY),
    hoverTip,
    showTip,
    openUnit: (target) => {
      moveEdit({ kind: 'leave' })
      setUnitEdit(target)
    },
  })

  useAnchorSizes({
    api,
    overlay: () => overlayRef.current,
    anchors: () => store.getSnapshot().anchors,
    keepClean,
  })

  // Suggestions for the open line (section 4): the sheet's names above it,
  // then the constants, functions and units. None on a title.
  const suggestForEdit =
    edit && edit.lineIndex !== TITLE_LINE
      ? ((sheet) => (text: string, caret: number) =>
          suggest(text, caret, { sheet, constants: constantNames, functions: functionNames, units: unitNames }, undefined, w))(
          sheetNames(
            readingOrder(anchors).map((id) => ({ id, lines: lines.get(id) ?? [] })),
            edit,
            w,
          ),
        )
      : null

  // A rule's condition field offers the same list (section 4, Rules list, M4e).
  const suggestRef = useRef(suggestForEdit)
  useEffect(() => {
    suggestRef.current = suggestForEdit
  })

  const leaveLine = (anchorId: string, lineIndex: number) => {
    const current = editRef.current
    if (current?.anchorId === anchorId && current.lineIndex === lineIndex) {
      moveEdit({ kind: 'leave' })
    }
  }

  return (
    // Above the drawing, below Excalidraw's toolbar and panels, so math never
    // covers (or steals clicks from) the editor's own UI.
    <div
      ref={overlayRef}
      className="math-overlay"
      // In Excalidraw's dark theme, math darkens with the canvas's own filter.
      style={
        {
          zIndex: ABOVE_DRAWING_BELOW_UI_Z_INDEX,
          filter: dark ? DARK_THEME_FILTER : undefined,
          // Every result's number and unit, list summaries and table cells (a line's own text colour wins).
          '--math-result': TEXT_COLOR_VALUES[resultColor],
        } as CSSProperties
      }
    >
      {anchors.map((anchor) => {
        const own = edit?.anchorId === anchor.id ? edit : null
        const elementSource = typedSourceOf(anchor)
        const elementLines = lines.get(anchor.id)
        const onType = (text: string) => {
          const current = editRef.current
          if (current) changeEdit({ ...current, text })
        }
        const onEscape = () => {
          moveEdit({ kind: 'leave' })
          focusCanvas()
        }
        const onBlurLine = (lineIndex: number) => leaveLine(anchor.id, lineIndex)
        return (
        // Section 4, Unexpected failures: each element has its own boundary,
        // and tries again when its lines, its results or its edit change.
        <Boundary
          key={anchor.id}
          resetKeys={[elementSource, elementLines, own?.lineIndex, anchor.title]}
          fallback={(failure) => (
            <FailedElement
              anchor={anchor}
              viewport={viewport}
              source={elementSource}
              edit={own}
              failure={failure}
              onType={onType}
              onMove={moveEdit}
              onEscape={onEscape}
              onBlurLine={onBlurLine}
            />
          )}
        >
        <MathElementView
          anchor={anchor}
          viewport={viewport}
          source={elementSource}
          lines={elementLines ?? []}
          edit={own}
          onType={onType}
          stored={own ? editStored : ''}
          onFormat={setFormat}
          onCommentFormat={setCommentFormat}
          onTitleFormat={(format) => {
            // A title format key: one undo step; the title stays open.
            writeAnchorTitleFormat(api, anchor.id, format)
          }}
          onMove={moveEdit}
          onEscape={onEscape}
          onBlurLine={onBlurLine}
          forwardWheel={forwardWheel}
          flash={flashOf(flash, anchor.id)}
          suggest={edit?.anchorId === anchor.id ? suggestForEdit : null}
          wrapRoom={own ? wrapRoom : null}
          onCaretRow={onCaretRow}
          unitSlots={{
            hovered: slotHover?.anchorId === anchor.id ? slotHover.line : null,
            revealed: revealed.has(anchor.id),
            open: unitEdit?.anchorId === anchor.id ? unitEdit.line : null,
            openColumn: unitEdit?.anchorId === anchor.id ? (unitEdit.column ?? null) : null,
            apply: (lineIndex, unit, column) => applyUnit(anchor.id, lineIndex, unit, column),
            applyPlot: (lineIndex, clauses) => applyPlot(anchor.id, lineIndex, clauses),
            cancel: () => setUnitEdit(null),
            isUnit: isDisplayUnit,
          }}
        />
        </Boundary>
        )
      })}
      {!phone &&
        followed.map((shown) => (
          <OfferCard
            key={shown.offer.key}
            ref={(node) => {
              if (node) cards.current.set(shown.offer.key, node)
              else cards.current.delete(shown.offer.key)
            }}
            followed={shown}
            blocks={sceneBlocks}
            titles={titles}
            settings={settings}
            touch={touch}
            onRename={() => answerOffer(shown.offer.key, 'rename')}
            onKeep={() => answerOffer(shown.offer.key, 'keep')}
          />
        ))}
      {tip && <HoverTip key={tip.key} tip={tip} room={() => tipRoom(overlayRef.current, canvasRoot)} />}
      {placing && <PlacingGhost canvasRoot={canvasRoot} zoom={viewport.zoom} />}
    </div>
  )
}

const runNow = (write: () => void) => write()

/** The one name line `index` of an element assigns, read as the engine reads it, or null. */
function nameAt(source: string, formats: string, index: number): string | null {
  const lines = splitLines(source)
  if (index < 0 || index >= lines.length) return null
  return assignedName(lines[index], lineFormats(formats, lines.length)[index])
}

/**
 * The commits that can make an offer (section 4, Which commits make it): the
 * ones that leave a line as one line's edit. ↑ / ↓, a click on another line or
 * outside, Esc and a drag; Enter only at the end of the line, since inside its
 * text it splits the line in two. Not a join, and not the Format tab's Edit title.
 */
function makesOffer(move: LineMove, edit: LineEdit): boolean {
  if (edit.lineIndex === TITLE_LINE) return false
  if (move.kind === 'split') return move.from === move.to && move.to === edit.text.length
  return move.kind === 'up' || move.kind === 'down' || move.kind === 'leave'
}

function sameOffers(a: readonly RenameOffer[], b: readonly RenameOffer[]): boolean {
  return a.length === b.length && a.every((offer, i) => offer.key === b[i].key && offer.line === b[i].line)
}

/** The room between a card and its line, and between two cards, in px. */
const CARD_GAP = 8

/**
 * Places each card beside its line (section 4, The offer): to the right of its
 * element, at the line's row, where the visible area has room for it; else
 * under the row. A card that would cover the open line's field goes under the
 * field, so the line being typed stays in view, and one that would cover a
 * card placed before it goes under that one. A card whose line isn't drawn is
 * hidden.
 */
function placeCards(
  overlay: HTMLElement | null,
  canvasRoot: HTMLElement,
  phone: boolean,
  followed: readonly FollowedOffer[],
  cards: ReadonlyMap<number, HTMLElement>,
) {
  if (!overlay || followed.length === 0) return
  const origin = overlay.getBoundingClientRect()
  const area = visibleArea(canvasRoot, phone)
  const placed: { left: number; top: number; right: number; bottom: number }[] = []
  for (const { offer } of followed) {
    const card = cards.get(offer.key)
    if (!card) continue
    const element = elementOf(overlay, offer.anchorId)
    const body = element?.querySelector<HTMLElement>(':scope > .math-element__body') ?? element
    const row = element?.querySelector<HTMLElement>(`[data-line="${offer.line}"]`)
    card.hidden = !body || !row
    if (!body || !row) continue
    const width = card.offsetWidth
    const height = card.offsetHeight
    const line = row.getBoundingClientRect()
    const right = body.getBoundingClientRect().right
    const beside = right + CARD_GAP + width <= area.right
    const box = beside
      ? { left: right + CARD_GAP, top: line.top }
      : { left: Math.max(area.left, Math.min(line.left, area.right - width)), top: line.bottom + 4 }
    // Never over the open line, where the next line is being typed: under it instead.
    const field = overlay.querySelector('.math-element__field')?.getBoundingClientRect()
    const covers = (other: { left: number; top: number; right: number; bottom: number }) =>
      box.left < other.right && box.left + width > other.left && box.top < other.bottom && box.top + height > other.top
    if (field && covers(field)) box.top = field.bottom + 4
    for (const other of placed) if (covers(other)) box.top = other.bottom + CARD_GAP
    placed.push({ ...box, right: box.left + width, bottom: box.top + height })
    card.style.left = `${box.left - origin.left}px`
    card.style.top = `${box.top - origin.top}px`
  }
}

/** The stored format of the line `edit` is on (section 3, M4e), as the Rules list has typed it if it has: none for the title. */
function storedFormat(anchors: readonly MathAnchor[], edit: LineEdit | null): string {
  const anchor = edit && edit.lineIndex !== TITLE_LINE ? anchors.find(({ id }) => id === edit.anchorId) : undefined
  if (!edit || !anchor) return ''
  if (edit.stored !== undefined) return edit.stored
  return lineFormats(anchor.formats, splitLines(anchor.source).length)[edit.lineIndex] ?? ''
}

/** One element's lines among those to flash, or null when it has none. */
function flashOf(flash: FlashLines | null, anchorId: string): { lines: readonly number[]; key: number } | null {
  const lines = flash?.lines.filter((line) => line.anchorId === anchorId).map(({ line }) => line) ?? []
  return flash && lines.length > 0 ? { lines, key: flash.key } : null
}

/** The open line's or title's field: the overlay holds at most one. */
function openField(overlay: HTMLElement | null): OpenField | null {
  return overlay?.querySelector<HTMLTextAreaElement>('.math-element__field') ?? null
}

/**
 * An element's rows as laid out: `offsetTop` and `offsetHeight` ignore CSS
 * transforms, so they are in scene units, before zoom and rotation.
 */
function rowsOf(overlay: HTMLElement | null, anchorId: string): RowBox[] {
  const element = elementsOf(overlay).find((child) => child.dataset.anchorId === anchorId)
  if (!element) return []
  return Array.from(element.querySelectorAll<HTMLElement>('[data-line]')).map((row) => ({
    top: row.offsetTop,
    height: row.offsetHeight,
  }))
}

/**
 * The unit slot drawn under a point on screen, from the slots' boxes: the
 * topmost element first (later in the DOM paints above).
 */
function slotAt(overlay: HTMLElement | null, clientX: number, clientY: number): SlotTarget | null {
  const elements = elementsOf(overlay).reverse()
  for (const element of elements) {
    if (!element.dataset.anchorId) continue
    for (const slot of element.querySelectorAll<HTMLElement>('[data-unit-slot]')) {
      const box = slot.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      if (clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom) {
        const [line, column] = (slot.dataset.unitSlot ?? '').split(':')
        const target: SlotTarget = { anchorId: element.dataset.anchorId, line: Number(line) }
        // A plot's ⚙ (section 10) opens its popover the way a slot opens its field.
        if (column !== undefined) target.column = column === 'gear' ? GEAR : Number(column)
        return target
      }
    }
  }
  return null
}

/**
 * The message under a point on screen (section 4, Problems and Solve details):
 * a gutter mark, an error cell while its text is cut short, or a solved
 * value's details, found from their boxes
 * (`data-tip`), the topmost element first. The box comes back relative to the
 * overlay, where the tip is drawn.
 */
function tipAt(overlay: HTMLElement | null, clientX: number, clientY: number): TipTarget | null {
  if (!overlay) return null
  const elements = elementsOf(overlay).reverse()
  for (const element of elements) {
    if (!element.dataset.anchorId) continue
    for (const mark of element.querySelectorAll<HTMLElement>('[data-tip]')) {
      const box = mark.getBoundingClientRect()
      if (box.width === 0 && box.height === 0) continue
      if (clientX < box.left || clientX > box.right || clientY < box.top || clientY > box.bottom) continue
      // An error that fits shows whole already: nothing to add on hover.
      if (mark.dataset.tipWhen === 'capped' && mark.scrollWidth <= mark.clientWidth) continue
      const origin = overlay.getBoundingClientRect()
      const row = mark.closest<HTMLElement>('[data-line]')?.dataset.line ?? ''
      const kind = mark.dataset.tipWhen ?? 'mark'
      return {
        key: `${element.dataset.anchorId}:${row}:${kind}:${mark.dataset.tip}`,
        message: mark.dataset.tip ?? '',
        left: box.left - origin.left,
        top: box.top - origin.top,
        bottom: box.bottom - origin.top,
      }
    }
  }
  return null
}

/**
 * Where a tip can show, in the overlay's coordinates: the overlay's box, short
 * of the Sheet panel where the panel covers its right edge, or above a phone's
 * bottom sheet.
 */
function tipRoom(overlay: HTMLElement | null, canvasRoot: HTMLElement) {
  if (!overlay) return { width: 0, height: 0 }
  const origin = overlay.getBoundingClientRect()
  const panel = canvasRoot.querySelector(`.${SHEET_SIDEBAR_CLASS}`)?.getBoundingClientRect()
  if (!panel || panel.width === 0) return { width: overlay.clientWidth, height: overlay.clientHeight }
  // A phone's bottom sheet spans the view: the room ends at its top (section 8, On a phone).
  if (panel.left <= origin.left + 1 && panel.right >= origin.right - 1) {
    return { width: overlay.clientWidth, height: Math.max(0, Math.min(overlay.clientHeight, panel.top - origin.top)) }
  }
  const covered = Math.max(0, origin.right - panel.left)
  return { width: overlay.clientWidth - covered, height: overlay.clientHeight }
}

/** The header's box as laid out, or null when the element shows no title. */
function headerOf(overlay: HTMLElement | null, anchorId: string): RowBox | null {
  const header = elementOf(overlay, anchorId)?.querySelector<HTMLElement>('[data-title]')
  return header ? { top: header.offsetTop, height: header.offsetHeight } : null
}

/**
 * The overlay's math elements, in DOM order. A query, not `instanceof`: a node
 * in a pop-out window has that window's `HTMLElement` (section 12a).
 */
function elementsOf(overlay: HTMLElement | null): HTMLElement[] {
  return Array.from(overlay?.querySelectorAll<HTMLElement>(':scope > [data-anchor-id]') ?? [])
}

function elementOf(overlay: HTMLElement | null, anchorId: string): HTMLElement | undefined {
  return elementsOf(overlay).find((child) => child.dataset.anchorId === anchorId)
}

function createSceneStore(api: SceneApi) {
  let current = readSnapshot(api)
  return {
    subscribe: (onStoreChange: () => void) => {
      const offChange = api.onChange(onStoreChange)
      const offScroll = api.onScrollChange(onStoreChange)
      return () => {
        offChange()
        offScroll()
      }
    },
    // Must return the same object while nothing relevant changed:
    // Excalidraw fires onChange for every pointer move and selection change.
    getSnapshot: () => {
      const next = readSnapshot(api)
      if (sameSnapshot(current, next)) return current
      // A change of selection alone keeps the anchors as they were, so what
      // follows the scene (a tip's place) doesn't take it for a scene change.
      current = sameAnchors(current, next) ? { ...next, anchors: current.anchors } : next
      return current
    },
  }
}

function readSnapshot(api: SceneApi): SceneSnapshot {
  const app = api.getAppState()
  const { scrollX, scrollY, zoom, theme, selectedElementIds } = app
  const anchors = api.getSceneElements().filter(isMathAnchor).map(toMathAnchor)
  return {
    viewport: { scrollX, scrollY, zoom: zoom.value },
    anchors,
    dark: theme === 'dark',
    placing: isPlacing(app),
    selected: anchors
      .filter(({ id }) => selectedElementIds[id])
      .map(({ id }) => id)
      .sort()
      .join(' '),
  }
}

function sameSnapshot(a: SceneSnapshot, b: SceneSnapshot): boolean {
  const va = a.viewport
  const vb = b.viewport
  if (va.scrollX !== vb.scrollX || va.scrollY !== vb.scrollY || va.zoom !== vb.zoom) {
    return false
  }
  if (a.dark !== b.dark || a.placing !== b.placing || a.selected !== b.selected) return false
  return sameAnchors(a, b)
}

function sameAnchors(a: SceneSnapshot, b: SceneSnapshot): boolean {
  if (a.anchors.length !== b.anchors.length) return false
  return a.anchors.every((anchor, i) => sameAnchor(anchor, b.anchors[i]))
}
