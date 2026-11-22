import type { PlotAxis, PlotView } from '../math/evaluate.ts'
import type { EngineMessage } from '../math/messages.ts'
import { centredShift, layoutChart, placeLabel, scaleOf, textWidth } from './plotLayout.ts'

/**
 * Observable Plot behind `import()`, and the chart a plot line draws with it
 * (docs/spec-v1.md section 10, Plots; section 14: a lazy chunk, Plot imported
 * by name in `plotMarks.ts`). The component around it is `PlotChart.tsx`; the
 * ranges, ticks and margins are `plotLayout.ts`'s.
 */

export type PlotModule = typeof import('./plotMarks.ts')

let loading: Promise<PlotModule> | null = null

/** Observable Plot, behind `import()`: its own chunk, loaded once. */
export function loadPlot(): Promise<PlotModule> {
  loading ??= import('./plotMarks.ts')
  return loading
}

/** The colours, in a fixed order (section 10): curves first, then points, then circles. */
export const SERIES_COLORS = ['#1971c2', '#e8590c', '#2f9e44', '#9c36b5', '#f08c00', '#0c8599', '#e03131', '#495057']

/** The colour of the `i`th thing drawn, in that order. */
export const colorOf = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]

const MARK_COLOR = '#495057'
const FAILED_COLOR = '#e03131'
/** A point's label is haloed in the chart's background, the sheet's white (dark is the overlay's filter). */
const HALO = '#ffffff'

/** The chart's SVG for a plot. */
export function drawChart(Plot: PlotModule, plot: PlotView): SVGSVGElement | HTMLElement {
  const layout = layoutChart(plot)
  const { margin } = layout
  const frame = { left: margin.left, right: plot.width - margin.right, top: margin.top, bottom: plot.height - margin.bottom }
  const equal = plot.equal !== null
  const rows = plot.series.map((series) =>
    plot.x.values.map((x, i) => ({ x, y: series.values[i] })).filter((row) => row.x !== null),
  )
  const marks: ReturnType<typeof Plot.line>[] = []
  if (equal) {
    // Equal scales' look (section 10, M4e): a frame, a line through 0 on each axis, no grid.
    marks.push(Plot.frame({ stroke: MARK_COLOR, strokeOpacity: 0.6 }))
    const inside = ([a, b]: [number, number]) => Math.min(a, b) < 0 && Math.max(a, b) > 0
    if (inside(layout.x.domain)) marks.push(Plot.ruleX([0], { stroke: MARK_COLOR, strokeOpacity: 0.45 }))
    if (inside(layout.y.domain)) marks.push(Plot.ruleY([0], { stroke: MARK_COLOR, strokeOpacity: 0.45 }))
  }
  plot.series.forEach((series, i) => {
    // A failed point is null: the line has a gap there. A typed range cuts the line at the frame.
    marks.push(Plot.line(rows[i], { x: 'x', y: 'y', stroke: colorOf(i), strokeWidth: 1.6, clip: 'frame' }))
    if (plot.points) {
      marks.push(Plot.dot(rows[i].filter((row) => row.y !== null), { x: 'x', y: 'y', fill: colorOf(i), r: 2.2, clip: 'frame' }))
    }
    if (plot.labelsDirect) {
      const last = [...rows[i]].reverse().find((row) => row.y !== null)
      if (last) {
        marks.push(Plot.text([last], { x: 'x', y: 'y', text: () => series.name, fill: colorOf(i), dx: 6, textAnchor: 'start' }))
      }
    }
  })
  // Circles: each one shape in the axes' units, cut at the frame (section 10, M4e).
  const firstCircle = plot.series.length + plot.dots.length
  if (plot.circles.length > 0) {
    marks.push(((_index: unknown, scales: { x?: (v: number) => number; y?: (v: number) => number }, _values: unknown, _dimensions: unknown, context: { document: Document }) => {
      const ns = 'http://www.w3.org/2000/svg'
      const box = context.document.createElementNS(ns, 'svg')
      box.setAttribute('class', 'plot-circles')
      box.setAttribute('x', String(frame.left))
      box.setAttribute('y', String(frame.top))
      box.setAttribute('width', String(frame.right - frame.left))
      box.setAttribute('height', String(frame.bottom - frame.top))
      box.setAttribute('overflow', 'hidden')
      plot.circles.forEach((circle, i) => {
        const x = scales.x!
        const y = scales.y!
        const ellipse = context.document.createElementNS(ns, 'ellipse')
        ellipse.setAttribute('cx', String(x(circle.cx) - frame.left))
        ellipse.setAttribute('cy', String(y(circle.cy) - frame.top))
        ellipse.setAttribute('rx', String(Math.abs(x(circle.cx + circle.rx) - x(circle.cx))))
        ellipse.setAttribute('ry', String(Math.abs(y(circle.cy + circle.ry) - y(circle.cy))))
        ellipse.setAttribute('fill', 'none')
        ellipse.setAttribute('stroke', colorOf(firstCircle + i))
        ellipse.setAttribute('stroke-width', '1.6')
        box.append(ellipse)
      })
      return box
    }) as unknown as ReturnType<typeof Plot.line>)
  }
  if (plot.marks.length > 0) {
    marks.push(Plot.ruleX(plot.marks, { x: 'x', stroke: MARK_COLOR, strokeDasharray: '4 3' }))
    marks.push(Plot.dot(layout.meets, { x: 'x', y: 'y', fill: MARK_COLOR, r: 3 }))
    // Each label centred on its guide, slid along where the chart's edge would cut it.
    const at = scaleOf(layout.x.domain, [frame.left, frame.right], plot.x.log)
    for (const mark of plot.marks) {
      const dx = centredShift(at(mark.x), textWidth(mark.label), plot.width)
      marks.push(Plot.text([mark], { x: 'x', text: 'label', frameAnchor: 'top', dy: -10, dx, fill: MARK_COLOR }))
    }
  }
  // Labelled dots (section 10, M4e), over the curves: right of the dot, or left where the right has no room.
  const atX = scaleOf(layout.x.domain, [frame.left, frame.right], plot.x.log)
  const atY = scaleOf(layout.y.domain, [frame.bottom, frame.top], plot.y.log)
  plot.dots.forEach((point, i) => {
    const color = colorOf(plot.series.length + i)
    marks.push(Plot.dot([point], { x: 'x', y: 'y', fill: color, r: 3.5 }))
    const place = placeLabel({ x: atX(point.x), y: atY(point.y) }, textWidth(point.label), frame)
    marks.push(
      Plot.text([point], {
        x: 'x',
        y: 'y',
        text: 'label',
        ...place,
        fill: 'currentColor',
        stroke: HALO,
        strokeWidth: 3.5,
        paintOrder: 'stroke',
        className: 'plot-point-label',
      }),
    )
  })
  if (plot.failed.length > 0) {
    marks.push(
      Plot.text(plot.failed, {
        x: 'x',
        text: () => '×',
        frameAnchor: 'bottom',
        fill: FAILED_COLOR,
        fontSize: 14,
        className: 'plot-failed',
      }),
    )
  }
  const axis = (a: PlotAxis, laid: typeof layout.x) => ({
    label: a.label,
    type: a.log ? ('log' as const) : ('linear' as const),
    domain: laid.domain,
    ...(laid.ticks ? { ticks: laid.ticks, tickFormat: laid.format } : {}),
  })
  const chart = Plot.plot({
    width: plot.width,
    height: plot.height,
    marginTop: margin.top,
    marginRight: margin.right,
    marginBottom: margin.bottom,
    marginLeft: margin.left,
    style: { background: 'transparent', fontSize: '11px', overflow: 'visible' },
    x: axis(plot.x, layout.x),
    y: { ...axis(plot.y, layout.y), grid: !equal },
    marks,
  })
  return chart
}

/**
 * Each × carries its point's message, for the hover (section 10), worded by
 * `word` in the language shown. Set apart from the drawing, so a language
 * change re-words the tips without drawing the chart again.
 */
export function tipFailures(chart: ParentNode, plot: PlotView, word: (message: EngineMessage) => string): void {
  chart.querySelectorAll<SVGElement>('.plot-failed text').forEach((text, i) => {
    const failure = plot.failed[i]
    if (!failure) return
    text.dataset.tip = word(failure.message)
    text.dataset.tipWhen = 'details'
  })
}
