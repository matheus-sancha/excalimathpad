Research for wayfinder ticket #28, 2026-11-02.

# Can a math element take double-click and Enter while Excalidraw keeps click and drag?

Installed version: `@excalidraw/excalidraw` **0.18.1**. Source links point at the matching tag,
[`v0.18.1`](https://github.com/excalidraw/excalidraw/tree/v0.18.1/packages/excalidraw). "Observed"
means seen in the probe at the end, run with real pointer and key input against the installed
package in the desktop app's Chromium browser pane.

## Answer

**Yes, unforked, with one change to the anchor and three capture-phase listeners.**

1. **The anchor needs a background Excalidraw treats as opaque.** With a transparent background, a
   click or drag inside an unselected anchor does nothing. Use `backgroundColor: '#ffffff01'` with
   `fillStyle: 'solid'`: it looks the same as transparent and takes clicks and drags from anywhere
   inside (observed). This changes ADR 0002, which says the anchor is transparent.
2. **The overlay stays `pointer-events: none`.** Pointer events go straight to Excalidraw, and no
   forwarding is needed. Only the open line editor (and an open unit field) takes pointer events.
3. **A capture-phase `dblclick` listener on the stage** takes the double-click and stops it, so
   Excalidraw never adds a label (observed).
4. **A capture-phase `keydown` listener on `document`** takes Enter and M in the same way (observed).
5. **Which line was hit comes from geometry**, not from DOM hit-testing: viewport to scene with the
   exported `viewportCoordsToSceneCoords`, undo the anchor's rotation, then find the row. It was
   right at 150% zoom with a 30° rotation (observed).
6. **Add math can be a real Excalidraw custom tool.** `setActiveTool({ type: 'custom', customType })`
   is [documented public API](https://github.com/excalidraw/excalidraw/blob/v0.18.1/dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx#L359-L373),
   so the placing click needs no overlay layer (observed). The note on
   [What is the v1 app chrome](https://github.com/matheus-sancha/excalimathpad/issues/17) that
   Excalidraw has no public custom tools is wrong.

**Two earlier decisions need adjusting**, both from
[How does a math element look typeset](https://github.com/matheus-sancha/excalimathpad/issues/14):

- **"A second Esc deselects, as in Excalidraw" is wrong for 0.18.1.** Esc on a selected rectangle
  leaves it selected, with or without our listeners (observed). If the second Esc should deselect,
  the app has to do it. `updateScene` with `appState: { selectedElementIds: {} }` and
  `CaptureUpdateAction.NEVER` worked (observed).
- **"Dragging from anywhere" and a clickable unit slot** can both hold if the slot lets pointer-down
  through and opens on `click` when the pointer did not move. Excalidraw then still selects on press
  and drags as usual. Stopping pointer-down on the slot also works, but a drag starting there then does
  nothing (observed). Opening on `click` is **unverified**: the probe only tried the stopping form.

**New question this raises:** selecting an anchor opens Excalidraw's properties panel and its hint
says "Press Enter to add text". See [Side effects](#side-effects-of-relying-on-a-selected-rectangle).

## How each gesture works

### Click and drag

[`shouldTestInside`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/element/collision.ts#L48)
only tests the inside of a shape when its background isn't transparent.
[`isTransparent`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/utils.ts#L540)
checks for the palette's transparent, a 5-character colour ending in `0`, or a 9-character colour
ending in `00`. So `#ffffff01` counts as opaque.

| Anchor | Action | Result (observed) |
|---|---|---|
| Transparent, unselected | Click inside | Not selected |
| Transparent, unselected | Drag from inside | Not moved |
| Transparent | Click on the stroke | Selected |
| Transparent, selected | Drag from inside | Moved ([`hitElement`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L5089) tests the selection box for a selected element) |
| `#ffffff01`, unselected | Click inside | Selected |
| `#ffffff01`, unselected | Drag from inside | Selected and moved |

So the result depends on whether the element is already selected. Only 0.18.1 was tested, so whether
it differs between versions is **unverified**; a contract test would catch a change. On screen the `#ffffff01` anchor looked the same as the transparent one on the
white canvas (observed). Dark mode and a drawing underneath it were not checked: **unverified**, but
at 1/255 alpha no visible change is expected.

### Double-click

Excalidraw binds [`onDoubleClick` on its interactive canvas](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L1797)
as a React prop, and React dispatches it when the event bubbles to the root. A native capture
listener on the stage runs on the way down, so `stopPropagation()` there means
[`handleCanvasDoubleClick`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L5353)
never runs.

- With the listener off, Excalidraw opened its text editor on the anchor (observed, the control).
- With it on, no text editor opened, no element was added, and the anchor stayed selected from the
  first click of the double-click (observed).
- Clicks of a double-click still reach Excalidraw, so selection works as #14 wants.

### Enter

Excalidraw's key handling is [a React `onKeyDown` on its root div](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L1558-L1559)
unless `handleKeyboardGlobally` is set. Its [Enter branch](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L4391)
starts text editing on a text container. A capture listener on `document` runs first, and stopping
the event there prevents it.

- With the listener off, Enter opened Excalidraw's text editor (observed, the control).
- With it on, the overlay took it and opened the last line, with no text editor (observed).

The listener should act only when exactly one math anchor is selected, the active tool is the
selection tool, no modifier is held, and the target isn't an input, textarea, contenteditable or
button. The probe ran the cases of one selected anchor and a textarea target. The other conditions
come from reading the handlers and are **unverified**. The probe didn't check the active tool or a
button target, and a real listener should, for double-click too.

### The line editor

The editor's `<textarea>` sits in the overlay, outside Excalidraw's root div, so Excalidraw's
`onKeyDown` never sees its keys. Typing `r` stayed in the field and didn't switch to the rectangle
tool, and Delete didn't delete the anchor (observed).

Leaving the editor has to give the keyboard back: focus the `.excalidraw` container. Without focus
inside it, Excalidraw's shortcuts wouldn't fire, because of the React handler above (from the source,
not tried). With it, Enter worked again straight after leaving (observed). There is no public focus method, so this query belongs in
`src/canvas/`, like `forwardWheel`.

### Which line was hit

A capture `pointermove` and `dblclick` on the stage are enough. Convert with
`viewportCoordsToSceneCoords`, rotate the point by `-angle` around the anchor's centre, and find the
row by its offset. It returned the right line at 150% zoom, scrolled, with a 30° rotation (observed).

The probe's rows were all one height. Real rows differ (KaTeX, tables), so read `offsetTop` and
`offsetHeight`, which ignore CSS transforms. That form is **unverified**.

`document.elementFromPoint` can't do this while the overlay is `pointer-events: none`, which is why
it isn't used here.

### M and the placing click

- **M isn't an Excalidraw shortcut:** there is no `M` in [`keys.ts`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/keys.ts),
  and pressing it with our listener off changed nothing (observed).
- **M can start a custom tool.** The next click on the canvas reaches
  [`onPointerUp`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L8959)
  with `pointerDownState.origin` already in scene coordinates. Excalidraw
  [draws nothing for a custom tool](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L6592). Placing on top of an existing anchor worked and didn't select or move it (observed).
- **Esc cancels** through the same listener, and adds nothing (observed).
- **The crosshair has to be re-applied.** `api.setCursor('crosshair')` holds until the pointer moves,
  then Excalidraw resets it. Calling it again two animation frames after each `pointermove` held it
  over an anchor (observed). A ghost box follows from the same `pointermove`; it wasn't built.

**Undo needs one detail.** `setActiveTool` to a non-selection tool clears the selection, and
Excalidraw records selection changes in its history. If something was selected before M, a plain
insert takes two undos: the first only restores the selection (observed). **Selecting the new element
in the same `updateScene` fixes it:** one undo removes the element and restores the old selection,
and redo brings it back selected (observed). That matches
[What is one undo step for a math edit?](https://github.com/matheus-sancha/excalimathpad/issues/11)
and #17's flow, where the new element is selected with its first line open.

```ts
const offPointerUp = api.onPointerUp((tool, down) => {
  if (tool.type !== 'custom') return
  const [anchor] = convertToExcalidrawElements([{ ...anchorProps, ...down.origin }])
  api.setActiveTool({ type: 'selection' })
  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), anchor],
    appState: { selectedElementIds: { [anchor.id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  })
})
```

### The result column: hover and unit slots

These work without pointer events too, from the same stage listeners and geometry: the probe reported
the hovered line and whether the pointer was on the slot (observed). A pointer cursor over a slot
works the same way as the crosshair, with `setCursor` two frames after the move (observed). Whether
that flickers wasn't judged by eye: **unverified**.

## Side effects of relying on a selected rectangle

- **The properties panel opens for an anchor.** Excalidraw shows it [whenever something is selected](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/element/showSelectedShapeActions.ts),
  and no prop turns it off for one element. It floats over the canvas on the left, and covered a
  selected math element's expressions in the probe (observed). It also offers Background: choosing
  transparent there would break clicking inside that anchor (follows from `shouldTestInside`).
  `.excalidraw .selected-shape-actions { display: none }` hides it (observed), but that's a CSS
  internal and needs a contract test.
- **The hint is wrong for an anchor.** It says "Press Enter to add text", and Enter now edits a line
  (observed). `.HintViewer` is the same kind of internal.
- **Arrows may bind to a math element from inside.** [`isBindingFallthroughEnabled`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/utils.ts#L550)
  is false for a solid, non-transparent fill. Not tried: **unverified**.
- **A drawing on top of an anchor:** as written, the listeners win over it, so a double-click there
  would edit math rather than label that drawing (from the code, not tried). Elements come back in
  z-order from `getSceneElements`, so the listener could check. Not built.

## What this relies on that isn't public API

Add these to the contract tests, as `layers.test.ts` does:

| Behaviour | If it changes | Test |
|---|---|---|
| `#ffffff01` counts as not transparent for hit-testing | Clicks inside an anchor stop selecting | Pointer down inside an unselected anchor selects it |
| `onDoubleClick` runs in React's bubble phase | Excalidraw adds a label as well | A double-click stopped at the stage adds no text element |
| Key handling runs in the bubble phase, at or below the root | Enter opens the text editor as well | Enter stopped on `document` opens no editor |
| No built-in shortcut for M | M also switches tool | M leaves the tool unchanged when not intercepted |
| Excalidraw resets the cursor on pointer move | Harmless | None needed |
| `.excalidraw` is the element that takes focus | Shortcuts die after leaving an edit | Enter works after leaving an edit |

The double-click, Enter and M rows could run under vitest + jsdom beside
`MathOverlay.excalidraw.test.tsx`. Whether Excalidraw's hit-testing runs in jsdom (the first row) is
**unverified**.

These are public and need no contract test: `setActiveTool` with a custom tool, `setCursor`,
`onPointerUp`, `updateScene` with `captureUpdate`, `viewportCoordsToSceneCoords`, and
`handleKeyboardGlobally`.

## Not covered

- **Touch.** A double tap calls [`handleCanvasDoubleClick` directly from `touchstart`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L2968),
  not through `dblclick`, so these listeners wouldn't stop it: a double tap on an anchor would still
  add a label. Follows from the source, not tried.
- **Other browsers.** The probe ran in Chromium only. Capture and bubble order is standard DOM, so no
  difference is expected: **unverified**.
- **Dragging while editing.** #14 says starting a drag on the element leaves the edit. The probe only
  tried a click outside the element, which left it (observed).
- **Grouped or locked anchors.** Not tried.

## Probe

A throwaway Vite page in a scratch clone of this repo at `main` (`fa38868`), not committed. It
rendered the real Excalidraw component, two anchors (one transparent, one `#ffffff01`), a drawing
rectangle and an overlay with four plain-text rows per anchor (no KaTeX). It was driven with real
input through the browser pane. Double-click, Enter and M were each also run with the listener
switched off, as controls. The listeners, in short:

```ts
stage.addEventListener('dblclick', (e) => {
  if (e.target instanceof HTMLTextAreaElement) return
  const hit = hitTest(e.clientX, e.clientY)  // geometry, as above
  if (!hit) return
  e.stopPropagation(); e.preventDefault()
  openLine(hit.id, hit.line ?? lastLine)
}, true)

document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement
  if (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) return
  const { selectedElementIds, activeTool } = api.getAppState()
  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
    const selected = api.getSceneElements().filter((el) => selectedElementIds[el.id])
    if (selected.length === 1 && isMathAnchor(selected[0])) {
      e.stopPropagation(); e.preventDefault()
      openLine(selected[0].id, lastLine)
    }
  }
  if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.stopPropagation(); e.preventDefault()
    api.setActiveTool({ type: 'custom', customType: 'add-math' })
    api.setCursor('crosshair')
  }
  if (e.key === 'Escape' && activeTool.type === 'custom') {
    e.stopPropagation()
    api.setActiveTool({ type: 'selection' })
  }
}, true)
```
