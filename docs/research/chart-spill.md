Research for wayfinder ticket #176, 2026-11-15.

# Why does a chart spill out of its math element, and what sizes the element around it?

Our code is at commit `0ed83eb` (0.2.0 plus the crash hotfix). "Observed" means seen in a probe that drove
the real app in the session's headless Chromium at 1366 × 768 unless a size is given: the built
plugin (`dist-plugin/main.js`, rebuilt, against the repo's fake `obsidian`) and the web app
(`npx vite`). The probes and their screenshots are in [`chart-spill/`](chart-spill/). The sheet is
the map's true-position sheet. Nothing was run inside Obsidian, Firefox or Safari; see
"Not verified".

## Answer

**The chart doesn't outgrow its element. The whole overlay, every math element with its chart,
slides away from the canvas underneath, so the math is drawn up to hundreds of pixels from the
box it belongs to. It happens while typing a long line and after Enter on a line near the bottom
of the window, and the vertical shift stays after the edit ends. Typing the true-position plot
line does both.**

- **Cause.** `.app-shell__overlay`, the layer that holds the math, is `overflow: hidden`
  (`src/shell/AppShell.css`). A hidden-overflow box can still be scrolled by the browser, and the
  browser scrolls it to bring the focused source field and its caret into view. Nothing in our
  code scrolls it back: `scrollLeft`, `scrollTop`, `scrollIntoView` and `preventScroll` appear
  nowhere in `src/overlay` or `src/canvas` (grep). Excalidraw's canvas, which draws the anchor's
  border, the selection and every drawing, doesn't move with it.
- **Proof.** With one rule injected, `.app-shell__overlay { overflow: clip }`, the same keystrokes
  leave the overlay where it was at every step (observed,
  [`probe-clip-and-ink.mjs.txt`](chart-spill/probe-clip-and-ink.mjs.txt)).
- **At rest there is no spill.** Opened and left alone, the element's box is exactly its content
  at every size, zoom and theme tried, and the chart sits inside it.
- **A second, small spill is real:** the chart's own text can run past the chart, and so past the
  element, by a few pixels to about 40. It doesn't happen on the true-position sheet as written.

| Part | What it is | Defect or decision |
| --- | --- | --- |
| The overlay scrolls away from the canvas | Browser scroll of an `overflow: hidden` layer | **Defect**, to fix as a bug |
| After the fix, an open line can sit outside the window | The browser's scroll was the only thing keeping the caret in view | **Decision**, small: the view follows the open line. Not the graph ticket's; see "What the fix exposes" |
| Tick numbers and a mark's label run past the chart | Fixed margins, `overflow: visible` on the SVG | **Defect**, small |
| A chart sets the element's least width, and ignores a chosen width | `size L` is 640 px whatever the element | **Decision**, graph ticket |
| The y axis title repeats the legend in plain text | Automatic axis titles (spec section 10) | **Decision**, graph ticket |
| The Format tab's sample draws the full chart in a 353 px box | The sample draws the line as the sheet does | **Decision**, sample ticket |

## Reproduction

The sheet is the map's true-position sheet with a short last line, `plot(zone_x, zone(theta))`.
Window 1366 × 768, zoom 100%, the Sheet panel as it opens.

1. Double-click the last line. Select all, and type the map's plot line (146 characters).
2. Press Enter.
3. Press Esc.

Observed, the same numbers in the plugin and the web app
([`probe-open-line.mjs.txt`](chart-spill/probe-open-line.mjs.txt),
[`probe-web.mjs.txt`](chart-spill/probe-web.mjs.txt)):

| Step | Overlay `scrollLeft`, `scrollTop` | The element's content, left and top | Where its box is drawn |
| --- | --- | --- | --- |
| At rest | 0, 0 | 603, 354 | 603, 354 |
| 1, the line typed | **671**, 2 | −68, 352 | 603, 354 |
| 2, Enter | 0, **453** | 603, −99 | 603, 354 |
| 3, Esc | 0, **453** | 603, −99 | 603, 354 |
| Then select the element, or wheel the canvas 100 px | 0, 453, then 353 | 603, −99 | moves with the canvas |

- **Step 1.** The field is 1408 px wide, wider than the window. The browser scrolls the overlay
  671 px left to show the caret, and every line above slides left with it, out of the element's
  box ([screenshot](chart-spill/plugin-while-typing.png)). Double-clicking the full plot line of a
  finished sheet does the same at once, by 979 px.
- **Step 2.** Enter opens an empty line under the chart, below the window's bottom edge. The
  browser scrolls the overlay 453 px up to show it. The horizontal scroll goes back to 0 only
  because the content is narrow again.
- **Step 3.** The 453 px stay. The chart is drawn over the top of the box, the lines of the sheet
  above it, and the box's lower half is empty
  ([plugin](chart-spill/plugin-after-enter-escape.png), [web](chart-spill/web-after-enter-escape.png)).
  This is what "spilled out of its box" looks like.
- **It doesn't heal.** Selecting, and panning with the wheel, leave it. The shift only shrinks
  when the content's bottom edge rises past the window's (the browser clamps the scroll). What
  does clear it (a reload, a zoom) was not tested.

Compare the element at rest, selected so that Excalidraw draws the anchor's border
([screenshot](chart-spill/rest-selected.png)): content and box agree.

Whether this is exactly what Matheus saw is **unverified**: his report has no screenshot. It
matches his words, his sheet and what he was doing (typing the lines of this sheet), and nothing
else tried moves a chart off its box.

## What sizes the element

- **The box is the content's size.** The content (`.math-element__body`) is `width: max-content`
  (`src/overlay/MathOverlay.css`). `useAnchorSizes` (`src/overlay/useAnchorSizes.ts`) reads its
  `offsetWidth` and `offsetHeight` after each render and whenever a `ResizeObserver` reports a
  change, and writes them to the anchor when they differ (`fitsContent`, `writeAnchorSizes` in
  `src/canvas/anchorSize.ts`). These ignore transforms, so the size is in scene units at any zoom.
- **A chart is a fixed-size block in its row.** `PlotChart` (`src/overlay/PlotChart.tsx`) gives
  the chart and its host an inline width and height from the size clause: S 360 × 220, M 480 × 280,
  L 640 × 360 (`src/math/plotLine.ts`). The title and the legend are HTML above it and add to the
  height: 43 px here, so the block is 640 × 403. The cell spans from the equation column to the
  right edge (`.math-element__plot-cell`, `grid-column: 2 / -1`).
- **So the chart sets a least width.** Observed, at rest
  ([`probe-rest.mjs.txt`](chart-spill/probe-rest.mjs.txt)):

  | Sheet | Element width | Chart | Chart's right edge to the element's |
  | --- | --- | --- | --- |
  | `size L` | 682 | 640 | 14 (the padding) |
  | `size M` | 636 | 480 | 128 |
  | `size S` | 636 | 360 | 248 |
  | `size L`, chosen width 400 | 682 | 640 | 14 |
  | `size L`, chosen width 50 | 682 | 640 | 14 |

  Without the chart the lines need 636 px, the `check` line's piecewise being the widest. With
  `size L` the chart is the widest thing. A chosen width below the floor gives the floor
  (`floorOf`, spec section 4, Chosen width), and the chart is part of the floor, so **a chosen
  width never narrows a chart and a chart never scales**.
- **While its own line is open, the chart is not drawn** in the element (the content is 428 px
  tall against 843 at rest), and the Format tab's sample draws it instead.
- **The open field widens the element.** The 146-character plot line makes the content 1742 px
  wide while it is open, and the result column moves right with it, off the window.
- **No difference** at zoom 40% and 243%, or in the dark theme: same sizes, no text outside the
  chart (observed). A neighbour element 38 px to the right of the box is not touched at rest.

## The chart's own text

The SVG is drawn with `overflow: visible` (`drawChart` in `src/overlay/plotDrawing.ts`, and
`.math-element__plot-chart svg`), with Observable Plot's default left margin (40 px), a right
margin of 20 px (72 with `labels direct`) and a top margin of 28 with a mark. Text that needs more
than its margin is drawn outside the chart's box. Observed
([`probe-clip-and-ink.mjs.txt`](chart-spill/probe-clip-and-ink.mjs.txt)):

| Chart | Text | Past the chart | Past the element |
| --- | --- | --- | --- |
| The true-position sheet, at L, M and S, with and without `labels direct` | none | 0 | 0 |
| `mark 2.2 r_t`, 12 px from the right edge | `2.2 r_t = 0.275 mm` | 16.7 px right | 2.7 px right |
| `mark -2.25 r_t`, at the left edge | `-2.25 r_t = -0.2813 mm` | 12.9 px left | 0 |
| y values near 120,000,000, `size S` | the tick numbers | 38.6 px left | 10.6 px left |

- A mark's label is centred on its guide, so it leaves the chart whenever the guide is nearer an
  edge than half the label ([screenshot](chart-spill/mark-at-edge.png)).
- Tick numbers wider than 40 px run over the element's left edge
  ([screenshot](chart-spill/big-numbers.png)).
- Spec section 4, Size, says the box always fits its content and counts charts toward the width,
  so both are defects, and the text is not measured because it is outside the chart's box.
- The y axis title lists every series as plain text (`↑ zone(theta), measured(theta) [mm]`) under
  a typeset legend that says the same ([screenshot](chart-spill/rest-zoomed-out.png)). It fits at
  640 px here. It was not pushed until it didn't.

## The Format tab's sample

With the plot line open the sample draws the element's line at sheet size, chart included: 682 px
of content in a box 353 px wide and 465 px tall, scrolling sideways, in a panel 376 px wide
(observed, 1400 × 1000, [screenshot](chart-spill/sample-plot-line-open.png)). About half the chart
shows. This is the "graph in the preview line is too big" of Matheus's fifth item, and is the
sample ticket's.

## What the fix exposes

`overflow: clip` stops the scroll, and then nothing brings an open line into view. With it, after
Enter the new line's field sat at y 1185 to 1209 in a 768 px window: typed text can't be seen
([screenshot](chart-spill/clip-after-enter.png)). While typing the plot line the field's right end
was at x 2039 in a 1366 px window.

- Today's spec has the view scroll an open line clear of the panel, "as a jump does" (section 8,
  Sheet panel), and nothing for a line below or beside the window. The browser's scroll was doing
  that job, wrongly.
- So the bug needs a rule: when an open line or its caret leaves the window, the canvas scrolls,
  as a jump does, and the overlay never scrolls by itself. Downwards this is one sentence. Sideways
  it meets the format ticket: a field wider than the window can't show both its ends, which a
  wrapping field would settle (see
  [`line-format-outside-text.md`](line-format-outside-text.md)).
- Other ways to stop the scroll (`focus({ preventScroll: true })`, resetting on a `scroll` event)
  were not tried. Typing moved the overlay as well as focus did, so `preventScroll` alone would
  not be enough (inferred from step 1, where the scroll grew as the line was typed).

## Seen on the way

- A sheet opened in a 1500 px window with the panel docked shows its element centred in the whole
  window, its right 230 px under the panel ([screenshot](chart-spill/rest-selected.png)). For the
  panel ticket.
- The probe could not set zoom or theme through the file's `appState`; it used ctrl+wheel and
  Alt+Shift+D.

## Not verified

- **Inside Obsidian, Firefox, Safari.** Obsidian is Chromium, as the probe is, so the same scroll
  is expected there; not run.
- **That this is what Matheus saw.** See Reproduction.
- **Why a hidden-overflow box scrolls.** That `overflow: hidden` leaves a box scrollable by script
  and by the browser's own scroll-into-view, and that `overflow: clip` doesn't, is the
  [CSS Overflow specification](https://drafts.csswg.org/css-overflow-3/#overflow-control)'s; it was
  not re-read this session. The observation above stands without it.
- **How much text a chart can push out** beyond the cases in the table.
