import { describe, expect, it } from 'vitest'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { readingOrder } from './readingOrder.ts'

const at = (id: string, x: number, y: number, more: Partial<MathAnchor> = {}): MathAnchor => ({
  id,
  x,
  y,
  width: 100,
  height: 40,
  angle: 0,
  ...more,
})

describe('readingOrder', () => {
  it('reads top to bottom first', () => {
    expect(readingOrder([at('low', 0, 200), at('high', 500, 10)])).toEqual(['high', 'low'])
  })

  it('reads left to right when the tops are equal', () => {
    expect(readingOrder([at('right', 300, 50), at('left', 20, 50)])).toEqual([
      'left',
      'right',
    ])
  })

  // Approved rule (issue #3): the top edge decides, even by one unit, so a
  // block slightly higher on the right comes first.
  it('lets the top edge win over left, however small the difference', () => {
    expect(readingOrder([at('left', 0, 51), at('right', 300, 50)])).toEqual([
      'right',
      'left',
    ])
  })

  it('breaks exact ties by id, whatever order the scene lists them in', () => {
    const a = at('a', 10, 10)
    const b = at('b', 10, 10)

    expect(readingOrder([b, a])).toEqual(['a', 'b'])
    expect(readingOrder([a, b])).toEqual(['a', 'b'])
  })

  it('places a rotated anchor by its visual bounds', () => {
    // 200 x 20 at y = 100, turned a quarter: it now spans y 10..210, so its
    // visual top (10) is above an upright block at y = 50.
    const turned = at('turned', 0, 100, { width: 200, height: 20, angle: Math.PI / 2 })

    expect(readingOrder([at('upright', 400, 50), turned])).toEqual(['turned', 'upright'])
  })

  it('returns nothing for an empty sheet', () => {
    expect(readingOrder([])).toEqual([])
  })
})
