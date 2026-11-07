import { describe, expect, it } from 'vitest'
import { fitToContent, fitsContent, type AnchorBox } from './anchorSize.ts'

/** The rotated top-left corner, as Excalidraw draws it (rotation about the centre). */
function rotatedTopLeft({ x, y, width, height, angle }: AnchorBox) {
  const cx = x + width / 2
  const cy = y + height / 2
  const dx = -width / 2
  const dy = -height / 2
  return {
    x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: cy + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

describe('fitToContent (docs/spec-v1.md section 4, Size)', () => {
  it('keeps an upright anchor’s x and y: it grows right and down', () => {
    expect(fitToContent({ x: 100, y: 50, width: 420, height: 72, angle: 0 }, { width: 300, height: 120 })).toEqual({
      x: 100,
      y: 50,
      width: 300,
      height: 120,
    })
  })

  it.each([
    ['30°', Math.PI / 6],
    ['90°', Math.PI / 2],
    ['200°', (200 * Math.PI) / 180],
  ])('keeps a rotated anchor’s rotated top-left corner in place at %s', (_, angle) => {
    const box = { x: 100, y: 50, width: 420, height: 72, angle }
    const fitted = { ...fitToContent(box, { width: 250, height: 140 }), angle }

    const before = rotatedTopLeft(box)
    const after = rotatedTopLeft(fitted)
    expect(after.x).toBeCloseTo(before.x, 9)
    expect(after.y).toBeCloseTo(before.y, 9)
    expect(fitted.width).toBe(250)
    expect(fitted.height).toBe(140)
  })
})

describe('fitsContent', () => {
  it('counts a size within half a pixel as a fit, and anything more as not', () => {
    const box = { width: 300, height: 100 }
    expect(fitsContent(box, { width: 300.5, height: 99.5 })).toBe(true)
    expect(fitsContent(box, { width: 300.6, height: 100 })).toBe(false)
    expect(fitsContent(box, { width: 300, height: 98 })).toBe(false)
  })
})
