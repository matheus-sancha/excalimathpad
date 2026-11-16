# App

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**App** (`src/App.tsx`) — the view's boundary around the composition root
(spec section 4, Unexpected failures, #193). The default export, `App`, wraps
`Sheet`, the root itself, in a `Boundary` and gives `FailureContext` its
home (the version, the stamp, web or plugin with `vault.device`) and the
sheet's words. A `FailureBox` (`createFailureBox`) passes between them: `Sheet` writes into it
the open line's text as it is typed (`MathOverlay`'s `onTyped`, before the
render), the sheet as last evaluated, and the sheet file's `fail`; on a
failure outside every smaller boundary, `onFail` calls that `fail` during
the render and notes what was being typed, and `FailureScreen` replaces the
view. Reload the sheet mounts `Sheet` again (a new `key`) with `resume`, the
kept sheet: the web's session loads it without asking, and a vault's sheet
starts from it, unwritten if it held changes. `Sheet` gives each panel tab
its own boundary (`tab`).
**Sheet** — the composition root. Decides what fills each shell
slot and wires the sheet file to the canvas and the line edit, and the
sheet's evaluation to the Sheet panel (opened at launch on a wide window,
on Problems only for an error: once the sheet's `start` has resolved and an
evaluation covers every math anchor in the scene, since the first runs
before the scene loads). The untitled
sheet starts empty, on the welcome screen. It runs in one of two **homes**.
On the web it takes `files` and `recovery` (required; tests pass fakes) and
mounts the session with `FileChrome`. With `vault` (a `VaultHome`: the
view's container and the sheet as the view read it) it mounts no file
chrome, no file keys and no ☰ file items, loads the sheet through
`createVaultSheet` (`src/file/vaultSheet.ts`) and hands it to the view
(`vault.connect`), which writes it back; it ignores a dropped sheet file
(`ignoreSceneDrops`), routes Excalidraw's image tool to the vault's picker
(`vault.pickImage`), binds the gestures' keys and the flash's click to the
view's container, and turns Excalidraw's embeds off. It also confines the
keys to the view (`confineKeys`), bridges the view when it is in a pop-out
window (`bridgeWindow`, again after `vault.onWindowMigrated`), hands the
view its `SheetCommands` (Add math, Toggle Math settings, Open Math guide) through
`vault.commands`, and passes the canvas `vault` and `vault.theme` (where
light or dark is remembered). `panelMemory` is where the panel's open state and its width live
(a port: `storagePanelMemory` on the web, `data.json` in the plugin, this
page only if unset); App hands it to the canvas as the slot's `width`, and
holds no width itself. Whether the panel docks is the canvas's answer
(`panelDocks()`, spec section 8, M4e, #198): the launch opens the panel only
where it docks, a jump closes it where it doesn't, and only a docked panel's
open state is remembered. **An edit opens the panel on Format** (M4d, #143):
from `MathOverlay`'s `onEdit`, App notes the panel's state when an edit
starts and opens it on Format where it docks, on a phone, or when it is
already open (M4e, #198: on an editor too narrow to dock an edit opens
nothing; scrolling the line clear of the panel by the follow rule), and puts
it back when the edit ends, unless it was
closed meanwhile or the edit ended from a press in the panel. What it opens
or restores itself (`automatic`) is never remembered as the user's choice.
**Touch** (M4d, #147): App holds `touch`, whether the last press in the
view was a touch (`pointerType`, so a mouse or a pen that hovers turns it
back), and hands it to the overlay and the Format tab's hint; on touch, while
a line or the title is open, it fills the panel's `quickKeys` (`QuickKeys`,
inserting through the line relay as the Symbols tab does). With
`vault.phone` the canvas draws the panel as the bottom sheet (`compact`
while something is open). **The view follows the caret** (0.2.1, #191):
on each `onEdit` with a target, `followCaret` waits a frame, then scrolls
the canvas by `scrollIntoArea` so the open field's `caretRow` is inside
`visibleArea` less 48 px; again when the panel reports it opened during an
edit, when ↑ or ↓ moves the caret between a wrapped field's rows
(`onCaretRow`, M4e, #196), and on a phone as `visualViewport` or the window
resizes. When the panel the edit itself opened is drawn, App also has the
overlay measure the line's wrap width again (`rewrap`). Only while
the open field has the keyboard. The launch and a jump open and close the panel through the
handle, so they work on the bottom sheet too.
App imports none of the browser ports at run time, so
the plugin's bundle holds none. `initialElements` gives tests a sheet.
Depends on: shell, canvas, overlay, file.
