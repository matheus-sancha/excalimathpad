import { describe, expect, it } from 'vitest'
import type { PlotView } from '../math/evaluate.ts'
import { centredShift, layoutChart, nice, placeLabel, tickFormat, ticks } from './plotLayout.ts'

/** A plot view with the given parts, the rest empty. */
function view(parts: Partial<PlotView>): PlotView {
  const axis = { label: '', unit: '', log: false, domain: null }
  return {
    x: { ...axis, values: [] },
    y: axis,
    series: [],
    marks: [],
    failed: [],
    dots: [],
    circles: [],
    equal: null,
    labelsDirect: false,
    points: false,
    width: 480,
    height: 280,
    title: null,
    ...parts,
  }
}

const inner = (layout: ReturnType<typeof layoutChart>, plot: PlotView) => ({
  w: plot.width - layout.margin.left - layout.margin.right,
  h: plot.height - layout.margin.top - layout.margin.bottom,
})

describe('the chart’s layout (docs/spec-v1.md section 10, Plots, M4e)', () => {
  it('makes D3’s ticks, round ranges and tick text, as Plot draws them', () => {
    expect(ticks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    expect(nice([0.3, 29.7])).toEqual([0, 30])
    expect(tickFormat(-1, 1, 5)(-0.4)).toBe('−0.4')
    expect(tickFormat(0, 2e8, 5)(1.2e8)).toBe('120,000,000')
    expect(tickFormat(-1, 1, 5)(-0.0001)).toBe('0.0')
  })

  it('gives equal scales: a unit of x is as long as a unit of y, the data padded and centred', () => {
    const plot = view({
      x: { label: 'dx [mm]', unit: 'mm', log: false, domain: null, values: [] },
      dots: [{ x: 0.08, y: -0.05, label: '', name: '', tex: '' }],
      circles: [{ cx: 0, cy: 0, rx: 0.125, ry: 0.125, name: '', tex: '' }],
      equal: 1,
      width: 280,
      height: 280,
    })
    const layout = layoutChart(plot)
    const { w, h } = inner(layout, plot)
    const perX = (layout.x.domain[1] - layout.x.domain[0]) / w
    const perY = (layout.y.domain[1] - layout.y.domain[0]) / h
    expect(perX).toBeCloseTo(perY, 12)
    expect(layout.x.domain[0]).toBeLessThan(-0.125)
    expect(layout.x.domain[0] + layout.x.domain[1]).toBeCloseTo(0, 12)
    expect(layout.y.domain[0] + layout.y.domain[1]).toBeCloseTo(0, 12)
    expect(layout.x.ticks!.length).toBeGreaterThanOrEqual(3)
  })

  it('keeps a typed range with equal scales and sets only the other axis, in its own units', () => {
    const plot = view({
      x: { label: '', unit: '', log: false, domain: [-1, 1], values: [] },
      circles: [{ cx: 0, cy: 0, rx: 1, ry: 1000, name: '', tex: '' }],
      equal: 1000,
      width: 280,
      height: 280,
    })
    const layout = layoutChart(plot)
    const { w, h } = inner(layout, plot)
    expect(layout.x.domain).toEqual([-1, 1])
    expect((layout.y.domain[1] - layout.y.domain[0]) / 1000 / h).toBeCloseTo(2 / w, 12)
  })

  it('sizes the left margin for long tick numbers, and the right for a series named at its end', () => {
    const big = view({ x: { label: '', unit: '', log: false, domain: null, values: [0, 10] }, series: [{ name: 'y', tex: 'y', values: [0, 1.2e8] }] })
    expect(layoutChart(big).margin.left).toBeGreaterThan(70)
    const small = view({ x: { label: '', unit: '', log: false, domain: null, values: [0, 10] }, series: [{ name: 'y', tex: 'y', values: [0, 1] }] })
    expect(layoutChart(small).margin).toEqual({ top: 20, right: 20, bottom: 30, left: 40 })
    const direct = view({ ...small, labelsDirect: true, series: [{ name: 'a rather long series name', tex: '', values: [0, 1] }] })
    expect(layoutChart(direct).margin.right).toBeGreaterThan(120)
  })

  it('keeps the pump chart’s ranges: rounded out from the data, with the mark’s room on top', () => {
    const pump = view({
      x: { label: '', unit: '', log: false, domain: null, values: [1, 30] },
      series: [{ name: 'Hs', tex: '', values: [12.1, 29.4] }],
      marks: [{ x: 18.81, label: 'Q_op = 18.81 L / s' }],
    })
    const layout = layoutChart(pump)
    expect(layout.x.domain).toEqual([0, 30])
    expect(layout.y.domain).toEqual([12, 30])
    expect(layout.margin.top).toBe(28)
    expect(layout.meets).toHaveLength(1)
  })

  it('puts a point’s label right of it, or left where the right has no room, inside the frame', () => {
    const frame = { left: 40, right: 260, top: 20, bottom: 250 }
    expect(placeLabel({ x: 100, y: 100 }, 80, frame)).toEqual({ textAnchor: 'start', dx: 8, dy: 0 })
    expect(placeLabel({ x: 260, y: 100 }, 80, frame)).toEqual({ textAnchor: 'end', dx: -8, dy: 0 })
    const top = placeLabel({ x: 150, y: 20 }, 80, frame)
    expect(20 + top.dy).toBeGreaterThan(20)
  })

  it('slides a mark’s label in from the chart’s edges', () => {
    expect(centredShift(5, 60, 360)).toBeGreaterThan(0)
    expect(centredShift(355, 60, 360)).toBeLessThan(0)
    expect(centredShift(180, 60, 360)).toBe(0)
  })
})
