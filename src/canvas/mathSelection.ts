import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { isMathAnchor } from './mathAnchor.ts'

/**
 * What a selection of only math elements shows (docs/spec-v1.md section 4,
 * Selected math element): a reduced properties panel, and for one element a
 * hint that tells the truth. Excalidraw has no prop for either, so the app
 * marks the box Excalidraw fills and `SheetCanvas.css` does the rest, on
 * Excalidraw's own DOM. That is behaviour outside its public API, held here
 * with its contract test (`mathSelection.excalidraw.test.tsx`), per ADR 0001.
 */
export type MathSelection = 'one' | 'several' | null

/** The hint for one selected math element (spec section 13). */
export const MATH_HINT = 'Double-click a line or press Enter to edit'

/** The same hint after a touch press (spec section 4, Touch). */
export const MATH_HINT_TOUCH = 'Double-tap a line, or tap Edit in Math settings'

type SelectionApi = Pick<ExcalidrawImperativeAPI, 'getSceneElements' | 'getAppState' | 'onChange'>

/** `one` or `several` when the selection is only math; null when empty or mixed. */
export function mathSelection(api: Pick<SelectionApi, 'getSceneElements' | 'getAppState'>): MathSelection {
  const { selectedElementIds } = api.getAppState()
  const selected = api.getSceneElements().filter(({ id }) => selectedElementIds[id])
  if (selected.length === 0 || !selected.every(isMathAnchor)) return null
  return selected.length === 1 ? 'one' : 'several'
}

/**
 * Keeps `data-math-selection` on `root` in step with the selection, and the
 * hint's texts in `--math-hint` and `--math-hint-touch`. Returns the function
 * that stops.
 */
export function markMathSelection(api: SelectionApi, root: HTMLElement): () => void {
  root.style.setProperty('--math-hint', JSON.stringify(MATH_HINT))
  root.style.setProperty('--math-hint-touch', JSON.stringify(MATH_HINT_TOUCH))
  const mark = () => {
    const selection = mathSelection(api)
    if (selection) root.dataset.mathSelection = selection
    else delete root.dataset.mathSelection
  }
  mark()
  const stop = api.onChange(mark)
  return () => {
    stop()
    delete root.dataset.mathSelection
  }
}

/**
 * Sets `data-math-touch` on `root` while the last press was a touch, so the
 * hint names the taps. Returns the function that takes it off.
 */
export function markTouch(root: HTMLElement, touch: boolean): () => void {
  if (!touch) return () => {}
  root.dataset.mathTouch = ''
  return () => {
    delete root.dataset.mathTouch
  }
}
