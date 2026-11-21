# plugin

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**plugin** (`plugin/`, section 12a, ADR 0006) — the Obsidian plugin, and the
only code that imports `obsidian`. `main.ts` (the `Plugin`) registers the
view for `.excalimathpad` only and keeps the panel's open state, its width
(`sheetPanelWidth`, M4e, #198) and light or dark in `data.json` (`loadData`/`saveData`; `SheetMemory`, anything else
read there dropped). It registers New sheet and `SHEET_COMMANDS` (Add math,
Toggle Math settings, Open Math guide, and Print…, marked `computer` and skipped where
`Platform.isMobile`), whose `checkCallback` offers each only while
`getActiveViewOfType(SheetView)` has that command in `commands`; none has a hotkey. `SheetView.ts` is the `TextFileView`:
`setViewData` runs the **lookbehind check** (`hasLookbehind`; without it,
"Excalimathpad needs iOS 16.4 or later."), then `readSheet`; a newer or
unreadable file shows section 13's message in the view and nothing mounts;
otherwise it mounts `<App vault=…>` on `contentEl` with React's `createRoot`
and unmounts on close, with `phone: Platform.isPhone` (the bottom sheet) and
`device` (desktop, phone or tablet, for Copy details). `vault.sheet` is a
getter that reads the view's `data` at each mount, so a sheet reloaded after
a failure that kept nothing opens the file as last written, not as first
read. A failed view (spec section 4, Unexpected failures) hands the view no
sheet (`connect(null)` as the app unmounts), so its `save` writes nothing. It holds the tab's `commands` while the app is up and
passes `contentEl.onWindowMigrated` for the bridge, and, unless `Platform.isMobile`,
`print`: `printInFrame` (`print.ts`, spec section 11, M5, #81; [print](print.md)) with the view's
`containerEl.doc` at that moment, so a pop-out prints its own sheet, and the file's name and basename. **Autosave** (section 7, A sheet in a vault): the
vault sheet calls `onUnwritten` when its `saveKey` (plus the settings)
leaves the key the file holds, and the view calls `requestSave`; `save` is
the view's own and writes only `unwritten()` (an open line committed
first), so viewing never writes; close, quit (`workspace.on('quit')`) and
Obsidian's Save current file write at once; a failed write is a Notice and
stays unwritten; saves run one at a time (`saving`). **Outside changes:**
`vault.on('modify')` for its file and `setViewData(data, false)` are only
word of a change: `checkOutside` waits for the view's own save, reads the
file afresh (Obsidian's text can predate the last write, or catch it
half-done: 0.1.0's beta), ignores its own text (`known`), reloads an idle tab in place (`VaultSheet.reload`: no undo step,
scroll and zoom kept), and for a busy one (`busy()`: unwritten work or a
line open) writes the tab's version beside the sheet with `vault.create`
under `names.ts`'s `conflictBase` and `freeSheetPath` (never over a file),
then reloads; no save runs meanwhile (`reconciling`). `main.ts` adds **New
sheet** (the command, the ribbon icon, a folder's `file-menu`), placed by
`fileManager.getNewFileParent` and named `Untitled`, `Untitled 1`…
`ImagePicker.ts` is the **vault image picker**, a `FuzzySuggestModal` over
the vault's image files that reads only the one picked (`readBinary`).
`styles.css`
is the view's own CSS (no padding, a full-height box), Print…'s hidden frame (transparent,
in the viewport) and the **guard**: the
build wraps the app's and Excalidraw's CSS in `@layer excalimathpad`
(`APP_LAYER` in `esbuild.plugin.mjs`), and one rule gives every element in
the view `all: revert-layer` with an id's weight, so Obsidian's and a theme's
global rules (buttons, inputs, selects) never reach the app. `src/index.css`,
the web's `html` and `body` rules, never ships. `plugin/test/obsidian.ts` is a
hand-written **fake `obsidian`** (Plugin, the view classes, WorkspaceLeaf,
Workspace, Vault, FileManager, TFile, TFolder, Menu, FuzzySuggestModal,
Scope, Platform, Notice (and `hiddenNotices`), Obsidian's DOM helpers with `onWindowMigrated`,
and `doc` and `win` on every node;
`setActiveLeaf`, `runCommand` and `isOffered` as the palette does, and
`migrateWindow` as a move to a pop-out does) that records
registrations, writes, creates, binary reads, notices and modals, and acts
as the world outside the view (`changeOutside`, `rename`, `failNext`,
`fileMenu`, `quit`, a pick in a modal); Vitest aliases `obsidian` to it, and the
blocked run bundles the same file for the browser.
`plugin/test/pump-sizing.excalimathpad` is the pump sheet with an image and
CJK text. Depends on: App, file (`readSheet`, the messages), panel memory.

**The build** (`esbuild.plugin.mjs`, section 12a, One source, two builds and
Data protection). It stubs Mermaid to Excalidraw, the code editor of its
dialog (`components/TTDDialog/CodeMirrorEditor-*.js`, the one importer of
CodeMirror: the stub throws as it loads, the case Excalidraw answers with a
plain text box), the non-English locales, font subsetting and math.js's help
texts (`embeddedDocs.js` resolves to `src/math/noHelpTexts.ts`, as
`vite.config.ts`'s alias does for the web; section 14, M4e, Lighter plugin);
rewrites Excalidraw's `./fonts/…` strings to `data:` URLs (Xiaolai to
`local:`); and in the files of every `@excalidraw/*` package
(`inExcalidraw`: the canary keeps storage and environment values in
`common` and `element` too) runs `neutralise` (`scripts/neutralise.mjs`,
pure, with its test on the canary's own text): a `localStorage.getItem(…)`
becomes `null`, a `setItem` or `removeItem` a call that does nothing, with
or without `window.`; the `esm.sh` fallback becomes `about:blank#` and every
`VITE_APP_*` value (service URLs, the Firebase key) `""`. Any other use of
`localStorage` is left in the text for the audit to fail on. **`TALLY`**
counts what each of the nine trims and rewrites found, the build prints it,
and a zero fails the build by name, as do no fonts inlined or no path made
`local:`. The minimap's worker is never started: it is found by
`import.meta.url`, which one CommonJS file doesn't have. KaTeX's CSS keeps woff2
only and loses the `@font-face` of the four families in
`src/overlay/katexFonts.ts` (`trimKatexCss`, which throws if one has no face to
drop); the font test (`src/overlay/katexFonts.test.tsx`) reads the same list
and KaTeX's CSS, and the network-blocked run fails on a KaTeX class drawn in a
family with no font. Each rewrite depends on the pinned Excalidraw's text; the
build, by `TALLY`, or the audit fails an upgrade that moves it. **The audit**
(`scripts/audit-plugin.mjs`) reads `scripts/plugin-allowlist.json`: `hosts`,
`elementCreation` (the marks of library code that may create a `<style>` or
`<link>`), and `text`, the names taken out before the forbidden words are
counted (one: `localStorageQuotaExceeded`, a message's name), each entry
with why. `BUDGET` is set from the upgrade's build (#269).
