# Source cuts: measured candidates (src/, plugin/, scripts/, root *.ts)

Method: `ms-engineering:lean-code-reviewer` (map structure, hunt each waste category, report by impact).
Repo read-only; nothing was edited. `knip`, `ts-prune`, `jscpd` and `depcheck` are **not** in
`node_modules/.bin` (only `eslint`, `tsc`, `vitest`), so dead code and duplication were scripted
(scripts are in this scratchpad: `exports.py`, `css.py`, `dup.py`).

## Verdict

The source is already lean. There is **no dead code**: no unused export, file, CSS class or dependency.
The real cuts are duplication, and they total about **300 source lines of 20,401 (1.5%)** and about
**275 test lines of 16,909 (1.6%)**. Nothing here changes the size of the project in a way the owner
would notice. The one change that helps an AI session is splitting `evaluate.ts`, and that moves lines
(adds about 30 to 50), it does not remove them.

## 1. Line counts

Commands:

```
git ls-files | grep -E '^(src|plugin|scripts)/|^[^/]+\.(ts|tsx|mjs)$' > all.txt      # 185 files
grep -E  '\.test\.tsx?$|(^|/)test/' all.txt > test.txt ; grep -vE '...same...' all.txt > src.txt
xargs wc -l < src.txt | tail -1 ; xargs wc -l < test.txt | tail -1
```

| | Lines | Files |
|---|---|---|
| Non-test | **20,401** | 110 |
| Test (`*.test.ts(x)` + anything under `test/`) | **16,909** | 75 |

Non-test by type: `.ts` 11,426, `.tsx` 5,284, `.css` 2,051, `.mjs` 1,609, `.json` 31.
Of the 16,710 non-test TS/TSX lines, **3,488 are comment lines (21%)** and 1,095 blank, so about 12,100
are code. (`grep -cE '^[[:space:]]*(//|/\*|\*)'`.) Tests: 16,666 TS/TSX lines, 808 comment, 2,351 blank.
Note: by the given rule `scripts/*.test.mjs` (230 lines) count as non-test, and the root config
`.mjs` files are included.

Per top-level directory (non-test / test):

| Dir | Non-test | Files | Test | Files |
|---|---|---|---|---|
| src/math | 5,574 | 20 | 3,722 | 12 |
| src/overlay | 4,863 | 21 | 5,153 | 15 |
| src/canvas | 3,226 | 20 | 2,876 | 19 |
| src/panel | 2,060 | 12 | 214 | 3 |
| scripts | 1,360 | 9 | 0 | 0 |
| src/file | 1,240 | 8 | 1,290 | 5 |
| plugin | 586 | 5 | 2,158 | 9 |
| src (root files) | 566 | 4 | 836 | 1 |
| src/guide | 508 | 5 | 190 | 2 |
| (repo root) | 339 | 4 | 15 | 1 |
| src/shell | 79 | 2 | 47 | 1 |
| src/test | 0 | 0 | 408 | 7 |

25 longest non-test files:

| Lines | File | Lines | File |
|---|---|---|---|
| 1,931 | src/math/evaluate.ts | 339 | src/math/solve.ts |
| 1,197 | src/overlay/MathElementView.tsx | 328 | src/math/solver.ts |
| 798 | src/overlay/MathOverlay.tsx | 318 | src/canvas/popoutBridge.ts |
| 768 | src/overlay/MathOverlay.css | 317 | src/overlay/useSheetGestures.ts |
| 652 | src/canvas/SheetCanvas.tsx | 311 | plugin/SheetView.ts |
| 611 | src/panel/SheetPanel.css | 293 | scripts/popout-run.mjs |
| 557 | src/math/lineForm.ts | 292 | src/overlay/suggest.ts |
| 526 | src/App.tsx | 260 | src/math/display.ts |
| 412 | src/file/sheetSession.ts | 248 | src/guide/markdown.ts |
| 398 | scripts/touch-run.mjs | 235 | src/math/symbols.ts |
| 370 | src/canvas/mathAnchor.ts | 225 | src/overlay/PlotSettings.tsx |
| 361 | src/canvas/SheetCanvas.css | 224 | scripts/blocked-run.mjs |
| 350 | src/math/typeset.ts | | |

15 longest test files:

| Lines | File | Tests (`it`) |
|---|---|---|
| 2,306 | src/overlay/MathOverlay.test.tsx | 158 |
| 1,989 | src/math/evaluate.test.ts | 226 |
| 836 | src/App.test.tsx | 39 |
| 729 | plugin/test/obsidian.ts (the fake Obsidian, not a test) | - |
| 627 | src/file/sheetSession.test.ts | 40 |
| 477 | plugin/test/vault.test.ts | 26 |
| 453 | src/math/lineForm.test.ts | 51 |
| 420 | src/overlay/MathOverlay.excalidraw.test.tsx | 16 |
| 412 | src/canvas/mathAnchor.excalidraw.test.tsx | 19 |
| 391 | src/overlay/gestures.excalidraw.test.tsx | 19 |
| 376 | src/file/FileChrome.excalidraw.test.tsx | 21 |
| 308 | src/canvas/anchorSize.excalidraw.test.tsx | 17 |
| 306 | plugin/test/tab.test.ts | 17 |
| 304 | src/overlay/hoverTip.excalidraw.test.tsx | 11 |
| 294 | src/math/pump-sizing.test.ts | 18 |

## 2. Dead code: none found

- **Exports.** `exports.py`: every `export const|function|class|type|interface|enum` in the 101
  non-test TS/TSX/MJS files, word-matched against every other file. 157 exports have no reference in
  another non-test file; **every one is used inside its own file** (`own >= 2`), except
  `plugin/main.ts:48 ExcalimathpadPlugin`, the default export Obsidian loads. About 95 are types and
  props interfaces, 38 are exported only so a test can read them. Dropping the `export` keyword saves
  zero lines. VERIFIED.
- **Unused locals and parameters.** `noUnusedLocals` and `noUnusedParameters` are on in all three
  tsconfigs, so the compiler already refuses them.
- **Unused files.** Each non-test file is imported by another, except the four entry points
  (`src/main.tsx` from `index.html:11`, `plugin/main.ts`, `plugin/styles.css`, `vite.config.ts`) and
  the ambient `src/guide/mathGuide.d.ts`. VERIFIED.
- **Unused CSS classes.** `css.py`: 234 class selectors in 8 stylesheets. 46 have no literal match in
  TS/TSX; all 46 are either built from a template (`is-${kind}`, `is-text-${color}`, `is-size-${size}`,
  `is-align-${align}`; 21 template sites, e.g. `MathElementView.tsx:351-354`, `formatControls.tsx:80,104`,
  `SymbolsTab.tsx:52`) or Excalidraw's own classes that `SheetCanvas.css` restyles (`sidebar-triggers`,
  `sidebar__header`, `App-menu__left`, `panelColumn`, `control-label`). VERIFIED each group by grep.
- **Unused dependencies.** All 6 dependencies and all 13 checked devDependencies are referenced
  (`grep -lF` over tracked files outside `docs/` and the lockfile; lowest count is 1, for
  `@observablehq/plot`, `fake-indexeddb`, `vitest-canvas-mock`, `typescript-eslint`, `@vitejs/plugin-react`). VERIFIED.
- **Unused test helpers.** Every export of `src/test/*.ts` and `plugin/test/*.ts` is used. VERIFIED.

## 3. Duplication (the real cuts)

`dup.py`: windows of 5 normalized statements (blank lines, comments, imports and lone brackets
dropped) across non-test files: 63 clone pairs. Same for tests with a window of 6: 23 pairs.

### Source

**S1. The three Playwright run scripts share their scaffold.** `scripts/blocked-run.mjs:22-109`,
`scripts/popout-run.mjs:20-140`, `scripts/touch-run.mjs:22-121`. Identical in all three: the six
imports, `root`/`dist`, the esbuild build of the fake Obsidian (9 lines), the `module`/`require` shim
(6 lines), the HTTP server (17 lines), the Chromium launch. About 42 lines each. A shared
`scripts/plugin-page.mjs` (`buildFake()`, `serve(routes)`, the shim string) removes them.
Saving: **about 65 lines (estimate)**. Risk: low, the three scripts run in `npm run check` and fail
loudly. Effort: S. VERIFIED duplicate by reading all three.

**S2. `parseLine` and `ParsedLine` repeat six fields five times.** `src/math/evaluate.ts`.
The type (`:447-524`) lists `note, format, rules, formatError, display, displayText` in each of the 5
variants; `parseLine` builds the same six at `:1708-1713, 1733-1738, 1754-1759, 1795-1800, 1818-1823`;
five `catch` blocks build the same syntax-error object (`:1715-1717, 1740-1742, 1762-1769, 1802-1809,
1825-1833`); the plot and table argument mapping is the same but for one field (`:1689-1697` vs
`:1724-1731`). One base type, one `common` object, one `syntaxError(error, defines)` helper, one
`readArg`. Saving: **about 55 lines (estimate: 20 type + 18 fields + 12 catch + 6 args)**.
Risk: low, pure restructuring under 226 `evaluate.test.ts` tests and strict TS. Effort: S. VERIFIED.

**S3. `typesetLine` repeats the fallback shape.** `src/math/evaluate.ts:1509-1562`: the plot and
table cases are identical but for the word (`:1515-1530`), and range, solve and parsed each repeat
`{ kind: 'math', ..., note: line.note, format: line.format }` twice in a try/catch. One local helper.
Saving: **about 20 lines (estimate)**. Risk: low. Effort: S. VERIFIED.

**S4. The column unit is worked out twice, and one unit idiom five times.**
`src/math/evaluate.ts:1229-1238` (`axisUnit`) and `:1288-1297` (`buildColumn`) are the same 9 lines.
`leadingNumber(display.show(...))?.rest.trim() ?? ''` then `display.readTarget(...)` then
`target?.kind === 'unit' ? target.unit : ...` appears at `:1235-1237, 1295-1297, 1410-1411,
1421-1424, 1446-1448`; the `kind === 'unit' ? ... : kind === 'percent' ? 'percent' : null` ternary at
`:955, 1232, 1291`; `runTable` and `runPlot` evaluate their arguments the same way (`:1080-1084,
1093-1095` vs `:1119-1122, 1132-1133`). Saving: **about 20 lines (estimate)**. Risk: low. Effort: S. VERIFIED.

**S5. A bracket-and-quote scanner is written eight times.** The same loop (`depth`, `quote`, skip
after `\`) is in `src/math/rangeLine.ts:39-56` (`topLevel`), `src/math/solveLine.ts:122-137` (`scan`),
`src/math/tableLine.ts:45-66` (`callSpans`), `src/math/plotLine.ts:41-61` (`splitClauses`), and
`src/math/lineForm.ts:277-304` (`splitDisplayUnit`), `:311-330` (`hasTopLevelSemicolon`), `:515-530`
(`outsideStrings`), `:538ff`. One `scanTopLevel(text, visit)` would hold the loop.
Saving: **about 45 lines (estimate)**. Risk: **medium**: there are two quote rules (`"` only in the
four line forms; `"` and `'` unless it ends a value in `lineForm.ts`), and a merge must keep both, or
it changes how a line with an apostrophe is read. Effort: M. VERIFIED that the loops match; the two
dialects are a real difference, not a copy error I could confirm either way.

**S6. Small copies in `src/math`.** `createIf` and `createIndex` hold the same 9-line compiled-node
cache (`conditionals.ts:36-43`, `indexes.ts:64-71`); `lineWarnings` and `solveWarnings` open with the
same 6 lines (`warnings.ts:49-57`, `:105-111`). Saving: **about 12 lines (estimate)**. Risk: low. Effort: S. VERIFIED.

**S7. Small copies in `src/panel`.** The filter box (11 lines) is in `SheetPanel.tsx:31-43`,
`:133-144` and `SymbolsTab.tsx:26-37`; the bold and underline toggles are in `FormatTab.tsx:129-135,
148-155, 174-181`; the system `<option>` list is in `SettingsTab.tsx:63-68, 82-87`; `chipClasses`
(`RulesList.tsx:182-186`) is `formatClasses` (`MathElementView.tsx:372-376`) minus one class.
Saving: **about 30 lines (estimate)**. Risk: low. Effort: S. VERIFIED.

**S8. The colour palette is spelled out five times in CSS.** The 5 highlights and 6 text colours (11
rules) appear for the title (`MathOverlay.css:85-95`), the row (`:292-296, 303-308`), the table row
(`:552-556, 559-564`), the rule chip (`SheetPanel.css:513-523`), plus the swatches and
`src/overlay/textColors.ts`. Setting two custom properties once per colour class and reading them in
each place removes about 3 of the 5 copies. Also `SheetCanvas.css:156-170` and `:289-303` are the same
13 lines for `.sheet-sidebar` and `.sheet-bottom` (one selector list).
Saving: **about 35 lines (estimate: 25 + 12)**. Risk: **medium** for the palette: nothing automated
checks colours (jsdom has no layout or paint), and print and the dark-theme filter depend on these
rules; low for the tab rules. Effort: S. VERIFIED duplicate.

### Tests

**T1. The overlay test harness is copied into five files, the mount preamble into fifteen.**
`function Harness` (AppShell + SheetCanvas + MathOverlay, 26 to 35 lines) is in
`src/overlay/gestures.excalidraw.test.tsx:32-66`, `unitSlot.excalidraw.test.tsx:30-64`,
`addMath.excalidraw.test.tsx:24-58`, `hoverTip.excalidraw.test.tsx:49-80`,
`MathOverlay.excalidraw.test.tsx:26-51` (the first two are identical for 54 statements). The five lines
`let handle...; render(<SheetCanvas .../>); await waitFor(...); sceneLoaded(api)` are in 15 files
(`grep -c "let handle: SheetCanvasHandle | undefined"`). One `mountCanvas()` / `mountOverlay()` in
`src/test/excalidraw.ts`. Saving: **about 150 test lines (estimate: 164 harness lines - 40 shared, + 3 x 15 preamble - 12)**.
Risk: low, test-only and each file keeps its own assertions. Effort: S. VERIFIED.

**T2. `sheetSession.test.ts` re-declares helpers that already exist.**
`src/file/sheetSession.test.ts:58-93` (`handleFor`, `fakeFiles`, `fakeRecovery`) is
`src/test/files.ts:6-40` (`fakeFileAccess`, `fakeRecovery`) line for line; three other test files
already import the shared one. Saving: **32 test lines (measured)**. Risk: low. Effort: S. VERIFIED.

**T3.** `src/canvas/anchorSize.excalidraw.test.tsx:226-233` re-declares `pointer`, which
`src/test/gestures.ts:64-71` holds unexported. Saving: **8 lines (measured)**. Risk: low. Effort: S. VERIFIED.

## 4. Code kept for a past milestone or superseded decision: none found

- Grep over non-test source for `legacy|for now|deprecated|TODO|FIXME|HACK|XXX|temporar|workaround|
  backward|compat|shim|obsolete|no longer|old format|interim|follow-up`: **zero** TODO, FIXME, HACK,
  legacy or deprecated markers. The only hit of substance is `evaluate.ts:171` ("Defining units, if
  wanted, is a follow-up"), a comment, not code.
- `docs/spec-v1.md:3201` "Changes since agreed" names what was replaced. Checked against the code:
  - **The format bar and the title's bar** (replaced by the Format tab, #117/#121): no `format-bar`
    or title-bar class, component or CSS remains. VERIFIED by grep.
  - **"The hosted app's work-laptop fallbacks are dropped"** (#115): these were a custom domain and a
    zip, never code. `fallbackAccess` in `src/file/fileAccess.ts:123-155` (file input and download for
    browsers other than Chrome and Edge) is still in the spec (`spec-v1.md:48, 1392`), so it is a
    feature, not a leftover. Not a cut.
  - **Guess removed from value solves** (kept for solve functions): `guess` is still read for solve
    functions only. Not a leftover.
- **`MIGRATIONS` is an empty list** (`src/file/sheetFormat.ts:40-48, 85-89`, about 12 lines, plus a
  `migrations` describe in the test): a runner with nothing to run. ADR 0004 (`:43, :72`) decides it,
  and it is what refuses or upgrades a newer file. Keep. Not a cut.
- One stale sentence, not a saving: `evaluate.ts:48` and `CONTEXT.md:414` say it is "the only module
  that imports `mathjs`"; nine modules in `src/math` import types and node guards from it (only
  `evaluate.ts` calls `create(all)`). And the doc comment at `evaluate.ts:145` sits above the wrong
  constant (it describes `DEFAULT_DISPLAY`, two lines below).

## 5. `src/math/evaluate.ts` (1,931 lines, 384 of them comments)

| Lines | What it holds |
|---|---|
| 1-44 | Imports |
| 46-275 | The engine: `create(all)`, SI, app units, short constants, `if` and index, the disabled functions, the `typed` stub, `SheetScope`, `forget` (about 230 lines, 60% comments explaining the hardening) |
| 278-524 | Types: `LineResult`, `TypesetLine`, `SheetLine`, `TableView`, `PlotView`, `SheetVariable`, `ParsedLine` (about 250) |
| 563-1470 | `evaluateSheet`: **one function of 908 lines** holding 27 inner functions (`readLine`, `runRules`, `variablesOf`, `warningsOf`, `evaluateLine`, `runCode`, `runSolve`, `runRange`, `runTable`, `runPlot`, `axisUnit`, `buildColumn`, `iterate`, `foldIndexes`, `foldAggregates`, the summaries) that share about 12 mutable locals (`scope`, `failed`, `assigned`, `slot`, `details`, `preview`, `lineValue`, `table`, `plot`, `listUnits`, `lastSolve`, `position`) |
| 1472-1570 | Rule resolution and `typesetLine` (about 100) |
| 1572-1655 | Exports for the UI: `typesetResult`, `isDisplayUnit`, `listConstants`, `typesetUnit` (about 85) |
| 1657-1912 | `parseLine` and its helpers (`definedNames`, `plainInputUnits`, `unitNames`) (about 255) |
| 1914-1931 | `explain` |

**Does a split reduce lines? No.** Honest answer in two parts:

- **Real reduction inside the file: about 95 lines (5%)**, from S2, S3 and S4 above. That is all.
- **A split only moves lines, and adds about 30 to 50** (imports and exports). Four pieces move with
  no change to logic because they sit at module level: the engine setup (230), the types (250),
  `parseLine` and helpers (255), typesetting and the UI exports (185). That leaves `evaluate.ts` at
  about 1,000 lines. It would cut what a session reads to change, say, parsing from 1,931 lines to
  about 300. Risk: low to medium (the load order of the engine setup matters: units and constants are
  registered before `import` is disabled; a test pins it). Effort: M.
- **Splitting `evaluateSheet` itself would add lines and risk.** Its 27 inner functions close over the
  12 locals; pulling `runPlot` or `runRules` out means passing a context object everywhere. I would
  not do it for size. Risk: medium to high. Effort: L.

## 6. Tests that repeat each other

- **No snapshots.** `grep -E "toMatchInlineSnapshot|toMatchSnapshot"`: 0. No large literal blocks
  beyond the pump sheet's expected values, which are the acceptance reference.
- **Table-driven tests are small.** 30 `.each` uses in all; the largest tables are the pump sheet's
  reference lines (`pump-sizing.test.ts:117, 190`), each row a different line of the sheet. No
  redundant rows found. Only one test title is repeated across files ("reads back what it wrote").
- **`evaluate.test.ts` is dense, not padded**: 226 tests in 1,989 lines (8.8 lines a test).
  `pump-sizing.test.ts` (acceptance) and `math-guide.test.ts` (runs the guide's examples) reach the same
  engine but pin different documents; not duplicates.
- **T4. One real overlap: gestures are asserted at three layers.** The pure decision
  (`src/overlay/gestures.test.ts`, 30 tests), the overlay on a fake scene
  (`src/overlay/MathOverlay.test.tsx:987-1230`, 21 tests, 243 lines) and the real Excalidraw
  (`src/overlay/gestures.excalidraw.test.tsx`, 19 tests). Seven fake-scene tests have a counterpart in
  **both** other layers: double-click on a selected element (`:1003`), the locked element (`:1055`),
  Enter edits the last line (`:1064`), Esc deselects (`:1085`), a click on another line (`:1144`), a
  drawing on top (`:1178`), a press that becomes a drag (`:1192`). Saving: **about 85 test lines
  (estimate)**. Risk: **medium**: the fake-scene versions also pin details the others do not (caret at
  the end, exactly one write), and they are the fast ones. INFERRED from titles and a read of the three
  files; not verified by removing them and mutating the code. I would leave these unless test run time
  matters.

## All cuts, by saving per risk

| # | Cut | Where | Saving (lines) | Risk | Effort | Verified |
|---|---|---|---|---|---|---|
| T1 | Shared overlay harness and canvas mount for tests | 5 + 15 test files, `src/test/excalidraw.ts` | ~150 est. | Low | S | Yes |
| S1 | Shared scaffold for the three run scripts | `scripts/{blocked,popout,touch}-run.mjs` | ~65 est. | Low | S | Yes |
| S2 | `ParsedLine` base, `common`, `syntaxError`, `readArg` | `src/math/evaluate.ts:447-524, 1669-1834` | ~55 est. | Low | S | Yes |
| T2 | Use `src/test/files.ts` in the session test | `src/file/sheetSession.test.ts:58-93` | 32 measured | Low | S | Yes |
| S7 | Filter box, style toggles, options, chip classes | `src/panel/*.tsx` | ~30 est. | Low | S | Yes |
| S3 | `typesetLine` helper | `src/math/evaluate.ts:1509-1562` | ~20 est. | Low | S | Yes |
| S4 | Column unit and unit-text helpers | `src/math/evaluate.ts:1229-1297, 1410-1448` | ~20 est. | Low | S | Yes |
| S6 | Compiled-node cache, warnings preamble | `conditionals.ts`, `indexes.ts`, `warnings.ts` | ~12 est. | Low | S | Yes |
| S8b | One selector list for the two tab strips | `src/canvas/SheetCanvas.css:156-170, 289-303` | ~12 est. | Low | S | Yes |
| T3 | Export `pointer` from the gesture helpers | `anchorSize.excalidraw.test.tsx:226-233` | 8 measured | Low | S | Yes |
| S5 | One top-level scanner for the line forms | `rangeLine`, `solveLine`, `tableLine`, `plotLine`, `lineForm` | ~45 est. | Medium | M | Yes (two quote rules to keep) |
| S8a | Colour palette as custom properties | `MathOverlay.css`, `SheetPanel.css` | ~25 est. | Medium | S | Yes (no automated colour check) |
| T4 | Drop fake-scene gesture tests covered at two other layers | `src/overlay/MathOverlay.test.tsx:987-1230` | ~85 est. | Medium | S | Inferred |
| - | Split `evaluate.ts` into 5 files | `src/math/evaluate.ts` | **+30 to +50** (moves, no saving) | Low to medium | M | Structure verified |

Totals: source about **300 lines** (1.5% of 20,401), of which about 230 are low risk; tests about
**275 lines** (1.6% of 16,909), of which 190 are low risk.

## Looked and found nothing

- Unused exports, files, CSS classes, dependencies, test helpers (section 2).
- Unused locals and parameters (compiler flags on).
- Legacy, deprecated, TODO or FIXME markers; flags; compatibility branches (section 4).
- Leftovers of the superseded format bar, title's bar, required guess, or hosted-app fallbacks.
- Duplication in `src/overlay`, `src/canvas`, `src/file`, `src/guide`, `src/shell`, `plugin/` and
  `App.tsx`: no clone of 5 statements or more between files; the largest inside one file is 5.
- Duplication between `vite.config.ts` and `esbuild.plugin.mjs`: none.
- Pass-through wrappers and single-implementation interfaces: the ports (`FileAccess`,
  `RecoveryStore`, `SessionPorts`, `VaultSheetPorts`) each have two implementations (browser or vault,
  and the test fake).
- Snapshot tests, redundant table rows, repeated test titles.
- Comments: 21% of the source, almost all "why" notes with a spec section or issue number; I found
  none that restate the code, so I list no cut. They are the largest single non-code share, if the
  owner ever wants to trade them against `CONTEXT.md`.
