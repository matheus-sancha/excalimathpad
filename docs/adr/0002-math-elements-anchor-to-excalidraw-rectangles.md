# 0002. Math elements anchor to a marked Excalidraw rectangle; the overlay renders them

- **Status**: accepted
- **Date**: 2026-10-25
- **Amended**: 2026-11-03 (spec v1, [`docs/spec-v1.md`](../spec-v1.md): source in the
  anchor, the app writes source, size and style, a solid `#ffffff01` background).
  2026-11-13 (M4c; #95, #100): a chosen width and a title's format, both built
  (#110, #111).
  Amended items name the milestone that builds them; until then
  [`CONTEXT.md`](../../CONTEXT.md) says what the code does.
- **Built**: source in the anchor (#41, 2026-11-04); the `#ffffff01` fill, the
  pointer-transparent overlay and the gesture listeners (#43, 2026-11-07); size,
  written with `NEVER` through `src/canvas/anchorSize.ts`, and resize handles that
  snap back (#44, 2026-11-07); Add math as a custom tool, the removal of an
  element left empty, and the untitled sheet without its seed (#45, 2026-11-10);
  the fixed style, restored with `NEVER` through `src/canvas/anchorStyle.ts`, and
  opacity followed by the overlay (#46, 2026-11-10); the optional title in
  `customData.title` (#64, 2026-11-11); the chosen width in `customData.width`, set
  by the resize handles on release in the resize's own undo step, with the snap-back
  kept for a height-only drag (`settleResizes`, #110, 2026-11-13); the title's format
  in `customData.titleFormat`, a string of the words that differ from no format,
  written one undo step per press (`writeAnchorTitleFormat`, #111, 2026-11-13).

## Context

ADR 0001 puts math in an overlay around the unforked Excalidraw component. A
math element still needs a position on the sheet that pans and zooms with the
drawing, and that can be moved, selected, deleted and undone like everything
else next to the sketches. Something has to own that position. Excalidraw has
no public way to add a custom element type.

Approved by Matheus on issue #2 (design comment, 2026-10-25), together with:
plain math.js `=` for assignment, one multi-line block per element for the
spike, one seeded element on load and no "add math" UI yet. v1 removes the seed and
adds Add math (#12, #17).

## Decision

Decided by Matheus: each math element is anchored to an ordinary Excalidraw
rectangle marked with `customData: { kind: "math" }`. The math overlay reads anchors
through Excalidraw's public API (`getSceneElements`, `getAppState`, `onChange`,
`onScrollChange`) and draws each math element over its anchor, at
`(scene + scroll) * zoom`.

Who owns what on the anchor (#10, #11, #29, #32; M1):

- **Excalidraw owns** position, rotation, selection, deletion, undo and redo.
- **The app writes** four things:
  - `customData.source`, the element's lines, once per line commit. This is the
    decision the first version left open.
  - Size, always equal to the content, with no undo step. Resize handles snap back.
    A size write doesn't move a bound arrow's end: Excalidraw's binding update
    isn't public, so the end follows when the element next moves (known limit,
    #44).
  - Style, fixed except `opacity`, restored with no undo step if anything changes it.
  - `customData.title`, the element's optional title, one undo step per change, by the same
    write path as the source (#64, 2026-11-11).
  - M4c: `customData.titleFormat`, the title's format, one undo step per press (#95).
  - M4c: `customData.width`, the element's optional chosen width, set by Excalidraw's resize
    handles as one undo step (#100). The size write then keeps the width at the larger of it and
    what the math lines need, and still owns the height. Resize handles no longer snap the width
    back; they snap the height back.

Engineering rules that make it work (Engineer's, found in the #2 spike and #28):

- The overlay sits between Excalidraw's DOM layers (`src/canvas/layers.ts`):
  at z-index 2, tied with Excalidraw's interactive canvas and winning by DOM
  order, so it is above the drawing and below Excalidraw's text editor, SVG
  layer, link buttons (3) and its toolbar and panels (4). With the overlay
  above everything, math covered the toolbar and took its clicks.
- The anchor's background is `#ffffff01`, solid, not transparent (#28; M1).
  Excalidraw tests the inside of a shape only when its background isn't transparent,
  and this one looks the same, so a click or drag anywhere inside works without
  forwarding anything.
- The overlay is `pointer-events: none`, except the open line editor, unit field and
  plot popover (#28, #31; M1, M2, M4). Capture-phase listeners take double-click, Enter
  and M. The line hit comes from geometry.
  - Built in #43: `src/canvas/canvasEvents.ts` (`listenToCanvas`) registers the
    listeners and owns their event phases, per ADR 0001; the overlay's gestures only
    decide. Pointer events are heard on the box Excalidraw fills, a sibling of the
    overlay, so the field's own clicks never reach them. A double-click, or the click
    that moves an edit, is math's only when Excalidraw's own press selected the anchor
    under the pointer, or the anchor is locked and nothing above it was selected
    (Excalidraw's hit-testing skips a locked element). So its hit-testing decides, and
    a drawing on top keeps its double-click. A press leaves an open line before
    Excalidraw sees it, so a drag starts on the committed scene.
- Wheel events over overlay content that takes pointer events are re-dispatched onto
  Excalidraw's canvas (`forwardWheel`), because Excalidraw only listens on its own
  container. With the overlay pointer-transparent that should mean only the open
  editor, field and popover (inferred, not tested).
- Add math is a public Excalidraw custom tool (`setActiveTool({ type: 'custom', … })`),
  which the first version of this ADR said didn't exist (#28; built in #45,
  `src/canvas/addMath.ts`).

## Alternatives considered

- **The overlay owns the position, with its own drag handle.** No coupling to
  Excalidraw's element model, but move, select, delete and undo would all be
  rebuilt by us, and math would not be part of the scene. Lost on cost.
- **Render math through Excalidraw's `renderEmbeddable`** (a public prop, with
  a custom `validateEmbeddable`). Excalidraw would place it with its own
  transform and wheel events would just work. But it renders inside
  Excalidraw's DOM (against ADR 0001's "around, not inside"), embeds are
  inert until clicked, and embeddables are tied to links. Kept as plan B; the
  spike did not need it.
- **A transparent anchor with the math text inset,** as this ADR first said. An
  unselected transparent anchor can't be selected or dragged from inside, so
  "drag from anywhere" (#14) needs the opaque form (#28).
- **Source in memory, keyed by anchor id,** the spike's arrangement. It can't be saved
  or undone with the scene, and a copied anchor comes up empty (#10).
- **An anchor that keeps the size you drew,** as the spike did. What you can grab is
  the anchor's rectangle, so content outside it can't be clicked or dragged, and
  results change size from edits elsewhere (#28, #29).

## Consequences

- Moving and deleting math is Excalidraw's own behaviour, for free. Undoing a delete
  brings the element back with its source, because the source is in the anchor.
- A math edit is on Excalidraw's undo stack, one step per line commit. That step's write uses
  `newElementWith` and `CaptureUpdateAction.IMMEDIATELY` (#10, #11). Before it, the app parks the
  anchor's `version` in an uncaptured update, to record a change Excalidraw didn't capture (#41).
  `docs/spec-v1.md` section 14 says why, and why that has to change at the next upgrade.
- A copied or duplicated anchor keeps its source (probed on #41, recorded in
  `docs/spec-v1.md` section 17, with contract tests).
- The overlay depends on Excalidraw details that are not public API. They are
  localised in `src/canvas/`, each with a contract test against the installed package,
  so an upgrade that breaks one fails CI. Today: layer z-indexes (`layers.test.ts`), the
  wheel handler and the `.excalidraw` focus query (`SheetCanvas.test.tsx`), how
  `updateScene` compares versions before it captures (`mathAnchor.excalidraw.test.tsx`),
  and, from #43:
  - `#ffffff01` counting as not transparent for hit-testing, so a press inside an
    anchor selects it (`mathAnchor.excalidraw.test.tsx`, with a transparent control);
  - the event phases of the gestures: Excalidraw handles `dblclick` and `keydown` in
    React's bubble phase, so a capture listener that stops them keeps them from it, and
    a capture `pointerdown` runs before its press (`canvasEvents.excalidraw.test.tsx`,
    each with the control; the gestures themselves in `gestures.excalidraw.test.tsx`).

  v1 adds the rest of the list in `docs/spec-v1.md` section 14.
- Excalidraw's export isn't reachable, because it would show the anchor without the
  math. Print leaves anchors out of its `exportToSvg` call and applies their opacity to
  the math (#17, #21, #32; M5).
- Selecting an anchor opens Excalidraw's panel and hint, which no prop turns off per
  element, so the app reduces them with CSS under a contract test (#32; M1).
