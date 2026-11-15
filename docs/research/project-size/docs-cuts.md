# Excalimathpad docs: reading cost and candidate cuts

Measured on `main` at 429606b (2026-11-15). Nothing in the repo was changed.
Tokens are **bytes / 4**, an approximation; these files are dense with code spans, URLs and symbols, so real counts are probably somewhat higher.

## Headline

- The must-read set (CONTEXT.md + spec + 6 ADRs) is **387,635 bytes, about 97k tokens per session**.
- **105 KB (38 %) of the spec is history** (change log, issue order, passed checks, ticket index). But the change log cannot simply be moved out: **some rules exist only there**, and at least one body section contradicts its change line (details in section 2).
- **Nothing in the repo tells a session to read all three.** There is no `CLAUDE.md` or `AGENTS.md`; the instruction comes from outside the repo. So the cheapest cut is a reading route, not an edit to the documents.
- Code cites the spec by section number **661 times in 147 files**. Renumbering is the main risk of any restructuring; moving the tail sections (16, 17, 18, Changes) touches only 12 of those citations.
- Both documents are still growing fast: the spec doubled in two days (132 KB on 11-13, 276 KB on 11-15), CONTEXT.md went from 37 KB to 74 KB in the same two days.
- M5 (Print) and M6 (Offline PWA) are unchecked in `CONTRIBUTING.md`'s roadmap and their "Verify first" items are all open, so by the spec's own finish line v1 is not yet done and the spec is still "living".

---

## 1. Sizes (measured)

| Document | Bytes | Lines | Words | ~Tokens | Must-read today |
|---|---:|---:|---:|---:|---|
| `docs/spec-v1.md` | 276,383 | 3,733 | 45,194 | 69,100 | yes |
| `CONTEXT.md` | 74,246 | 1,037 | 11,212 | 18,600 | yes |
| `docs/adr/*.md` (6) | 37,006 | 599 | 5,953 | 9,300 | yes |
| **Must-read total** | **387,635** | **5,369** | **62,359** | **96,900** | |
| `docs/math-guide.md` | 32,384 | 531 | 6,503 | 8,100 | no (bundled feature) |
| `CONTRIBUTING.md` | 21,837 | 285 | 3,219 | 5,500 | no |
| `README.md` | 5,293 | 67 | 799 | 1,300 | no |
| `docs/acceptance/` (2 files) | 11,480 | 269 | 2,403 | 2,900 | no |
| `docs/research/*.md` (17) | 318,407 | 4,748 | 45,583 | 79,600 | no |
| `docs/research/` other files (22: PNGs, one 155 KB HTML, probe scripts) | 1,750,443 | | | | no |

ADRs individually: 0001 4,359 · 0002 9,138 · 0003 7,832 · 0004 4,275 · 0005 7,593 · 0006 3,809.

### `docs/spec-v1.md` by top-level section, sorted

| Section | Lines | Bytes | % |
|---|---:|---:|---:|
| Changes since agreed (81 dated entries, 11-04 to 11-15) | 534 | 53,585 | 19.4 |
| 4. Math element: look and editing | 562 | 34,094 | 12.3 |
| 17. Verify first | 361 | 33,084 | 12.0 |
| 14. Engineering constraints | 286 | 24,902 | 9.0 |
| 3. Sheet lines: every form | 239 | 13,976 | 5.1 |
| 2. Terms and invariants | 189 | 13,917 | 5.0 |
| 8. App chrome | 184 | 13,215 | 4.8 |
| 16. Milestones and finish line | 198 | 12,169 | 4.4 |
| 12a. Obsidian plugin | 151 | 11,401 | 4.1 |
| 13. Messages | 165 | 10,691 | 3.9 |
| 5. Results: units and numbers | 182 | 9,354 | 3.4 |
| 7. File and save | 150 | 8,912 | 3.2 |
| 18. Decision index | 57 | 7,950 | 2.9 |
| 10. Ranges, tables, plots | 122 | 6,739 | 2.4 |
| 9. Solve | 111 | 6,366 | 2.3 |
| 6. Undo | 62 | 4,400 | 1.6 |
| 1. What v1 is, and what it isn't | 54 | 4,165 | 1.5 |
| 11. Print | 58 | 3,557 | 1.3 |
| 12. Offline PWA (incl. Hosted build 1,931) | 46 | 3,083 | 1.1 |
| 15. Acceptance | 18 | 741 | 0.3 |

Largest second-level parts: 2 Terms 7,801 (64 terms) · 2 Invariants 6,004 · 4 While editing a line 4,767 · 8 Sheet panel 3,745 · 7 A sheet in a vault 3,338 · 12a Listing 3,108 · 10 Plots 3,067 · 8 Inside an Obsidian tab 3,059 · 12a Data protection 2,900 · 12a One source, two builds 2,869 · 4 Typeset grid 2,795. Section 4 has 20 subsections, none above 4.8 KB; it is big because it is wide, not because one part is bloated.

Section 17 by milestone: M1 8,379 · M3/M4 1,938 · M4b 1,378 · M4c 3,314 · **M4d 17,086** · M5 495 · M6 149.

### `CONTEXT.md` by section, sorted

| Section | Lines | Bytes | % |
|---|---:|---:|---:|
| Modules | 605 | 44,666 | 60.2 |
| Load-bearing (31 items) | 208 | 14,615 | 19.7 |
| Domain (12 terms) | 88 | 6,013 | 8.1 |
| Entry points | 49 | 3,340 | 4.5 |
| Incidental (21 items) | 49 | 3,284 | 4.4 |
| Decisions (ADR index) | 26 | 1,566 | 2.1 |
| Intro | 13 | 763 | 1.0 |

Modules, per entry: **math 14,493** (one bullet, 196 lines) · **overlay 8,481** · **canvas 8,104** · plugin 3,807 · panel 3,639 · App 2,990 · file 1,330 · guide 1,122 · test setup 354 · shell 334.

---

## 2. What a session needs from the spec

| Class | Sections | Bytes | % |
|---|---|---:|---:|
| (a) Rules of the app that future work must respect | header, section 1 minus the Not-in-v1 table, sections 2 to 13, 14, 15, 16's "The finish line" | 168,824 | 61.1 |
| (b) History | Changes since agreed 53,584 · 17 Verify first 33,084 · 16 minus the finish line (milestone table, issue orders, dates) 10,591 · 18 Decision index 7,950 | 105,209 | 38.1 |
| (c) Not in v1 | the table in section 1 | 2,350 | 0.9 |

Measured qualifications:

- **Provenance inside class (a):** 13 "Decided in:" blocks, 8,239 bytes, and 125 full issue URLs (7,407 bytes) inside sections 2 to 14. The whole file has 191 issue URLs, 11,321 bytes. Section 18 is the reverse index of those same links.
- **Rules for things not built yet inside class (a):** section 11 Print 3,557, section 12 PWA 1,152, and section 14's Print and PWA lists about 1,900. These are still needed for M5 and M6.
- **Section 17 is not all closed.** Of 58 items (32,739 bytes), about 38 carry a "Passed" style outcome (about 29 KB). About 20 items (3,746 bytes) are open or carry a different note: all 7 of M5, both of M6, 3 of M4b (work-laptop checks), the failed BRAT beta entry, and a few M1/M4c items.
- **The change log is not pure history. This is the main finding of this section.**
  - Checked by hand: `### Unit systems` (spec line 1093) says "A kind not on the list shows in composed base units". The change line for #56 (line 3323) says a dimension off the list shows in its named SI unit first, and lists the prefix steps per kind. The body was not updated. `CONTEXT.md` has the as-built rule.
  - Checked by grep: "The dot marks every letter that is also a constant", "Touch is the last press in the view", and the bottom sheet's heights appear only in the change log.
  - Heuristic (estimate): of the 55 entries that quote code or messages, 37 (29 KB) have fewer than half of their quoted strings anywhere in sections 1 to 18. Quoted examples inflate this, so read it as "a large minority of entries hold detail the body lacks", not as a count of missing rules.
  - Only 15 % of the change log's 5-word sequences recur in sections 1 to 13 (measured), which agrees: it is mostly additional text, not a copy.

So the honest split of class (b) is: about 52 KB is safely history (section 16's issue orders, section 18, the passed items of 17), and 53.6 KB (Changes) is history only after its rules are folded into the body.

---

## 3. Repetition

**Measured** (share of a document's 5-word sequences that also occur in the other; a floor for verbatim copying, since most repetition here is paraphrase):

| Text | Also in | Share | ~Bytes |
|---|---|---:|---:|
| CONTEXT.md | spec | 15.3 % | 11,300 |
| ADRs | spec | 10.3 % | 3,800 |
| ADRs | CONTEXT.md | 6.6 % | 2,400 |
| spec Changes | spec sections 1 to 13 | 14.8 % | 7,900 |
| spec 14 | CONTEXT.md | 10.7 % | 2,700 |
| spec 2 | CONTEXT.md | 13.3 % | 1,900 |
| spec 17 | spec 1 to 14 | about 8 % | 2,600 |
| math guide | spec | 24.7 % | 8,000 |
| CONTRIBUTING | CONTEXT.md / spec | 7.6 % / 13.3 % | 1,700 / 2,900 |

**Estimate** of the same fact stated twice or more inside the must-read set, counting paraphrase: **60 to 80 KB (15 to 20 % of 388 KB)**. Rough parts: CONTEXT Modules restating behaviour from spec 3 to 13, 25 to 30 KB; change log entries that were folded into the body, 15 to 25 KB; ADR Decision sections restated in spec 2/14 and CONTEXT Load-bearing, 8 to 10 KB; CONTEXT Load-bearing against spec 14 and 17, 5 to 6 KB; glossary, 4 KB; ADR index, 1.6 KB.

Examples (file, heading, line):

1. **Anchor fill `#ffffff01`**, six places: ADR 0002 header, Decision (l. 71) and Consequences (l. 131); CONTEXT Modules/canvas (l. 131), Domain/Anchor style (l. 717), Load-bearing "Anchors need a fill" (l. 813); spec 4 Selected math element (l. 1013), 14 Contract tests (l. 2489), 17 M1 (l. 2862).
2. **App units set-up order (`createUnit`, then disable)**: spec 14 Engine "Setup order" (l. 2288); CONTEXT Modules/math (l. 276 to 286); ADR 0003 Decision (l. 61).
3. **Reading order (top, then left, derived, never stored)**: spec 2 Terms; ADR 0003 Decision (l. 29); CONTEXT Domain/Sheet (l. 720); CONTRIBUTING "How it works" step 2.
4. **Glossary**: spec 2 Terms (64 terms, 7.8 KB) and CONTEXT Domain (12 terms, 6.0 KB). Eight are the same terms (Math element, Anchor, Placing, Title and Title format, Line edit, Line commit, Sheet). Only Content size, Empty element, Gesture, Anchor style and Viewport are CONTEXT's own.
5. **Release procedure** (one version, `scripts/version.mjs`, `versions.json`, atomic push, draft release): spec 12a Releases (l. 2047, 2.0 KB); CONTEXT Entry points (l. 43 to 56, about 1.5 KB); CONTRIBUTING Releasing (2.8 KB); `.github/release-checklist.md` (1.2 KB, a test keeps it equal to CONTRIBUTING).
6. **Plugin bundle limits (three files, 5,000,000 bytes, no network)**: spec 12a Data protection (l. 2033) and 17 M4d (l. 2989); CONTEXT Incidental (l. 985) and Load-bearing "The plugin's bundle names no browser storage"; ADR 0006 Decision (l. 27); CONTRIBUTING (l. 56).
7. **Sidebar docks above 1229 px**: spec 8 three times (l. 1502, 1582, 1602) and Changes twice (l. 3335, 3710); CONTEXT Incidental (l. 982).
8. **`customData` holds no nested objects / title format as a string of words**: spec 7 The file (l. 1308), Changes (l. 3220); CONTEXT Load-bearing (l. 893) and Domain/Title.
9. **ADR one-line summaries**: CONTEXT Decisions (1.6 KB) restates each ADR's title and decision; CONTRIBUTING Architecture restates four of them again.
10. **Milestones and finish line**: spec 16 (12.2 KB) and CONTRIBUTING Roadmap (1.7 KB), the three finish conditions word for word.

The math guide's overlap with spec 3 and 13 is by design (same forms and messages, for users) and is not counted as waste.

---

## 4. Inside CONTEXT.md

| Kind | Where | Bytes | % |
|---|---|---:|---:|
| Module map with behaviour | Modules | 44,666 | 60 |
| Invariants and upstream traps | Load-bearing + Incidental | 17,899 | 24 |
| Glossary | Domain | 6,013 | 8 |
| Build, CI, release entry points | Entry points | 3,340 | 5 |
| ADR index and intro | Decisions, intro | 2,329 | 3 |
| Narrative history | scattered tags | under 2,000 (estimate) | under 3 |

- **History is small.** It is 48 issue tags and 39 milestone tags of the "(M4d, #144)" kind plus one "Built so far" sentence in the intro. CONTEXT.md is not a diary.
- **The bulk is behaviour written as prose inside module entries.** The math, overlay and canvas entries (31 KB together, 42 % of the file) describe what a line does, what a message says and how a rule resolves: that is spec text with function names added. Estimate: 60 to 70 % of those three entries is behaviour, the rest is interface and dependencies. The Modules section names 730 code spans and all 89 non-test source files.
- **It also holds as-built facts the spec body lacks** (the named-SI-unit rule above), so it cannot be cut by deletion alone.
- **Structure:** six `##` headings, no `###`. Modules is ten top-level bullets with no sub-bullets and no blank lines; the math entry is one 196-line paragraph. A session cannot open "the math module" by heading, only by line range or grep. Entries are in dependency order, not sorted. Domain is not alphabetical.
- **Tight already:** Entry points, Incidental, Decisions. Load-bearing is long but every item is a trap with a test named; it is the part most worth reading in full.

---

## 5. What refers to what

**Who tells sessions to read the files (measured):**

- No `CLAUDE.md`, `AGENTS.md`, `.claude/`, Cursor or Copilot file is tracked. Nothing in the repo says "read these before working".
- `CONTRIBUTING.md` "Spec, CONTEXT.md and ADRs" (l. 77) says to keep the four documents in step, not to read them all first.
- `.github/pull_request_template.md` l. 12 requires "Spec (with a Changes since agreed line if behaviour changed), `CONTEXT.md` and ADRs in step".
- Spec section 1 "How to read this spec" and CONTEXT Decisions define the three roles. `README.md` l. 61 links all three.
- `.github/ISSUE_TEMPLATE/idea.yml` links spec section 1.
- The read-everything rule is therefore in the session prompt or another place outside the repo.

**Citations that restructuring would break (measured):**

| What | src/ | plugin/ | scripts/ | Total |
|---|---:|---:|---:|---:|
| "section N" citations | 600 in 127 files | 39 in 11 | 22 in 9 | **661 in 147 files** |
| of which with a heading name ("section 4, Touch") | | | | 292 |
| `spec-v1.md` path | 211 | 13 | 13 | **237** |
| ADR numbers | 42 | 2 | 0 | 44 |
| `CONTEXT.md` | 0 | 1 | 0 | 1 |

By section: 4: 205 · 8: 112 · 3: 54 · 10: 54 · 5: 49 · 14: 46 · 12a: 40 · 7: 24 · 13: 24 · 9: 23 · 6: 11 · 17: 10 · 12: 3 · 2: 2 · 16: 2 · 15: 1 · 11: 1 · 18: 0 · "Changes since agreed": 0.

Other links: 262 internal anchors in the spec (59 distinct targets); 6 links from other files to spec anchors (5 in CONTRIBUTING, 1 in the idea template); CONTEXT.md cites spec sections 43 times; the ADRs 8; research notes 24.

Files that are read by code or tests and so must keep their path and content: `docs/math-guide.md` (bundled, examples run in CI), `docs/acceptance/pump-sizing.md` (imported by `src/math/pump-sizing.test.ts`), `CONTRIBUTING.md` and `.github/release-checklist.md` (compared by `scripts/release.test.mjs`). No test reads the spec, CONTEXT.md or the ADRs.

Reading the risk: section **numbers** are the contract (661 citations). The file **path** is cited 237 times. The tail sections that are history are cited 12 times in total. So trimming the tail is cheap; renumbering or splitting sections 2 to 14 is not.

---

## 6. `docs/research/`

- 2,068,850 bytes in 38 files: 17 Markdown notes (318,407 bytes, about 80k tokens), one 155 KB HTML of samples, PNGs and probe scripts.
- Nothing requires a session to read it. CONTEXT.md, README and the ADRs do not link into it. The spec links to it 15 times as evidence (section 14's "Evidence:" lines); CONTRIBUTING describes it in one sentence; code mentions it 5 times.
- It is already on-demand. No cut is needed for reading cost. (It is repository weight, not session weight.)

---

## 7. Candidate cuts and moves

Savings are off the 388 KB must-read set unless stated. "Measured" savings come from the tables above; "estimate" is marked.

**A. A reading route in a tracked `CLAUDE.md` (or `AGENTS.md`).** Always read CONTEXT.md; read spec sections 1 and 2 and the sections the task touches (code comments already name them); read an ADR when CONTEXT's Decisions index points to it; for a touched section, also grep the change log for that section's anchor.
- Saving: up to 276 KB (69k tokens) on a task that touches two or three spec sections; ADRs on demand saves another 37 KB (9k). Typical session estimate: 388 KB down to 110 to 150 KB.
- Risk: a session misses a rule in a section it did not open. The 661 citations in code make the lookup natural. The change-log grep step is needed while B is not done.
- Effort S. Safe before 1.0.0. No document changes.

**B. Fold the change log into the body, then move it to a history file.** Audit the 81 entries; where the body disagrees or is silent, edit the body; then move the log to `docs/spec-v1-history.md`.
- Saving: 53.6 KB (13.4k tokens), measured. It also removes the need to read two places for one rule.
- Risk: a rule lost in the fold. The log has no code citations and one inbound link (`CONTRIBUTING.md`) plus the PR template's wording; both need a one-line update. The spec's own rule ("with a line under Changes since agreed") must point to the new file.
- Effort M to L (81 entries, the largest 2 KB). Can be done before 1.0.0, but it is a review task, not a mechanical one; better as its own PR.

**C. Move closed history out of the spec: section 16's milestone table and issue orders, section 17's passed items, section 18.**
- Saving: 10.6 + about 29 + 7.95 = about 47.5 KB (11.9k tokens); 17's split is an estimate, the others measured.
- Risk: 12 code citations (section 17: 10, section 16: 2) and the links in CONTRIBUTING's Roadmap. Keep the headings 16, 17 and 18 in place as stubs with the open items and a link, so numbers and anchors still resolve. Section 17's passed items hold measured facts about Excalidraw; they stay available in the history file and in the contract tests they name.
- Effort S to M. Safe before 1.0.0 if the stubs stay.

**D. Split CONTEXT.md's Modules by module** (for example `src/math/CONTEXT.md`, or `###` headings plus the route in A). CONTEXT.md keeps a two-to-four-line entry per module: interface, dependencies, link.
- Saving: about 35 to 40 KB (9 to 10k tokens) for a session that works in one module (estimate: 44.7 KB minus about 5 KB of summaries, minus the one module read).
- Risk: low. One code comment cites CONTEXT.md; 7 research notes do. Cross-module rules must stay in Load-bearing.
- Effort S to M. Safe before 1.0.0. Pure move, no fact removed.

**E. Remove duplication, one home per fact.**
- Glossary: keep spec 2 Terms; CONTEXT Domain keeps its five code-only terms. Saving about 4 KB (estimate).
- Behaviour prose in CONTEXT's math, overlay and canvas entries: replace with "spec section N" where the spec body says the same. Saving 15 to 20 KB (estimate). Risk: medium, because CONTEXT sometimes holds the as-built rule and the spec body the stale one; do after B.
- Section 18 against the "Decided in:" blocks: covered by C.
- Full issue URLs (191, 11.3 KB): shortening to `#N` saves about 9 KB but loses the clickable link in a file view. Not worth it.
- Effort M. After B; can wait until after 1.0.0.

**F. After 1.0.0: keep the spec file and its numbering, change its job.** Sections 2 to 15 become the standing "how the app works" reference under the same path and numbers; the status line changes; history lives in the history file (B and C done). This keeps all 661 citations valid. Freezing the whole file as "historical" and writing a new shorter reference would orphan those citations as behaviour moves on.
- Saving: none beyond A to C in bytes; it prevents a second full-size document from appearing.
- Risk: low. It departs from the one sentence in spec section 1 ("the status becomes 'v1 done, historical'"), which is the only place "historical" appears; CONTEXT.md does not use the word. That is the owner's call.
- Effort S once B and C are done. After 1.0.0 by definition.

**G. Split the spec into one file per section with an index.**
- Saving: none over A. A session can already read a line range, and headings are greppable.
- Risk: high. 237 path citations, 262 internal anchors, 6 inbound links, and the citations stop pointing at one file.
- Effort M to L. Not recommended, before or after 1.0.0.

**H. A size budget in `npm run check`** (for example CONTEXT.md and the spec body each under a byte limit, the change log under N entries before a fold).
- Saving: none by itself. It stops regrowth: the spec grew 144 KB and CONTEXT.md 37 KB between 11-13 and 11-15.
- Risk: a PR blocked by the limit pushes text into the wrong file. Set limits after the cuts, with headroom.
- Effort S. After A to D, so the numbers mean something.

**Already tight, leave:** the ADRs (37 KB; about 4 KB is "Amended/Built" header history, not worth a PR), the Not-in-v1 table (2.3 KB), CONTEXT's Entry points, Incidental and Decisions, README, `docs/acceptance/`, `docs/research/` (on demand already), and the math guide (feature).

### Summary, sorted by saving per risk

| # | Cut | Saving off must-read | ~Tokens | Basis | Risk | Effort | When |
|---|---|---:|---:|---|---|---|---|
| A | Reading route in `CLAUDE.md`; spec sections and ADRs on demand | up to 276 KB + 37 KB | up to 78k | measured ceiling, typical is an estimate | Low: a missed section; needs the change-log grep until B | S | Before 1.0.0 |
| D | CONTEXT Modules split by module | 35 to 40 KB | 9 to 10k | estimate | Low: 1 code citation | S to M | Before 1.0.0 |
| C | Sections 16, 17 (passed), 18 to a history file, stubs kept | about 47.5 KB | 11.9k | measured, 17 estimated | Low: 12 code citations, kept valid by stubs | S to M | Before 1.0.0 |
| B | Fold the change log into the body, then move it | 53.6 KB | 13.4k | measured | Medium: a rule lost in the fold; 81 entries | M to L | Before 1.0.0 as its own PR, or straight after |
| F | Spec stays the reference under the same path and numbers | 0 (avoids a new document) | 0 | | Low: changes one stated intention | S | After 1.0.0 |
| H | Size budget in `npm run check` | 0 (stops growth) | 0 | | Low to medium: wrong-file pressure | S | After A to D |
| E | One home per fact (glossary, CONTEXT behaviour prose) | 19 to 24 KB | 5 to 6k | estimate | Medium: CONTEXT sometimes holds the only correct rule | M | After B |
| G | Split the spec into per-section files | 0 over A | 0 | | High: 237 path citations, 262 anchors | M to L | Not recommended |

A, B, C and D overlap: A already takes the spec out of the must-read set, so B and C then reduce the on-demand cost and the two-places problem more than the per-session cost. Done together, a session that touches one module and two spec sections reads an estimated 60 to 80 KB (15 to 20k tokens) in place of 388 KB (97k).
