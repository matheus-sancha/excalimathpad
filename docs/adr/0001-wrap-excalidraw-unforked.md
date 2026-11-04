# 0001. Wrap the npm Excalidraw component, unforked; math lives around it

- **Status**: accepted
- **Date**: 2026-10-25
- **Amended**: 2026-11-03 (spec v1, [`docs/spec-v1.md`](../spec-v1.md): persistence
  decided, chrome in Excalidraw's public slots, contract-tested internals allowed).
  Amended items name the milestone that builds them; until then
  [`CONTEXT.md`](../../CONTEXT.md) says what the code does.

## Context

Excalimathpad needs a freehand canvas plus live math elements that look and
behave as if they were on the canvas: they pan and zoom with it and sit next
to drawings. Excalidraw is the canvas. The question is how deep the math goes
into it. Excalidraw's element model has no "math" type, and adding one
properly means touching its renderer, serialisation and tools.

Decided by Matheus in the project interview on 2026-10-25.

## Decision

Decided by Matheus: we use the official `@excalidraw/excalidraw` npm package
as an unmodified React component. Math is a separate overlay layer stacked
over the canvas, around Excalidraw rather than inside it. The app's chrome (file
items, Add math, the Sheet panel) goes into Excalidraw's public UI slots: its main
menu, `renderTopRightUI` and its sidebar (#17; M1, M2). It is still unforked.

Math source persists in the anchor's scene `customData` (#10, #12; M1). The file
around the scene is ADR 0004.

Engineering rules that enforce it (Engineer's, not part of his decision):

- The app stays in sync through Excalidraw's public API first. A behaviour that
  isn't public API (a CSS internal, event phase, DOM focus target) is allowed only
  when a contract test against the installed package fails if it changes, and only
  in `src/canvas/` (#28, #32; M1). `docs/spec-v1.md` section 14 lists them.
- Only `src/canvas/` imports Excalidraw **at runtime**, so the dependency has one
  seam. Tests may import it (e.g. the contract test against its own
  `sceneCoordsToViewportCoords`), and other modules may import its *types*.

## Alternatives considered

- **Fork Excalidraw and add a native math element type.** The most integrated
  result (selection, undo, export would include math for free), but it makes
  us maintain a fork of a large, fast-moving codebase, and every upstream
  release becomes a merge. Too costly for a single-user v1.
- **Patch the package (`patch-package`) for a few hooks.** Smaller than a
  fork, but patches break silently on upgrade and still couple us to
  internals.
- **Render math as existing elements (e.g. text elements with a marker).**
  Keeps everything in one scene, but fights Excalidraw's text editing and
  rendering for typeset output. Rejected for rendering on 2026-10-25.
- **Marker text elements to persist math,** a candidate this ADR first left open.
  `customData` round-trips through Excalidraw's save and undo, so nothing needs
  marker elements (#10).
- **A side panel and app bar around Excalidraw,** as this ADR first said. Excalidraw's
  own slots gave the same controls without a second bar, and the sidebar is public
  API (#17).

## Consequences

- Upgrades are `npm update`; we inherit Excalidraw's fixes and features. Each
  non-public behaviour we rely on has a contract test, so an upgrade that breaks one
  fails CI rather than the app.
- We only get what the public API exposes. Overlay positioning has to follow
  scroll/zoom events; if that lags or the API changes, math visibly drifts
  (issue #2 is the spike that proves this works).
- Undo includes math, because the source is in the scene (#10, #11; M1).
- Excalidraw's own save and export don't know about the math, so neither is
  reachable: the app writes files itself, and print is its own view built from the
  overlay's views and Excalidraw's public `exportToSvg` (#12, #17, #21; M1, M5).
