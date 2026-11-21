# Contributing to Excalimathpad

Thank you for your interest in contributing to Excalimathpad! We appreciate bug reports, feature requests, documentation fixes and code alike.

Excalimathpad v1 has a written scope ([spec section 1](docs/spec-v1.md#1-what-v1-is-and-what-it-isnt)). A change outside it is best raised as an issue first, so we can agree on it before any code is written.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Spec, CONTEXT.md and ADRs](#spec-contextmd-and-adrs)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Engineering Rules](#engineering-rules)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Build and Deploy](#build-and-deploy)
- [Releasing](#releasing)
- [Roadmap](#roadmap)
- [Reporting Issues](#reporting-issues)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

## Getting Started

You need **Node.js** `^22.22.2 || ^24.15.0 || >=26` and **npm 10+**. CI runs on the lowest supported version, 22.22.2. The Node floor is set by jsdom, which the tests use; Vite 8 alone would accept less. Both are also declared in `package.json` `engines`.

1. Fork the repository.
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/excalimathpad.git
   cd excalimathpad
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:5173](http://localhost:5173) in **Chrome or Edge on desktop**, the browsers v1 supports.

## Development Workflow

### Common commands

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (hot reload) |
| `npm run build` | Type-check, then build both homes: `build:web` and `build:plugin` |
| `npm run build:web` | The web app's production build in `dist/` (Vite) |
| `npm run build:plugin` | The Obsidian plugin in `dist-plugin/`: `main.js`, `styles.css`, `manifest.json` (`esbuild.plugin.mjs`) |
| `npm run audit:plugin` | Check `dist-plugin/`: three files, each under 5,000,000 bytes and within its budget (`BUDGET` in `scripts/audit-plugin.mjs`), nothing that reaches the network |
| `npm run test:blocked` | Open the built plugin in headless Chromium with the network blocked (Playwright's Chromium: `npx playwright install chromium` once) |
| `npm run test:popout` | Open the built plugin in headless Chromium with a sheet tab in a pop-out window, and check it drags, places math, opens Help and the Math guide, pastes, copies and prints its own sheet there |
| `npm run test:touch` | Open the built plugin in headless Chromium by touch, at a phone and a tablet viewport, as Android and as iOS, and check the touch gestures, the quick keys, the phone's bottom sheet, the rename form's 40 px buttons, the rename offer's row at the top of the phone's bottom sheet and its card on the tablet, and that there is no Print… |
| `npm run test:follow` | Open the built plugin in headless Chromium, type a long plot line near the window's bottom, press Enter and Esc, and check the math stays drawn on its box and the caret stays in view; then check the line's field wraps at 1280 px and 880 px |
| `npm run test:panel` | Open the built plugin and the built web app in headless Chromium and check the Sheet panel: 320 px and docked at 1536, 1280 and 1000 px, closed on an edit at 880 px, the drag handle and its keys, the docking width following the drag, the width remembered after a restart and a reload, every tab usable at 280 px, and a rename from a Variables row on the pump sheet: its form, its refusals, one Ctrl+Z, and a nudge or an open line as its own step before it; and the offer on a committed line with real keys: the card and its count, a line typed while it waits, Rename and the Ctrl+Z steps, Keep, and where the card is drawn at 640, 1280 and 2560 px |
| `npm run test:print` | Open the built web app in headless Chromium, print the pump and true-position sheets through Print… into real PDFs and read them back: every line, result, table row and plot, no math missing, nothing twice, the footer on each page, the window's title, the sheet left as it was, and the one line the browser's own Print prints; and the built plugin's Print… from its command and ☰, offline: the pages in its hidden frame, KaTeX's fonts there, the paper's notice, the title, and the frame gone after |
| `npm run test:probe` | The odd-values probe: about 40,000 sheets of odd values through the engine and the view, about 8 minutes. Not part of `check`: run by hand before a release |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | Lint with oxlint, then Obsidian's ESLint rules at zero warnings |
| `npm test` | Run the tests once with Vitest (jsdom) |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run typecheck` | Run the TypeScript project build, with no output files |
| `npm run check` | Run lint, the tests, both builds, the plugin audit, the blocked run, the pop-out run, the touch run, the follow run, the panel run and the print run. **This is what CI runs, so run it before you push** |

### Typical workflow

1. Find or open an issue that describes the change.
2. Create a feature branch from `main`.
3. Make the change, with tests.
4. Update the spec, [`CONTEXT.md`](CONTEXT.md) and the ADRs where the change touches them. See the [next section](#spec-contextmd-and-adrs).
5. Check the change by hand in the running app (`npm run dev`).
6. Make sure `npm run check` passes.
7. Open a pull request against `main`.

## Spec, CONTEXT.md and ADRs

The project keeps five documents in step with the code. A pull request that changes what they describe updates them in the same pull request.

| Document | Says | Update it when |
|---|---|---|
| [`docs/spec-v1.md`](docs/spec-v1.md) | What v1 **will be** | Behaviour changes. **Behaviour doesn't change without this file changing.** Record the change under [Changes since agreed](docs/spec-v1.md#changes-since-agreed) |
| [`CONTEXT.md`](CONTEXT.md) | What the code **is today**: the model, the terms, the invariants and one line per module. It has a size budget, checked by `npm run check` | You add or change a term, an invariant or a module's one line. Use the spec's names. Behaviour goes in the spec, not here |
| [`docs/context/`](docs/context/) | One file per module: its files, its interfaces and how they work together | You add or change a module or an interface |
| [`docs/adr/`](docs/adr/) | **Why**, for choices that are hard to reverse | You make, or amend, a decision of that kind. Add a new numbered ADR or amend the existing one |
| [`docs/math-guide.md`](docs/math-guide.md) | **How to use it**, for users: every form, key and setting, with examples. Shown in the app from ☰ → Math guide | Something a user types, sees or presses changes: a line form, a unit, a setting, a key or a message. Its examples run in CI, so a change that alters one fails `src/math/math-guide.test.ts` until the guide follows |

The issue orders of the milestones already built, the results of the spec's Verify first items and its decision index are in [`docs/spec-history.md`](docs/spec-history.md). [`CLAUDE.md`](CLAUDE.md) tells a coding agent which of these to read for an issue.

Background investigations go in [`docs/research/`](docs/research/): units, solvers, undo, printing, the PWA and the Obsidian plugin. The two acceptance sheets are in [`docs/acceptance/`](docs/acceptance/): the pump sheet with its independent reference calculation, and the true-position sheet.

## Architecture

Excalimathpad is a **non-destructive wrapper**. Excalidraw owns the scene, selection, moving and undo. Each math element is anchored to an ordinary Excalidraw rectangle that stores its source in `customData` ([ADR 0002](docs/adr/0002-math-elements-anchor-to-excalidraw-rectangles.md)). The math is drawn in an overlay above the canvas.

It wraps the official `@excalidraw/excalidraw` component, never a fork ([ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md)), and evaluates with [math.js](https://mathjs.org) entirely on the client. There is no server. One source builds two homes ([ADR 0006](docs/adr/0006-plugin-bundles-the-app-from-one-source.md)): the web app, as static files that save sheets to your disk, and the Obsidian plugin, which opens sheets from a vault in its own tab.

```
src/
├── main.tsx          The web entry: mounts App
├── App.tsx           Composition root: wires the file, canvas, overlay and panel
├── shell/            Full-viewport layout: canvas, overlay and side-panel slots
├── canvas/           Everything that knows Excalidraw: anchors, Add math, the ☰ menu,
│                     More tools items, sizes, selection, scene (de)serialisation
├── math/             The engine: evaluateSheet(blocks) → one result per line.
│                     The only module that imports math.js. Units, solve, lists,
│                     tables, plots, typesetting to TeX
├── overlay/          Typeset grids over the canvas, the line edit, gestures,
│                     unit slot, suggestions, hover tips, plot drawing
├── panel/            Sheet panel tabs: Format, Symbols, Variables, Problems,
│                     Constants, Settings
├── file/             The .excalimathpad file: save, open, recovery copy, migrations
├── guide/            The Math guide: docs/math-guide.md as elements, and its dialog
└── test/             jsdom stubs and helpers for tests against real Excalidraw
plugin/               The Obsidian plugin: the only code that imports `obsidian`
└── test/             The fake `obsidian`, the plugin's tests and the pump sheet fixture
scripts/              The plugin's bundle audit, its browser runs and the version step
docs/
├── spec-v1.md        The v1 spec
├── math-guide.md     The Math guide, for users, shown in the app
├── adr/              Architecture decision records
├── research/         Investigations behind decisions
└── acceptance/       The acceptance sheets: pump sizing, with its Python reference,
                      and true position
```

### How it works

1. **Anchor.** Placing a math element creates an Excalidraw rectangle tagged `customData.kind = "math"`. Its `customData.source` is the only stored copy of the math.
2. **Reading order.** On every change, the overlay sorts the anchors top to bottom, then left to right ([ADR 0003](docs/adr/0003-sheet-evaluates-in-reading-order-in-one-scope.md)).
3. **Evaluation.** `evaluateSheet` runs every line in one fresh scope. It never throws, and a failed line does not stop the lines after it.
4. **Overlay.** Each element is drawn over its anchor's scene position as a KaTeX grid, and the anchor's size is kept equal to the grid's. These size writes and style restorations add no undo step.
5. **Line commit.** Leaving an edited line writes the element's whole source once, as one undo step on Excalidraw's own stack.
6. **File.** The scene is saved as Excalidraw JSON plus an `excalimathpad` block for settings and the format version ([ADR 0004](docs/adr/0004-sheet-file-is-excalidraw-json-plus-a-block.md)). Older files are upgraded on open, and files from a newer version are refused. In a vault, the plugin's view saves through Obsidian in place of the web app's file access and recovery copy.

[`CONTEXT.md`](CONTEXT.md) names each module and what it depends on, and [`docs/context/`](docs/context/) describes each one's interface.

## Tech Stack

| Concern | Library | Why |
|---|---|---|
| Whiteboard | [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) 0.18 | The canvas, tools, selection and undo, wrapped and never forked |
| Evaluation and units | [math.js](https://mathjs.org) 15 | Safe expression parsing with a full unit system. The app closes every route an expression could use to change the shared instance |
| Typesetting | [KaTeX](https://katex.org) 0.16 | Fast, synchronous TeX to HTML, loaded lazily |
| Plots | [Observable Plot](https://observablehq.com/plot/) 0.6 | Declarative SVG charts, loaded only when a sheet has a plot |
| UI | React 19 | Matches Excalidraw's own stack |
| Build | Vite 8 + TypeScript 6; esbuild for the plugin | Fast HMR and a static web build with relative URLs; the plugin as one `main.js` and one `styles.css` |
| Quality | Vitest 5 (jsdom), Testing Library, oxlint, `eslint-plugin-obsidianmd`, Playwright's Chromium | Tests run against the real Excalidraw component; the built plugin runs in a headless browser |
| Hosting | Cloudflare Pages | Deployed by CI from the exact build that passed |

## Engineering Rules

These rules keep the architecture sound, and the tests check several of them. Please don't break them without first changing the ADR that sets them.

- **Excalidraw stays unforked.** Only `src/canvas/` imports `@excalidraw/excalidraw` at runtime. Other modules may import its types, and tests may import it. See [ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md) and [ADR 0002](docs/adr/0002-math-elements-anchor-to-excalidraw-rectangles.md).
- **Only `src/math/` imports `mathjs`.** App code evaluates only through `evaluateSheet`.
- **One source, two builds.** `src/` never imports `obsidian` or `plugin/`; oxlint and `plugin/test/boundary.test.ts` both check it. The plugin makes no network request and stores nothing outside the vault: `npm run check` audits the bundle, runs it with the network blocked, and runs it in a pop-out window. See [ADR 0006](docs/adr/0006-plugin-bundles-the-app-from-one-source.md).
- **No `eval()` or `new Function()`.** Expressions are parsed by math.js. The engine closes every route an expression could use to change the shared math.js instance, and each of those closures has a test. Keep it that way.
- **The anchor's `customData.source` is the only stored copy of an element's math.** Write it only through `writeAnchorSource`.
- **Keep undo honest.** A line commit is one undo step, and keystrokes are none. Size and style writes add no undo step and never make a clean sheet dirty.
- **Evaluation never throws.** A failed line reports its own error, and the lines below it still run.
- **Pure where possible.** Decisions such as gestures, line edits, reading order and number formatting live in pure modules, so they can be tested without a DOM.

## Code Style

- **TypeScript.** All code must pass `npm run typecheck`, with `noUnusedLocals` and `noUnusedParameters` enabled.
- **React.** Use function components with hooks.
- **Lint.** oxlint with the `react`, `typescript` and `oxc` plugins. `npm run lint` must be clean.
- **Formatting.** 2-space indent, no semicolons, single quotes, no trailing whitespace. Match the file you are editing.
- **Names follow the spec.** Use the spec's terms in code, tests and docs: *math element*, *anchor*, *line commit*, *reading order*, *unit slot*.
- **Comments.** Explain *why* when it isn't obvious from the code, and point to the spec section or ADR that decided it.

## Testing

- **Unit tests** sit next to the code, as `*.test.ts` or `*.test.tsx`.
- **Tests against the real Excalidraw component** are named `*.excalidraw.test.tsx`. Use them when behaviour depends on Excalidraw's DOM or API, such as class names in More tools or undo steps.
- **The pump sheet is in CI.** `src/math/pump-sizing.test.ts` reads its lines from [`docs/acceptance/pump-sizing.md`](docs/acceptance/pump-sizing.md) and checks every result to 4 significant figures against an independent Python reference. A change that alters a result there needs a very good reason.
- **The true-position sheet is in CI** (from M4e). `src/math/true-position.test.ts` reads its lines and its `check` line's stored format from [`docs/acceptance/true-position.md`](docs/acceptance/true-position.md), and checks its results to 4 significant figures, its chart (one point, one circle) and "Fail" with `dx = 0.12 mm`.
- **The typing test** (`src/typing.test.tsx`) types every Math guide example and both acceptance sheets one character at a time, and fails on any throw. A new example in the guide is typed too.
- **The Math guide is in CI.** `src/math/math-guide.test.ts` runs each section of [`docs/math-guide.md`](docs/math-guide.md) as one sheet: every `Write | Shows | Note` row (a Write cell in italics marks a row that isn't math, and is skipped) and every `sheet` code block, whose results follow `→`. It also fails on a link outside the guide. Write a Shows cell as the screen shows the result (`82.19 cm²`); `—` is an empty result cell, `` ● `message` `` an error and `` ⚠ `message` `` a warning.
- **Fixing a bug?** Add a test that fails without the fix.

## Commit Messages

Write the subject as a short, plain sentence about what the change does, without a type prefix. When there is an issue, end with its number in parentheses:

```
Show a problem's message on hover over the gutter mark (#58)
Range solve, the roots found in a range (#105)
A comment line wraps at the element's width (#98)
Spec: milestone M4c Improvements, before M5
```

- Prefix a change that only touches documentation with its area: `Spec:`, `Research:`, `ADR:` or `Docs:`.
- Use the body, if needed, to explain *why*.

## Pull Requests

A new pull request starts from [the template](.github/pull_request_template.md): fill in its sections and tick its checks.

1. **Keep it focused.** One issue, feature or fix per pull request.
2. **Describe it.** Say what changed and why, and link the issue.
3. **Keep the docs in step.** Update the spec, `CONTEXT.md` and the ADRs as described [above](#spec-contextmd-and-adrs).
4. **Pass CI.** `npm run check` must pass on Node 22.22.2.
5. **Add tests** for new behaviour, and for each bug you fix.
6. **Show UI changes.** Include a screenshot or a short recording.

A merge to `main` deploys to <https://excalimathpad.pages.dev>. Pull requests never deploy.

## Build and Deploy

`dist/` is plain static files with relative asset URLs. You can serve it from any static host or sub-path: GitHub Pages, Netlify, an S3 bucket or a local folder server. There is no backend. `dist-plugin/` holds the plugin's three files; the [Release workflow](#releasing) attaches them to a release.

### The hosted build

A push to `main` that passes `npm run check` publishes that run's `dist/` to Cloudflare Pages, through the `deploy` job in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Pull requests deploy nothing. The job is skipped until the repository has:

- the Actions **variable** `CLOUDFLARE_PAGES_PROJECT`, the name of the Pages project. It must be a direct-upload project, created in Cloudflare first;
- the Actions **secrets** `CLOUDFLARE_API_TOKEN` (with permission to edit Pages) and `CLOUDFLARE_ACCOUNT_ID`.

To check the two secrets from a terminal:

1. Set them as environment variables.
2. Run `npx wrangler@4 pages project list`. It should list the project.

`wrangler whoami` fails with a token that can only edit Pages, so it is not a useful check.

The ☰ menu's last line shows the build stamp: the short commit and date (`389dd51 · 2026-11-12`), or `dev` for a build made outside CI.

## Releasing

The web app and the Obsidian plugin share **one version**, from `package.json` ([spec section 12a](docs/spec-v1.md#releases)). The hosted web app still deploys on every push to `main`; the plugin moves only when the maintainer releases it.

- **The Release button.** Actions → **Release** → **Run workflow**, on `main`, with patch, minor or major. The first release is **minor**, from `0.0.0` to `0.1.0`; `1.0.0` waits for v1's finish line. The workflow (`.github/workflows/release.yml`) runs `npm version`, then `npm run check` against the bumped build, then pushes the version commit and tag to `main` together, and drafts a GitHub release with `main.js`, `manifest.json` and `styles.css`, this checklist and generated notes. If the check fails, nothing is pushed.
- **One commit.** `npm version <bump>` runs `scripts/version.mjs`, which copies the version into `manifest.json` and adds a line to `versions.json` when `minAppVersion` has changed (it is `1.7.2`), so all three move in one commit, "Release x.y.z". Tags are `x.y.z`, with no `v` (`.npmrc`). Don't edit the version by hand.
- **Publish the workflow's draft.** Open the draft it made on the Releases page, click **Edit**, then **Publish release**. Don't use **Draft a new release**: a release made by hand on the same tag has no files, and BRAT refuses it.
- **`main.js` is never committed.** It is built in the workflow and attached to the release.
- **The plugin's stamp** in the ☰ menu is its version (`0.1.0`); the web app's stamp stays the commit and date.
- **Betas** are installed through [BRAT](https://github.com/TfTHacker/obsidian42-brat) from this repository until the plugin is listed. Fixes ship as `0.1.x`.
- **To 1.0.0.** `0.2.1` is a fix release. M4e ships as the beta `0.3.0` through BRAT, M5 follows (both are built), and the release after it is `1.0.0`, the version submitted to the community list. A sheet saved by `0.3.0` or later is format 2, which `0.2.x` refuses, so every device takes the beta before one of them saves a sheet.
- **Start-up.** The plugin's own figure in Obsidian's startup-time view is read on the work laptop and recorded on one phone. If the laptop's figure is over 150 ms, loading the app only when the first sheet opens is built before `1.0.0`; otherwise after.

**Before Publish,** tick the draft's checklist. It is this list, kept in `.github/release-checklist.md`:

- [ ] Install the release's three files in a test vault, by hand or with BRAT
- [ ] Open a sheet
- [ ] Type a line and see its result
- [ ] Close and reopen it, and see the line kept
- [ ] Repeat on one phone or tablet
- [ ] Run the odd-values probe, `npm run test:probe` (about 8 minutes), and see it pass
- [ ] The device checklist, on an iPhone, an iPad, an Android phone and an Android tablet, before the first release with `isDesktopOnly: false` and before any release that changes touch, panel or overlay code (otherwise say in the notes that it was skipped): open a sheet from the vault; Add math from More tools, then a tap; double-tap a line and the title, and see the keyboard come up; Done, ↑ ↓ and Edit; format, with a rule; Symbols and the quick keys; a tap's tip, and the unit slots and ⚙ a touch selection shows; save, close and reopen; a sync round trip; on a phone, the bottom sheet stays above the keyboard
- [ ] Write each device's result, with the device and OS versions, in the release notes. If any device failed, don't publish: set `isDesktopOnly: true` in `manifest.json` and release again

**Before `1.0.0` is published,** besides the draft's checklist and the device checklist (M4e and M5 change panel and overlay code, so it runs again on the four devices), check by hand:

- On the work laptop, in Obsidian: a format 1 sheet saved by `0.2.x` opens with its formats and saves as format 2.
- The pump sheet and the true-position sheet show their values.
- Print… gives a clean PDF through the system dialog, on the paper its notice names, and in the web app in Chrome.
- The Sheet panel docks, drags and remembers its width.
- The plugin's start-up time is read in Obsidian's startup-time view.
- The odd-values probe (about 8 minutes) has run.
- On the four devices, also: no Print… command, the bottom sheet's sample, and a tablet docking the panel by its width.

## Roadmap

v1 is built in milestones ([spec section 16](docs/spec-v1.md#16-milestones-and-finish-line)). M1 to M5 are built; the next release is `1.0.0`, submitted to Obsidian's community list, and v1 is done when its checks below have passed and it is published. The web app targets Chrome and Edge on desktop; the plugin targets Obsidian 1.7.2 or later.

- [x] **M0 Spike.** Live recalculation across math elements.
- [x] **M1 Keepable sheet.** Typeset lines, line-by-line editing, undo, save and open, recovery copy.
- [x] **M2 Units & panel.** App units, number format, unit systems, display units, warnings, the Sheet panel, the unit slot.
- [x] **M3 Solve.** Solve for a value, solve functions, nested solves, solve details on hover.
- [x] **M4 Ranges & plots.** Ranges and lists, tables, plots, plot settings.
- [x] **M4b Hosted build.** Deployed to Cloudflare Pages on merge, with a build stamp.
- [x] **M4c Improvements.** Range solve for every root, indexing, text colours, conditional formats, chosen width, title format.
- [x] **M4d Plugin & panel.** The Obsidian plugin on desktop, phone and tablet; the Format, Rules and Symbols tabs; checks with `if()` and text; comment-line formats; the Math guide.
- [x] **M4e Room to work.** Unexpected failures stay small; a line's format stored beside it; the line's field wraps; a wider, resizable Sheet panel; a point in a tolerance circle as one chart; a lighter plugin; the true-position sheet.
- [x] **M5 Print.** Print the sheet to clean PDF pages, from the web app and from Obsidian on a computer.
- [ ] **M6 Offline PWA** (after 1.0.0). Install the app, work offline, open a `.excalimathpad` file from the desktop.

**v1 is done, and released as 1.0.0,** when all three hold:

1. The [pump sheet](docs/acceptance/pump-sizing.md) passes steps 1-4, step 4 in both homes.
2. The [true-position sheet](docs/acceptance/true-position.md) passes its checks, and the release checklist has passed on the build that becomes 1.0.0.
3. It has been used for one real calculation other than the pump sheet. This is met: the true-position sheet.

What v1 deliberately leaves out is listed in [spec section 1](docs/spec-v1.md#1-what-v1-is-and-what-it-isnt). The roadmap follows the maintainer's own engineering work.

## Reporting Issues

Support is free and best effort, with no response time. Open an issue from one of the two [forms](https://github.com/matheus-sancha/excalimathpad/issues/new/choose); blank issues are off.

- **[Bug](https://github.com/matheus-sancha/excalimathpad/issues/new?template=bug.yml):** the version from the last line of the ☰ menu, the home (Obsidian or the browser), the device, and the steps, with the sheet lines that show the problem. Attach a `.excalimathpad` file only if it holds nothing confidential.
- **[Idea](https://github.com/matheus-sancha/excalimathpad/issues/new?template=idea.yml):** the calculation you are trying to do, what is missing, and the approach you propose, if you have one.
- **A security problem** goes through private vulnerability reporting, never an issue: see [SECURITY.md](SECURITY.md).

The forms live in [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

## Code of Conduct

This project follows its [Code of Conduct](CODE_OF_CONDUCT.md). By taking part, you agree to follow it.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
