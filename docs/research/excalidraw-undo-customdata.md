Research for wayfinder ticket #10, 2026-11-01.

# Does Excalidraw's undo history record `customData` edits made through `updateScene`?

Installed version: `@excalidraw/excalidraw` **0.18.1** (`node_modules/@excalidraw/excalidraw/package.json`).
Source links point at the matching tag
[`v0.18.1`](https://github.com/excalidraw/excalidraw/tree/v0.18.1/packages/excalidraw).
"Observed" means seen in the probe described at the end, run against the installed package
under vitest + jsdom.

## Answer

**Yes, with two conditions.** A `customData` edit lands on Excalidraw's undo stack, and
Ctrl+Z / the Undo button restores the old `source`, when:

1. the update is sent with `captureUpdate: CaptureUpdateAction.IMMEDIATELY`, and
2. the edited element gets a **new `versionNonce`**. Use `newElementWith(el, { customData: … })`
   (exported by the package), which also bumps `version`. A plain `{ ...el, customData }` keeps
   the old `versionNonce`, so the change is **not recorded** (observed).

Done that way, each `updateScene` call is exactly one undo step. Undo and redo restore
`customData.source`, and `onChange` fires with the restored value (observed). Undoing a
delete brings the anchor back with its source (observed). A formula edit and a move are
separate steps, undone in reverse order (observed).

**Excalidraw never merges rapid edits.** Three `IMMEDIATELY` edits make three undo steps
(observed). The public API gives no way to merge history entries:
`ExcalidrawImperativeAPI.history` has only `clear()`
([types.ts](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/types.ts),
[docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#history)).
To get one undo step per edit rather than per keystroke, the app has to hold the in-progress
text itself and write it to the scene once, with `IMMEDIATELY` (for example on blur or after
a typing pause). The other two capture modes cannot do this coalescing:

- **`NEVER`** for the intermediate keystrokes moves Excalidraw's committed snapshot forward
  each time. The final `IMMEDIATELY` edit then records only the last delta, so undo goes back
  one keystroke, not to the text before the burst (observed: N `ab`, N `abc`, I `abcd`, then
  undo gives `abc`).
- **`EVENTUALLY` (and leaving `captureUpdate` out, which behaves the same) is a trap** when
  combined with later `updateScene(IMMEDIATELY)` calls. Once an element has uncommitted
  changes, `updateScene` swaps in the last committed copy of that element before it captures
  anything. As a result, every later `IMMEDIATELY` update to that element is silently left
  off the undo stack. This includes moves, not just formula edits (observed: E, E, I edit:
  undo stays disabled; E, I, I, I move: still disabled). The pending changes are then swept
  into the *next* step Excalidraw captures internally. Observed: E `ab`, E `abc`, then the
  Delete key. Undoing the delete restores the anchor with `source: "a"`, so the formula edit is
  lost together with the delete. **Don't use `EVENTUALLY` (or omit `captureUpdate`) for source
  edits.**

**Ctrl+Z typed in the overlay's textarea never reaches Excalidraw.** Excalidraw listens for
keys on its own container, and it bails out for any writable target (observed, and in the
source). Undo of formula edits therefore works only when the canvas has focus, or through
the Undo button. Re-dispatching the keydown onto `.excalidraw` (the same pattern as
`forwardWheel`) does trigger Excalidraw's undo (observed). Whether that pattern is wanted is
a design choice. The browser's native textarea undo was not observable in jsdom.

**Serialisation keeps `customData` intact.** `serializeAsJSON(…, "local")` writes it, and both
`restore()` and `loadFromBlob()` read it back unchanged, including newlines (observed). Two
caveats:

- Deleted elements are dropped from the file (observed), so an anchor's source does not
  outlive its deletion across a save.
- The undo history is not part of the file.

## Details, with sources

### `captureUpdate` in 0.18.1

- 0.18.1 exports `CaptureUpdateAction` with `IMMEDIATELY`, `NEVER` and `EVENTUALLY`
  ([store.ts L40-70](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/store.ts#L40-L70);
  re-exported from the package index,
  `node_modules/@excalidraw/excalidraw/dist/types/excalidraw/index.d.ts`).
  `SceneData.captureUpdate` is optional
  ([types.ts](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/types.ts)).
- What the official docs say: `IMMEDIATELY` "should be used for most of the local updates",
  `NEVER` is for remote updates and scene initialisation, and `EVENTUALLY` is for steps of an
  async multi-step process. Updates to collaborators or unobserved appState never reach
  undo/redo. The docs do not state a default
  ([docs: captureUpdate](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureupdate)).
- The source documents the default as `EVENTUALLY`
  ([App.tsx `updateScene` JSDoc](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L3885-L3903)).
  The code agrees: only a truthy value other than `EVENTUALLY` touches the store
  ([App.tsx L3905-L3933](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L3905-L3933)).
  Observed: with the option left out, undo stays disabled after an edit.
- How `updateScene` handles each value
  ([App.tsx L3905-L3933](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L3905-L3933)):
  - `IMMEDIATELY` calls `store.captureIncrement` synchronously.
  - `NEVER` calls `store.updateSnapshot`, which moves the committed baseline forward without
    recording anything.
  - `EVENTUALLY` does nothing to the store.

  `captureIncrement` diffs the snapshot against the new elements and emits an increment
  ([store.ts L179](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/store.ts#L179)).
  The app records each increment in `History`
  ([App.tsx L2474](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L2474)),
  one entry per non-empty increment
  ([history.ts L40-L55](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/history.ts#L40-L55)).
  Nothing in the code merges increments.

### Why `versionNonce` must change

- The store decides whether an element changed by comparing `versionNonce` only
  ([store.ts `detectChangedElements` L377-L398](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/store.ts#L377-L398)).
  `ElementsChange.calculate` only diffs elements whose `versionNonce` differs
  ([change.ts L946](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/change.ts#L946)).
- `newElementWith` returns a copy with `version + 1` and a fresh random `versionNonce`
  ([mutateElement.ts L149-L180](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/element/mutateElement.ts#L149-L180)).
  `bumpVersion` does the same in place
  ([L188-L195](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/element/mutateElement.ts#L188-L195)).
  Both are public exports. `newElementWith` returns the *same* element when no value changed
  by `===`. An object value such as `customData` always counts as changed, so a no-op write
  would still create an (empty-looking) undo step. Comparing the source before writing avoids
  that. This last point comes from reading the code; the probe did not exercise it.
- `version` matters too. It is how `filterUncomittedElements` detects "uncommitted" elements
  (next section).

### The `EVENTUALLY` → `IMMEDIATELY` trap

The trap is in `store.filterUncomittedElements`, which `updateScene(IMMEDIATELY|NEVER)` runs
before it captures anything
([store.ts L221-L245](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/store.ts#L221-L245)).
For each element in the current scene whose committed snapshot has a lower `version`, it
replaces the incoming element with the snapshot copy. The comment there says this exists for
collaboration ("in-progress local async actions (ephemerals)"). An `EVENTUALLY` write leaves
the scene element ahead of the snapshot. From then on, every `IMMEDIATELY` update to that
element compares the snapshot with itself, so nothing is recorded. The editor's own actions
do not go through this filter: they schedule a capture and diff the whole scene on commit
([store.ts L161-L176](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/store.ts#L161-L176)).
So the next built-in action (Delete in the probe) records the pending edits together with its
own change.

### Undo / redo mechanics

- Undo/redo are actions (`createUndoAction` / `createRedoAction`). They are bound to Ctrl/Cmd+Z
  and Ctrl/Cmd+Shift+Z (Ctrl+Y on Windows), and to the footer buttons
  `data-testid="button-undo" | "button-redo"`
  ([actionHistory.tsx](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/actions/actionHistory.tsx)).
  The public API has no `undo()` method
  ([types.ts `ExcalidrawImperativeAPI`](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/types.ts)).
- Applying an undo commits with `NEVER`, so the undo itself is not recorded
  ([actionHistory.tsx L16-L45](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/actions/actionHistory.tsx#L16-L45)).
- `History.perform` keeps popping entries until one makes a "visible" change
  ([history.ts L91-L130](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/history.ts#L91-L130)).
  `customData` counts as visible: `checkForVisibleDifference` is a first-level shallow
  compare of every changed property except `index`
  ([change.ts L1270](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/change.ts#L1270),
  [`distinctKeysIterator` L342-L390](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/change.ts#L342-L390)).
  So a source-only edit is its own undo step and is not folded into the step before it
  (observed). The shallow compare looks one level into `customData`, which is enough for
  `{ kind, source }` strings.
- When the redo path pushes an entry back, it uses the element's latest values for the
  properties in that entry (`applyLatestChanges`,
  [change.ts](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/change.ts)).
  This is consistent with the probe: undoing a move that came before a `NEVER` source edit
  restores the position and keeps the newer source.
- Keyboard: the container gets `onKeyDown` unless `handleKeyboardGlobally` is set
  ([App.tsx L1558-L1560](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L1558-L1560)).
  With that prop, the listener is on `document`
  ([L2584](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L2584)).
  Either way, `onKeyDown` returns early for a writable target before it reaches the action
  manager
  ([App.tsx L4246-L4256](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/components/App.tsx#L4246-L4256)).
  `SheetCanvas` does not set `handleKeyboardGlobally`.

### Serialisation

- `serializeAsJSON(elements, appState, files, "local")` writes elements through
  `clearElementsForExport`
  ([json.ts L43-L60](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/data/json.ts#L43-L60)).
  That function drops deleted elements and otherwise only nulls `lastCommittedPoint` on
  linear elements
  ([element/index.ts L103-L118](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/element/index.ts#L103-L118)).
  `customData` passes through `JSON.stringify` untouched.
- `restoreElementWithProperties` copies `customData` explicitly, and it spreads the original
  element so unknown props survive too
  ([restore.ts L209-L211](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/data/restore.ts#L209-L211)).
  `loadFromBlob` → `loadSceneOrLibraryFromBlob` → `restore(…)`
  ([blob.ts L121-L190](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/data/blob.ts#L121-L190)).
  The `customData` value must be JSON-serialisable (the element type declares it
  `Record<string, any>`); plain strings are fine.
- Side note relevant to ADR 0002's consequence about duplicates: `duplicateElement`
  deep-copies the element, so a duplicated anchor carries a copy of `customData` (and its
  source)
  ([newElement.ts L609-L680](https://github.com/excalidraw/excalidraw/blob/v0.18.1/packages/excalidraw/element/newElement.ts#L609-L680)).
  This comes from reading the code; the probe did not exercise it.

## Probe

A throwaway `src/probe.undo.test.tsx` (not committed) mounted the real `SheetCanvas` in
vitest + jsdom with one anchor `m1` (`customData: { kind: "math", source: "a" }`). It wrote
the source with `api.updateScene({ elements: …map(e => newElementWith(e, { customData: {
...e.customData, source } })), captureUpdate })`. It undid and redid by clicking
`[data-testid=button-undo|redo]`, or by firing a Ctrl+Z `keydown`. The core of each step:

```ts
api.updateScene({
  elements: api.getSceneElementsIncludingDeleted().map((e) =>
    e.id === 'm1' ? newElementWith(e, { customData: { ...e.customData, source } }) : e),
  captureUpdate: CaptureUpdateAction.IMMEDIATELY,
})
fireEvent.click(container.querySelector('[data-testid="button-undo"]')!)
```

Results (I = IMMEDIATELY, N = NEVER, E = EVENTUALLY):

| # | Steps | Observed |
|---|---|---|
| 0 | mount with `initialData` | undo disabled (load not undoable); anchor `version` 2 |
| 1 | I `ab` → undo → redo | `a` → `ab`; `onChange` saw `ab`, `a`, `ab` |
| 2 | I `ab` with plain spread (no nonce bump) | scene shows `ab`, **undo stays disabled** |
| 3 | I `ab`, I `abc`, I `abcd`, then undo ×3 | `abc`, `ab`, `a`: one step per call, no merging |
| 4 | I move x→300, N `ab`, undo | x back to 100, source stays `ab`, stack empty |
| 5a / 5b | E `ab` / no `captureUpdate` | undo disabled |
| 5c | E `ab`, E `abc`, I `abcd` | **undo disabled**: the I edit was not recorded |
| 5d | E, E, I move | **undo disabled**: the move was not recorded either |
| 5e | E, E, then I selection change (appState only) | one step that undoes only the selection; source stays `abc` |
| 5f1 | select, E `ab`, E `abc`, Delete key, undo | anchor restored with source **`a`**: pending edits swept into the delete step |
| 5g | E `ab`, I `abc`, I `abcd`, I move | all I updates dropped; undo disabled |
| 5h | N `ab`, N `abc`, I `abcd`, undo | `abc`: only the last delta is undoable |
| 6 | I `ab`, I move, undo, undo | (`ab`, x 100), then (`a`, x 100): two steps, reverse order |
| 7 | I `ab`; Ctrl+Z on an outside textarea; Ctrl+Z on `.excalidraw` | outside: still `ab`; container: `a` |
| 8 | I `ab`, I delete, undo | restored, `isDeleted: false`, source `ab` |
| 9 | serialise → `restore` / `loadFromBlob` | `customData` identical (multi-line source); deleted elements serialised: 0 |

What jsdom could not show:

- **Keyboard nudge:** an ArrowRight nudge moved the element, but no undo step appeared with
  the `keydown` / `keyup` events the probe sent (5f0). This is likely an artefact of the
  synthetic events; real-browser behaviour was not checked.
- **Native textarea undo:** the browser's own undo inside the overlay textarea is not
  implemented by jsdom. **Unverified** how it interacts with the source once the textarea is
  controlled from the scene.
- **Scene running ahead of the snapshot:** whether anything in normal use (font loading,
  text re-measuring, etc.) leaves an anchor's scene `version` ahead of the committed
  snapshot was not tested. If something does, the trap in 5c / 5g would apply to that anchor.
  **Unverified**; rectangles are not re-measured, so this is unlikely.
