# plugin

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**plugin** (`plugin/`, section 12a, ADR 0006) — the Obsidian plugin, and the
only code that imports `obsidian`. `main.ts` (the `Plugin`) registers the
view for `.excalimathpad` only and keeps the panel's open state, its width
(`sheetPanelWidth`, M4e, #198), light or dark and, from 0.5.0, the language
(`language`: `en` or `pt-BR`) in `data.json` (`loadData`/`saveData`; `SheetMemory`, anything else
read there dropped). The view hands App the language memory as `language`, beside `panelMemory`. It registers New sheet and `SHEET_COMMANDS` (Add math,
Toggle Math settings, Open Math guide, and Print…, marked `computer` and skipped where
`Platform.isMobile`), whose `checkCallback` offers each only while
`getActiveViewOfType(SheetView)` has that command in `commands`; none has a hotkey.
**The plugin's own words** (0.6.0, spec section 8, Language: In Obsidian; section 13, In a
vault) are the `vault` group of the text tables ([text](text.md)), read through
`wordsFor` in the language `data.json` holds: `main.ts`'s `words()` and the view's
`vaultWords(memory.language)`. The command names (a `SHEET_COMMANDS` entry's `name` is its
key), the ribbon's tooltip and the folder item are worded once, at `onload`, so they change
after a restart. Everything else is worded when it is made, so it follows a choice in ☰ at
once, with no sheet tab open too: the notices (`writeFailed`, `conflict`, `createFailed`;
`errorReason` passes Obsidian's reason through as it arrives), the lookbehind message, the
image picker's placeholder (handed to `pickVaultImage` as it opens), the paper notice
(`paperNotice(page, text)`, the stored `A4`/`Letter` and `portrait`/`landscape` worded
through `paperSize` and `orientation`), New sheet's base name (`untitled`) and the conflict
copy's (`conflictBase(…, text)`, `conflictCopy`). A name is only written, never read back.
The view's newer and unreadable messages are still `MESSAGES` (`src/file/sheetSession.ts`). `SheetView.ts` is the `TextFileView`:
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
under `names.ts`'s `conflictBase` and `freeSheetPath` (never over a file; `(conflict …)` or
`(conflito …)` by the language at that moment),
then reloads; no save runs meanwhile (`reconciling`). `main.ts` adds **New
sheet** (the command, the ribbon icon, a folder's `file-menu`), placed by
`fileManager.getNewFileParent` and named `Untitled`, `Untitled 1`… (`Sem título`… in
Português).
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
Data protection). It stubs Mermaid to Excalidraw, every Excalidraw locale but
English and, from 0.5.0, Brazilian Portuguese (`KEPT_LOCALES`; the build fails
if it meets no `pt-BR` to keep: about 24 kB of `main.js`),
font subsetting and math.js's help texts (`embeddedDocs.js` resolves to
`src/math/noHelpTexts.ts`, as `vite.config.ts`'s alias does for the web; the
build fails if it stubbed nothing; section 14, M4e, Lighter plugin);
rewrites Excalidraw's `./fonts/…` strings to `data:` URLs (Xiaolai to
`local:`); and in Excalidraw's own files turns `localStorage` into no
storage, the `esm.sh` fallback into `about:blank#` and every `VITE_APP_*`
value (service URLs, the Firebase key) into `""`. KaTeX's CSS keeps woff2
only and loses the `@font-face` of the four families in
`src/overlay/katexFonts.ts` (`trimKatexCss`, which throws if one has no face to
drop); the font test (`src/overlay/katexFonts.test.tsx`) reads the same list
and KaTeX's CSS, and the network-blocked run fails on a KaTeX class drawn in a
family with no font. Each rewrite depends on Excalidraw 0.18.1's text; the
audit fails an upgrade that moves it.

**The Math assistant's ports** (`assistant.ts`, section 12a, One source, two builds, and
Data protection; section 14, 0.7.0, #306 and #307; [assistant](assistant.md)): the one file
of `plugin/` that names a request API or Obsidian's secret storage
(`test/requestApis.test.ts`, which also holds that Obsidian's own request function is named
nowhere). `assistantPorts(on, mobile, app)` gives the ports only when the build-time switch
is on and the device is a computer; `SheetView` calls it with `__ASSISTANT__` (or its
`assistant` option, for tests), `Platform.isMobile` and its `app`, and passes the result as
App's `assistant` prop. **The switch is on since #312,** so a built plugin on a computer has
the seventh tab and its More tools item, and on a phone or a tablet neither (the touch run
sees six tabs); the network-blocked run opens the tab and types in the card with nothing
saved, and the assistant run walks the rule against a stand-in provider. **The setup's store** is one entry, `excalimathpad-assistant`
(`SETUP_ENTRY`), in `App#secretStorage`: the one thing the plugin keeps outside the vault.
It is made, and the storage named, only inside `if (requireApiVersion('1.11.4'))`, which is
what lets Obsidian's lint pass at `minAppVersion` 1.7.2 with no exception; on an older
Obsidian the store is `null` and the storage is never called. There is one store per `App`
(a `WeakMap`), so every sheet tab shares one keeper of the setup. The storage has no public
delete: `remove` writes the entry empty, which reads back as no setup. The fake `obsidian`
has `SecretStorage` (its `calls`, `secrets` and `failNext`), `requireApiVersion` and
`obsidian.apiVersion`, which a test lowers.
