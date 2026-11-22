Hand check for wayfinder ticket #324, 2026-11-22.

# Attachments: what Google's compatible endpoint, a drop and a paste on the Sheet panel, and a file dialog in Obsidian do

**Question.** The attachments ticket (#249) decided three things on documentation or on a reading
of code, and nobody ran them. Does Google's compatible endpoint take a PDF? Do a file dropped on
a Sheet panel tab and a picture pasted in one of its fields reach the app before Excalidraw? Does
a hidden file input open the system's Open dialog inside Obsidian? This note records what ran.
It decides nothing: the third slice's ticket (#254) does.

Three labels:

- **Observed** (unmarked): a run in this session said it.
- **Read:** from code or a web page, not run.
- **Inferred:** my reading of the two. Always marked.

## Answer

1. **Google's compatible endpoint refuses a PDF sent as a `file` part,** the shape #249 agreed:
   `400`, "Invalid content part type: file", on three models. **It reads the same PDF sent as an
   `image_url` part** with a `data:application/pdf;base64,…` address: two models answered with the
   value that is only in the file. Google's reference doesn't name that second shape (read).
2. **A file dropped on a Sheet panel tab goes to Excalidraw unless a listener stops it:** a PNG
   lands on the canvas as an image, and a PDF opens Excalidraw's own "Couldn't load invalid file"
   dialog. **A listener on the tab that stops the `drop` gets the file and nothing reaches the
   canvas,** in the web app, in the plugin's main window and in a pop-out. A sheet file dropped
   there never reaches the tab's listener: the app's own file routes take it first.
3. **A picture pasted with a panel field focused reaches that field's listener, and Excalidraw
   adds nothing,** with the pointer resting over the canvas and with a listener that doesn't
   stop the event. The same in all three places.
4. **In a pop-out window, a dropped or pasted file is not an `instanceof` the code's `File`.**
   It belongs to the pop-out's window. Its `name`, `type`, `size` and `arrayBuffer()` work.
5. **A file input inside Obsidian: not run yet.** The throwaway plugin is ready and passes
   against a mock; Matheus runs it on the Windows PC (below).
6. **Not checked:** how a model that takes no pictures answers one; a drop in a real Obsidian
   window, where Obsidian's own drop handling may act first (the throwaway plugin checks it); a
   scanned PDF with no text layer.

## 1. Google's compatible endpoint and a PDF

**How it was run.** From this session's container with `curl`, with the Gemini key the
environment holds (free tier), to
`POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
[`gemini-pdf-requests.mjs.txt`](attachment-hand-check/gemini-pdf-requests.mjs.txt) makes the
files and the request bodies: a one-page PDF printed by Chromium (15,823 bytes, with a text
layer) and a PNG of the same page (13,755 bytes), both reading "Pump P-101 datasheet. Rated
flow: 42.7 m3/h. Rated head: 61.3 m. Motor power: 11 kW". The question: "What is the rated head
of the pump in the attached file? Answer with the number and its unit only. If no file reached
you, answer exactly: NO FILE." Not from a browser page: the origin was checked in
[`provider-shapes.md`](provider-shapes.md) and [`obsidian-hand-check.md`](obsidian-hand-check.md),
and what the endpoint takes doesn't depend on it (inferred).

| The part beside the question | `gemini-4-hydrogen` | `gemini-3.5-flash-lite` | `gemini-3.8-flash` |
| --- | --- | --- | --- |
| `{type: "file", file: {filename: "file-1.pdf", file_data: "data:application/pdf;base64,…"}}` | **400**, "Invalid content part type: file" | **400**, the same | **400**, the same |
| The same with `file_data` as plain base64 | 400, the same | not run | not run |
| `{type: "image_url", image_url: {url: "data:application/pdf;base64,…"}}` | **200, "61.3 m"** (678 prompt tokens) | **200, "61.3 m"** (563 prompt tokens) | no answer in 120 s |
| `{type: "image_url", image_url: {url: "data:image/png;base64,…"}}` (control) | 200, "61.3 m" (1,148 prompt tokens) | 200, "61.3 m" (1,116 prompt tokens) | not run |
| No part (control) | 503 "high demand", then 429 (the free tier's 20 requests a day) | 200, "NO FILE" (35 prompt tokens) | not run |

- **The `file` part is refused before the model sees anything,** as an invalid argument. A
  wrong-key answer from this endpoint is also a 400, so the chat must read the message, not the
  status, to tell the two apart.
- **The PDF as an `image_url` is read:** the answer is the file's value, and the prompt costs 528
  to 643 tokens more than the bare question, about half of the picture's.
- **That shape isn't in Google's reference.** Forum threads at `discuss.ai.google.dev` report
  both that it works and, earlier, "Invalid MIME type. Only image types are supported."
  ([one thread](https://discuss.ai.google.dev/t/openai-compatibility-for-pdf-file/77388); read,
  undated). **Inferred:** it is behaviour Google may change without notice.
- **The free tier answered 429 after about 20 requests a day** on `gemini-4-hydrogen`. A tester
  on a free key meets that message early.
- **How a model that takes no pictures answers one: not found out.** Every chat model listed
  takes pictures as far as these runs show; `gemma-4-31b-it` answered 503 "high demand", and an
  embedding model answers 404 "not supported for generateContent".

## 2. A drop and a paste on the Sheet panel

**How it was run.** [`probe-drop-paste.mjs.txt`](attachment-hand-check/probe-drop-paste.mjs.txt),
headless Chromium (Playwright 1.63.0), on `main` at `fb5febf`, against the built web app
(`dist/`) and the built plugin (`dist-plugin/main.js` with the fake `obsidian`, in the main
window and in a pop-out, as `scripts/popout-run.mjs` makes them). A 1400 px window, the panel
docked, the Variables tab showing.

- **A drop is Chromium's own drag** (CDP `Input.dispatchDragEvent` with the file's path), so the
  browser's rule holds: no `drop` unless a `dragover` was prevented.
- **A paste is a real Ctrl+V** of a PNG the page put on the clipboard.
- **The tab's listener** is a plain listener on the tab's body (`.sheet-panel`) in the bubble
  phase, which prevents the event and stops it. The chat's own will be React's; it stops
  Excalidraw the same way, since Excalidraw's drop handler is a React prop on its container
  (read: `handleAppOnDrop`, Excalidraw 0.18.1). **Inferred**, not run with React.
- **The fields** are the Variables tab's filter and a `<textarea>` added to the tab, as the
  chat's field will be.

The three places gave the same result on every row but the last.

| Case | Canvas | The tab's or field's listener |
| --- | --- | --- |
| Control: a PNG dropped on the canvas | one image more | |
| A PNG dropped on the tab, nothing listening | **one image more** | |
| A PDF dropped on the tab, nothing listening | unchanged; Excalidraw's dialog "Error: Couldn't load invalid file" | |
| A PNG dropped on the tab, a listener on `drop` only | unchanged | got the file: `photo.png`, `image/png`, 77 of 77 bytes read |
| A PNG dropped on the tab, listeners on `dragover` and `drop` | unchanged | got the file |
| A PDF dropped on the tab, listeners on `dragover` and `drop` | unchanged, no dialog | got the file: `notes.pdf`, `application/pdf`, 193 of 193 bytes read |
| Control: a picture pasted with the canvas focused | one image more | |
| A picture pasted in the filter, pointer over the canvas, nothing listening | unchanged | |
| The same, a listener that only reads | unchanged | got the file: `image.png`, `image/png`, 92 of 92 bytes read |
| The same, a listener that stops it | unchanged | got the file |
| A picture pasted in the textarea, the same three | unchanged | got the file in both listening cases |
| A sheet file (`.excalimathpad`) dropped on the tab, listeners on `dragover` and `drop` | unchanged | **heard nothing.** Web: the app asks "Save changes to Untitled.excalimathpad?" (its own Open). Plugin, both windows: nothing happens |

- **Without a listener the panel is no shelter:** a picture dropped on any tab lands on the
  canvas today. The chat's tab needs the listener over its whole body, and a file dropped
  beside it (the tab row, another tab) still goes to the canvas.
- **A `drop` listener alone is enough** for the event to arrive: something above already
  prevents `dragover`. The chat still needs its own `dragover` to show where a file may fall.
- **The app's file routes come first** (`fileRoutes.ts`: the window in capture on the web, the
  view's container in a vault): a file named `.excalimathpad`, `.excalidraw` or `.json` is
  never the tab's. None of those is an attachment's type.
- **Excalidraw leaves a paste alone when the focus is in a text field,** even with the pointer
  over its canvas (read: `pasteFromClipboard` returns on `isWritableElement`; observed above).
  The field's listener need not stop the event.
- **In the pop-out the paste never crosses the bridge** (read: `forwardClipboard` returns for a
  text field; observed: the main window's sheet kept its 4 elements through the pop-out's
  cases).
- **A real Ctrl+V fires `paste` in headless Chromium** (text and a picture), against what
  `scripts/popout-run.mjs` says in a comment.
- **Not shown by this:** Obsidian's own handlers, which the fake `obsidian` doesn't have. The
  throwaway plugin below checks a drop and a paste on a view in the real app.

## 3. A file input inside Obsidian

**Not run yet.** [`attachment-hand-check/`](attachment-hand-check/) holds a throwaway plugin
(`main.js.txt` and `manifest.json.txt`, renamed without `.txt` in
`<vault>/.obsidian/plugins/emp-attachment-check/`). It opens a view with three steps and writes
what happens to the note "Excalimathpad attachment check.md", with no file name or content:

1. A button that clicks a hidden
   `<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" multiple>`.
   It records whether the dialog gave files or was closed, and for each file its extension,
   type, size, whether `arrayBuffer()` read it, and whether the vault holds a file of that name
   and size.
2. A box whose listeners stop a `drop`, and whether Obsidian's vault or tabs changed 1.5 s later.
3. A field whose listener reads a `paste`, and whether the vault or the field's text changed.

Each line says whether the view was in the main window or a pop-out. Before it went to Matheus
it ran in Chromium against a mock Obsidian
([`harness.mjs.txt`](attachment-hand-check/harness.mjs.txt)), in a main window and a pop-out:
the dialog gave both files, the drop and the paste reached their listeners, and every file was
read. That run also gave point 4 of the answer: a file from the input (made in the main
document, then moved with the view) is the code's `File`; a dropped or pasted one in the
pop-out is the pop-out's.

Results from Obsidian go here when Matheus has run it.
