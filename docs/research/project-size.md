Research for wayfinder ticket #178, 2026-11-15.

# What makes the plugin, the source and the documents large, and what could each lose without losing a feature?

Our code is at commit `429606b` (the code of 0.2.0 plus research notes). "Measured" means a number
read from a build, a count or a run in this session. "Probed" means a throwaway build or run
outside the app ([`project-size/`](project-size/)), with nothing changed in the repo. "Estimated"
means arithmetic or judgement, not a run. Nothing was run inside Obsidian; see "Not verified".

## Answer

**The plugin is large because of what it bundles, not because of our code: our own code is 6% of
`main.js` and 5% of `styles.css`. Fonts are a quarter of everything an install delivers. Four cuts
to the plugin are real and safe, worth about 350 KB of 4.2 MB (8%); nothing larger exists without
dropping a feature or forking Excalidraw. The source is PLACEHOLDER_SOURCE. The documents are
PLACEHOLDER_DOCS.**

The one list Matheus chooses from is at the end: [The list](#the-list).

## The plugin

### What is inside (measured)

`npm run build:plugin` at `429606b`, with esbuild's metafile
([`project-size/measure.mjs.txt`](project-size/measure.mjs.txt)). `main.js` is 3,562,170 B (957 B
more than the map's figure, which was taken at `bfecd10`) and `styles.css` 655,587 B: 4,217,757 B
together. Gzipped they are 1,328,011 B and 379,318 B, which matters to nobody: Obsidian downloads
and stores the files as they are.

| Part | `main.js` B | `styles.css` B | Share of both |
| --- | ---: | ---: | ---: |
| Excalidraw's own code and styles | 964,753 | 144,445 | 26% |
| Fonts, as base64 `data:` URLs | 478,423 | 455,284 | 22% |
| math.js and the packages it needs (decimal.js, typed-function, complex.js, fraction.js) | 665,999 | | 16% |
| Observable Plot and d3 | 413,862 | | 10% |
| Packages Excalidraw needs (pako, image-blob-reduce, pica, roughjs and 63 smaller) | 275,938 | | 7% |
| KaTeX's code and styles | 270,893 | 20,943 | 7% |
| React | 223,415 | | 5% |
| Our code (`src/`, `plugin/`) | 200,176 | 33,224 | 6% |
| The Math guide, as elements | 73,968 | | 2% |

The fonts, by family:

| Fonts | Where | B (base64) | Used for |
| --- | --- | ---: | --- |
| Excalidraw's drawing fonts: Excalifont (7 files), Nunito (5), Comic Shanns (4), Lilita One (2), Cascadia, Virgil, Liberation Sans | `main.js` | 478,423 | The text tool's font choices, and old drawings |
| KaTeX's 20 faces | `styles.css` | 346,972 | Typeset math |
| Assistant, 4 weights | `styles.css` | 108,312 | Excalidraw's interface |

Base64 costs a third more than the font files themselves (KaTeX's 20 are 259,792 B on disk). An
Obsidian plugin is three files, so there is nowhere else to put them.

Of our own 200 KB of JavaScript: `src/math` 76,768 B, `src/overlay` 48,850, `src/canvas` 30,865,
`src/panel` 21,032, the rest 22,661. **No change to our own source moves the plugin's size by more
than a percent or two.**

### What is already cut (measured, from `esbuild.plugin.mjs`)

Mermaid to Excalidraw, the 58 non-English locales and Excalidraw's font subsetting are stubs (about
300 B each or less). Xiaolai's 209 font files are `local:` paths, not data. KaTeX's `woff` and `ttf`
copies are dropped. The bundle is minified, targets ES2022, and its licence comments are 2,943 B.
**Nothing is left to gain from minification settings.**

### What it costs at start-up (probed)

Obsidian loads every enabled plugin's `main.js` when it starts, sheet or no sheet. In this
session's headless Chromium, `main.js` took a median 115 ms to compile and 240 ms to run (7 runs,
[`project-size/load.mjs.txt`](project-size/load.mjs.txt)): about a third of a second before the
plugin has done anything. math.js's own set-up is 27 ms of that; the rest was not attributed. The
figure is this container's, not a laptop's or a phone's.

### What could go

**P1. math.js's built-in help texts: 87 KB.** `mathjs/lib/esm/expression/embeddedDocs` is 87,708 B
of `main.js`. It is read only by `help()`, which the engine disables (`src/math/evaluate.ts`, "fail
with … is not supported"). Probed: `create(all)` bundles to 661,376 B, and to 574,188 B with that
one module replaced by an empty one, 87,188 B less. It is one more stub of the kind
`esbuild.plugin.mjs` already has, plus an alias in `vite.config.ts` if the web app takes it too.
Risk low: a test already pins that `help` is refused. Not run in the app.

**P2. Observable Plot by name, not whole: about 148 KB.** `src/overlay/plotDrawing.ts` loads the
whole module (`import('@observablehq/plot')`) and calls `plot`, `line`, `dot`, `text` and `ruleX`.
Probed: the whole module bundles to 409,515 B; those five and `ruleY`, imported by name, to
261,890 B, 147,625 B less (the maps, hexbins, trees, contours and their d3 packages fall away).
Risk low to medium: every mark the app draws must be named in one file, so the graph ticket's
additions (a `tip`, an ellipse) each add some bytes back, and a missed name is a build error, not
a silent one. Not run in the app.

**P3. Five KaTeX font families the app never asks for: about 109 KB.** The app writes its own TeX
(`src/math/typeset.ts`): it uses `\mathrm`, `\mathit`, `\mathtt` and `\text`, and no `\mathfrak`,
`\mathcal`, `\mathscr` or `\mathsf` (grep, not a run). A sheet's author types math.js, never TeX.
So KaTeX_Fraktur (30,498 B), KaTeX_SansSerif (46,543), KaTeX_Caligraphic (18,714) and KaTeX_Script
(12,998) are never drawn: 108,753 B of `styles.css`. Typewriter stays (`\mathtt` is used once).
Risk low to medium: it rests on "the app never emits those commands", which needs a test that
typesets every guide line and fails on a font class that was dropped, or a missing glyph shows in
a fallback font with no error.

**P4. The Math guide as a smaller tree: perhaps 15 to 25 KB (estimated).** `docs/math-guide.md` is
32,384 B and becomes 73,968 B of elements. A more compact form of the same tree would shrink it; it
is 2% of the plugin and the smallest of the four.

**P5. Load the app when the first sheet opens, not when Obsidian starts: about 240 ms of start-up,
no bytes.** `plugin/main.ts` imports the app at the top, so all of it runs at start-up. With the
view's code behind an `import()`, esbuild keeps one file but runs the app's modules only on first
use. Risk medium: Obsidian restores open sheet tabs as it starts, so the view must exist at once
and fill in a moment later; the three by-hand plugin runs (`test:blocked`, `test:popout`,
`test:touch`) would need to pass again. The saving is measured only here, not in Obsidian.

### What cannot go without losing a feature, or forking

- **Excalidraw's code (965 KB + 144 KB of styles) and its packages (276 KB).** It ships as two
  large pre-built chunks; what the plugin hides (the library, collaboration, the AI dialogs) is
  inside them and cannot be cut out without a fork, which ADR 0001 rules out. `pako` (46 KB) reads
  and writes scenes inside PNGs; `image-blob-reduce` and `pica` (79 KB) shrink pasted images.
- **Excalidraw's drawing fonts (478 KB).** Each is a choice in the text tool, or what an old
  drawing was written in. Dropping one is dropping a feature.
- **Assistant (108 KB).** Excalidraw's interface font, in the four weights its styles use.
- **math.js's functions.** A line may call any of them, so each is a feature. `simplify`,
  `derivative` and `rationalize` are disabled and are 25 KB, but `simplifyCore`,
  `simplifyConstant` and `leafCount` share their code and still work: not worth the risk.
- **React (223 KB).** Obsidian has none to share.
- **Storing the code compressed and unpacking it at start-up** (as the Obsidian Excalidraw plugin
  does) would bring `main.js` to roughly 1.6 MB (estimated from the gzip figure). It means running
  code from a string, a slower start, and a bundle the audit script and Obsidian's reviewers can't
  read. Listed for completeness; not recommended.

### The web app (measured)

`dist/` is 10,376,140 B, untrimmed by design (ADR 0006): it keeps Mermaid and its diagram packages
(`cytoscape` alone is 434,711 B), all locales, and KaTeX's `ttf` and `woff` copies. A browser
fetches only what a page uses: the entry `index-*.js` is 2,254,268 B and the rest loads on demand.
P1 and P2 apply to it as they do to the plugin. Whether the web app is worth trimming at all is a
question for the choosing ticket: nobody installs it.

SOURCE_SECTION

DOCS_SECTION

## The list

LIST

## Not verified

- Nothing was run inside Obsidian, on the work laptop or on a phone. The start-up times are this
  container's headless Chromium.
- P1 and P2 were probed as separate small bundles, not built into the plugin and run. P3 rests on a
  search of our source, not on a run of every line the app can typeset.
- Whether Obsidian or its community list has a size limit of its own was not looked up.
