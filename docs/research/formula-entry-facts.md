Research for wayfinder ticket #354, 2026-11-26.

# Facts for "What is a built-in formula entry, and how is each one checked?"

This note collects facts for the grilling on
[#354](https://github.com/matheus-sancha/excalimathpad/issues/354) (map
[#344](https://github.com/matheus-sancha/excalimathpad/issues/344)). It decides nothing. Nothing
of the formula library is built. Code facts were read at `7a91167` on
`claude/kind-mccarthy-7aeucj`.

## 1. Data-driven content an entry could mirror

**Constants.** Spec section 5, Constants (`docs/spec-v1.md:1697`), lists every math.js constant,
with short names for the common ones. The data is `src/math/constants.ts`, which its header calls
"Pure data, with no math.js and no words" (lines 1-12). A `ConstantEntry` is `{ name, short? }`
(13-18). A `ConstantGroup` is `{ id, constants }`, where `id` is a `ConstantGroupId` string union
(20-26). `CONSTANT_GROUPS` starts at line 28. The words are kept outside the data and keyed by it:
`en.constants.groups[id]` and `en.constants.description[name]` (`src/text/en.ts:284-300`), with
the same keys in `ptBR.ts:230-240`. `ptBR` is typed `Words` (`ptBR.ts:11`), so a key missing
from either table fails `tsc -b` (`docs/context/text.md:13-24`).
`src/panel/panelWords.test.ts:22-30` checks that both tables describe every constant (62 of them,
a hard-coded count) and name every group. The Constants tab's filter matches the description in
the language shown (`docs/context/panel.md:65-68`).

**Symbols.** `src/math/symbols.ts` has the same shape: no words, and an optional runnable
`example` (`symbols.ts:68`). `src/math/symbols.test.ts:61-67` runs every `example` through
`evaluateSheet` and fails on any error line. It checks only "no error", not a value. A symbol's hint
is keyed by its group and spelling in both tables (`panelWords.test.ts:32-38`).

**The Math guide.** Spec section 8, Math guide (`spec-v1.md:2214-2242`). Each form is a
`Write | Shows | Note` row, or a `sheet` code block with `→` results.
`src/test/guideExamples.ts` reads the rows: `sections()` (27-34), the Shows cell as a value, `—`,
`● error`, prose or `⚠ warning` (46-56), and an italic Write cell as a row to skip (81).
`src/math/math-guide.test.ts:98-113` runs each section as **one sheet**, in order, at the default
Digits 4 and SI. It compares the shown text with spaces, `·` and `^` set aside (`canonical`, 60-65),
and compares the warnings exactly. So the guide already checks text against text, warnings
included, in one scope. `rename.test.ts` reuses the same examples
(`docs/context/math.md:305-310`).

**The Português guide is specified but not built.** The spec has `docs/math-guide.pt-BR.md`
match the English guide "row for row and character for character" in its Write cells, and says a
CI test fails if the two differ (`spec-v1.md:2234-2242`). In this checkout `docs/` holds only
`math-guide.md`, and `math-guide.test.ts` imports only that file (line 2). No row-for-row test
exists yet. `package.json` is at 0.5.0, and the Português guide is a 0.6.0 item.

**App text.** `docs/research/app-text-inventory.md` is the inventory for #285, with 601 strings
in `app-text-inventory/strings.tsv`. Its rule, now in `text.md:16-23`, is that a catalogue's words
are keyed by the catalogue and never held in it, and that no Portuguese text is built from English
pieces. An argument is a function in both tables.

**Acceptance sheets.** `src/math/pump-sizing.test.ts` reads the lines of
`docs/acceptance/pump-sizing.md` and compares them at 4 significant figures with
`pump-sizing.py`, "Plain floats in SI base units, no math.js, so it checks the app independently"
(`pump-sizing.py:1-4`). It re-reads a shown result with a separate math.js and calls
`toNumber(unit)` (`inUnit`, test lines 71-79). This is the closest precedent for "a worked example
from an independent route".

## 2. Fields the closed tickets already imply

| Field | Implied by |
|---|---|
| Name, in English and Português (the block's title is "the entry's name in the language shown at insert") | #352 |
| Group (7 groups, 42 entries) | #351 |
| Source: a primary citation with a locator (author, title, edition, section, equation or table), optionally a free second source | #350 ("Proposed rule for an entry", `formula-library-sources.md:66-78`), #358 (a first and a free second per group) |
| The source comment line's text, `# Source: <citation with locator>` | #352 |
| Inputs: name, example value with unit, and a description (the prototype has `[name, value, what]`, `formula-block-prototype/blocks.mjs:20`) | #352, #344 |
| Formula lines: result name and expression (the prototype has `formulas: [[name, expr, note]]`) | #352 |
| Which names are inputs and which are results ("use yours" reuses inputs set above and suffixes result names) | #352 |
| Comment lines in the language shown, with the math never translated | #352, #344 |
| Assumptions or validity text (Bernoulli: steady, incompressible, inviscid, no pump; Darcy, not Fanning; three-phase line-to-line) | #358 |
| A display unit on a result (ω `in 1/s`) | #358 |
| Our own worked example, its expected value from an independent route, and optionally the published example it agrees with | #350 (rule items 3-4) |
| Search terms in two languages | #344 ("how search matches in two languages" is not yet specified) |
| A figure, drawn from scratch, if any | #344 (open), #350 |
| Material values and friction factors as inputs, not looked up | #351 |

## 3. Checking an entry with today's engine

The harness is `evaluateSheet(blocks, settings)` (`src/math/evaluate.ts:628`), with blocks
`{ id, source, formats? }` (485-494). It never throws. `src/test/english.ts` words results in
English for tests. A `SheetLine` has `result` (`{ kind: 'value', text }`, text only, line 310),
`warnings`, `variables` and `unitSlot`, whose `kind` is one of `KINDS` or `'dimensionless'`
(`display.ts:45-51`, `unitSystems.ts:10-29`).

- **Run the inserted block.** Build the block's lines (title aside, the comment lines included)
  and evaluate them as one block, as `symbols.test.ts` and `math-guide.test.ts` do.
  - Catches: a typo, an undefined name, a unit mismatch that math.js refuses (`Cannot add m
    and s`), and a block that breaks itself through its own names (#358: `m = 2 kg` then
    `r = 0.1 m` gives `200 g`).
  - Misses: a wrong formula that runs.
- **Assert no warnings.** An input named like a unit or built-in gets the `shadows` warning
  (`warnings.ts:15-22`, `messages.ts:28-31`, spec section 5, Warnings). A constant's short name
  doesn't warn unless it is also a unit (`h`, `hbar`).
  - Catches: every textbook name that is a unit (`m`, `L`, `F`, `T`, `V`, `A`, `h`, `g`, `K`)
    and every built-in (`e`, `tau`, `phi`), mechanically.
  - Misses: a name that shadows a constant's short name the user relies on (`R`, `k`, `c`, `G`;
    no warning by design), and collisions with the user's sheet, which are left to insert time
    (#352).
- **Compare against a worked example.** Compare the result text with an expected value at
  4 significant figures, re-read as `pump-sizing.test.ts` does, or as text as the guide does.
  The expected value comes from our own derivation, or a second independent script like
  `pump-sizing.py`, or numerical integration for section properties
  (`formula-library-sources.md:229`).
  - Catches: a wrong formula, a factor of 4 (Darcy and Fanning), a missing sqrt(3).
  - Misses: an error copied into both the entry and the expected value. A test on the example
    values alone also misses a formula wrong only outside them (a sign that cancels at θ = 90°).
- **Check unit consistency.** Compare the result's `unitSlot.kind` with an expected kind, or
  append `<result> in <unit>` and expect no error.
  - Catches: a result of the wrong dimension.
  - Misses: kinds that share a dimension (torque and energy are both N·m; stress is
    `pressure`). Results with no kind (second moment of area, mm⁴) give `kind: null`. A stray
    `rad` (#358: `1570 W rad`) is caught only by an explicit `in W`.
- **Check name collisions in the catalogue.** Check every input and result name against units,
  built-ins and short constants with no sheet at all. The engine already knows this list:
  `what(name)` in `warnings.ts`, `registerShortConstants` in `evaluate.ts:101`.
  - Catches: what the warnings check catches, plus short-constant collisions.
  - Misses: nothing it is aimed at. It can't judge whether a substitute name (`m_1`, `U`) reads
    well.
- **Check both languages.** Mirror `panelWords.test.ts`: every entry's name, comments and input
  descriptions are non-empty in `en` and `ptBR`, and `tsc -b` holds the shape if the words are
  keyed in the `Words` tables.
  - Misses: whether a translation is correct.
- **Check the citation's form.** A test can require a non-empty source with a locator.
  - Misses: whether the section number is right. #358 says every section number is unverified,
    so this is a review step, not a test.

## 4. Where the data would live, and how tests are organised

- **Patterns.** Pure data modules sit in `src/math/` (`constants.ts`, `symbols.ts`,
  `unitSystems.ts`), with no math.js import and no words, and the words sit in
  `src/text/en.ts` and `ptBR.ts`, keyed by id. The panel's tabs are in `src/panel/`. Inserting a
  block is a new kind of panel action, since `planInsert` (`src/overlay/symbolInsert.ts:27`) only
  types into the open line (#344).
- **Tests.** Vitest (`package.json` `"test": "vitest run"`; `vite.config.ts:57-67`, jsdom, setup
  `src/test/setup.ts`). Unit tests sit beside their module as `*.test.ts(x)`. Tests against the
  real Excalidraw are `*.excalidraw.test.tsx`. `scripts/*.test.mjs` hold the repo's own scripts
  and documents (`docs.test.mjs`, `audit-plugin.test.mjs`, `release.test.mjs`). Shared readers
  live in `src/test/` (`guideExamples.ts`, `english.ts`). The Playwright runs are
  `scripts/*-run.mjs`.
- **Size.** `scripts/audit-plugin.mjs:18-34`: `MAX_BYTES` 5,000,000 is Obsidian Sync's per-file
  cap. `BUDGET` is `main.js` 3,595,000 and `styles.css` 584,000, raised "only on purpose, in a
  commit that says what was added". The two guides and the Português table were estimated at
  60 to 90 kB (`spec-v1.md:3751-3753`). 42 entries of a few lines each, in two languages, is a
  few tens of kB, not measured. A drawn figure per entry would add more.
- **`CONTEXT.md` budget.** `CONTEXT_BUDGET` is 38,900 bytes (`scripts/docs.test.mjs:22`), and
  `CONTEXT.md` is 38,885 bytes now: 15 bytes of headroom.

## Questions for the grilling

1. Is an entry's English and Português text held in the entry, or keyed by id in `en.ts` and
   `ptBR.ts` as the constants' is?
2. Are the inserted lines stored as literal text, or built from structured fields (inputs,
   formulas, notes)?
3. Does each entry carry one worked example (the inserted example values), or a separate test
   case with other values?
4. Where does an expected value come from: our own hand derivation, an independent script like
   `pump-sizing.py`, numerical integration, or a published example named as a cross-check?
5. How is a result compared: shown text as the guide does, or a number at 4 significant figures
   in a stated unit?
6. Must every entry run with zero warnings, which forces a naming rule?
7. Which naming rule for unit-named symbols: subscripts (`m_1`, `F_1`), other letters (`U`, `P`),
   descriptive names, or textbook letters with the warning accepted?
8. May an entry use a constant's short name (`R`, `k`, `G`) as an input, which raises no warning?
9. Is an expected kind or display unit a field, and is it tested?
10. Is the citation's locator checked by a person against the book before an entry ships, and is
    that a review rule written into CONTRIBUTING or the spec?
11. Are search terms a field, in both languages, or is search over the name and description
    alone?
12. Does an entry hold its assumptions as a comment line, a note on the formula line, or text
    shown only in the tab?
13. Is the Português guide's row-for-row test (specified, unbuilt) a model to reuse, such as
    "same lines in both languages except comments"?
14. Does the plugin budget take a measured raise when the library lands, and do figures fit in it?
