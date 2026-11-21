# failure

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**failure** (`src/failure/`) — unexpected failures (spec section 4, Unexpected
failures; the words are section 13's; M4e, #193). The line's own guard is the
engine's (`src/math/evaluate.ts`); this module is the rest.

- `details.ts` (pure): `NO_CONTENT`, `REPORT_URL`, `failureOf(error)` (a
  `Failure`: the raw text, `TypeError: …`, and the stack), `failureDetails(what,
  failure, home, words, language)` (the text Copy details copies, English in both
  languages, with `Language: English` or `Language: Português (Brasil)` after the
  home and device, 0.6.0), `sheetWords(sheet, typing)` (the sheet's own text) and
  `scrub(text, words)`, which cuts those words from the error's text. The stack's
  frames aren't scrubbed.
- The words that show (the notices, the screen, the buttons and the link) are the
  text tables' `failure` group ([text](text.md), 0.6.0), read with `useWords()`. A
  line's own unexpected error is the engine's message (`UNEXPECTED_LINE`,
  [math](math.md)).
- `Boundary.tsx`: the app's one class component. `resetKeys` say what the
  failed part was drawn from: a change of any tries the children again.
  `fallback(failure)` draws in their place. `onFail` runs once per failure,
  during the render, before anything is unmounted (CONTEXT.md, Load-bearing);
  `told` is cleared only by a commit that shows the children, since React can
  render one failure twice before it commits.
- `context.ts`: `FailureContext` (the `FailureHome` and the sheet's words,
  given by `App`; alone it reads as the web with no sheet).
- `failureBox.ts`: `createFailureBox`, what passes from the sheet to the
  view's boundary ([app](app.md)): the text being typed, the sheet as last
  evaluated and the sheet file's `fail`, and at a failure what was kept.
- `FailureActions.tsx`: `CopyButton` (the clipboard of the button's own window, for a pop-out;
  `Copied`; the text in a box where the clipboard refuses),
  `FailureActions`, Copy details (naming `shownLanguage()`) and the plain Report this error
  link, and `FailedNotice`, the notice in place of a failed element, chart or tab: a
  boundary's fallback runs in its render, so it reads its words through that component.
  None takes focus.
- `FailureScreen.tsx` and `Failure.css`: the screen that replaces the view.

Where each boundary is: the view's in `App` ([app](app.md)); an element's and
a chart's in the overlay ([overlay](overlay.md)); a panel tab's in `App`'s
`tab`; the failed line's row in the Problems tab ([panel](panel.md)). What a
failed view keeps and what stops writing is the sheet file's `fail`
([file](file.md)).

Tests: `details.test.ts`, `Boundary.test.tsx`, and the injected failures of
section 14, `injected.excalidraw.test.tsx` (the web) and
`plugin/test/failure.test.ts` (a vault), each in English and in Português. `src/test/sheetStates.tsx` sends
sheet states through the engine and the view for the typing test
(`src/typing.test.tsx`) and the odd-values probe (`src/oddValues.probe.tsx`,
`npm run test:probe`, `vitest.probe.config.ts`): both fail on a throw and on
a line that reached the guard.

Depends on: text (its words), and React.
