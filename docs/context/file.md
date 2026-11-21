# file

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**file** (`src/file/`) — the sheet file (ADR 0004, spec section 7).
`sheetFormat.ts` (pure) reads and writes the `excalimathpad` block, settings
and migrations. `FORMAT` is 2 (M4e, #195): `MIGRATIONS` holds the one step,
`moveFormatsOut`, which moves each line's format clause out of a math
element's `customData.source` into `customData.formats` (`commitFormat`, in
`src/math/lineForm.ts`), one entry per line, leaving an element with no
clause untouched. `readSheet` runs it on a format 1 file and on a drawing
with no block, so every open path migrates in memory: the session's Open…, a
dropped file, the recovery copy and a kept sheet, and the vault's first read
and an outside change (`plugin/SheetView.ts`). Nothing is written by an open:
the clean mark is taken from the loaded scene. The session's state carries the settings, and
`setSettings` changes them. `sheetSession.ts` is the deep module: save, save as, open,
startup with the recovery offer, the clean mark and the recovery copy, over
ports (scene, file access, recovery store, dialogs, line), so it knows no
Excalidraw, React or DOM. `fileAccess.ts` wraps the File System Access API,
with a download and file-input fallback. `recovery.ts` keeps the one copy in
IndexedDB. `vaultSheet.ts` is the vault's counterpart (M4d): the same
clean-key rule and `keepClean` over the scene and line ports, but it never
writes itself; the view asks it what is `unwritten()` (an open line
committed first), tells it what was `written`, asks if it is `busy()`, and
`reload`s it after an outside change. The line relay's `isOpen` is how it
knows a line is open. **A failed view** (spec section 4, Unexpected failures, #193): both
sheets have `fail()`, which returns a `KeptSheet` (the file's text as the
scene is, without committing the open line; whether it is dirty; on the web
its name and handle) and ends that sheet's writes for good: the session
writes the kept text as the recovery copy if it is dirty, then no copy, save
or clean mark; the vault's `unwritten()` is null from then on. A session
given `resume` loads it in `start` in place of the recovery offer; a vault
sheet given `unwrittenAtStart` asks for a save once loaded.
`FileChrome.tsx` shows the name and title, asks the two questions
and asks before leaving while dirty; an unsaved sheet's name there, and the
browser's own Print line (`--math-print-line` on `<html>`, for `src/index.css`),
are in the language shown, read with `useWords()`, and `displayName` and the
save picker's file type read `words()` when worded ([text](text.md), 0.6.0); it answers the keys and drops that
`canvas/fileRoutes.ts` takes, Ctrl+P through its `print` prop (App's Print…). Opening picks the file before it asks about
unsaved changes: Chromium allows one picker per gesture. Depends on: canvas
(file routes, layers), text (its words).
