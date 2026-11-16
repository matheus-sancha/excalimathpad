import { useEffect, useRef, useState } from 'react'
import type { PlotView } from '../math/evaluate.ts'
import { texToHtml } from './katex.ts'
import { Boundary } from '../failure/Boundary.tsx'
import { FAILURE_MESSAGES } from '../failure/details.ts'
import { drawChart, loadPlot, SERIES_COLORS, type PlotModule } from './plotDrawing.ts'

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
          {FAILURE_MESSAGES.chart}
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

  return (
    <div className="math-element__plot" style={{ width: plot.width }}>
      {plot.title !== null && <div className="math-element__plot-title">{plot.title}</div>}
      {!plot.labelsDirect && (
        <div className="math-element__plot-legend">
          {plot.series.map((series, i) => {
            const html = texToHtml(series.tex)
            return (
              <span key={i} className="math-element__plot-key">
                <span className="math-element__plot-swatch" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                {html === null ? series.name : <span className="math-element__tex" dangerouslySetInnerHTML={{ __html: html }} />}
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

