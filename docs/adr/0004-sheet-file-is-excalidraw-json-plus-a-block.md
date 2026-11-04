# 0004. The sheet file is Excalidraw JSON plus one block, saved as `.excalimathpad`

- **Status**: accepted, not built yet (M1)
- **Date**: 2026-11-03

## Context

ADR 0001 and ADR 0002 left persistence open. A saved file outlives any code change:
once sheets exist on disk, the app has to read them for as long as they matter, so the
format is the hardest v1 choice to reverse. It also decides what other tools can open.

Decided by Matheus on 2026-11-01 (#12). The file's behaviour is in
[`docs/spec-v1.md`](../spec-v1.md) section 7.

## Decision

Decided by Matheus: a sheet is the JSON Excalidraw itself writes (`type: "excalidraw"`,
`elements`, `appState`, `files`), with one extra top-level key, `excalimathpad`, holding
`format` (an integer, 1 in v1) and the sheet's `settings`. Each anchor's source is in its
`customData`. The extension is `.excalimathpad`, and the installed app registers it.

- An **older** `format` is upgraded in memory on open, one step at a time.
- A **newer** `format` is refused, so an old app never overwrites a newer file.
- A file with **no block** opens as format 1 with default settings.
- The file changes only on Save or Save as. A recovery copy lives in the browser between
  saves.

Engineering rules (Engineer's):

- Serialize with `serializeAsJSON(…, "local")`, then add the block. Excalidraw's own save
  drops the block, so its save, open and export are never reachable.
- A migration is a pure function from format *n* to *n + 1*, one per step.
- Results are never saved: they are derived on every run (ADR 0003).

## Alternatives considered

- **Plain `.excalidraw`.** Opens anywhere, but it has no format number or settings of
  ours, and PWA file handling needs an extension of its own (#22).
- **Our own wrapper around the scene.** Clean to version, but Excalidraw couldn't read it,
  losing the fallback below for no gain.
- **Autosave to the file,** in place of Ctrl+S with a recovery copy. The file on disk would
  change without being asked. Matheus chose saving on purpose, as in Mathcad.
- **Other names:** `.calc`, `.xmath` and `.excalimath` were offered. `.excalimathpad` was
  Matheus's own pick.

## Consequences

- Renamed to `.excalidraw`, a file opens in plain Excalidraw or Obsidian Excalidraw as a
  drawing with empty dashed rectangles. That's a fallback, not a round trip: saving it back
  from those tools may lose the block.
- Every format change needs a migration and a test, and the app must keep them.
- The format inherits Excalidraw's own scene format, so an Excalidraw upgrade that changes
  it reaches our files through its `restore`.
- Display units, comments and plot settings live in each line's source, so adding those
  needs no format change (ADR 0005).
