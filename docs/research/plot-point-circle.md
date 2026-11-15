Research for wayfinder ticket #177, 2026-11-15.

# How do Mathcad and its peers, and Observable Plot, draw a labelled point, a circle and equal axis scales?

Our code is at commit `c8be844` (0.2.0 plus the crash hotfix). "Observed" means seen in a probe run
in this session: [`plot-point-circle/probe-plot.mjs.txt`](plot-point-circle/probe-plot.mjs.txt)
draws twelve charts with the Observable Plot the app bundles (0.6.17, its UMD build, in headless
Chromium), with the picture in [`variants.png`](plot-point-circle/variants.png) and the numbers in
[`report.json`](plot-point-circle/report.json); the engine was run through `evaluateSheet` in a
throwaway vitest file. The numbers are the map's true-position sheet: `dx = 0.08 mm`,
`dy = -0.05 mm`, `r_t = 0.125 mm`.

**The peers' documentation could not be opened.** The session's network refused every vendor host
(PTC, smath.com, calcpad.eu, help.desmos.com, support.microsoft.com, mathworks.com). What is said
about them below comes from search excerpts of the linked official pages, marked **[excerpt]**, or
from forums, marked **[forum]**. Neither is a direct read; see "Not verified".

## Answer

**Nothing new has to be bundled, and none of the peers has a form worth copying whole. Observable
Plot already draws all three things; what is missing is a way to write them on a plot line.**

- **A labelled point** is a `dot` mark plus a `text` mark (or a `tip` mark). Both are in the bundle
  and `dot` and `text` are already used by `drawChart`. Today the engine refuses a single point:
  `plot(dx, dy)` gives `x must be a list: dx is a single value` (observed).
- **A circle** is either a line through computed points, which works today, or one SVG ellipse
  placed with the chart's scales (a "function mark"), which needs no list. A `dot` mark can't be the
  circle: its radius is pixels, not data (observed, chart G).
- **Equal scales** are ours to compute. Plot's `aspectRatio` option only sets the height when no
  height is given, and we always give one, so it is ignored (observed, chart B: the circle is 1.87
  times as wide as tall). Widening the shorter axis' range to match the chart's inner width and
  height keeps the circle round at every size tried (charts D, E1 to E3, F, J: ratio 1.000).
- **Today's sheet needs two helper lines, not six.** `plot` takes expressions as arguments:
  `plot(r_t cos(theta) in mm, r_t sin(theta) in mm)` draws the circle from `r_t` and `theta` alone
  (observed). `zone_x`, `zone(a)` and `measured(a)` exist only to fake the point with a flat series
  and a `mark`, which is where the crossing lines Matheus dislikes come from.
- **Among the peers, only Desmos shows a point's coordinates by itself, and only matplotlib and
  MATLAB have a circle and equal scales as one word each.** Mathcad Prime, SMath Studio, Calcpad and
  Excel all draw the circle as cos and sin of an angle, and none of the four has an equal-scales
  setting that was found.

## The peers

| Tool | A point with its coordinates | A circle | Equal scales |
| --- | --- | --- | --- |
| Mathcad Prime | A trace with a symbol and line style "(none)". No label at a point; the nearest is a vertical and a horizontal marker, each with a callout of one coordinate | `r·cos(θ)` against `r·sin(θ)` over a range variable | Not found in Prime; Mathcad 15 had an "Equal Scales" box |
| SMath Studio | A matrix row `x, y, "char", size, colour`; a label is another row whose third column is a string | A two-column matrix of computed points | Not found; the wheel zooms both axes together |
| Calcpad | A constant pair `x1\|y1` inside a multiple plot; no label | `$Plot{r*cos(t)\|r*sin(t) @ t = 0 : 2*π}` | Not found; only `PlotWidth` and `PlotHeight` |
| Desmos | `(a, b)` and the Label box, which shows the coordinates | `(r cos t, r sin t)` for t from 0 to 2π | The default view is square; a "Zoom Square" command |
| Excel | A one-row scatter series with data labels | A computed cos and sin series, "Scatter with smooth lines" | Not found; equal bounds and a square plot area by hand |
| matplotlib, MATLAB | `ax.annotate(text, xy)`, `text(x, y, txt)` | `patches.Circle(xy, radius)`, `viscircles(centers, radii)` | `ax.set_aspect('equal')`, `axis equal` |

**Mathcad Prime.**
- A point is a trace: on the Plots tab, set Symbol to a shape and Line Style to "(none)"
  **[excerpt]**, [To Customize a Trace](https://support.ptc.com/help/mathcad/r8.0/en/PTC_Mathcad_Help/to_customize_a_trace.html).
- Markers "include callouts for the x-coordinate or y-coordinate of the marker" **[excerpt]**,
  [About Markers and Callouts](https://support.ptc.com/help/mathcad/r9.0/en/PTC_Mathcad_Help/about_markers_and_callouts.html).
  A point is pinned by one vertical and one horizontal marker. That is the same picture as our
  `mark`, and what Matheus asked not to have. That Prime has no label at a point is an absence in
  the pages found, not a statement by PTC.
- A circle is a parametric plot over a range variable ending at 2π **[excerpt]**,
  [Example: Parametric Curves](https://support.ptc.com/help/mathcad/r10.0/en/PTC_Mathcad_Help/example_parametric_curves.html).
- Mathcad 15's "Equal Scales" gave each axis the same units per inch without resizing the plot, and
  Prime users are told to set equal limits and drag the plot square by eye **[forum]**,
  [Equal scales on Plot](https://community.ptc.com/t5/Mathcad/Equal-scales-on-Plot/td-p/393434),
  [lock plot aspect ratio](https://community.ptc.com/t5/Mathcad/lock-plot-aspect-ratio-Mathcad-prime/m-p/780044).

**SMath Studio.** A matrix of up to five columns, x, y, character or string, size in pixels and
colour, where "size and color columns are not required" **[excerpt]**,
[Plots](https://smath.com/wiki/Plots.ashx). The user writes the label's text. The axes can be
scaled one at a time with Ctrl or Shift and the wheel since 0.85 **[excerpt]**, same page; no
equal-scales setting was found.

**Calcpad.** `$Plot{x(t)|y(t) @ t = a : b}` is the parametric form and `&` joins several curves
**[excerpt]**, [Plotting](https://calcpad.eu/help/24/plotting). A constant pair draws a point
**[forum]**, [discussion 407](https://github.com/Proektsoftbg/Calcpad/discussions/407). The circle
line in the table is composed from the documented form, not quoted. `PlotWidth` and `PlotHeight`
default to 400 and 250 **[excerpt]**, same page.

**Desmos.** "Add a point to an expression line, then check Label. This will automatically display
coordinates of the point on the graph paper" **[excerpt]**,
[Labels](https://help.desmos.com/hc/en-us/articles/4405487300877-Labels). A parametric curve plots
"for t between 0 and 1" unless its domain is set **[excerpt]**,
[Parametric Equations](https://help.desmos.com/hc/en-us/articles/4406906208397-Parametric-Equations).
"Zoom Square" is documented for 3D graphs **[excerpt]**,
[3D Graph Settings](https://help.desmos.com/hc/en-us/articles/20301369699981-3D-Graph-Settings);
its 2D wording was not found on the help site.

**Excel.** Data labels are added from Chart Design, Add Chart Element **[excerpt]**,
[Add or remove data labels in a chart](https://support.microsoft.com/en-us/office/add-or-remove-data-labels-in-a-chart-884bf2f1-2e37-4265-8554-ba7b2fb5e9a5).
That the label options include "X Value" and "Y Value" is from Microsoft's Q&A site **[forum]**,
[How do I add a label to a datapoint](https://learn.microsoft.com/en-us/answers/questions/4828645/how-do-i-add-a-label-to-a-datapoint-in-an-excel-ch).
No Microsoft page describing a circle or equal scales was found.

**matplotlib and MATLAB**, as the programming reference.
- matplotlib, read from the docstrings of version 3.11.2: `Circle` creates "a true circle at center
  *xy* = (*x*, *y*) with given *radius*"
  ([patches.Circle](https://matplotlib.org/stable/api/_as_gen/matplotlib.patches.Circle.html)).
  Equal scales come two ways: `axis('equal')` works "by changing the axis limits" and
  `axis('scaled')` "by changing dimensions of the plot box"
  ([Axes.axis](https://matplotlib.org/stable/api/_as_gen/matplotlib.axes.Axes.axis.html)).
- MATLAB: `axis equal` uses "the same length for the data units along each axis" **[excerpt]**,
  [axis](https://www.mathworks.com/help/matlab/ref/axis.html).

matplotlib's two ways are the choice we face too: keep the chart's size and widen a range, or keep
the ranges and change the chart's shape.

## What Observable Plot 0.6.17 draws

All observed in the probe; the letters are the charts in `variants.png`.

| Need | How | Observed |
| --- | --- | --- |
| A dot at one point | `Plot.dot([{x, y}], {r: 4})` | D, E, F, J |
| Its coordinates beside it | `Plot.text` with `dx: 8, textAnchor: 'start'` | Reads well inside the chart. Where the label crosses the circle's line, a white halo (`stroke: 'white', strokeWidth: 4`) keeps it readable (J) |
| The label near an edge | `Plot.text` runs past the chart: 72 px with the point near the right edge (I), 11 px on a 360 × 360 chart with the real numbers (E2). `Plot.tip`, drawn always rather than on hover, is a boxed callout that picks its own side and stayed inside (H, 0 px) | The tip places itself a frame after it is attached, so a measurement taken at once reads wrong |
| A circle from a list | `Plot.line` through 181 points; `fill` with `fillOpacity` shades it | A, D, E, J |
| A circle with no list | A function mark, `(index, scales) => SVG ellipse`, with `rx = \|x(cx + r) − x(cx)\|` and `ry` likewise | F: round, shaded, and drawn in data units, so it would show as an ellipse if the scales weren't equal |
| A circle as a `dot` | No: `r` is pixels. `r: 0.125` is invisible, `r: 40` is 40 px whatever the axes | G |
| Equal scales, chart size kept | Our own `domain` on both axes: take the data's extent, pad it, then widen the shorter axis so data units per pixel match, using the chart's inner width and height | D, E1, E2, E3, F, J: ratio 1.000 at 640 × 360, 480 × 280, 360 × 220 and 360 × 360 |
| Equal scales, ranges kept | `aspectRatio: 1` with a width and no height: Plot derives the height (360 wide gave 350 tall) | C. With our fixed height it does nothing (B), as the source says: `aspectRatio` is read only in `autoHeight` (`node_modules/@observablehq/plot/src/dimensions.js`) |
| A frame and zero lines | `Plot.frame`, `Plot.ruleX([0])`, `Plot.ruleY([0])` | J |

**Bundle cost: none.** `loadPlot` imports the whole module (`import('@observablehq/plot')` in
`src/overlay/plotDrawing.ts`), so every mark is already inside: the web build's Plot chunk is
297,382 B (`dist/assets/src-CH2vdNE-.js`) and the plugin folds it into `main.js`. `dot`, `text`,
`tip`, `frame`, `ruleX` and `ruleY` are all functions on the loaded module (observed). The
equal-scales arithmetic and the ellipse are a few lines of ours.

**The margins must be ours for equal scales.** The arithmetic needs the chart's inner size, so the
margins have to be the numbers we pass. `drawChart` passes the top and right ones today and leaves
the bottom and left to Plot's defaults (30 and 40).

## What the engine accepts today

Observed through `evaluateSheet`:

- `plot(r_t cos(theta) in mm, r_t sin(theta) in mm), size L` draws the circle. Its axis titles are
  the expressions: `r_t cos(theta) [mm]` and `r_t sin(theta) [mm]`.
- `plot(dx, dy), points` is an error: `x must be a list: dx is a single value`.
- A clause's text is split at commas outside brackets (`splitClauses` in `src/math/plotLine.ts`), so
  a clause may hold a bracketed pair such as `(dx, dy)` without a change to the splitting.

## Options, smallest first

Each is written for the true-position sheet. The words (`point`, `equal`, `circle`) are
placeholders for the graph ticket to choose. In every option the legend, colours and sizes stay as
spec section 10 has them.

**1. Two clauses on `plot`: a point, and equal scales.**

```text
theta = 0 .. 2 pi step pi / 90
plot(r_t cos(theta) in mm, r_t sin(theta) in mm), point (dx, dy), equal, title "True position"
```

- **Chart:** D, or J with a frame and shading. The dot has `(0.08, −0.05) mm` beside it, with
  Digits as a mark's value has today.
- **Helper lines:** two (`r_t`, `theta`), down from six.
- **Cost:** two clause kinds, one value pair in `PlotView`, the equal-scales arithmetic, two rows in
  the ⚙ popover.
- **Leaves:** the axis titles read as the two expressions, and the reader still writes the circle
  as cos and sin, as in Mathcad, SMath, Calcpad and Excel.

**2. Option 1 plus a circle clause.**

```text
plot(r_t cos(theta) in mm, r_t sin(theta) in mm), point (dx, dy), equal
```

becomes

```text
plot(dx, dy), circle r_t, equal, title "True position"
```

- **Chart:** F. The circle is one ellipse, centred on the origin unless a centre is given
  (`circle (x0, y0) r_t`).
- **Helper lines:** none. `r_t` can be `T_p / 2` in the clause.
- **Cost:** option 1's, plus the function mark, and a rule change: `plot(x, y)` with two single
  values would be a point, where today it is the error above. Then `point` isn't needed as a clause
  for this sheet, only for a point on top of curves.
- **Leaves:** axis titles are `dx [mm]` and `dy [mm]` for free, from the arguments. A circle only
  looks right with `equal`, so the clause could imply it.

**3. A form of its own.**

```text
target(dx, dy), zone T_p, title "True position"
```

- **Chart:** J, always: equal scales, zero lines, a shaded zone of diameter `T_p`, the point and its
  label, titles from the arguments. No clause to remember.
- **Helper lines:** none; `r_t` and `theta` leave the sheet.
- **Cost:** a new line form through the parser, the engine, the typesetting, the Math guide and the
  messages, for one kind of chart. Nothing in it helps a point on a pump curve.
- **Leaves:** `plot` unchanged, and a second word for charts in the language.

Options 1 and 2 keep `plot(x, y1, …)` and every clause working as they are. Option 3 does too, by
not touching them.

## Spec items this would reopen

Spec section 1 lists under "not in v1", for plots: "A second y axis; zoom, pan or hover values on
curves; renamed axis titles; chosen colours".

| Item | Reopened? | Why |
| --- | --- | --- |
| Renamed axis titles | **Yes, under option 1 only** | The titles would read `r_t cos(theta) [mm]` and `r_t sin(theta) [mm]`. Options 2 and 3 name the axes from `dx` and `dy` and don't need it |
| Chosen colours | **Only if the point should be green inside the zone and red outside** | The fixed colour order is enough for a zone and a point. A pass or fail colour is nearer a line rule (`@text-green if …`) on the plot line than a colour picker, and is a new question either way |
| Hover values | No | The label is always drawn. A `tip` used as a label is drawn always too, not on hover |
| A second y axis; zoom and pan | No | Not touched |

Two rules of section 10 change rather than reopen: "x must be a list" (option 2) and "at least one y
is required" stays true in all three.

## Not verified

- **Every peer claim marked [excerpt] or [forum].** The pages were not opened; the wording is what a
  search returned for the linked page. To check them, the hosts need allowing in the environment's
  network settings, or a read from a browser.
- **Absences.** That Mathcad Prime has no label at a point, and that Prime, SMath Studio, Calcpad
  and Excel have no equal-scales setting, rest on nothing being found, and for Prime on forum
  threads. Mathcad Prime's Chart Component and SMath's X-Y Plot plugin were not looked at.
- **Desmos' label syntax for a value** (`${a}`) and its 2D "Zoom Square" wording.
- **The probe is Plot alone, not the app.** The charts were drawn outside `PlotChart.tsx`, without
  the app's fonts, the typeset legend, dark theme or the ⚙ popover, in Chromium only. Nothing was
  run in Obsidian, Firefox or Safari.
- **Print.** How a `tip`'s box or a shaded zone prints was not tried.
