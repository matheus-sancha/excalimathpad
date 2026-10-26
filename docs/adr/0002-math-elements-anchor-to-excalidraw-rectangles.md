# 0002. Math elements anchor to a marked Excalidraw rectangle; the overlay renders them

- **Status**: accepted
- **Date**: 2026-10-25

## Context

ADR 0001 puts math in an overlay around the unforked Excalidraw component. A
math element still needs a position on the sheet that pans and zooms with the
drawing, and that can be moved, selected, deleted and undone like everything
else next to the sketches. Something has to own that position. Excalidraw has
no public way to add a custom element type or tool.

Approved by Matheus on issue #2 (design comment, 2026-10-25), together with:
plain math.js `=` for assignment, one multi-line block per element for the
spike, one seeded element on load and no "add math" UI yet.

## Decision

Decided by Matheus: each math element is anchored to an ordinary Excalidraw
rectangle marked with `customData: { kind: "math" }`. Excalidraw owns the
anchor: position, size, rotation, selection, deletion, undo and redo. The math
overlay reads anchors through Excalidraw's public API (`getSceneElements`,
`getAppState`, `onChange`, `onScrollChange`) and draws each math element over
its anchor, at `(scene + scroll) * zoom`.

Engineering rules that make it work (Engineer's, found in the #2 spike):

- The overlay sits between Excalidraw's DOM layers: above its drawing, below
  its toolbar and panels (`src/canvas/layers.ts`). With the overlay above
  everything, math covered the toolbar and took its clicks.
- Wheel events over a math element are re-dispatched onto Excalidraw's canvas
  (`forwardWheel`), because Excalidraw only listens on its own container.
- The anchor has a transparent background and the math text is inset from its
  border, so the border stays grabbable while the text area takes typing.

Not decided here: how math source is persisted. It is still open (ADR 0001):
scene `customData` on the anchor, or marker text elements. During the spike
the source lives in memory, keyed by anchor id.

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

## Consequences

- Moving, deleting and undoing math is Excalidraw's own behaviour, for free.
  Undoing a delete brings the element back with its source, because the
  source is keyed by the anchor id.
- The overlay depends on two Excalidraw details that are not public API: its
  layer z-indexes (CSS), and that its wheel handler acts on any canvas
  target. Both are localised in `src/canvas/` and must be re-checked in the
  browser on every Excalidraw upgrade.
- Copying or duplicating an anchor in Excalidraw copies the marker but not
  the source: the copy shows an empty math element until the source moves
  into the scene (the persistence decision).
- Excalidraw's export (PNG/SVG) shows the dashed anchor but not the math.
- The anchor does not grow with its text; longer source overflows its border.
