import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import { SheetCanvas } from './SheetCanvas.tsx'

describe('SheetCanvas', () => {
  it('hands its imperative API to the caller once mounted', async () => {
    const onApiReady = vi.fn<(api: ExcalidrawImperativeAPI) => void>()

    render(<SheetCanvas onApiReady={onApiReady} />)

    await waitFor(() => expect(onApiReady).toHaveBeenCalled())
    const api = onApiReady.mock.calls[0][0]
    // What the overlay (issue #2) relies on: scene + viewport state.
    expect(api.getSceneElements()).toEqual([])
    expect(api.getAppState().zoom.value).toBe(1)
    expect(typeof api.onScrollChange).toBe('function')
  })
})
