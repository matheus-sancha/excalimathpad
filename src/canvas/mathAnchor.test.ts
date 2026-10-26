import { describe, expect, it } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { createMathAnchorElements, isMathAnchor } from './mathAnchor.ts'

const [anchor] = createMathAnchorElements([
  { id: 'm1', x: 0, y: 0, width: 100, height: 50 },
])

describe('isMathAnchor', () => {
  it('recognises a created anchor', () => {
    expect(isMathAnchor(anchor)).toBe(true)
  })

  it('ignores ordinary rectangles, other types and deleted anchors', () => {
    const plain = { ...anchor, customData: undefined }
    const ellipse = { ...anchor, type: 'ellipse' } as ExcalidrawElement
    const deleted = { ...anchor, isDeleted: true }

    expect(isMathAnchor(plain)).toBe(false)
    expect(isMathAnchor(ellipse)).toBe(false)
    expect(isMathAnchor(deleted)).toBe(false)
  })
})
