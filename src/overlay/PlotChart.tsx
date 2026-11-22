import { useEffect, useRef, useState } from 'react'
import type { PlotView } from '../math/evaluate.ts'
import { texToHtml } from './katex.ts'
import { Boundary } from '../failure/Boundary.tsx'
import { FailedNotice } from '../failure/FailureActions.tsx'
import { colorOf, drawChart, loadPlot, type PlotModule } from './plotDrawing.ts'

/**
 * A plot line's chart (docs/spec-v1.md section 10, Plots), under its line and
 * inside its row: drawn by Observable Plot, which loads lazily (section 14), so
 * a placeholder of the chart's size holds the box until it arrives. The chart
 * is static SVG: no zoom, pan or hover values on the curves. The legend and
 * the title are HTML around it, typeset; text inside the SVG is plain.
 *
 * It takes no pointer events, like the rest of the overlay, so a drag from it
 * moves the element and a double-click opens its line. A failed point's × on
 * the x axis carries its message as `data-tip`, which the gestures show.
 *
 * A chart that fails to draw (section 4, Unexpected failures) says so in its
 * box, the failure's raw text on hover; its line and the element stay. It is
 * tried again when the plot changes.
 */
export function PlotChart({ plot }: { plot: PlotView }) {
  return (
    <Boundary
      resetKeys={[JSON.stringify(plot)]}
      fallback={(failure) => (
        <div
          className="math-element__plot is-failed"
          role="alert"
          style={{ width: plot.width, height: plot.height }}
          data-tip={failure.text}
        >
          <FailedNotice thing="chart" />
        </div>
      )}
    >
      <Chart plot={plot} />
    </Boundary>
  )
}

function Chart({ plot }: { plot: PlotView }) {
  const [module, setModule] = useState<PlotModule | null>(null)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void loadPlot().then((loaded) => {
      if (live) setModule(() => loaded)
    })
    return () => {
      live = false
    }
  }, [])

  // Rebuilt only when the plot's data or settings change (section 14).
  const key = JSON.stringify(plot)
  useEffect(() => {
    if (!module || !host.current) return
    host.current.replaceChildren(drawChart(module, plot))
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `plot`, so an equal plot draws nothing.
  }, [module, key])

  // The legend's rows in the colours' order: curves (named at their ends instead with
  // `labels direct`), then points with a dot, then circles with a line (section 10).
  const legend = [
    ...plot.series.map((s, i) => ({ name: s.name, tex: s.tex, color: i, dot: false })).filter(() => !plot.labelsDirect),
    ...plot.dots.map((d, i) => ({ name: d.name, tex: d.tex, color: plot.series.length + i, dot: true })),
    ...plot.circles.map((c, i) => ({ name: c.name, tex: c.tex, color: plot.series.length + plot.dots.length + i, dot: false })),
  ]

  return (
    <div className="math-element__plot" style={{ width: plot.width }}>
      {plot.title !== null && <div className="math-element__plot-title">{plot.title}</div>}
      {legend.length > 0 && (
        <div className="math-element__plot-legend">
          {legend.map((row, i) => {
            const html = texToHtml(row.tex)
            return (
              <span key={i} className="math-element__plot-key">
                <span className={`math-element__plot-swatch${row.dot ? ' is-dot' : ''}`} style={{ background: colorOf(row.color) }} />
                {html === null ? row.name : <span className="math-element__tex" dangerouslySetInnerHTML={{ __html: html }} />}
              </span>
            )
          })}
        </div>
      )}
      <div
        ref={host}
        className={`math-element__plot-chart${module ? '' : ' is-loading'}`}
        style={{ width: plot.width, height: plot.height }}
      />
    </div>
  )
}

