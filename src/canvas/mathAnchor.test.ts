import { describe, expect, it } from 'vitest'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import {
  createMathAnchorElements,
  isMathAnchor,
  sameAnchor,
  toMathAnchor,
} from './mathAnchor.ts'

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

describe('toMathAnchor', () => {
  it('reads the source from customData', () => {
    const [withSource] = createMathAnchorElements([
      { id: 'm2', x: 0, y: 0, width: 100, height: 50, source: 'a = 1' },
    ])

    expect(toMathAnchor(withSource).source).toBe('a = 1')
    expect(toMathAnchor(anchor).source).toBe('')
  })

  it('reads a missing or malformed source as none', () => {
    const malformed = { ...anchor, customData: { kind: 'math', source: 7 } }
    const missing = { ...anchor, customData: { kind: 'math' } }

    expect(toMathAnchor(malformed).source).toBe('')
    expect(toMathAnchor(missing).source).toBe('')
  })
})

describe('sameAnchor', () => {
  // Otherwise an undo that only changes the source would not reach the overlay.
  it('tells anchors apart by source', () => {
    const a = toMathAnchor(anchor)

    expect(sameAnchor(a, { ...a })).toBe(true)
    expect(sameAnchor(a, { ...a, source: 'x' })).toBe(false)
  })

  // A locked element's double-click rule reads it (#43).
  it('tells anchors apart by lock', () => {
    const a = toMathAnchor(anchor)

    expect(sameAnchor(a, { ...a, locked: true })).toBe(false)
  })

  // Otherwise a change of opacity in the panel would not reach the overlay.
  it('tells anchors apart by opacity', () => {
    const a = toMathAnchor(anchor)

    expect(a.opacity).toBe(100)
    expect(sameAnchor(a, { ...a, opacity: 40 })).toBe(false)
  })
})

describe('title', () => {
  it('is empty unless the anchor carries one', () => {
    const [titled] = createMathAnchorElements([
      { id: 'm4', x: 0, y: 0, width: 10, height: 10, title: 'Pipe flow' },
    ])

    expect(toMathAnchor(anchor).title).toBe('')
    expect(anchor.customData).not.toHaveProperty('title')
    expect(toMathAnchor(titled).title).toBe('Pipe flow')
  })

  // Otherwise an undo that only changes the title would not reach the overlay.
  it('tells anchors apart', () => {
    const a = toMathAnchor(anchor)

    expect(sameAnchor(a, { ...a, title: 'Pipe flow' })).toBe(false)
  })
})

describe('createMathAnchorElements', () => {
  it('creates unlocked anchors unless asked', () => {
    const [locked] = createMathAnchorElements([
      { id: 'm3', x: 0, y: 0, width: 10, height: 10, locked: true },
    ])

    expect(toMathAnchor(anchor).locked).toBe(false)
    expect(toMathAnchor(locked).locked).toBe(true)
  })
})
