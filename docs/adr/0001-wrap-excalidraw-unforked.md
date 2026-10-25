# 0001. Wrap the npm Excalidraw component, unforked; math lives around it

- **Status**: accepted
- **Date**: 2026-10-25

## Context

Excalimathpad needs a freehand canvas plus live math elements that look and
behave as if they were on the canvas: they pan and zoom with it and sit next
to drawings. Excalidraw is the canvas. The question is how deep the math goes
into it. Excalidraw's element model has no "math" type, and adding one
properly means touching its renderer, serialisation and tools.

Decided by Matheus in the project interview on 2026-10-25.

## Decision

We use the official `@excalidraw/excalidraw` npm package as an unmodified
React component. Math is a separate overlay layer stacked over the canvas,
kept in sync through Excalidraw's public imperative API (app state, scroll
and zoom subscriptions), plus a side panel. Only `src/canvas/` imports
Excalidraw.

## Alternatives considered

- **Fork Excalidraw and add a native math element type.** The most integrated
  result (selection, undo, export would include math for free), but it makes
  us maintain a fork of a large, fast-moving codebase, and every upstream
  release becomes a merge. Too costly for a single-user v1.
- **Patch the package (`patch-package`) for a few hooks.** Smaller than a
  fork, but patches break silently on upgrade and still couple us to
  internals.
- **Store math inside existing elements (e.g. text elements with a marker)
  and re-render them.** Keeps everything in one scene, but fights
  Excalidraw's text editing and rendering; kept open as a way to *persist*
  math later, not to render it.

## Consequences

- Upgrades are `npm update`; we inherit Excalidraw's fixes and features.
- We only get what the public API exposes. Overlay positioning has to follow
  scroll/zoom events; if that lags or the API changes, math visibly drifts
  (issue #2 is the spike that proves this works).
- Excalidraw's own selection, undo/redo and export do not know about math.
  Anything that should include math (undo, export to PNG/SVG, saving) needs
  our own handling.
