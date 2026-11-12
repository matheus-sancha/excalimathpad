import type { PlotView } from '../math/evaluate.ts'

/**
 * Observable Plot behind `import()`, and the chart a plot line draws with it
 * (docs/spec-v1.md section 10, Plots; section 14: a lazy chunk). The component
 * around it is `PlotChart.tsx`.
 */

export type PlotModule = typeof import('@observablehq/plot')

let loading: Promise<PlotModule> | null = null

/** Observable Plot, behind `import()`: its own chunk, loaded once. */
export function loadPlot(): Promise<PlotModule> {
  loading ??= import('@observablehq/plot')
  return loading
}

/** The series colours, in a fixed order (section 10). */
export const SERIES_COLORS = ['#1971c2', '#e8590c', '#2f9e44', '#9c36b5', '#f08c00', '#0c8599', '#e03131', '#495057']

const MARK_COLOR = '#495057'
const FAILED_COLOR = '#e03131'

/** The chart's SVG for a plot. */
export function drawChart(Plot: PlotModule, plot: PlotView): SVGSVGElement | HTMLElement {
  const color = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]
  const rows = plot.series.map((series) =>
    plot.x.values.map((x, i) => ({ x, y: series.values[i] })).filter((row) => row.x !== null),
  )
  const marks: ReturnType<typeof Plot.line>[] = []
  plot.series.forEach((series, i) => {
    // A failed point is null: the line has a gap there.
    marks.push(Plot.line(rows[i], { x: 'x', y: 'y', stroke: color(i), strokeWidth: 1.6 }))
    if (plot.points) {
      marks.push(Plot.dot(rows[i].filter((row) => row.y !== null), { x: 'x', y: 'y', fill: color(i), r: 2.2 }))
    }
    if (plot.labelsDirect) {
      const last = [...rows[i]].reverse().find((row) => row.y !== null)
      if (last) {
        marks.push(Plot.text([last], { x: 'x', y: 'y', text: () => series.name, fill: color(i), dx: 6, textAnchor: 'start' }))
      }
    }
  })
  if (plot.marks.length > 0) {
    marks.push(Plot.ruleX(plot.marks, { x: 'x', stroke: MARK_COLOR, strokeDasharray: '4 3' }))
    const meets = plot.marks.flatMap((mark) =>
      rows.flatMap((series) => {
        const y = interpolate(series, mark.x)
        return y === null ? [] : [{ x: mark.x, y }]
      }),
    )
    marks.push(Plot.dot(meets, { x: 'x', y: 'y', fill: MARK_COLOR, r: 3 }))
    marks.push(Plot.text(plot.marks, { x: 'x', text: 'label', frameAnchor: 'top', dy: -10, fill: MARK_COLOR }))
  }
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
  const axis = (a: PlotView['x'] | PlotView['y']) => ({
    label: a.label,
    type: a.log ? ('log' as const) : ('linear' as const),
    // A log axis fits its data; rounding it out would stretch it to whole decades.
    ...(a.domain ? { domain: [...a.domain] } : { nice: !a.log }),
  })
  const chart = Plot.plot({
    width: plot.width,
    height: plot.height,
    marginTop: plot.marks.length > 0 ? 28 : 20,
    marginRight: plot.labelsDirect ? 72 : 20,
    style: { background: 'transparent', fontSize: '11px', overflow: 'visible' },
    x: axis(plot.x),
    y: { ...axis(plot.y), grid: true },
    marks,
  })
  // Each × carries its point's message, for the hover (section 10).
  chart.querySelectorAll<SVGElement>('.plot-failed text').forEach((text, i) => {
    const failure = plot.failed[i]
    if (!failure) return
    text.dataset.tip = failure.message
    text.dataset.tipWhen = 'details'
  })
  return chart
}

/** A series' value at x, between its two neighbouring points; null outside it or across a gap. */
function interpolate(rows: readonly { x: number | null; y: number | null }[], x: number): number | null {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    if (a.x === null || b.x === null || a.y === null || b.y === null) continue
    const low = Math.min(a.x, b.x)
    const high = Math.max(a.x, b.x)
    if (x < low || x > high) continue
    return a.x === b.x ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)
  }
  return null
}
