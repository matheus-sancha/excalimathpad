# Where a user's own formulas could live: the facts

This note prepares ticket
[#353](https://github.com/matheus-sancha/excalimathpad/issues/353) ("Where do a user's own
formulas live in the web app and in a vault?") on map
[#344](https://github.com/matheus-sancha/excalimathpad/issues/344). It gathers what the app
stores today, how a sheet file is saved, how Excalidraw and the Obsidian Excalidraw plugin keep
a library, and the rules that bind any answer. It decides nothing. Nothing of the formula
library is built. Prior art is in
[`formula-library-prior-art.md`](formula-library-prior-art.md): elsewhere a user's own
entries are ordinary documents in a known folder, and the #349 ruling notes that a library in
per-browser storage is "stranded there, so file-based storage or export matters".

## 1. What the app stores today, and where

**Web app.** `src/main.tsx:23-37` hands App the browser's ports:

- `localStorage`, read through a `try` so blocked storage reads as none (`main.tsx:23-29`):
  `excalimathpad.sheetPanel` and `excalimathpad.sheetPanelWidth`
  (`src/panel/panelMemory.ts:19-20`), `excalimathpad.language` (`src/canvas/language.ts:37`),
  and the Math assistant's setup `excalimathpad.assistant` (`src/assistant/ports.ts:53`).
  Light or dark is not remembered on the web (`src/canvas/theme.ts:9`).
- IndexedDB database `excalimathpad`, store `recovery`, key `current`: the one recovery copy,
  with the file handle (`src/file/recovery.ts:24-41`; spec section 7, Saving).
- The sheet file itself, through the File System Access API or a download
  (`src/file/fileAccess.ts:48,80,92,134`).
- No service worker or offline cache until M6 (spec section 12, Hosted build: "Until M6 there is
  no service worker"). M6's precache holds the app's own files, not user data (section 12).

The spec's rule for every such memory is "per device and never in the file": the panel width
(section 8, Sheet panel, `spec-v1.md:2135`), the language (section 8, Language, `:2296`), the
Excalidraw upgrade's nine preferences (`:2408`), and the setup, "never synced, never in the
vault or a sheet" (section 2, Terms, `:158`). Between machines "a sheet moves as its
`.excalimathpad` file. The recovery copy belongs to one browser and doesn't travel" (section 12,
Hosted build, `:3711`).

**Plugin.** "It stores nothing outside the vault: sheets in their files, its own memory in
`data.json`. No IndexedDB, no `localStorage`", with one exception, the assistant's setup in
`App#secretStorage` (section 2, Invariants, `:289-291`; section 12a, Data protection). `data.json`
holds `sheetPanel`, `sheetPanelWidth`, `theme`, `language` (`plugin/main.ts:12-20,56-70`), and
anything else read there is dropped (`docs/context/plugin.md:12`). Note that `data.json` is a file
inside the vault's config folder, so the spec's "per device" is really per vault, and it travels
with any sync that carries plugin settings (section 3 below).

**Size limits that matter.** Obsidian Sync Standard caps a file at 5 MB, Sync Plus at 200 MB
([`obsidian-plugin.md`](obsidian-plugin.md), "Size, and the 5 MB line"). The plugin's `main.js`
is about 3.40 MB (`CONTEXT.md:497`); it is the file held under that cap, and a growing
`data.json` or a library file would be another file under it. A picked image is capped at 4 MB
by Excalidraw (`spec-v1.md:4510`). Browsers' `localStorage` quota is a few MB per origin
(general knowledge, not measured here); the setup store already surfaces a full storage as an
error (`main.tsx:18-21`).

## 2. The sheet file, and whether it can carry more

Spec section 7, The file: a sheet is Excalidraw's JSON plus one top-level `excalimathpad` block
(`format`, `settings`). Each anchor's `customData` holds `kind`, `source`, `formats`, and
optionally `title`, `titleFormat`, `width`. `customData` holds no nested objects, because
Excalidraw compares it one level deep and a nested object adds an empty undo step
(`CONTEXT.md:392-396`). A new kind of data in the file means a format rise: formats are a plain
sequence and each build refuses a higher one (section 7, "From the Excalidraw upgrade").

How the code writes it: `writeSheet` rebuilds the block as `{ format, settings }` only
(`src/file/sheetFormat.ts:132-139`), and the scene comes from Excalidraw's
`serializeAsJSON(elements, appState, files, 'local')` (`src/canvas/sceneFile.ts:69`). So any other
key in the block, or at the top level, is dropped at the next save; only an element's
`customData` survives as Excalidraw keeps it. "Never saved" lists results, undo, selection and
the panel state (`spec-v1.md:1945`).

**Excalidraw's own library.** A `.excalidrawlib` is `{ type, version, source, libraryItems }`, each
item `{ id, status, elements, created, name? }`
(`node_modules/@excalidraw/excalidraw/dist/types/excalidraw/data/types.d.ts:36-41`,
`types.d.ts:386-395`). The package persists nothing itself: a host passes `libraryItems` and
`onLibraryChange`, or a `LibraryPersistenceAdapter` with `load`/`save` (`data/library.d.ts:9-27`).
This app passes none of them (no match for `libraryItems`, `onLibraryChange` or
`useHandleLibrary` in `src/` or `plugin/`), so the library lives only for the session in both
homes (inferred from the code; the spec says so for the plugin, "the library keeps the session's
items", section 8, Inside an Obsidian tab, `:3113`). Browse libraries is hidden in the plugin
(same place). A dropped library file "stays Excalidraw's" (section 7, Opening, `:1979`).

**The Obsidian Excalidraw plugin, as a precedent** (`zsviczian/obsidian-excalidraw-plugin` at
`198b85d`, 2026-11-22): it used to keep the library in its plugin settings (`library2` in
`data.json`, `src/core/main.ts:1093-1116`). Its default is now `libraryStorageMode: "vault"`,
`.excalidrawlib` files in the folder `Excalidraw/Libraries`, file `local-library`
(`src/core/settingsDefaults.ts:404-406`), with a migration from `data.json` and a way back to it
(`src/core/managers/StencilLibraryManager.ts:132-148,219-260`). It lists every library file in
that folder and merges them (`:320-345`), watches the folder for changes, and reconciles writes
"to avoid clobbering files updated by sync" (`:32-35`); a comment notes "a sync conflict can
restore stale data.json items after migration" (`:110`). It can also export the library as
`my-obsidian-library.excalidrawlib` (`src/core/managers/FileManager.ts:440-450`).

## 3. Obsidian: vault files against `data.json`, and sync

From [`obsidian-network-key.md`](obsidian-network-key.md), "Per-device storage":
`Plugin#saveData` writes `data.json` "in the plugin folder", inside the vault;
`onExternalSettingsChange` exists because "a Sync service or external program has modified the
plugin settings". Obsidian Sync carries the config folder and community plugins only when the user
turns on "Active community plugin list" and "Installed community plugin list"; git or a cloud
drive carries the file anyway (inferred). `App#saveLocalStorage` and `App#secretStorage` stay on
the device, and Obsidian's lint flags both at `minAppVersion` 1.7.2.

Vault files sync as files, but Obsidian Sync carries `.excalimathpad` (and any unknown extension)
only with "Sync all other types" on (spec section 7, A sheet in a vault; `obsidian-plugin.md`,
"Rename, external change and sync"). A `.md` file always syncs. An outside change to a sheet is
handled by reload or conflict copy (section 7, A sheet in a vault); nothing like that exists for
`data.json` today.

**Reach rule.** The plugin "reads only the sheet open in the view and one image the user picks from
a vault image picker (image files listed by name) … It writes only the open sheet …, `data.json`,
the new sheets the user creates, and the conflict copy. It never lists, renames or deletes another
note" (section 12a, Data protection, `:3852-3858`). A library kept as vault files would need a read
of more than the open sheet and a write of a new kind of file; the image picker is the one place
that lists files today.

## 4. Import and export paths that exist

- **Web:** Open… (Ctrl+O), Save and Save as, and a dropped `.excalimathpad`, `.excalidraw` or
  `.json` (section 7, Saving and Opening; `fileAccess.ts`; the routes are taken before Excalidraw
  in `src/canvas/fileRoutes.ts`, `CONTEXT.md:403-411`). The picker accepts only sheet types
  (`fileAccess.ts:48,134`).
- **Plugin:** Obsidian's own file explorer, copy, move and links; New sheet; the vault image picker.
  Save, Save as and Open are dropped (section 7, A sheet in a vault).
- **Paste:** today a pasted newline becomes a space (`src/overlay/MathElementView.tsx:1342-1352`).
  A paste of several lines that becomes lines is specified for 0.7.0 (section 4, While editing a
  line, `:953-963`), not built in this code.
- **Inserting a block** (the #352 resolution): a pick starts placing, as Add math does: a ghost box
  the size of the block follows the pointer, a click places it, Esc cancels. The block is a new math
  element: title, `# Example values: replace them`, inputs, formula, `# Source: …`; "use yours" for
  names already on the sheet; one toast for inputs set only below. The placing machinery exists
  (`useSheetGestures`, `PlacingGhost`, `docs/context/overlay.md:137-140`), and the assistant's Insert
  writes new math elements from a proposal (section 8, Math assistant; #319). A Constants or Symbols
  press only types into the open line (`planInsert`, `src/overlay/symbolInsert.ts`, map #344 notes).

## 5. Constraints from the spec

- **No server, account or sync of ours:** a static build (`CONTEXT.md:424-425`); "Still never:
  telemetry; an account, server, proxy or key of ours" (section 12a, Data protection); live
  collaboration is out because it "needs a relay server, storage and an account" (section 1,
  `:60`).
- **Network:** none but the Math assistant's, on a press (section 12a, Data protection).
- **Plugin storage:** only the vault and `data.json`, plus the one named secret-storage exception;
  the bundle names no browser storage, and importing `localStorage` or `recovery.ts` into App at run
  time fails the bundle audit (`CONTEXT.md:429-437`; `scripts/audit-plugin.mjs`). A web store
  therefore has to be a port given by `src/main.tsx`, as panel memory is.
- **Same file in both homes:** "The same `.excalimathpad` file opens unchanged in both homes"
  (section 2, Invariants, `:294-295`).
- **Language:** every panel text in English and Português (`src/text/en.ts`, `ptBR.ts`,
  `panelWords.test.ts`); math is never translated (map #344 notes).
- **Size:** the 5 MB Sync Standard line (section 1 above).

## Questions for the grilling

1. Is a user's formula saved from a selected math element, and is it then a whole element (title
   and every line) or a chosen subset of lines?
2. In the web app, is the library per-browser memory (`localStorage` or IndexedDB), a file the user
   opens and saves, or both?
3. In a vault, is it in `data.json` (synced only with plugin settings) or in vault files, and if
   files, which extension (`.md`, `.excalimathpad`, a new one), so that Obsidian Sync carries them by
   default?
4. If vault files, which folder, fixed or chosen, and does reading them amend the "never lists
   another note" reach rule?
5. Is one library file shared by both homes, so a library moves the way a sheet does, or does each
   home keep its own?
6. Could a library simply be a sheet: an ordinary `.excalimathpad` whose titled math elements are the
   entries, opened by the panel as a library?
7. Is export and import in scope here, or left to the map's "Sharing" item?
8. What happens on a sync conflict or an outside change to the library while a tab is open?
9. How does a user edit, rename or remove an entry, and is removal undoable?
10. Does a saved entry keep "example values" and a source line as the built-in blocks do, and does
    "use yours" apply to it unchanged?
11. Is there a size or count limit, given `localStorage` quotas and the 5 MB Sync line?
12. What does a user see the first time on a new browser or vault, where their library is empty?
