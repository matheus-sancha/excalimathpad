Research for wayfinder ticket #34, 2026-11-03.

# Does the print view come out right as a real Chromium PDF?

Tested on Chrome 156.0.8078.80 on Windows 11, with `@excalidraw/excalidraw` 0.18.1, KaTeX 0.19.1 and
`@observablehq/plot` 0.6.18. "Observed" means read back from a generated PDF. Chromium source links
are pinned to commit [`6f2e3f4`](https://github.com/chromium/chromium/tree/6f2e3f4e3eb7213176778480af439da26bac26e6).
[How the probe worked](#how-the-probe-worked) describes the setup, and [Not covered](#not-covered) lists the gaps.

## Answer

**Yes, the print view from
[How does print / PDF turn the canvas into pages?](https://github.com/matheus-sancha/excalimathpad/issues/21)
comes out right, with exact placement and everything in vector, but only with a specific page recipe.** Each
of the first three parts below fails silently without it: rows or math vanish from the PDF with no error.

| Question | Result (observed) |
|---|---|
| Does `@page { size; margin: 0 }` fix the paper? | Yes. A4 and Letter, both orientations, came out at the set size. A remembered landscape setting in the dialog didn't override it. |
| Does it remove the browser's header and footer? | Yes, with Headers and footers on. The control with a 15 mm `@page` margin printed the URL on every page. |
| Is the math crisp and aligned at a shrink scale? | Yes, with `transform`, down to the lowest scale tried (0.40). No rasterized images in any PDF, and `≔` lined up to 0.000 pt within an element. |
| Are measured heights still right at that scale? | With `transform`, exactly: 0.000 pt row spread at every scale. With `zoom`, no: up to 8.65 pt. |
| Any cut rows at page edges? | None, and no blank pages over 240 rows. This needs containment (below). |
| What must be ready before `window.print()`? | The SVG export, Plot, and **every font the print view uses**. |
| What about the browser's own Print command? | With nothing prepared, a blank page. Building synchronously in `beforeprint` from cached parts works. |

## The recipe

```css
@page { size: 210mm 297mm; margin: 0 } /* written from the sheet's Page setting */

@media print {
  .app-root { display: none }
  .print-root { display: block }
}

.print-page {
  position: relative;
  width: 210mm;
  height: 100vh;       /* not 297mm: survives a remembered "Margins: Minimum" */
  contain: strict;     /* without this, rows vanish */
  break-after: page;
}
.print-page:last-of-type { break-after: auto }
.print-frame { position: absolute; overflow: hidden } /* the 15 mm margins, app-drawn */
.print-slice { transform-origin: 0 0 } /* transform: scale(s) translateY(-y0px) */
.print-footer { color: #888; print-color-adjust: exact }
```

Boxes outside a page's slice get `visibility: hidden`, so their text stays out of the PDF. Measure with
`getBoundingClientRect` on an unscaled copy, then multiply by the scale. The `offsetTop` and `offsetHeight`
suggested for hit-testing in the [gesture note](excalidraw-gestures.md) are whole pixels, which would add up over a long table.

The parts were tested together except the footer's `exact`, which was tested on its own with the `297mm` pages.

## Why each part of the recipe is there

### `contain: strict` on each page

Without it, **table rows disappear from the PDF**. At scale 0.76, a transform-scaled sheet printed 3 of 30 rows
and 431 characters on page 1. With containment it printed all 30 rows and 1,054 characters (observed).

The likely cause is that pages are fragmented on layout boxes, before transforms apply. A slice is taller in layout
than a page, so its lower part goes to the next page's area, where the frame clips it. That cause is inferred
from these results and not read from Blink's source. The fix follows the spec:
["Size containment boxes are monolithic"](https://www.w3.org/TR/css-contain-2/#containment-size), so a contained
page is never fragmented. Removing `overflow: hidden` isn't a fix either: at scale 0.40 the sheet then spread over 3
pages instead of 1, with all 30 rows on the wrong page (observed).

### `transform`, not `zoom`

Both give vector output. Only `transform` keeps the measurements true, because layout doesn't change.

| Scale | `transform`: row spread against prediction | `zoom`: row spread against prediction |
|---|---|---|
| 0.76 | 0.000 pt | 4.857 pt |
| 0.57 | 0.000 pt | 8.652 pt |
| 0.40 | 0.000 pt | 2.198 pt |

Spread is the largest minus the smallest difference between a row's position in the PDF and the position
predicted from the unscaled measurement, over 30 rows. With `zoom`, a page break computed from measurements can land
on a row. `transform` also had 0.000 pt at 1.00 and 0.78, and the result didn't change at a device scale factor
of 1.5. The first `≔` sat 0.23 pt (under 0.1 mm) right of its prediction at scales 0.78, 0.76 and 0.57, and 0.00 pt at 1.00.
Everything in a run shifts together, so alignment isn't affected. The cause wasn't looked into.

### `visibility: hidden` outside the slice

The frame's clip is visual only. Without hiding, rows clipped off a page stayed in the PDF's text, so one row
came up on two pages in text extraction: row 28 with `transform` and rows 16 to 28 with `zoom` (observed). That would
pollute search and copy in the PDF. With hiding there were no duplicates.

### `height: 100vh`, not `297mm`

The two are identical under the default margins. They differ if the user's dialog remembers **Margins: Minimum**:
`297mm` then gave 4 pages with every second one blank, and `100vh` gave the right 2 pages, with content about 14 pt
lower and nothing cut (observed). `100vh` also matched the predicted page count in all four paper and orientation
combinations with 240 rows, with no blank pages and all rows present (observed). No URL printed under Minimum either,
although Chromium's [availability check](https://github.com/chromium/chromium/blob/6f2e3f4e3eb7213176778480af439da26bac26e6/chrome/browser/resources/print_preview/data/model.ts#L793-L820)
offers the header option whenever margins are Minimum. The same check explains the main case: with default
margins it makes the option unavailable when the document's top and bottom margins are both 0.

Margins: None changed nothing (observed).

### `print-color-adjust: exact` on the grey footer

Background graphics is off by default in the dialog, and then Chromium **darkens light text**: the footer's `#888888`
came out `#343434` (observed). With `print-color-adjust: exact` it stayed `#888888`, even with Background graphics off
(observed). The spec lets the browser do this: under
[`economy`](https://www.w3.org/TR/css-color-adjust-1/#print-color-adjust), the initial value, it may adjust styling
"as it deems necessary and prudent for the output device". The error red `#c92a2a` was unchanged either way.

Nothing else was lost with Background graphics off: KaTeX fraction bars, `\sqrt` signs, the table's header rule, Plot's
legend swatches and Excalidraw's fills all printed (observed in the page images). Anything the app draws with a CSS
background does need `exact`.

## What must be ready, and when

**Fonts are the dangerous one.** Calling `window.print()` straight after building, before any KaTeX font had loaded, left
the page with **no math at all**: no error, and no KaTeX font in the PDF, just the `≔` signs, bars and row labels (observed;
227 characters on page 1 against 1,039 in the good run). This hit every KaTeX font, including those with no added delay,
because `window.print()` blocks the page before they can arrive. KaTeX's CSS sets `font-display: block`, and in that period the
[spec](https://www.w3.org/TR/css-fonts-4/#font-display-desc) has an element render with an invisible fallback font.

Laying out a hidden copy with `visibility: hidden` and awaiting `document.fonts.ready` before printing fixed this, even with three
math fonts delayed by 2.5 s (observed). Whether a `display: none` copy would also request the fonts wasn't tried.

So the order for Print… (Ctrl+P) is:

```ts
const parts = await Promise.all([exportDrawings(), loadPlot()]) // both async
const pages = buildPrintPages(parts)   // lays out, so it requests the fonts
await document.fonts.ready
window.print()
```

Timings over 30 probe page loads, on the Vite dev server: `exportToSvg` 156 to 313 ms, importing Plot 59 to 98 ms, fonts ready 56 to
88 ms. That is short enough for Ctrl+P to await with no progress indicator. A real sheet with a large drawing may take
longer: **unverified**.

`window.print()` needs no user gesture here: it ran from a timer after those awaits (observed).

## Printing from the browser's own menu

The [spec](https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#printing) runs the same printing steps
whenever the user asks for a printed copy, so `beforeprint` fires either way. What differs is whether the page keeps running.

Marks added to the print view at different moments after `beforeprint` show which work reached the PDF (observed):

| Added | `window.print()` | Browser's Print command |
|---|---|---|
| Synchronously in `beforeprint` | In the PDF | In the PDF |
| Microtask, `setTimeout(0)`, `requestAnimationFrame` | Not in the PDF (ran after `afterprint`) | In the PDF |
| After `await exportToSvg(...)` | Not in the PDF | In the PDF |
| `setTimeout(300)` | Not in the PDF | **Varies**: in one run of three |
| `setTimeout(3000)` | Not in the PDF | Not in the PDF |

So `window.print()` blocks the page until the dialog closes, and only synchronous work counts. The menu route leaves the
page running with no deadline, so async work there is a race and must not be relied on. A font that hadn't arrived in
time was also dropped on this route: the slow-font run had no Caligraphic, Fraktur or Script font in the PDF, and the fast
run had all three (observed).

If the app prepares nothing, the menu route gives **one blank page** (observed), because the app is hidden in print and the
print root is empty.

**Recommendation for the menu route:**

1. Keep the async parts cached rather than waiting for print. The drawing's SVG is refreshed on idle after a scene change.
   Plots and math are already rendered in the overlay, so they can be cloned synchronously.
2. In `beforeprint`, build the print pages synchronously from that cache. This worked and produced the same layout as the
   Ctrl+P route, with 0.000 pt row spread (observed).
3. Load the KaTeX fonts ahead of printing, so a font first used by off-screen math is already there. Math the print view shows
   but the screen didn't (scrolled away) could otherwise be missing. Loading all of them or only those a sheet uses is a build
   choice; the cost of each wasn't measured.
4. As a last resort, a print-only line saying "Use Print… from the app's menu" beats a blank page if the cache is empty.

A menu print within the idle delay after a drawing edit could print a slightly old drawing. Reaching a menu takes longer than
the delay, so this was judged acceptable, and it wasn't tested.

## Small things worth keeping

- **The PDF's default file name is `document.title`.** With the title `pump-sizing`, Save as PDF named the file
  `pump-sizing.pdf` and set the same PDF title (observed). The app should keep the title set to the sheet's name.
- **Opacity stays vector.** `opacity: 0.5` on a math element added no images to the PDF (observed), which suits
  [What should a selected math element show](https://github.com/matheus-sancha/excalimathpad/issues/32).
- **Fonts are embedded.** Excalifont and the KaTeX fonts are all in the PDF (observed). In the probe, `≔` came from Cambria
  Math, a Windows system font, because the probe set it as plain text. KaTeX's own `\coloneqq` avoids depending on that, and
  [the typesetting note](mathjs-katex-typesetting.md) covers how lines are typeset.
- **`html, body { overflow: hidden; height: 100% }` doesn't truncate the print.** Leaving the app's `src/index.css` rules
  active gave the same 2 pages (observed), so no reset is needed in Chromium.
- **Excalidraw's own print rules** only hide its UI (`.layer-ui__wrapper` and similar) in its `index.css`, so they don't get
  in the way once the app root is hidden.

## Not covered

- **A person at the dialog.** Runs went through print preview's code with settings accepted automatically, not a dialog open
  for a while. Whether DOM changes made while the dialog stays open reach the PDF on the menu route is **unverified**. The
  recommendation doesn't depend on it.
- **A hand-set Scale in the dialog.** A remembered 50% had no effect on the output, which may mean the setting wasn't applied
  in this mode, so this is **unverified**.
- **Other browsers and systems.** Chrome on Windows only. Edge, Firefox, Safari and other systems are **unverified**.
- **Real printers.** Save as PDF only.
- **The app's real views.** The sheet was a stand-in with real KaTeX, Plot and `exportToSvg` output, not the overlay code.
- **Parts of the break rules.** Staggered side-by-side elements, the no-clean-gap fallback, and a drawing taller than a page
  weren't built. Breaks here were one line across the page, moved up to clean gaps.
- **Dark mode** and images inside drawings.
- **KaTeX version.** The probe used 0.19.1, while the repo currently resolves 0.16.47 through a transitive dependency. No
  difference is expected in font loading: **unverified**.
- **Taking over Ctrl+P.** The probe didn't press real keys. `preventDefault` on `keydown` is assumed to stop the browser's
  print: **unverified**.

## How the probe worked

A throwaway Vite page in a scratch clone at `main` (`9fb99c9`), not committed. It mounted the real Excalidraw component and
built a sheet from `exportToSvg`, KaTeX lines in a grid aligned on `≔`, an error line, a 30-row table (240 in some runs) and an
Observable Plot chart with a marked point, then laid it out as print pages with a repeated table header and an app-drawn footer.

Three routes produced PDFs, driven by `puppeteer-core` against the installed Chrome with a throwaway profile:

- **The dialog's pipeline:** headed Chrome with `--kiosk-printing` and remembered settings (destination Save as PDF, Headers and
  footers on) in the profile's `print_preview_sticky_settings`. `window.print()` then runs through print preview and saves a file.
- **The browser's Print command:** a `WM_COMMAND` with [`IDC_PRINT`](https://github.com/chromium/chromium/blob/6f2e3f4e3eb7213176778480af439da26bac26e6/chrome/app/chrome_command_ids.h#L128)
  posted to the window. It takes the browser's route rather than the page's. That the menu item runs this same command is
  inferred from the id.
- **Headless `Page.printToPDF`** with `preferCSSPageSize` for the scale and paper matrix. For the same case it matched the dialog's
  pipeline on page count, character count and row positions.

PDFs were read back with PyMuPDF for page sizes, text positions, fonts, colours and images, and rendered to images to look at. Font
delays came from request interception on the KaTeX Caligraphic, Fraktur and Script files.
