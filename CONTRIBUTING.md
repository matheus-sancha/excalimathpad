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
| `npm run build` | Type-check, then make a production build in `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | Lint with oxlint |
| `npm test` | Run the tests once with Vitest (jsdom) |
| `npm run test:watch` | Run the tests in watch mode |
| `npm run typecheck` | Run the TypeScript project build, with no output files |
| `npm run check` | Run lint, the tests and the build. **This is what CI runs, so run it before you push** |

### Typical workflow

1. Find or open an issue that describes the change.
2. Create a feature branch from `main`.
3. Make the change, with tests.
4. Update the spec, [`CONTEXT.md`](CONTEXT.md) and the ADRs where the change touches them. See the [next section](#spec-contextmd-and-adrs).
5. Check the change by hand in the running app (`npm run dev`).
6. Make sure `npm run check` passes.
7. Open a pull request against `main`.

## Spec, CONTEXT.md and ADRs

The project keeps three documents in step with the code. A pull request that changes what they describe updates them in the same pull request.

| Document | Says | Update it when |
|---|---|---|
| [`docs/spec-v1.md`](docs/spec-v1.md) | What v1 **will be** | Behaviour changes. **Behaviour doesn't change without this file changing.** Record the change under [Changes since agreed](docs/spec-v1.md#changes-since-agreed) |
| [`CONTEXT.md`](CONTEXT.md) | What the code **is today**: modules, interfaces, terms, invariants | You add or change a module, an interface, a term or an invariant. Use the spec's names |
| [`docs/adr/`](docs/adr/) | **Why**, for choices that are hard to reverse | You make, or amend, a decision of that kind. Add a new numbered ADR or amend the existing one |

Background investigations go in [`docs/research/`](docs/research/).

## Project Structure

```
src/
├── App.tsx       Composition root
├── shell/        Layout slots: canvas, overlay, side panel
├── canvas/       Everything that knows Excalidraw
├── math/         The engine: evaluateSheet, units, solve, lists, tables, plots, TeX
├── overlay/      Typeset grids, the line edit, gestures, unit slot, suggestions
├── panel/        Sheet panel tabs: Variables, Problems, Settings, Constants
├── file/         The .excalimathpad file, save, open, recovery copy
└── test/         jsdom stubs and helpers (not app code)
docs/
├── spec-v1.md    The v1 spec
├── adr/          Architecture decision records
├── research/     Investigations behind decisions
└── acceptance/   The pump-sizing acceptance sheet and its Python reference
```

[`CONTEXT.md`](CONTEXT.md) describes each module's interface and what it depends on.

## Engineering Rules

These rules keep the architecture sound, and the tests check several of them. Please don't break them without first changing the ADR that sets them.

- **Excalidraw stays unforked.** Only `src/canvas/` imports `@excalidraw/excalidraw` at runtime. Other modules may import its types, and tests may import it. See [ADR 0001](docs/adr/0001-wrap-excalidraw-unforked.md) and [ADR 0002](docs/adr/0002-math-elements-anchor-to-excalidraw-rectangles.md).
- **Only `src/math/` imports `mathjs`.** App code evaluates only through `evaluateSheet`.
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

1. **Keep it focused.** One issue, feature or fix per pull request.
2. **Describe it.** Say what changed and why, and link the issue.
3. **Keep the docs in step.** Update the spec, `CONTEXT.md` and the ADRs as described [above](#spec-contextmd-and-adrs).
4. **Pass CI.** `npm run check` must pass on Node 22.22.2.
5. **Add tests** for new behaviour, and for each bug you fix.
6. **Show UI changes.** Include a screenshot or a short recording.

A merge to `main` deploys to <https://excalimathpad.pages.dev>. Pull requests never deploy.

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
