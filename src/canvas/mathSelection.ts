import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { isMathAnchor } from './mathAnchor.ts'
import { onLanguage, words } from '../text/words.ts'

/**
 * What a selection of only math elements shows (docs/spec-v1.md section 4,
 * Selected math element): a reduced properties panel, and for one element a
 * hint that tells the truth. Excalidraw has no prop for either, so the app
 * marks the box Excalidraw fills and `SheetCanvas.css` does the rest, on
 * Excalidraw's own DOM. That is behaviour outside its public API, held here
 * with its contract test (`mathSelection.excalidraw.test.tsx`), per ADR 0001.
 */
export type MathSelection = 'one' | 'several' | null

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
 * hint's texts (spec section 13, App; section 4, Touch) in `--math-hint` and
 * `--math-hint-touch`, in the language shown (0.6.0). Returns the function
 * that stops.
 */
export function markMathSelection(api: SelectionApi, root: HTMLElement): () => void {
  const word = () => {
    const { hint } = words()
    root.style.setProperty('--math-hint', JSON.stringify(hint.selected))
    root.style.setProperty('--math-hint-touch', JSON.stringify(hint.selectedTouch))
  }
  word()
  const stopWords = onLanguage(word)
  const mark = () => {
    const selection = mathSelection(api)
    if (selection) root.dataset.mathSelection = selection
    else delete root.dataset.mathSelection
  }
  mark()
  const stop = api.onChange(mark)
  return () => {
    stop()
    stopWords()
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
