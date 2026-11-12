import { useEffect, useRef, useState } from 'react'
import type { PlotView } from '../math/evaluate.ts'
import { texToHtml } from './katex.ts'
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
 */

export function PlotChart({ plot }: { plot: PlotView }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

