# App

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**App** (`src/App.tsx`) — composition root. Decides what fills each shell
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
light or dark is remembered). `panelMemory` is where the panel's open state lives
(a port: `storagePanelMemory` on the web, `data.json` in the plugin, this
page only if unset). **An edit opens the panel on Format** (M4d, #143):
from `MathOverlay`'s `onEdit`, App notes the panel's state when an edit
starts and opens it on Format (on a small window, scrolling the line clear
of the floating panel), and puts it back when the edit ends, unless it was
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
edit, and on a phone as `visualViewport` or the window resizes. Only while
the open field has the keyboard. The launch and a jump open and close the panel through the
handle, so they work on the bottom sheet too.
App imports none of the browser ports at run time, so
the plugin's bundle holds none. `initialElements` gives tests a sheet.
Depends on: shell, canvas, overlay, file.
