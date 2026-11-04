import { fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'

/**
 * Waits for Excalidraw's first commit after it loads the scene. A write before
 * that isn't recorded, because `updateScene` drops elements its last captured
 * copy doesn't hold yet. The overlay can't open a line that early for a person
 * at human speed; a test can write in that gap.
 */
export async function sceneLoaded(api: Pick<ExcalidrawImperativeAPI, 'getAppState'>) {
  await waitFor(() => expect(api.getAppState().isLoading).toBe(false))
}

/** Excalidraw's Undo and Redo buttons: the public API has no undo call. */
export function undoControls(root: ParentNode) {
  const button = (name: 'undo' | 'redo') =>
    root.querySelector<HTMLButtonElement>(`[data-testid="button-${name}"]`)!
  return {
    canUndo: () => !button('undo').disabled,
    undo: () => fireEvent.click(button('undo')),
    redo: () => fireEvent.click(button('redo')),
  }
}
