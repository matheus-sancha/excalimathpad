import { describe, expect, it } from 'vitest'
import type { MathAnchor } from '../canvas/mathAnchor.ts'
import { readingOrder } from './readingOrder.ts'

const at = (id: string, x: number, y: number, more: Partial<MathAnchor> = {}): MathAnchor => ({
  id,
  x,
  y,
  width: 100,
  height: 40,
  source: '',
  angle: 0,
  locked: false,
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

  describe('equal tops read left to right, whatever the sizes (PR #6 review, B3)', () => {
    // Regression: these tops differed by float noise and the left one came second.
    it('orders an aligned pair with fractional heights by left', () => {
      const left = at('z-left', 100, 995.93, { height: 72.3 })
      const right = at('a-right', 600, 995.93, { height: 48.7 })

      expect(readingOrder([right, left])).toEqual(['z-left', 'a-right'])
    })

    // Deterministic pseudo-random sizes, so a failure is reproducible.
    function mulberry32(seed: number) {
      return () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    it('holds for 10,000 aligned pairs, upright or upside down', () => {
      const random = mulberry32(3)
      const size = () => 1 + random() * 500
      const misordered: string[] = []
      for (let i = 0; i < 10_000; i++) {
        // Equal top, as Excalidraw's "align top" makes it; ids sort the
        // other way round, so only `left` can put them in order.
        const y = (random() - 0.5) * 4000
        const x = (random() - 0.5) * 4000
        const angle = () => (random() < 0.5 ? 0 : Math.PI)
        const left = at('z', x, y, { width: size(), height: size(), angle: angle() })
        const right = at('a', x + left.width + 1 + random() * 300, y, {
          width: size(),
          height: size(),
          angle: angle(),
        })
        if (readingOrder([right, left])[0] !== 'z') {
          misordered.push(JSON.stringify({ left, right }))
        }
      }
      expect(misordered).toEqual([])
    })

    it('holds for 10,000 aligned pairs turned a quarter', () => {
      const random = mulberry32(7)
      const misordered: string[] = []
      for (let i = 0; i < 10_000; i++) {
        // Turned a quarter, the visual top is centreY - width / 2: equal for
        // equal centres and widths, whatever the heights.
        const centreY = (random() - 0.5) * 4000
        const width = 1 + random() * 500
        const anchor = (id: string, centreX: number, height: number) =>
          at(id, centreX - width / 2, centreY - height / 2, {
            width,
            height,
            angle: Math.PI / 2,
          })
        const leftHeight = 1 + random() * 500
        const leftCentre = (random() - 0.5) * 4000
        const left = anchor('z', leftCentre, leftHeight)
        const right = anchor('a', leftCentre + 1000 + random() * 300, 1 + random() * 500)
        if (readingOrder([right, left])[0] !== 'z') {
          misordered.push(JSON.stringify({ left, right }))
        }
      }
      expect(misordered).toEqual([])
    })
  })

  it('returns nothing for an empty sheet', () => {
    expect(readingOrder([])).toEqual([])
  })
})
