Research for wayfinder ticket #174, 2026-11-15.

# What sets the Sheet panel's width and its docking, and can Excalidraw's sidebar be resized?

Installed version: `@excalidraw/excalidraw` **0.18.1**. Excalidraw references point at the installed
development bundle, `node_modules/@excalidraw/excalidraw/dist/dev/index.js` and `index.css`, by
name. Our code is at commit `01abb2c`. "Observed" means seen in the probe
([`sheet-panel-width/probe.mjs.txt`](sheet-panel-width/probe.mjs.txt)), which drove the real app
(`npm run dev`) in the session's headless Chromium. The only app change during the probe, since
reverted, passed `UIOptions.dockedSidebarBreakpoint` from the URL. "Computed" means arithmetic on
observed sizes, not itself observed. Nothing was run inside Obsidian; see "Not verified".

## Answer

**Both the width and the docking width are ours to change, without forking. Excalidraw has no
resizing of its own, so a drag handle would be our element, and nothing in Excalidraw stops it.
What is not ours: the switch to Excalidraw's mobile layout below 730 px, and the canvas toolbar's
550 px, which sets how narrow the space left of a docked panel can get.**

| Thing | Whose | How it is set | Can it change while running? |
| --- | --- | --- | --- |
| Panel width | Ours | The CSS variable `--right-sidebar-width` on `.excalidraw-container`. Excalidraw writes `302px` inline; our stylesheet overrides it with `384px !important` (`src/canvas/SheetCanvas.css`) | **Yes** (observed, 200 to 600 px) |
| Docking width | Ours | `UIOptions.dockedSidebarBreakpoint`, default 1229 (`MQ_RIGHT_SIDEBAR_MIN_WIDTH`). We don't pass it; `SIDEBAR_DOCKS_ABOVE = 1229` in `src/canvas/selection.ts` is our copy of the default | **Yes**, Excalidraw re-reads it when the prop changes (`componentDidUpdate`) |
| Docked or floating above that width | Ours and the user's | `docked` and `onDock` on `<Sidebar>`; the "Keep sidebar open" button | Yes |
| A drag handle, a remembered width | Nobody's yet | `SidebarProps` has only `name`, `onStateChange`, `onDock`, `docked`, `className` (`dist/types/excalidraw/components/Sidebar/common.d.ts`); no width, no resize | To be built by us |
| Mobile layout below 730 px wide, or below 500 px high and 1000 px wide | Excalidraw's | `isMobileBreakpoint`, constants `MQ_MAX_WIDTH_PORTRAIT`, `MQ_MAX_HEIGHT_LANDSCAPE`, `MQ_MAX_WIDTH_LANDSCAPE`; no prop | No |
| Toolbar, 550 px wide from x = 84 | Excalidraw's | Observed | No |

## Width

- **Where it comes from.** `.excalidraw .sidebar` is `position: absolute; right: 0; width:
  calc(var(--right-sidebar-width) - var(--space-factor) * 2)` (`index.css`), so the panel is 8 px
  narrower than the variable: 376 px at 384 (observed). The same variable narrows the UI layer when
  docked: `.layer-ui__wrapper` gets `width: calc(100% - var(--right-sidebar-width))` (`LayerUI`).
- **Any value works, live.** Setting the variable inline with priority `important` on the container
  moved the panel and the UI layer together at 200, 240, 280, 302, 340, 384, 480 and 600 px
  (observed). The inline value survived a tab switch and drawing a rectangle, so Excalidraw's
  re-renders don't reset it (observed). A cleaner form of the same thing, not run: our rule reads a
  second variable, `--right-sidebar-width: var(--sheet-panel-width, 384px) !important`, and the app
  sets `--sheet-panel-width`.
- **The canvas does not move.** The canvas stays the full width of the editor under the panel, and
  its backing size did not change across all eight widths (observed: 1536 before and after). Only
  the UI layer narrows, and the toolbar re-centres in it. So a width change, even on every frame of
  a drag, doesn't re-lay-out or shift the sheet. `getEditorUIOffsets` reads the sidebar's rectangle
  from the DOM when asked, so scroll-to-content keeps clear of the panel at any width.
- **Where a width could be remembered.** `PanelMemory` (`src/panel/panelMemory.ts`) already keeps
  open or closed outside the file: `localStorage` on the web, the plugin's `data.json` in a vault.
  A width would be a second value on that port.

## What six tabs need

Observed at 384: the tab row is 250 px (five icon tabs of 32 px, the active tab with its name at
86 px on Variables, 4 px of padding), and the rest of the header (the "Keep sidebar open" and Close
buttons at 36 px each, gaps and padding) takes 126 px. Tabs already show an icon only, with the
name on the active one. They are `flex: 0 1 auto; overflow: hidden`, so in a narrower panel they
shrink and clip rather than push Close out:

| Variable | Tab widths observed | Result |
| --- | --- | --- |
| 384 | 32 ×5, 86 | Fits, as today |
| 340 | 30 ×5, 77 | Active name clipped, icons whole |
| 302 | 25 ×5, 60 | Icons clipped (an 18 px icon in 11 px) |
| 280 | 23 ×5, 50 | Clipped |
| 240 | 19 ×5, 32 | Clipped |

What would fit, computed from those sizes (other tabs' names were not measured; Variables' is one
of the longest):

| Tab design | Smallest variable | Cost |
| --- | --- | --- |
| As today: icon tabs, name on the active one, dock and Close | 384 | None |
| Icons only, name in the tooltip and for screen readers | about 330 | The active tab's name goes; a heading under the row could carry it |
| Icons only, tab padding cut from 7 to 3 px (24 px tabs) | about 282, so 302 fits | Smaller targets, below the 32 px Excalidraw uses |
| Icons only, no "Keep sidebar open" button (`onDock` not passed) | about 294, so 302 fits | The user can't choose floating on a wide window |
| Two rows of three, or a menu for the last tabs | 302 and below | Our own tab list in place of `Sidebar.TabTriggers`'s single row; 40 px more height for two rows; a menu hides the Problems badge |

## Docking

- **The rule.** `refreshEditorBreakpoints` sets `canFitSidebar = editorWidth > breakpoint`, where
  `editorWidth` is the Excalidraw container's own width, not the window's, so an Obsidian tab is
  measured as a tab. It runs from a `ResizeObserver` on the container. The panel takes room beside
  the canvas only when it is open, `docked` and `canFitSidebar`.
- **At or below the breakpoint the panel floats:** it lies over the canvas and the toolbar, the dock
  button is gone, and a press outside it or Esc closes it (`SidebarInner`). Observed at 1229, 1000,
  900 and 760: the UI layer keeps the full width; at 760 the panel (384 to 760) covers the right
  half of the toolbar (84 to 634).
- **The breakpoint is a prop.** With it set to 800 the panel docked at 1000 and 900; with 700 or 0,
  at 760 (observed). With it set to 5000 the panel floated at 1536, and still opened by itself at
  launch, because `App.tsx` decides that from its own constant (observed). **The prop and
  `SIDEBAR_DOCKS_ABOVE` must be one value**; today they agree only because both are 1229.
- **How low it can go is set by the toolbar.** Docked, the toolbar must fit left of the panel, and
  it is 550 px wide starting at x = 84, so it needs about 640 px. Observed with a 384 panel: at
  1000 the toolbar's last 10 px lie under the panel, at 900 its last 110 px, at 760 its right half.
  So the lowest clean docking width is about **640 + the panel's width**: about 1024 for 384,
  about 942 for 302 (computed). This was seen on an empty sheet with nothing selected; the
  properties island that appears on the left with a selection sits below the toolbar and was not
  measured.
- **Excalidraw's own numbers** leave 927 px for the canvas at the breakpoint (1229 − 302). Ours
  leave 846 (1230 − 384, observed).
- **"Never float" is possible but not free.** A breakpoint of 0 docks at any width, but a 760 px
  editor is left with 376 px, less than the toolbar. The alternative for a narrow editor that is
  not a floating panel has to be ours: for example the phone's bottom sheet, which `SheetCanvas`
  already draws from the same tabs when `phone` is true.

## A 14-inch laptop, and an Obsidian tab

Assumed, not measured on Matheus's PC: a 14-inch screen gives a window 1280 to 1536 CSS px wide
(1920×1080 at 150 % or 125 % scaling).

| Editor width | Where it happens | Today (observed at that width) |
| --- | --- | --- |
| 1536 | Full window at 125 % | Docked, opens at launch; 384 of 1536 is a quarter of the screen, 1152 left |
| 1280 | Full window at 150 % | Docked, opens at launch; 30 % of the screen, 896 left |
| about 1230 to 900 | An Obsidian tab with one or both of Obsidian's sidebars open | Floats over the sheet and the toolbar, doesn't open at launch, closes on a press outside |
| 760 | A narrow tab or a split | Floats over half the editor |
| below 730 | A narrower tab or split | Excalidraw's mobile layout (toolbar at the bottom, 445 px); the panel still floats at 376 of 700 |

So in a vault on this laptop the panel is nearly always floating, and at 150 % with both Obsidian
sidebars open the tab can fall into the mobile layout. An edit opens the panel on Format
(`App.tsx`, `showAutomatically`) whether it docks or floats; floating, it stays open during the
edit because the line field carries `data-prevent-outside-click` (`docs/spec-v1.md`, the M4d checks table).

## What the phone's bottom sheet shares

`BottomSheet.tsx` is drawn instead of `<Sidebar>` when the plugin reports `Platform.isPhone`. It
shares the tab contents and `TabFace` (the same `panelTabs` array in `SheetCanvas.tsx`), the
remembered tab, and `showSheetPanel`. It shares neither the width variable nor the breakpoint. A
tablet is not a phone to the plugin, so it gets the sidebar and whatever width and docking rule the
desktop gets.

## Options for the panel prototype

**Width**

| Option | Cost | Breaks |
| --- | --- | --- |
| W1. Keep 384 | None | Nothing; Matheus's complaint stands |
| W2. One narrower fixed width (302 to 340) | One CSS value, and a tab design from the table above | At 302, tab targets or the dock button; Format, Symbols and Constants content was laid out for 376 and needs checking |
| W3. Width follows the editor (for example 25 %, clamped 302 to 384) | A CSS `clamp()` in the variable; no script (not run) | Content has to work across the range; the width changes as Obsidian's sidebars open |

**Resizing**

| Option | Cost | Breaks |
| --- | --- | --- |
| R1. None | None | |
| R2. Our drag handle on the panel's left edge, width remembered in `PanelMemory` | A small element inside `<Sidebar>` with pointer capture, a min and max, a keyboard equivalent, a second remembered value in both homes (browser and `data.json`). It must be let through `listenToCanvas` like other panel presses, and must not end an open line edit | Adds a control Excalidraw doesn't have; every width in the range needs a working tab row, so it forces a tab design that survives the minimum |
| R3. Two sizes, a toggle (compact and wide) | A button and one remembered value | One more header button, in a header that is already the tight spot |

**Docking**

| Option | Cost | Breaks |
| --- | --- | --- |
| D1. Keep 1229 | None | In an Obsidian tab on a 14-inch laptop the panel floats nearly always |
| D2. Lower the breakpoint to about 640 + panel width | Pass `dockedSidebarBreakpoint`, and make `SIDEBAR_DOCKS_ABOVE` the same value. If the width can change (W3, R2), the breakpoint is computed from it and passed as a prop | Docks in narrower tabs, where the panel then takes a larger share; launch-opening follows it |
| D3. Below the breakpoint, something other than floating | The bottom sheet for narrow editors (exists for phones; needs a width rule beside `Platform.isPhone`), or not opening by itself on an edit when it would float | Changes "an edit opens the panel on Format" for narrow editors; a tablet below the breakpoint changes too |
| D4. Always dock (breakpoint 0) | One prop | The toolbar goes under the panel below about 640 + panel width |

None of these touches Excalidraw's code, so ADR 0001 stands. Below 730 px Excalidraw's mobile
layout applies whatever is chosen.

## Not verified

- **Inside Obsidian.** No run in Obsidian. The widths of Obsidian's own sidebars and so of a tab
  on Matheus's laptop are assumed; the behaviour at each editor width is observed in the web app,
  and the breakpoints read the container's width, so a tab should behave as a window of that width.
- **The screen's CSS width** on Matheus's work PC (scaling).
- **`clamp()` or a second variable** inside `--right-sidebar-width`: standard CSS, not run.
- **Tab minimums** in the second table are computed, and only Variables' name was measured.
- **Panel content below 376 px** (Format's controls, the Symbols grid, Constants rows) was not
  looked at; the prototype will show it.
