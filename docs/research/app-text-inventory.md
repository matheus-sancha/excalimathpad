Research for wayfinder ticket #285, 2026-11-21.

# Where is every piece of Excalimathpad's own text, and by which route does each reach the screen?

[Spec for 0.7.0: Excalimathpad's own text in Português (Brasil)](https://github.com/matheus-sancha/excalimathpad/issues/284)
chose its own typed string tables, read through the language Excalidraw holds, and an engine
that returns codes. This note is the inventory those choices apply to: what text there is, in
which file, and by which route it reaches the screen. It gives sizes and a list. It recommends
nothing: what is translated at the edges is the next ticket's, and the build order is the
last one's.

## How each fact is marked

- **[C]** read in the source at `7664027` (Release 0.5.0), or in `mathjs@15.2.0` and
  `@excalidraw/excalidraw@0.18.1` as installed.
- **[O]** observed by running the engine (`evaluateSheet`) on lines written for the probe, in
  Node 22 with `--experimental-strip-types`. The script is
  [`app-text-inventory/probe.mjs.txt`](app-text-inventory/probe.mjs.txt).
- **[M]** measured by a script: every string literal, template and JSX text in the 120 source
  files of `src/` and `plugin/` (tests, probes and `src/test/` left out), walked with the
  TypeScript compiler's own parser, then filtered by hand-written rules that drop class names,
  selectors, TeX, units and internal throws. The scripts are
  [`extract.cjs.txt`](app-text-inventory/extract.cjs.txt) and
  [`curate.cjs.txt`](app-text-inventory/curate.cjs.txt); what they kept, 601 entries with file
  and line, is [`strings.tsv`](app-text-inventory/strings.tsv).
- **[I]** inferred from the facts beside it.

A count is a **count of strings in the code**, one per literal or template, not of section 13's
rows. The filter keeps some text that stays as it is (a signature such as `pow(x, y)`) and
misses one-word strings that look like identifiers (`plus`, `sine`, `iteration`). Those
misses were counted by hand and are added in the tables below. Read each count as ±10%.

## Answer

**About 600 strings of the app's own text in 62 files, plus the Math guide (598 lines,
8,238 words), plus math.js's own wording, which has no fixed size [M].** By kind:

| Kind | Files | Strings |
|---|---|---:|
| **Messages from the engine**: errors, warnings, rule warnings, a rename's refusals | 13 files in `src/math/` | ≈ 135 |
| **Words inside results**: list summaries, a matrix's size, a plot's default title, Solve details | `lists.ts`, `evaluate.ts`, `MathElementView.tsx` | ≈ 20 |
| **Catalogue data**: Symbols hints and groups, Constants descriptions and groups, the unit kinds, the typing suggestions' details | `symbols.ts`, `constants.ts`, `unitSystems.ts`, `suggest.ts` | ≈ 160 |
| **Sheet panel**: tab names, labels, tooltips, empty states, Format, Rules, Settings, rename form, quick keys | 13 files in `src/panel/`, the tab names in `SheetCanvas.tsx` | ≈ 140 |
| **On the sheet**: plot settings, the unit slot, the offer card, a failed element, the line edit's names | 7 files in `src/overlay/` | ≈ 70 |
| **Chrome**: ☰ items, More tools items, the welcome hint, the selection hint, the bottom sheet, the resize handle, Language | 8 files in `src/canvas/`, `AppShell.tsx` | ≈ 35 |
| **File**: the two dialogs and their buttons, the four file messages, reasons the app words itself, Untitled | 5 files in `src/file/` | ≈ 20 |
| **Unexpected failures**: four line or element texts, the failure screen, Copy details | `src/failure/details.ts`, `evaluate.ts` | ≈ 20 |
| **Print**: the failure notice, the footer's page count, the browser Print line | `printSheet.ts`, `printView.ts`, `src/index.css` | 3 |
| **Plugin**: five commands, the ribbon and folder item, four notices, the paper notice, the image picker, two file names | 5 files in `plugin/` | ≈ 15 |
| **Math guide**: the dialog's Close; the guide itself | `MathGuide.tsx`; `docs/math-guide.md` | 2; 1 file |

**Text reaches the screen by thirteen routes [C].** Five of them don't go through a
React component that renders inside Excalidraw, so `useI18n` can't reach them as the
tables decided: the engine (2), module constants (3), CSS (4), Obsidian (6) and the browser
(9). Each needs the language passed in, or the text worded later where it is shown.

| # | Route | What goes by it | Where it turns into text |
|---|---|---|---|
| 1 | **JSX** inside Excalidraw's tree: text, `aria-label`, `title`, `placeholder`, `label` props | The Sheet panel, the overlay, ☰ and More tools items, the welcome screen, the dialogs' buttons | The component, at render |
| 2 | **The engine's return value**: `LineResult.message`, `SheetLine.warnings`, a rule's state, a rename's refusal, a list's `summary`, a plot's title | Every message of section 13's reading, functions, units, conditionals, rules, solve and ranges tables, and the words inside results | In `src/math/`, as English strings, before React sees them |
| 3 | **Module constants**, computed once at import | `WELCOME_HINT`, `MATH_HINT`, `FAILURE_MESSAGES`, `RENAME_WORDS`, `PRINT_FAILED`, `SYMBOLS`, `CONSTANT_GROUPS`, `KIND_LABELS`, `SHEET_COMMANDS`, `NEW_SHEET`, `LIMIT_TEXT` | At import, so a language switch never reaches them as they are |
| 4 | **CSS `content`** | The selection hint, `--math-hint` and `--math-hint-touch`, set from `mathSelection.ts`; `"Use Print… from the app's menu"`, a literal in `src/index.css` | In the style sheet, with no TypeScript at print time |
| 5 | **Excalidraw's toast**, `api.setToast({ message })` | The four file messages and the restore and save dialogs (`createDialogHost`), the rename toast, the image-too-big toast | The app passes a finished string (`App.tsx`, `imageTool.ts`) |
| 6 | **Obsidian's API** | `addCommand` names, the ribbon's tooltip, the folder menu's item, `new Notice(...)` | At `onload` for commands, ribbon and menu; at the time for a notice (`plugin/main.ts`, `SheetView.ts`, `print.ts`) |
| 7 | **The print view's DOM**, built by hand | The footer: the file name, the date and `1 of 3` | `printView.ts`, with `textContent` |
| 8 | **The clipboard** | Copy details | `failureDetails` in `details.ts` |
| 9 | **The browser and the system** | `document.title` (`● name`), the save picker's file type `Excalimathpad sheet` (`fileAccess.ts`), and the `<reason>` in four file messages and three notices | The browser or Obsidian, in its own language (see the list below) |
| 10 | **The build**: `docs/math-guide.md?guide` | The Math guide | `vite.config.ts` and `esbuild.plugin.mjs` through `src/guide/markdown.ts`, once per build |
| 11 | **Hover text** in `data-tip`, drawn by `HoverTip.tsx` | A line's error or warnings, Solve details, a list's preview, a failed table cell | Whoever sets `data-tip`: the overlay, from route 2 |
| 12 | **Identifiers made into words** | The kinds in `H_s is a length, P is a power: one plot shows one kind`: `volumeFlow` becomes `a volume flow` | `kindName` in `evaluate.ts`, splitting the camel case |
| 13 | **Numbers pinned to `en-US`** | `10,000` in the limits' messages; the plot axes' tick labels, with a comma between thousands | `toLocaleString('en-US')` in `limits.ts` and `plotLayout.ts` |

## Text that doesn't start in the app's code

The list the ticket asked for. Each item says where the words come from, and whether the app
can change them.

- **math.js's own error wording.** A message math.js throws reaches the line unchanged unless
  the app catches it by its English words [C][O]. `mathjs@15.2.0` has about 700 places that
  throw: 303 `new Error(`, 234 `new TypeError(`, 63 `new RangeError(`, 43 `new SyntaxError(`
  and 25 `createSyntaxError(` in the parser, 37 `DimensionError`, 6 `IndexError` [M]. The probe
  saw these reach the line as math.js words them [O]:

  | Line typed | The line's message |
  |---|---|
  | `a = (1 + 2` | `Parenthesis ) expected (char 11)` |
  | `b = 3 +` | `Unexpected end of expression (char 8)` |
  | `l = 2 ]` | `Unexpected operator ] (char 7)` |
  | `c = 2 m + 3 s` | `Units do not match` |
  | `d = sin(1, 2)` | `Too many arguments in function sin (expected: 1, actual: 2)` |
  | `e = [1, 2] * [3, 4, 5]` | `Dimension mismatch in multiplication. Vectors must have the same length` |
  | `f = foo` | `Undefined symbol foo` |
  | `k = sqrt("x")` | `Cannot convert "x" to a number` |
  | `q = det([1,2])` | `Matrix must be square (size: [2])` |
  | `t = gcd(1.5, 2)` | `Parameters in function gcd must be integer numbers` |

  The app recognises three of math.js's messages by their English words and words them
  itself: `Undefined symbol|function x`, as `x is defined below` or `x has an error above`
  (`UNDEFINED_NAME` in `evaluate.ts`, "pinned by a test, so an upgrade that rewords it fails
  CI"); `'f' is not a function`, as `f_d is a value, not a function…` (`messageOf` in
  `functions.ts`); and, in a rule's condition, `Cannot compare units` or `actual: Unit`, as
  `Units do not match` (`evaluate.ts:815`) [C]. A fourth is recognised by its data, not its
  words: a `wrongType` error whose `data.actual` names a function, as `q is a function: call it
  with q(...)` [C]. `conditionals.ts` keeps math.js's "Unexpected type of argument" from ever
  showing by checking a comparison before math.js runs it [C]. And `in k(1 s): <message>` wraps
  whatever a function's body threw, math.js's words included [C]. A rename's check of which
  results change (`planRename`, `rename.ts:507`) compares messages before and after with
  math.js's ` (char N)` cut off, so it reads that suffix too [C].
- **The limits.** `limits.ts` words its own messages, but each one starts with the user's code
  as math.js prints it (`zeros(1e8) has more than 10,000 values`) and the number is pinned to
  `en-US` (route 13) [C]. `limits.ts:296` passes another error's message through unchanged when
  it isn't one of its own [C].
- **The unexpected failures and Copy details.** The four texts (`this line…`, `this element…`,
  `this chart…`, `this tab…`) and the failure screen's words are the app's
  (`FAILURE_MESSAGES` in `details.ts`, `UNEXPECTED_LINE` in `evaluate.ts`) [C]. Copy details is
  the app's header (`Excalimathpad <version>`, the home and device in English words, `What
  failed: a line`) and then the error's own text and stack, which come from the JavaScript
  engine or the code that threw, and the last line `(no sheet content is included)` [C]. It
  leaves the app on the clipboard for an issue, not for the screen (route 8) [I].
- **The plugin's commands and notices.** `New sheet`, `Add math`, `Toggle Math settings`,
  `Open Math guide` and `Print…` are registered once, in `onload`, from constants
  (`NEW_SHEET`, `SHEET_COMMANDS`); the ribbon's tooltip and the folder menu's item reuse
  `New sheet` [C]. The notices are the app's words (`conflictNotice`, `writeFailedNotice`,
  `createFailedNotice`, `NO_LOOKBEHIND`, `paperNotice`, `PRINT_FAILED`), but three of them
  carry a `<reason>` from Obsidian or the system, through `errorReason(error)` [C]. The paper
  notice puts the Page setting's stored values in the sentence: `Choose ${size},
  ${orientation} in the print dialog.`, where `orientation` is the file's word `portrait` or
  `landscape` and `size` is `A4` or `Letter` [C]. Two file names are written to the vault in
  English: a new sheet's `Untitled.excalimathpad` (`NEW_SHEET_BASE`) and a conflict copy's
  `pump-sizing (conflict 2026-11-14 1532)` (`conflictBase`) [C]. The command palette shows a
  command's name as registered; the ticket that set this map's direction already says it
  changes after Obsidian restarts.
- **The reasons in file messages.** `Couldn't save <name>: <reason>` and `Couldn't open the
  file: <reason>` take the reason from the browser when it threw (a `DOMException`'s message,
  in the browser's language), and from the app in four cases: `permission to write the file was
  refused`, `this browser cannot write back to a file`, `this browser cannot read a file again`
  (`fileAccess.ts`), and the recovery copy's `IndexedDB would not open`, `IndexedDB
  transaction failed`, `IndexedDB transaction aborted` (`recovery.ts`) [C]. Whether the
  recovery's three ever reach the screen wasn't followed [I].
- **The print view's footer and its date.** The footer is three spans: the sheet's file name,
  the date as `YYYY-MM-DD` in local time (`printDate`), and `${index + 1} of ${pages.length}`
  [C]. Only `of` is a word. The browser's own Print, on the web, prints one line from CSS:
  `Use Print… from the app's menu` (`src/index.css`, route 4) [C].
- **The Constants tab's descriptions.** 62 constants in 7 groups, each a CODATA-style name
  (`Molar volume of an ideal gas (273.15 K, 101.325 kPa)`), in `CONSTANT_GROUPS`
  (`constants.ts`) [C]. The row also shows `${short} or ${name}` (`SheetPanel.tsx`), whose `or`
  is a word [C]. Of the 62 descriptions, one is math, not words (`tau`'s `2π`) [C].
- **Excalidraw's own text, written by the app in English.** `imageTool.ts` shows its own copy
  of Excalidraw's `File is too big. Maximum allowed size is 4MB.` when the vault's picker hands
  it a file over 4 MB [C]. Excalidraw's pt-BR file has that text as `errors.fileTooBig`: "O
  arquivo é muito grande. O tamanho máximo permitido é {{maxSize}}." [C].
- **The build stamp.** ☰ shows `dev` or `<commit> · YYYY-MM-DD` (`buildStamp.ts`), with the
  tooltip `This build` [C]. Only the tooltip and `dev` are words.

## The words inside results

Not messages, but English words the engine writes into what a line shows [C]:

- A list's summary: `30 values, 12.04 … 33.18 m`, `28 of 30 values`, and for texts
  `3 OK, 1 NOT OK, 1 failed` (`lists.ts`). Past the written limit of roots, `evaluate.ts:1643`
  turns `N values` into `N roots` with a regex on the English summary.
- A matrix: `2 × 3 matrix` (`evaluate.ts:1630`).
- A failed point inside a message: `1 of 30 points failed. At Q_s = 0 L/s: …`, or `At point 3`
  (`evaluate.ts:1683`); `evaluate.ts:1228` takes that sentence apart again with a regex,
  `/^\d+ of \d+ points failed\. /`, to build `H_s: every point failed. …`.
- A plot's default title: `H_s against Q_s`, written twice, as text and as TeX
  (`\text{ against }`, `evaluate.ts:1333`).
- A rule's count on a list line: `v > 3: 4 of 30 points` (`evaluate.ts:887`).
- Solve details, in the hover: `Scan + Brent, roots found in …`, `N points`, `Root 1: …
  (touching), residual …`, `N crossings rejected as poles or jumps`, `Brent, N iterations`,
  `Residual:`, `Bracket:` (`detailsText` in `MathElementView.tsx`).

The keywords the TeX writes as text (`\text{guess }`, `\text{step }`, `\text{circle }`,
`\mathrm{solve}`, `\mathrm{plot}`, `\mathrm{table}`) are line forms, which stay English by the
map's direction [C].

## Where the same words are written twice

Found while counting. Each is one text a table will need one key for [C]:

- **The warnings** are built twice, with the same four sentences: `warnings.ts:53-80` for a
  line and `warnings.ts:109-139` for a function's body.
- **The unit kinds** have two forms: `KIND_LABELS` (`Volume flow`, for the Settings tab and
  the unit slot) and the camel-case split of the `Kind` identifier (`a volume flow`, for the
  one-kind message, route 12).
- **The rename words** are in `RENAME_WORDS` (`renameForm.ts`, the form and the toast) and
  again in `renameOffer.ts` (the offer's `1 line` and `N lines`, `This changes N results:`).
- **`Untitled`** is written in `App.tsx`, `FileChrome.tsx`, `sheetSession.ts`,
  `plugin/SheetView.ts` and `plugin/names.ts`.
- **The formats** are named once on the Format tab's buttons (`Bold (Ctrl+B)`, `Size S`,
  `formatControls.tsx`) and again, in other words, by the typing suggestions (`bold row`,
  `size S, 13 px`, `suggest.ts`).

## The spec and the code differ in three places

- **The touch welcome hint isn't in the code.** Sections 8 and 13 say that on touch the
  welcome screen reads `Tap More tools, then Add math, then tap the sheet`. The code has one
  `WELCOME_HINT`, the computer's `Press M, or choose Add math under More tools, then click the
  sheet to place math`, for every device (`SheetCanvas.tsx:702`) [C]. No test names the touch
  text [M].
- **`View mode is on: the sheet can't be changed.`** is the Excalidraw upgrade's, not yet
  built at `7664027` [C]. It arrives with the upgrade, and is in the fog patch about the
  upgrade's labels.
- **Section 13 has 134 rows in 13 tables** [M], not the 150 measured while charting. Many rows
  give two or three wordings, and the code has about 135 message templates in `src/math/`
  alone [M], so the rows are not a count of keys.

## The Math guide

- `docs/math-guide.md`: 598 lines (the test's limit is 600), 8,238 words, 17 sections under
  `##` and 20 headings in all, 5 code blocks, 17 tables headed `Write | Shows | Note`, 276
  table rows, of which 173 are examples whose Write cell is a line [M].
- **The Shows column holds messages.** 32 example rows show an error (`●`) and 5 a warning
  (`⚠`), in the engine's English words, and `src/math/math-guide.test.ts` runs every example
  and compares the engine's text with the Shows cell [C][M]. In the Portuguese guide those 37
  cells would be Portuguese, so that test has to word the engine's result in the guide's
  language before it compares [I].
- The same test lists the 17 section titles in English (`SECTIONS`, and again in "checks
  examples in every section that has math") and checks that every link lands on one of the
  guide's own headings [C].
- The guide's build errors (`markdown.ts`: `line 12: the code block never ends`) are for the
  guide's author at build time, not for a user [C].

## Sizes for the last ticket

- **The engine's messages** are about 135 templates in 13 files, and six places read
  English back with a regex: three of math.js's messages and its ` (char N)` suffix, and two
  of the app's own sentences (`N of M points failed.` and `N values`, both above). Engine tests write the
  expected message as English text: `evaluate.test.ts` alone builds 129 expected results with
  `error('…')` [M].
- **The tests that find things by their English names**: 413 lines across the test files and
  the six Playwright runs use `getByText`, `getByLabelText`, `getByTitle` or a role's `name`,
  and 594 lines compare text with `toBe`, `toEqual`, `toContain` or `toMatch` [M]. The
  heaviest are `MathOverlay.test.tsx` (180), `App.test.tsx` (163),
  `MathOverlay.excalidraw.test.tsx` (59) and `symbolInsert.test.ts` (45) [M]. These run in
  English and keep working as long as English stays the default and its words don't change
  [I].
- **Catalogue data** (Symbols, Constants, unit kinds, suggestions) is about 160 strings
  in four files, all pure data read at import (route 3) [C][M].
- **The modules with the most text**: `src/math/` (≈ 155 with result words), `src/panel/`
  (≈ 140), catalogue data (≈ 160), `src/overlay/` (≈ 70), `src/canvas/` (≈ 35) [M].

## Not done

- No string was followed to the screen in a browser: the routes are read from the code, and
  only the engine's messages were run.
- The filter's misses were counted by hand for the Symbols hints, the unit kinds, Solve
  details and `Sheet units`. Others of one word may remain.
- The Math assistant's text (0.6.0) isn't in the code yet, and isn't counted.
