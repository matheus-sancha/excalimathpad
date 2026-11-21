# canvas

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**canvas** (`src/canvas/`) — everything that knows Excalidraw, which on the branch
`excalidraw-upgrade` is the pinned canary `0.18.0-9fbeaed` (spec section 8, The Excalidraw
upgrade; ADR 0001). The sentences below that name 0.18.1 are each rewritten by the upgrade
issue that redoes its contract. `SheetCanvas`
is the official, unforked component; its `onReady` hands out a
`SheetCanvasHandle`: Excalidraw's imperative API plus `forwardWheel`,
`focusCanvas`, and `addMath` and `toggleSheetPanel`, what the two More tools
items do, and `openMathGuide`, what ☰ → Math guide does (M4d, #148). The ☰
menu holds Math guide just above Excalidraw's Help; its dialog
(`MathGuide`, in `src/guide/`) is portalled into `.excalidraw`, as the
bottom sheet is, and gives the canvas the keyboard back when it closes. With `vault` it marks its box `sheet-canvas--vault` (`VAULT_CLASS`
in `vaultItems.ts`), under which `SheetCanvas.css` hides the items
`VAULT_HIDDEN` names (Web Embed and Mermaid, one test id; the Generate
heading; Browse libraries; Copy to clipboard as SVG), and turns off
Excalidraw's AI items. Excalidraw 0.18.1 doesn't render its command palette
unless the host does, so Ctrl+/ and Ctrl+Shift+P open nothing even before a
vault view swallows them; its own Ctrl+P only shows a toast naming the palette,
and on the web the app takes Ctrl+P first (Print…). After an Open, Excalidraw's
Undo button can stay lit: `history.clear()` (`sceneFile.ts`) doesn't notify it;
pressing it undoes nothing and puts it right. With `theme` (a `ThemeMemory`, `theme.ts`) it opens
in the mode last chosen, light until one is, and tells the memory each
change of `appState.theme`. `vaultKeys.ts` is the keys of a vault tab:
`PASS_THROUGH_KEYS` and `SWALLOWED_KEYS` (tested constants), `vaultKeyRoute`,
and `confineKeys`, a capture listener on the view's container that stops a
core key Obsidian took (`defaultPrevented`) and every swallowed key.
`popoutBridge.ts` is the **pop-out bridge** (`bridgeWindow`, see
Load-bearing). `mathAnchor.ts` defines a math element's anchor (a rectangle
with `customData.kind === "math"` and `customData.source`, ADR 0002; a solid
`#ffffff01` fill, so clicks inside it select and drag it) and
`writeAnchorSource`, the only way source enters the scene, and
`writeAnchorTitle`, the same for the optional `customData.title`. An anchor
also carries its lines' **stored formats** (`MathAnchor.formats`,
`customData.formats`, spec section 7, M4e, #195): a string, one clause per
line of the source, no key when no line has one. `writeAnchorSource(api, id,
source, formats)` writes the two in one captured write, one undo step; with
`formats` left out they stay as they are, which only a write that keeps every
line in its place may do (a unit slot, a plot's settings, a save with a line
open). `selection.ts`
holds `deselectAll`, the second Esc's write (`NEVER`, no undo step).
`anchorStyle.ts` keeps anchors in the fixed style (`ANCHOR_STYLE`, in
`mathAnchor.ts`): `restoreAnchorStyles` writes it back with `NEVER`.
`mathSelection.ts` marks the box Excalidraw fills with
`data-math-selection` (`one`, `several`) while only math is selected, and
with `data-math-touch` (`markTouch`) while the `touch` App passes
`SheetCanvas` is set; `SheetCanvas.css` uses the marks for the reduced panel
and the hint (`MATH_HINT`, or `MATH_HINT_TOUCH` under the touch mark).
`SheetCanvas` starts new text in the Normal font (Nunito).
`canvasEvents.ts` (`listenToCanvas`) hands the canvas's double-clicks, presses,
clicks, pointer moves and keys to the gestures before Excalidraw hears them,
and stops the ones they take. On touch (M4d, #147) it follows Excalidraw's
own double tap (`TAP_TWICE_MS`, a second one-finger `touchstart` on the
canvas) and offers the second touch as a double-click (`PointAt`), stopping
and cancelling one the app takes; a touch's click is its `pointerup`, a task
later, and the browser's click after a touch is skipped; `anyPress` hears
every press under `root`, the panel's too. Keys are heard on a target it is given: the
page's document on the web, the view's container in a vault (`keyScope`,
through `MathOverlay` and `useSheetGestures`). `isCanvasElement` tells
Excalidraw's canvas by node name, so it holds in a pop-out window. `sceneFile.ts` is
the Excalidraw half of the sheet file: `serializeScene`, `loadScene` (no undo
step, clears history; `keepView` keeps scroll and zoom, for a vault's
outside change), `saveKey`, the key dirty is measured by, and `emptyScene`,
a New sheet's scene. `loadScene` restores a file through Excalidraw's `restoreElements`
and `restoreAppState` and then centres the view with `setViewport` on
`contentToShow(elements, appState)`: the whole sheet where it fits the view, else the
element nearest the point Excalidraw 0.18.1's `scrollToContent` measured from, since
`setViewport` centres whatever it is given (`contentToShow.test.ts`). The saved app
state (`SAVED_APP_STATE`) is the background, the grid's three keys and, since the canary,
`lockedMultiSelections`.
`SheetCanvas`'s `embeds={false}` passes Excalidraw `validateEmbeddable={false}`,
so no embed loads an iframe (the plugin's no-network rule).
`SheetCanvas` also turns off Excalidraw's own open, save and export and draws
the ☰ menu with the app's file items and, as its last line, the build stamp
(`__BUILD_STAMP__`, plain text); its handle carries `root`, the box it
shares with the overlay; its ☰ file items end with Print… (Ctrl+P) on the
web (M5, #81), and in a vault its `print` prop is the first ☰ item, Print… with
no key, then a separator. `fileRoutes.ts` takes the file keys, Ctrl+P (Print…) and scene-file
drops from Excalidraw (in a vault, `ignoreSceneDrops` only stops the drops),
and measures the space beside the ☰ button (`useBesideMenu`). `imageTool.ts`
takes over Excalidraw's image tool in a vault (`takeOverImageTool`: the
`toolbar-image` press and the key 9, stopped in capture, so the operating
system's picker never opens) and copies a picked image in with the public
API (`insertImage`: a `files` entry named by the bytes' SHA-1 and an image
element sized as Excalidraw sizes a click-placed one, one undo step;
Excalidraw's own 4 MB cap). `layers.ts` records where overlay
content sits among Excalidraw's DOM layers, and the dark theme's filter.
`addMath.ts` is Add math: a public custom tool (`startPlacing`,
`cancelPlacing`, `isPlacing`) and `watchPlacing`, which turns the placing
click into a new anchor, selected in the same write, and holds the crosshair.
`mathAnchor.ts` also has `removeAnchor`, the one-step removal of an element
left empty. `SheetCanvas` draws the welcome screen, and the app's two
items in Excalidraw's More tools dropdown: Add math and Math settings, which
opens the Sheet panel. `panelPresses.ts` holds `SHEET_SIDEBAR_CLASS`,
`isInSheetPanel` and `keepPanelPresses` (see Load-bearing), and `LINE_FIELD`
with `isLineField`, the mark the line's field shares with a rule's condition
field so the keyboard can pass between them (M4e, #197). The Sheet panel
(M4d, #143) has six icon tabs, `SHEET_PANEL_TABS`: Format, Symbols,
Variables, Problems, Constants, Settings, each named by a label span (read
on all; shown only on the bottom sheet's active tab) and its `title`, the
error badge on Problems; in the sidebar the shown tab's name is a heading
over its content (`.sheet-sidebar__heading`, M4e, #198). **The panel's
width** (spec section 8, M4e, #198): `panelWidth.ts` (pure) holds
`PANEL_WIDTH` (320), the range (280 to 480), the key step (16),
`clampPanelWidth` and `docksAbove(width)`, the docking width (640 px plus
the width), and the `PanelWidthMemory` port, which the slot's `width` takes
(`PanelMemory` is one). `SheetCanvas` holds the width as state, from the
memory once: it sets `--sheet-panel-width` on its own box, which
`SheetCanvas.css` hands to Excalidraw's `--right-sidebar-width`; it passes
`UIOptions.dockedSidebarBreakpoint` as `docksAbove(width)`, calls
Excalidraw's `refresh()` after each change (Excalidraw reads the prop after
its render and draws nothing again by itself), and the handle's
`panelDocks()` answers from the same value (never on a phone).
`PanelResizeHandle.tsx` is the drag handle, a `role="separator"` on the
sidebar's left edge inside `.sheet-sidebar__keys`: pointer capture on
itself, `onWidth` on each move, `onSettle` at the release, a double-click or
a key (← → by the step, Home), which is when the memory is told. It is the
one panel control with `tabIndex={0}`. The handle's `sheetPanel()` reads whether it is open and its tab,
and `showSheetPanel(state)` opens it on a tab or closes it with that tab as
the one Math settings opens next. `selection.ts`'s `scrollIntoArea` is
the follow rule (0.2.1, #191): it scrolls the canvas the least distance
that puts a row inside an area less `FOLLOW_MARGIN` (48 px), centring a row
the area has no room for, with `NEVER`; `visibleArea` is the canvas less
the Sheet panel where it covers it (floating or docked, at whatever width),
a phone's bottom sheet and the keyboard (`visualViewport`).
**The bottom sheet** (`BottomSheet.tsx`, M4d, #147): with `phone`,
`SheetCanvas` draws the panel there instead of Excalidraw's `Sidebar`,
portalled into `.excalidraw` (Excalidraw's theme, above the overlay), with
the same tabs (`TabFace`) and contents, a ✕, and the slot's `quickKeys`
above the tab icons; it carries `SHEET_SIDEBAR_CLASS` and
`BOTTOM_SHEET_CLASS`, so presses there are the panel's. Its state is held in
`SheetCanvas`; the handle's `sheetPanel`, `showSheetPanel` and
`toggleSheetPanel`, and the Math settings item, act on it, and it reports
each change through the slot's `onChange`, as the sidebar does. It sits
above the on-screen keyboard (how far the visual viewport's bottom falls
short of its box) at about half the visible height, short while `compact`.
The sidebar takes `quickKeys` too, above its tab triggers. `moreTools.ts` finds the open dropdown
(`useMoreToolsSlot`, a box of the app's own appended to it; Math settings
sits in a `display: contents` wrapper carrying `sidebar-trigger`, so a
floating panel's outside click ignores it without Excalidraw's square-button
style, whose `line-height: 0` hid its label, #102), closes it
(`closeMoreTools`) and marks its button while it is closed (`markMoreTools`:
`data-math-placing`, `data-math-problems` and `--math-problems`). Excalidraw
has no slot for it, so `moreTools.excalidraw.test.tsx` pins the class names.
`anchorSize.ts` writes an anchor's size (`writeAnchorSizes`: `NEVER`, top-left
kept, the rotated top-left for a rotated anchor) and settles a resize on
release (`settleResizes`, from `onPointerUp`'s `originalElements`): a width
at or above the element's floor becomes its **chosen width**
(`customData.width`, `MathAnchor.chosenWidth`), with Excalidraw's `x` kept
and the top and height put back, written `NEVER` so it lands in the resize's
own undo step; below the floor it goes back to automatic; a height-only drag
snaps back. It also says when a size write waits (`sizeWritesWait`).
`printScene.ts` is the scene's half of the print view (spec section 11, M5, #81;
[print](print.md)): `drawingBoxes` (each drawing's box from `getCommonBounds`,
Excalidraw text included, never an anchor), `anchorPlaces`, and `drawingsSvg(api,
top, bottom)`, the drawings that cross a page as one SVG from `exportScene` (no
anchors, light, no background, the scene's images; `inlineFonts` for a frame), with
its scene top-left. It writes nothing. The only module that imports
Excalidraw at runtime; tests may too, and other modules may import its
types. This is ADR 0001's engineering rule as amended in ADR 0002. Depends
on: `@excalidraw/excalidraw`, guide (the Math guide's dialog).
