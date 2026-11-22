# text

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**text** (`src/text/`, spec section 8, Language, and section 14, 0.6.0, #290) — the app's
own words in English and Português (Brasil), and the one way to read them. Depends on:
React (`useSyncExternalStore`) and the engine's message types (`src/math/messages.ts`, types
only); it never imports Excalidraw.

**The two text tables.** `en.ts` is the English table, `export const en = { … }`, grouped by
where the words show (`menu`, `tools`, `welcome`, `hint`, `file`, `print`, `vault`; from issue 4,
#293, `panel`, and the catalogues' `kinds`, `constants`, `symbols` and `suggest`); `Words`
is its type. A catalogue's words are keyed by the catalogue, never held in it: a constant's
description by math.js's name, a symbol's hint by its group and spelling, a kind by its id
(`kinds.name`, and `kinds.a` with its article); `panelWords.test.ts` checks every entry has
its words in both tables. `ptBR.ts` is `export const ptBR: Words = { … }`, so a key missing there, or added
there alone, fails `tsc -b`, and `words.test.ts` holds that with `@ts-expect-error` lines
and checks the two shapes match key by key. A word with arguments is a function of them
in both tables (`tools.errors(count)`), so a plural, an article or the order of words
belongs to the language; no Portuguese text is built from English pieces. The Portuguese
words come from spec section 2's Português column and section 13's.

**The engine's messages** (ADR 0007, spec section 13, section 14, 0.6.0, #291). The engine
returns codes (`EngineMessage`, `src/math/messages.ts`); each table's `engine` group words
every code (`engine.en.ts`, `engine.ptBR.ts`, one file each so they stay their own group), typed
as `EngineWords`, so a code missing from either fails `tsc -b`. `wordMessage(words.engine,
message)` (`engine.ts`) is the one way a message becomes text: it words a message inside a
message first, and hands the code's wording its arguments. `wordPreview` words a list's hover
rows. The Português `mathjs` wording is `mathjsInPortuguese` (`mathjs.ptBR.ts`): section 13's
known patterns over math.js 15.2's exact text, ` (char N)` as ` (caractere N)`, anything else
as math.js wrote it; `mathjs.ptBR.test.ts` holds each pattern against the text math.js throws,
and `engine.test.ts` section 13's Português rows. The app's grouped numbers in these messages
(the limit, `10,000` and `10 000`) are each table's own for now.

**The reader** (`words.ts`). The language is the one Excalidraw shows: the canvas's
`LanguageShown` (`SheetCanvas.tsx`, under Excalidraw's tree) reads its public `useI18n`
and calls `showLanguage` before paint, so the app's words change with Excalidraw's, in
every sheet tab of the window (Excalidraw keeps one language per window, and so does the
reader). English until a sheet shows another. Read a word with:

- `useWords()` in a component: the table of the language shown, drawn again on a change.
- `words()` where something is worded outside React, at the moment it is worded (the
  window title's `displayName`, the save picker's file type in `fileAccess.ts`).
- `onLanguage(listener)` where text already handed out must follow a change: the canvas
  hint's `--math-hint` and `--math-hint-touch` (`markMathSelection`), CSS `content`.
- `wordsFor(language)` for what is worded before any sheet shows a language (the plugin's
  `onload`, from `data.json`). The plugin reads its `vault` group this way for its notices
  and file names too, in `data.json`'s language at that moment, since New sheet can run with
  no sheet tab open ([plugin](plugin.md)).

`shownLanguage()` answers which one is shown; `SheetLanguage` (`en`, `pt-BR`) is defined
here and re-exported by `src/canvas/language.ts`, which keeps the choice and its memory.

**To add a word:** add the key to `en.ts` in the group where it shows (a new group for a
new place), then the same key to `ptBR.ts` (the type check names it until it is there),
then read it with `useWords()` or `words()` where it shows. Never copy a word into a module
constant built at import: a choice in ☰ → Language would never reach it. Tests that find
things by English text keep working, since English is the default; a test that reads
Portuguese chooses it through ☰ (or its memory), as `language.excalidraw.test.tsx` does,
and resets nothing by hand.

**What reads it so far** (0.6.0, issue 1): ☰'s items, the Language row's label and the
build stamp's tooltip, More tools' heading, items and badge (`SheetCanvas.tsx`); the
welcome hint, with its touch wording after a touch press; the canvas hint
(`mathSelection.ts`); the window title and the name beside ☰ (`FileChrome.tsx`,
`displayName`), the save picker's file type (`fileAccess.ts`) and the browser's own Print
line (`--math-print-line` on `<html>`, read by `src/index.css`); in `vault` (issue 6),
the plugin's commands, ribbon, folder item, notices, image picker and file names
(`plugin/`). Issue 5 (#294) adds the
groups `dialogs` (the file's two questions, their buttons, the four messages and the reasons
the app words itself, `FileChrome.tsx`, `sheetSession.ts`, `fileAccess.ts`, `recovery.ts`; the
suggested name `Sem título.excalimathpad`), `printView` (the footer's `2 de 3` and Print…'s
notice, `printView.ts`, `printSheet.ts`), `failure` (`src/failure/`), `offer` (the offer's
card, its lines and row, and the toast after a rename, `OfferCard.tsx`, `renameOffer.ts`,
App), `unitSlot` (`UnitField.tsx`) and `plotSettings` (`PlotSettings.tsx`). A word with
parts that aren't text, as the offer's question with its code and button, is a function that
hands back the words and the parts in the language's order (`offer.question`). The image-too-big toast is
Excalidraw's own `errors.fileTooBig`, from its `t`, not a word of these tables. Issue 4
(#293): the whole Sheet panel, its tab names and the bottom sheet ([panel](panel.md),
[canvas](canvas.md)), with the Symbols and Constants catalogues and the kinds; and the
typing suggestions' details (`suggest.ts`, which `MathOverlay` builds again on a change of
language). Issue 2
(#291) adds `engine`, every engine message: the result cell and the gutter's tip, a table's
and a chart's failed points, the Problems tab, a rule's state and the rename form's reason.

**The Math assistant's words** (section 13, Math assistant, 0.7.0): the tab's name is
`panel.tabs.assistant` and the More tools item `tools.assistant`, in both tables from its
first issue (#306). The setup card's words are the `assistant` group (#307): its fields,
buttons, refusals, each provider's cost line and the lines that name a host. The Send (#310)
adds the conversation's: the first request's confirm (`first`), the empty state, the
suggested questions, the field, "Goes with your message", waiting, Stop and every failure,
and Check key's and Show models' answers.
