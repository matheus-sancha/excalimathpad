Research for wayfinder ticket #178, 2026-11-15.

# What makes the plugin, the source and the documents large, and what could each lose without losing a feature?

Our code is at commit `429606b` (the code of 0.2.0 plus research notes). "Measured" means a number
read from a build, a count or a run in this session. "Probed" means a throwaway build or run
outside the app ([`project-size/`](project-size/)), with nothing changed in the repo. "Estimated"
means arithmetic or judgement, not a run. Nothing was run inside Obsidian; see "Not verified".

## Answer

**The plugin is large because of what it bundles, not because of our code: our own code is 6% of
`main.js` and 5% of `styles.css`. Fonts are a quarter of everything an install delivers. Three cuts
to the plugin are real and safe, worth about 345 KB of 4.2 MB (8%); nothing larger exists without
dropping a feature or forking Excalidraw. The source is already lean: no dead code, and about 575 lines of
duplication in 37,300 (1.5%). The documents are where "large" costs most: a session that reads
what it is told to reads 388 KB, about 97,000 tokens, of which a route for what to read, and moving
the spec's history out, would save most.**

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

## The source

Full report, with the commands: [`project-size/source-cuts.md`](project-size/source-cuts.md),
made with `/lean-code-reviewer`'s method. Read by an agent; the savings are estimates unless marked.

### What is there (measured)

20,401 lines that are not tests, in 110 files, and 16,909 lines of tests in 75 (`git ls-files` and
`wc -l`). That is more than the map's "18,000 plus 14,000", which left out 2,051 lines of CSS,
1,609 of build and run scripts and the 729-line stand-in for Obsidian. Of the 16,710 lines of
TypeScript that are not tests, 3,488 (21%) are comments: about 12,100 lines are code.

### What was looked for and not found

- **Dead code: none.** No unused file, no export used nowhere, no unused CSS class, no unused
  package. (`knip`, `ts-prune` and `jscpd` are not installed; the checks were scripted.)
- **Code kept for a past milestone: none.** No TODO, legacy or deprecated marker. The floating
  bars that the Format tab replaced left nothing behind. The empty `MIGRATIONS` list is ADR 0004's.
- **Tests that repeat: almost none.** No snapshots, no redundant table rows.

### What could go: duplication only

| # | Cut | Where | Lines | Risk |
| --- | --- | --- | ---: | --- |
| T1 | One shared harness for the overlay and canvas tests | 20 `*.excalidraw.test.tsx` files | ~150 | Low |
| S1 | One scaffold for the three Playwright runs | `scripts/{blocked,popout,touch}-run.mjs` | ~65 | Low |
| S2 | `ParsedLine` and `parseLine` repeat six fields and a catch block five times | `src/math/evaluate.ts` | ~55 | Low |
| T2 | A test re-declares helpers `src/test/files.ts` has | `src/file/sheetSession.test.ts` | 32 (measured) | Low |
| S7 | Filter box, style toggles, option list, chip classes | `src/panel/*.tsx` | ~30 | Low |
| S3, S4, S6, S8b, T3 | Five small repeats | `evaluate.ts`, `conditionals.ts`, `indexes.ts`, `warnings.ts`, `SheetCanvas.css`, one test | ~72 | Low |
| S5 | The bracket-and-quote scanner, written eight times | the five line-form readers | ~45 | Medium: two quote rules to keep apart |
| S8a | The colour palette, spelled out five times | `MathOverlay.css`, `SheetPanel.css` | ~25 | Medium: no test checks colours |
| T4 | Seven gesture tests covered at two other layers | `src/overlay/MathOverlay.test.tsx` | ~85 | Medium: they pin details the others don't |

About 300 lines of source and 275 of tests in all. **None of it changes the plugin's size
noticeably or what the app does.**

### `src/math/evaluate.ts` (1,931 lines, 384 of comments)

**A split moves lines; it doesn't remove them.** Four pieces could move out with no change of
logic (the engine's set-up, the types, `parseLine`, the typesetting exports), leaving about 1,000
lines and adding 30 to 50 of imports. What it buys is reading cost: a session changing how a line
is parsed reads about 300 lines, not 1,931. `evaluateSheet` itself, one 908-line function whose 27
inner functions share a dozen locals, should stay whole.

Two comments are stale, and are not savings: `evaluate.ts` and `CONTEXT.md` say it is the only
module that imports `mathjs`, and nine modules in `src/math` do (most for types only).

## The documents every session reads

Full report: [`project-size/docs-cuts.md`](project-size/docs-cuts.md). Read by an agent; tokens
are bytes divided by 4.

### What is there (measured)

| Document | B | About, in tokens |
| --- | ---: | ---: |
| `docs/spec-v1.md` | 276,383 | 69,000 |
| `CONTEXT.md` | 74,246 | 18,500 |
| `docs/adr/` (6) | 37,006 | 9,000 |
| **Read before any ticket** | **387,635** | **97,000** |

- **The spec is 61% rules and 38% history.** Rules of the app as built: 168.8 KB. History:
  105.2 KB, made of "Changes since agreed" (53.6 KB, 81 entries), section 17 Verify first
  (33.1 KB), section 16 apart from the finish line (10.6 KB) and section 18's decision index
  (7.95 KB). "Not in v1" is 2.35 KB.
- **`CONTEXT.md` is 60% module descriptions** (44.7 KB), with no sub-headings: the math entry is
  one 196-line bullet, so a session can't open one module. The math, overlay and canvas entries
  (31 KB) are mostly behaviour, which is spec text. The glossary is 8%.
- **The two repeat each other.** 15% of `CONTEXT.md` is in the spec word for word; with
  paraphrase, an estimated 60 to 80 KB of the 388 KB is said twice.
- **Both doubled in two days**: the spec from 132 KB to 276 KB and `CONTEXT.md` from 37 KB to
  74 KB between 2026-11-13 and 2026-11-15.
- **The code cites the spec by section number 661 times in 147 files**, and by path 237 times.
  The history sections are cited 12 times. So the spec's path and numbering must not change.
- **Nothing in the repo says what to read.** There is no `CLAUDE.md`; "read `CONTEXT.md`, the
  spec and the ADRs" comes from each map's Notes.
- `docs/research/` (318 KB of notes) is read only on demand, and the ADRs, the README and the
  Math guide are already tight.

### What could go

- **D1. A reading route**, in a tracked `CLAUDE.md` and in each map's Notes: always `CONTEXT.md`;
  the spec's sections and the ADRs by number, as the ticket names them. Saves up to 313 KB
  (78,000 tokens) a session; a typical session's saving is an estimate. Risk low: a session that
  skips a section it needed. Small.
- **D2. `CONTEXT.md`'s Modules under one heading per module**, or one file per module. Saves an
  estimated 35 to 40 KB for a session that touches one module. Risk low. Small to medium.
- **D3. Sections 16, 17 (the passed items) and 18 move to a history file**, leaving numbered
  stubs so the 12 citations hold. Saves about 47.5 KB. Risk low. Small to medium.
- **D4. "Changes since agreed" folded into the body, then moved out.** Saves 53.6 KB. Risk
  medium: **some rules exist only in the log** (checked for one: the body says an unlisted kind of
  unit shows in base units; the log's entry for #56 says a named SI unit comes first), so all 81
  entries must be checked against the body first. Medium to large; a change of its own.
- **D5. One home per fact** (the glossary; behaviour out of `CONTEXT.md`). Saves an estimated 19
  to 24 KB. Risk medium. After D4.
- **D6. The spec keeps its path and its numbers as the standing reference after 1.0.0**, not
  frozen with a second document written beside it. Saves nothing; keeps 661 citations true.
- **D7. A size limit on the must-read set in `npm run check`.** Saves nothing; stops the growth.
- **Not recommended: one file per spec section.** Nothing over D1, and 237 path citations and 262
  internal links to mend.

With D1 to D4, a session on one module and two spec sections would read an estimated 60 to 80 KB
where it reads 388 KB today.

## The list

Sorted by what each saves against what it risks. "Before" is a suggestion for
[Which of the measured cuts are made before 1.0.0?](https://github.com/matheus-sancha/excalimathpad/issues/184),
not a decision.

| # | Cut | Saves | Risk | Effort | Suggested |
| --- | --- | --- | --- | --- | --- |
| D1 | A reading route for sessions | Up to 78,000 tokens a session | Low | S | Before |
| P1 | math.js's help texts out of the bundle | 87 KB of `main.js` (probed) | Low | S | Before |
| D3 | Spec sections 16, 17 and 18 to a history file | 47.5 KB a session | Low | S to M | Before |
| D2 | `CONTEXT.md`'s modules under their own headings | 35 to 40 KB a session (estimated) | Low | S to M | Before |
| P2 | Observable Plot by name | About 148 KB of `main.js` (probed) | Low to medium | S | Before, after the graph ticket |
| P3 | Four unused KaTeX font families | 109 KB of `styles.css` | Low to medium, needs a test | S | Before |
| T1, T2, S1, S2, S7 and the small repeats | Duplication in tests, scripts and `evaluate.ts` | About 400 lines | Low | S each | Either |
| D7 | A size limit on the must-read documents | Stops the growth | Low | S | After D1 to D3 |
| P5 | Load the app on the first sheet | About 240 ms of Obsidian's start (probed here only) | Medium | M | Measure in Obsidian first |
| D4 | The change log folded into the spec's body, then moved | 53.6 KB a session | Medium | M to L | After, as its own change |
| `evaluate.ts` in four files | Moves lines | 1,931 lines read becomes about 300 for a parsing change | Low to medium | M | After |
| D5 | One home per fact | 19 to 24 KB a session (estimated) | Medium | M | After D4 |
| S5, S8a | The scanner and the palette, once each | About 70 lines | Medium | S to M | After, or never |
| P4 | The Math guide as a smaller tree | 15 to 25 KB (estimated) | Low | S to M | Never, unless cheap |
| T4 | Seven gesture tests | About 85 lines | Medium | S | Never |
| D6 | The spec stays the standing reference | Keeps 661 citations true | Low | S | A decision, at 1.0.0 |

**Not on the list, because each loses a feature, needs a fork, or isn't worth its risk:**
Excalidraw's code and fonts, Assistant, React, math.js's functions, a compressed `main.js`, and one
file per spec section.

**Taken together.** P1 to P3 bring the plugin from 4,217,757 B to about 3,873,000 B (8% less,
estimated from the probes). D1 to D3 bring a session's reading from 388 KB to an estimated 60 to
80 KB. The source cuts are housekeeping.

## Not verified

- Nothing was run inside Obsidian, on the work laptop or on a phone. The start-up times are this
  container's headless Chromium.
- The source and document parts were read by two agents; their figures were not re-run here.
- P1 and P2 were probed as separate small bundles, not built into the plugin and run. P3 rests on a
  search of our source, not on a run of every line the app can typeset.
- Whether Obsidian or its community list has a size limit of its own was not looked up.
