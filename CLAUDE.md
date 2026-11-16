# Excalimathpad: what to read, and where to write

For any session that builds or changes this repository. The rule itself is in
[spec section 14](docs/spec-v1.md#14-engineering-constraints) (M4e, Documents).

## Reading route

Read these, and no more, before starting an issue:

1. **Always:** [`CONTEXT.md`](CONTEXT.md). The model, the terms, the load-bearing rules and one
   line per module.
2. **The spec sections the issue names,** in [`docs/spec-v1.md`](docs/spec-v1.md). Find a
   section by its heading (`## 7. File and save`, `### Sheet panel`) and read that section,
   not the file: the whole spec is about 70,000 tokens. If the spec and an issue differ, the
   spec wins.
3. **`docs/context/<module>.md` for each module the issue touches:**
   [app](docs/context/app.md), [canvas](docs/context/canvas.md), [math](docs/context/math.md),
   [overlay](docs/context/overlay.md), [file](docs/context/file.md),
   [plugin](docs/context/plugin.md), [guide](docs/context/guide.md),
   [panel](docs/context/panel.md).
4. **An ADR by number, when the issue or a section names it,** in [`docs/adr/`](docs/adr/).

Read on demand only, when one of the above points there: the spec's "Changes since agreed"
log, [`docs/spec-history.md`](docs/spec-history.md) (the built milestones' issue orders, the
results of Verify first, the decision index), [`docs/research/`](docs/research/),
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`docs/math-guide.md`](docs/math-guide.md).

If an issue names no section, find the behaviour in the spec by searching for its terms
before reading the code.

## Writing rule

- **Behaviour goes in the spec:** what a user types, sees or presses, and every rule about
  it. The spec is edited in place and keeps its path and its section numbers, which the code
  cites.
- **`CONTEXT.md` holds the model, the terms and where things are:** entry points, the module
  index, the glossary, the load-bearing rules. It doesn't describe behaviour, and
  `npm run check` fails when it is over its budget (`scripts/docs.test.mjs`). Raise the
  budget only on purpose, in a commit that says what was added.
- **A module's files, interfaces and how they work together go in
  `docs/context/<module>.md`,** with a section number where the behaviour is, not the
  behaviour again.
- **A "Changes since agreed" entry is added only for a change to an agreed rule.** A new
  rule, a build detail or a clarification is written into the section it belongs to, with no
  entry.
- **A Verify first item that gets its result** moves from spec section 17 to
  `docs/spec-history.md`.
- A pull request updates the documents it makes untrue, in the same pull request
  ([`CONTRIBUTING.md`](CONTRIBUTING.md#spec-contextmd-and-adrs)).

## Checks

`npm run check` is what CI runs: lint, the tests, both builds, the bundle audit and the four
Playwright runs. `npm test` alone is the quick loop.
