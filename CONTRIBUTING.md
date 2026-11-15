# Contributing to Excalimathpad

Thank you for your interest in contributing to Excalimathpad! We appreciate bug reports, feature requests, documentation fixes and code alike.

Excalimathpad v1 has a written scope ([spec section 1](docs/spec-v1.md#1-what-v1-is-and-what-it-isnt)). A change outside it is best raised as an issue first, so we can agree on it before any code is written.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Spec, CONTEXT.md and ADRs](#spec-contextmd-and-adrs)
- [Project Structure](#project-structure)
- [Engineering Rules](#engineering-rules)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Releasing](#releasing)
- [Reporting Issues](#reporting-issues)
- [Code of Conduct](#code-of-conduct)
- [License](#license)

## Getting Started

You need **Node.js** `^22.22.2 || ^24.15.0 || >=26` and **npm 10+**. CI runs on the lowest supported version, 22.22.2.

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
| `npm run audit:plugin` | Check `dist-plugin/`: three files, each under 5,000,000 bytes, nothing that reaches the network |
| `npm run test:blocked` | Open the built plugin in headless Chromium with the network blocked (Playwright's Chromium: `npx playwright install chromium` once) |
| `npm run test:popout` | Open the built plugin in headless Chromium with a sheet tab in a pop-out window, and check it drags, places math, opens Help and the Math guide, pastes and copies there |
| `npm run test:touch` | Open the built plugin in headless Chromium by touch, at a phone and a tablet viewport, as Android and as iOS, and check the touch gestures, the quick keys and the phone's bottom sheet |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | Lint with oxlint, then Obsidian's ESLint rules at zero warnings |
| `npm test` | Run the tests once with Vitest (jsdom) |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run typecheck` | Run the TypeScript project build, with no output files |
| `npm run check` | Run lint, the tests, both builds, the plugin audit, the blocked run, the pop-out run and the touch run. **This is what CI runs, so run it before you push** |

### Typical workflow

1. Find or open an issue that describes the change.
2. Create a feature branch from `main`.
3. Make the change, with tests.
4. Update the spec, [`CONTEXT.md`](CONTEXT.md) and the ADRs where the change touches them. See the [next section](#spec-contextmd-and-adrs).
5. Check the change by hand in the running app (`npm run dev`).
6. Make sure `npm run check` passes.
7. Open a pull request against `main`.

## Spec, CONTEXT.md and ADRs

The project keeps four documents in step with the code. A pull request that changes what they describe updates them in the same pull request.

| Document | Says | Update it when |
|---|---|---|
| [`docs/spec-v1.md`](docs/spec-v1.md) | What v1 **will be** | Behaviour changes. **Behaviour doesn't change without this file changing.** Record the change under [Changes since agreed](docs/spec-v1.md#changes-since-agreed) |
| [`CONTEXT.md`](CONTEXT.md) | What the code **is today**: modules, interfaces, terms, invariants | You add or change a module, an interface, a term or an invariant. Use the spec's names |
| [`docs/adr/`](docs/adr/) | **Why**, for choices that are hard to reverse | You make, or amend, a decision of that kind. Add a new numbered ADR or amend the existing one |
| [`docs/math-guide.md`](docs/math-guide.md) | **How to use it**, for users: every form, key and setting, with examples. Shown in the app from ☰ → Math guide | Something a user types, sees or presses changes: a line form, a unit, a setting, a key or a message. Its examples run in CI, so a change that alters one fails `src/math/math-guide.test.ts` until the guide follows |

Background investigations go in [`docs/research/`](docs/research/).

## Project Structure

```
src/
├── App.tsx       Composition root
├── shell/        Layout slots: canvas, overlay, side panel
├── canvas/       Everything that knows Excalidraw
├── math/         The engine: evaluateSheet, units, solve, lists, tables, plots, TeX
├── overlay/      Typeset grids, the line edit, gestures, unit slot, suggestions
├── panel/        Sheet panel tabs: Format, Symbols, Variables, Problems, Constants, Settings
├── file/         The .excalimathpad file, save, open, recovery copy
├── guide/        The Math guide: docs/math-guide.md as elements, and its dialog
└── test/         jsdom stubs and helpers (not app code)
plugin/           The Obsidian plugin: the only code that imports `obsidian`
└── test/         The fake `obsidian`, the plugin's tests and the pump sheet fixture
scripts/          The plugin's bundle audit, its browser runs and the version step
docs/
├── spec-v1.md    The v1 spec
├── math-guide.md The Math guide, for users, shown in the app
├── adr/          Architecture decision records
├── research/     Investigations behind decisions
└── acceptance/   The pump-sizing acceptance sheet and its Python reference
```

[`CONTEXT.md`](CONTEXT.md) describes each module's interface and what it depends on.

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

## Releasing

The web app and the Obsidian plugin share **one version**, from `package.json` ([spec section 12a](docs/spec-v1.md#releases)). The hosted web app still deploys on every push to `main`; the plugin moves only when the maintainer releases it.

- **The Release button.** Actions → **Release** → **Run workflow**, on `main`, with patch, minor or major. The first release is **minor**, from `0.0.0` to `0.1.0`; `1.0.0` waits for v1's finish line. The workflow (`.github/workflows/release.yml`) runs `npm version`, then `npm run check` against the bumped build, then pushes the version commit and tag to `main` together, and drafts a GitHub release with `main.js`, `manifest.json` and `styles.css`, this checklist and generated notes. If the check fails, nothing is pushed.
- **One commit.** `npm version <bump>` runs `scripts/version.mjs`, which copies the version into `manifest.json` and adds a line to `versions.json` when `minAppVersion` has changed (it is `1.7.2`), so all three move in one commit, "Release x.y.z". Tags are `x.y.z`, with no `v` (`.npmrc`). Don't edit the version by hand.
- **Publish the workflow's draft.** Open the draft it made on the Releases page, click **Edit**, then **Publish release**. Don't use **Draft a new release**: a release made by hand on the same tag has no files, and BRAT refuses it.
- **`main.js` is never committed.** It is built in the workflow and attached to the release.
- **The plugin's stamp** in the ☰ menu is its version (`0.1.0`); the web app's stamp stays the commit and date.
- **Betas** are installed through [BRAT](https://github.com/TfTHacker/obsidian42-brat) from this repository until the plugin is listed. Fixes ship as `0.1.x`.

**Before Publish,** tick the draft's checklist. It is this list, kept in `.github/release-checklist.md`:

- [ ] Install the release's three files in a test vault, by hand or with BRAT
- [ ] Open a sheet
- [ ] Type a line and see its result
- [ ] Close and reopen it, and see the line kept
- [ ] Repeat on one phone or tablet
- [ ] The device checklist, on an iPhone, an iPad, an Android phone and an Android tablet, before the first release with `isDesktopOnly: false` and before any release that changes touch, panel or overlay code (otherwise say in the notes that it was skipped): open a sheet from the vault; Add math from More tools, then a tap; double-tap a line and the title, and see the keyboard come up; Done, ↑ ↓ and Edit; format, with a rule; Symbols and the quick keys; a tap's tip, and the unit slots and ⚙ a touch selection shows; save, close and reopen; a sync round trip; on a phone, the bottom sheet stays above the keyboard
- [ ] Write each device's result, with the device and OS versions, in the release notes. If any device failed, don't publish: set `isDesktopOnly: true` in `manifest.json` and release again

## Reporting Issues

Use [GitHub Issues](https://github.com/matheus-sancha/excalimathpad/issues) to report bugs or request features. Please include:

- **For bugs:**
  - the sheet lines that show the problem (or the `.excalimathpad` file);
  - the steps to reproduce it;
  - what you expected and what you saw;
  - your browser and OS;
  - the build stamp from the last line of the ☰ menu.
- **For features:**
  - the calculation you are trying to do;
  - what is missing;
  - the approach you propose, if you have one.

## Code of Conduct

This project follows its [Code of Conduct](CODE_OF_CONDUCT.md). By taking part, you agree to follow it.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
