import type { PlotAxis, PlotView } from '../math/evaluate.ts'

/**
 * A chart's layout, worked out before Observable Plot draws it
 * (docs/spec-v1.md section 10, Plots, M4e): each axis's range and ticks, and
 * all four margins, sized for the tick numbers, the axis titles and a mark's
 * label, so nothing drawn runs past the chart. Equal scales (from `equal` or a
 * circle) widen the shorter axis here, since Plot's `aspectRatio` is ignored
 * at a fixed size (section 14). Pure: no Plot and no DOM, so it is tested in
 * jsdom; a text's width is an estimate from its characters, held against
 * real fonts in the panel run.
 */

/** Plot's text size in the chart (`style.fontSize`). */
export const CHART_FONT = 11

export interface AxisLayout {
  domain: [number, number]
  /** The ticks and their text; null on a log axis, whose ticks are Plot's own. */
  ticks: number[] | null
  format: (n: number) => string
}

export interface ChartLayout {
  margin: { top: number; right: number; bottom: number; left: number }
  x: AxisLayout
  y: AxisLayout
  /** Where each mark's guide meets each curve. */
  meets: { x: number; y: number }[]
}

/** Plot's spacing between ticks, in px: about one per 80 px on x and 35 on y. */
const TICK_SPACING = { x: 80, y: 35 }
/** Plot's tick length and the gap to its number. */
const TICK_ROOM = 6 + 3
/** Room kept between text and the chart's edge. */
const EDGE = 3

/** The chart's ranges, ticks and margins. */
export function layoutChart(plot: PlotView): ChartLayout {
  const meets = plot.marks.flatMap((mark) =>
    plot.series.flatMap((series) => {
      const y = interpolate(plot.x.values, series.values, mark.x)
      return y === null ? [] : [{ x: mark.x, y }]
    }),
  )
  const xs = [
    ...plot.x.values,
    ...plot.marks.map((m) => m.x),
    ...plot.failed.map((f) => f.x),
    ...plot.dots.map((d) => d.x),
    ...plot.circles.flatMap((c) => [c.cx - c.rx, c.cx + c.rx]),
  ]
  const ys = [
    ...plot.series.flatMap((s) => s.values),
    ...meets.map((m) => m.y),
    ...plot.dots.map((d) => d.y),
    ...plot.circles.flatMap((c) => [c.cy - c.ry, c.cy + c.ry]),
  ]
  const extentX = extent(xs, plot.x.log)
  const extentY = extent(ys, plot.y.log)
  const equal = plot.equal !== null && !plot.x.log && !plot.y.log

  const top = plot.marks.length > 0 ? 28 : 20
  const bottom = 30
  let left = 40
  let right = 20
  let x: AxisLayout = axis(plot.x, extentX, 1, false)
  let y: AxisLayout = axis(plot.y, extentY, 1, false)
  // The margins depend on the tick numbers, and the ticks on the room the margins leave: settle them.
  for (let round = 0; round < 6; round++) {
    const innerW = Math.max(1, plot.width - left - right)
    const innerH = Math.max(1, plot.height - top - bottom)
    let domainX: [number, number] | null = plot.x.domain ? [...plot.x.domain] : null
    let domainY: [number, number] | null = plot.y.domain ? [...plot.y.domain] : null
    if (equal) [domainX, domainY] = equalDomains(plot, extentX, extentY, innerW, innerH)
    x = axis(plot.x, domainX ?? extentX, innerW / TICK_SPACING.x, domainX === null)
    y = axis(plot.y, domainY ?? extentY, innerH / TICK_SPACING.y, domainY === null)
    const xTexts = tickTexts(x, plot.x.log)
    const yTexts = tickTexts(y, plot.y.log)
    const half = (text: string | undefined) => (text === undefined ? 0 : textWidth(text) / 2 + EDGE)
    const wantLeft = Math.ceil(Math.max(40, ...yTexts.map((t) => textWidth(t) + TICK_ROOM + EDGE), half(xTexts[0])))
    const directs = plot.labelsDirect ? plot.series.map((s) => textWidth(s.name) + 6 + EDGE) : []
    const wantRight = Math.ceil(Math.max(20, half(xTexts[xTexts.length - 1]), ...directs))
    if (wantLeft <= left && wantRight <= right) break
    left = Math.max(left, wantLeft)
    right = Math.max(right, wantRight)
  }
  return { margin: { top, right, bottom, left }, x, y, meets }
}

/** An axis's range and ticks: the given range, else the data's, rounded out on a linear axis. */
function axis(view: PlotAxis, domain: [number, number], count: number, fit: boolean): AxisLayout {
  if (view.log) {
    return { domain, ticks: null, format: plainNumber }
  }
  // A typed range may run high to low: the axis runs that way, its ticks the same.
  const range = fit ? nice(domain) : domain
  const [low, high] = sorted(range)
  // At least three numbers on an axis: a small square chart's x would otherwise show 0 alone.
  let wanted = count
  while (ticks(low, high, wanted).length < 3 && wanted < count * 8) wanted *= 2
  return { domain: range, ticks: ticks(low, high, wanted), format: tickFormat(low, high, wanted) }
}

/** The texts an axis's ticks show, for its margin; on a log axis, each power of ten in range. */
function tickTexts(layout: AxisLayout, log: boolean): string[] {
  if (layout.ticks) return layout.ticks.map(layout.format)
  if (!log) return []
  const [low, high] = layout.domain
  const texts: string[] = []
  for (let p = Math.floor(Math.log10(low)); p <= Math.ceil(Math.log10(high)); p++) texts.push(plainNumber(10 ** p))
  return texts
}

/**
 * Equal scales (section 10, M4e): the data's ranges padded, then the shorter
 * axis widened about its middle so a unit of x is as long as a unit of y. A
 * typed range is kept and only the other axis is set (the engine refuses both).
 */
function equalDomains(
  plot: PlotView,
  extentX: [number, number],
  extentY: [number, number],
  innerW: number,
  innerH: number,
): [[number, number], [number, number]] {
  const k = plot.equal ?? 1
  const typedX = plot.x.domain ? sorted(plot.x.domain) : null
  const typedY = plot.y.domain ? sorted(plot.y.domain) : null
  // Pad each by a share of the larger span, measured in x's units.
  const span = Math.max(extentX[1] - extentX[0], (extentY[1] - extentY[0]) / k)
  const pad = span * PAD
  const x = typedX ?? [extentX[0] - pad, extentX[1] + pad]
  const y = typedY ?? [extentY[0] - pad * k, extentY[1] + pad * k]
  // x's units per px on each axis.
  const perX = (x[1] - x[0]) / innerW
  const perY = (y[1] - y[0]) / k / innerH
  const per = typedX ? perX : typedY ? perY : Math.max(perX, perY)
  const around = (d: [number, number], half: number): [number, number] => {
    const middle = (d[0] + d[1]) / 2
    return [middle - half, middle + half]
  }
  return [typedX ?? around(x, (per * innerW) / 2), typedY ?? around(y, (per * innerH * k) / 2)]
}

/** The share of the drawn span added on each side, with equal scales. */
const PAD = 0.08

/** The smallest and largest finite value; a single value is widened, so the axis has a length. */
function extent(values: readonly (number | null)[], log: boolean): [number, number] {
  let low = Infinity
  let high = -Infinity
  for (const v of values) {
    if (v === null || !Number.isFinite(v) || (log && v <= 0)) continue
    low = Math.min(low, v)
    high = Math.max(high, v)
  }
  if (low > high) return log ? [1, 10] : [0, 1]
  if (low === high) {
    if (log) return [low / 10, low * 10]
    const half = low === 0 ? 1 : Math.abs(low) / 2
    return [low - half, low + half]
  }
  return [low, high]
}

function sorted([a, b]: readonly [number, number]): [number, number] {
  return a <= b ? [a, b] : [b, a]
}

/** A series' value at x, between its two neighbouring points; null outside it or across a gap. */
export function interpolate(xs: readonly (number | null)[], ys: readonly (number | null)[], x: number): number | null {
  for (let i = 0; i + 1 < xs.length; i++) {
    const ax = xs[i]
    const bx = xs[i + 1]
    const ay = ys[i]
    const by = ys[i + 1]
    if (ax === null || bx === null || ay === null || by === null) continue
    if (x < Math.min(ax, bx) || x > Math.max(ax, bx)) continue
    return ax === bx ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax)
  }
  return null
}

/*
 * The ticks and their text as Observable Plot makes them, through D3: `ticks`,
 * `nice` and the `,f` tick format (d3-array 3 and d3-scale 4), restated here so
 * the margins can be sized for the very texts Plot draws.
 */
const E10 = Math.sqrt(50)
const E5 = Math.sqrt(10)
const E2 = Math.sqrt(2)

function tickSpec(start: number, stop: number, count: number): [number, number, number] {
  const step = (stop - start) / Math.max(0, count)
  const power = Math.floor(Math.log10(step))
  const error = step / 10 ** power
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1
  let i1: number
  let i2: number
  let inc: number
  if (power < 0) {
    inc = 10 ** -power / factor
    i1 = Math.round(start * inc)
    i2 = Math.round(stop * inc)
    if (i1 / inc < start) ++i1
    if (i2 / inc > stop) --i2
    inc = -inc
  } else {
    inc = 10 ** power * factor
    i1 = Math.round(start / inc)
    i2 = Math.round(stop / inc)
    if (i1 * inc < start) ++i1
    if (i2 * inc > stop) --i2
  }
  if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start, stop, count * 2)
  return [i1, i2, inc]
}

/** D3's round ticks between `start` and `stop` (start below stop). */
export function ticks(start: number, stop: number, count: number): number[] {
  if (!(count > 0)) return []
  if (start === stop) return [start]
  const [i1, i2, inc] = tickSpec(start, stop, count)
  if (!(i2 >= i1)) return []
  return Array.from({ length: i2 - i1 + 1 }, (_, i) => (inc < 0 ? (i1 + i) / -inc : (i1 + i) * inc))
}

function tickIncrement(start: number, stop: number, count: number): number {
  return tickSpec(start, stop, count)[2]
}

/** D3's `nice`, as Plot calls it (`nice: true`, 10 ticks). */
export function nice([start, stop]: [number, number], count = 10): [number, number] {
  let prestep: number | undefined
  for (let i = 0; i < 10; i++) {
    const step = tickIncrement(start, stop, count)
    if (step === prestep) break
    if (step > 0) {
      start = Math.floor(start / step) * step
      stop = Math.ceil(stop / step) * step
    } else if (step < 0) {
      start = Math.ceil(start * step) / step
      stop = Math.floor(stop * step) / step
    } else break
    prestep = step
  }
  return [start, stop]
}

/** D3's linear tick format: `,f` to the ticks' step, with a true minus sign. */
export function tickFormat(start: number, stop: number, count: number): (n: number) => string {
  const inc = tickIncrement(start, stop, count)
  const step = inc < 0 ? 1 / -inc : inc
  const exponent = Number.isFinite(step) && step > 0 ? Number(step.toExponential().split('e')[1]) : 0
  const precision = Math.max(0, -exponent)
  return (n: number) => {
    const text = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision })
    return n < 0 && /[1-9]/.test(text) ? `−${text}` : text
  }
}

function plainNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumSignificantDigits: 12 }).replace(/^-/, '−')
}

/**
 * A text's width in px at the chart's size, from its characters: generous
 * per-character widths (Inter, Segoe UI and the system's sans), so a margin is
 * never too small for what it holds.
 */
export function textWidth(text: string, size = CHART_FONT): number {
  let em = 0
  for (const char of text) em += CHAR_EM[char] ?? (/[A-Z]/.test(char) ? 0.74 : /[a-z]/.test(char) ? 0.6 : 0.66)
  return em * size
}

const CHAR_EM: Record<string, number> = {
  ...Object.fromEntries([...'0123456789'].map((d) => [d, 0.64])),
  '.': 0.32,
  ',': 0.32,
  ' ': 0.3,
  '−': 0.84,
  '-': 0.42,
  '(': 0.38,
  ')': 0.38,
  '[': 0.38,
  ']': 0.38,
  '/': 0.4,
  i: 0.28,
  l: 0.28,
  j: 0.3,
  f: 0.38,
  t: 0.4,
  r: 0.42,
  m: 0.92,
  w: 0.84,
  M: 0.9,
  W: 1,
}

/**
 * Where a dot's label goes (section 10, M4e): right of the dot, or left of it
 * when the right has no room, and up or down only as far as keeps it inside
 * the frame. Returns the text's anchor and its offset from the dot, in px.
 */
export function placeLabel(
  at: { x: number; y: number },
  width: number,
  frame: { left: number; right: number; top: number; bottom: number },
): { textAnchor: 'start' | 'end'; dx: number; dy: number } {
  const gap = 8
  const roomRight = frame.right - (at.x + gap)
  const roomLeft = at.x - gap - frame.left
  const right = roomRight >= width || roomRight >= roomLeft
  let dx = right ? gap : -gap
  // Neither side has room: slide it along so it stays inside.
  if (right && roomRight < width) dx -= Math.min(width - roomRight, at.x + gap - frame.left)
  if (!right && roomLeft < width) dx += Math.min(width - roomLeft, frame.right - (at.x - gap))
  const halfHeight = CHART_FONT * 0.7
  const y = Math.min(Math.max(at.y, frame.top + halfHeight), frame.bottom - halfHeight)
  return { textAnchor: right ? 'start' : 'end', dx, dy: y - at.y }
}

/** A mark's label, centred on its guide, slid along so it stays inside the chart. */
export function centredShift(x: number, width: number, chartWidth: number): number {
  const half = width / 2 + EDGE
  if (x - half < 0) return half - x
  if (x + half > chartWidth) return chartWidth - half - x
  return 0
}

/** A value's position in px, for a linear or log axis. */
export function scaleOf(domain: [number, number], range: [number, number], log: boolean): (v: number) => number {
  const f = log ? Math.log10 : (v: number) => v
  const [d0, d1] = [f(domain[0]), f(domain[1])]
  return (v: number) => range[0] + ((f(v) - d0) / (d1 - d0 || 1)) * (range[1] - range[0])
}
