# file

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**file** (`src/file/`) — the sheet file (ADR 0004, spec section 7).
`sheetFormat.ts` (pure) reads and writes the `excalimathpad` block, settings
and migrations. The session's state carries the settings, and
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
knows a line is open. `FileChrome.tsx` shows the name and title, asks the two questions
and asks before leaving while dirty; it answers the keys and drops that
`canvas/fileRoutes.ts` takes. Opening picks the file before it asks about
unsaved changes: Chromium allows one picker per gesture. Depends on: canvas
(file routes, layers).
