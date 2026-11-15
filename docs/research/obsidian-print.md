Research for wayfinder ticket #186, 2026-11-15.

# How can a plugin's view print from inside Obsidian?

Read from other plugins' source on GitHub and from Obsidian's lint rules. **Nothing here was run in
Obsidian.** Obsidian's own docs, help and forum were not reachable from the session. Each line says
whether its source was read directly or is a search excerpt.

## Answer

**On a computer, yes, with no Node or Electron API: build the pages in a hidden `<iframe>` and call
its `contentWindow.print()`.** That opens the operating system's print dialog, with no preview. On
a phone or tablet there is no route that keeps text as text without new libraries.

| Question | Finding | Source |
|---|---|---|
| Does `window.print()` work in Obsidian on a computer? | Yes, from an iframe. [Print](https://github.com/marijnbent/obsidian-print) 0.6.7 (listed, `isDesktopOnly: false`, lints with `eslint-plugin-obsidianmd`) appends an off-screen iframe to `document.body`, fills its `contentDocument` and calls `frame.contentWindow.print()`. Only the iframe's document prints. | Read: `src/utils/desktopPrintDocument.ts` |
| Does `afterprint` fire? | On the iframe's window, yes. Print cleans up on it, with a 60 s timer as fallback. | Read, same file |
| How do styles get in without creating `<style>`? | `new CSSStyleSheet()`, `replaceSync(css)`, `doc.adoptedStyleSheets`. Obsidian's lint rule `no-forbidden-elements` also exempts a `<style>` made inside an iframe's `contentDocument`. | Read: Print's source; the [lint rules](https://github.com/obsidianmd/eslint-plugin) |
| Which dialog opens? | The system's (Electron's `webContents.print` defaults to `silent: false`). That there is no Chromium preview is a search excerpt. | Read: Electron's `web-contents.md`; excerpt |
| Does the dialog honour `@page { size; margin: 0 }`? | **Not verified.** Excalidraw's plugin relied on `@page` rules, but through `printToPDF`, not the dialog. | n/a |
| Do Obsidian's own print rules interfere? | **Not verified** (`app.css` isn't public). Excalidraw 2.12.0 moved its content into `body > div.print` before Obsidian's export, which suggests `app.css` shows only `.print` in print. Printing the main document is therefore risky; the iframe avoids it. | Inferred from Excalidraw's source |
| What do other plugins use? | Excalidraw 2.8 to 2.12: Obsidian's internal `ipcRenderer.send('print-to-pdf')` and `electron.remote`'s save dialog, desktop only. Better Export PDF: a `<webview>` and `printToPDF`, `fs`, `electron.remote`. Both are Electron APIs, unavailable on a phone. | Read: each plugin's source |
| Android | "Android WebView cannot start the native print dialog from JavaScript" (Print's source). Print writes an HTML file into the vault and opens it in the browser. | Read: `androidPrintDocument.ts`; the claim is the author's |
| iPhone, iPad | Print doesn't call `window.print()`. It draws each page to a picture (`html2canvas-pro`), builds a PDF (`pdf-lib`) and shares it from a second tap. Text can't be selected. | Read: `iosPrintDocument.ts`, `iosPdfDocument.ts` |
| A pop-out window | **Not verified.** Print always uses the main window. An iframe made in `view.containerEl.doc` and printed through its own `contentWindow` should print from the pop-out. | Inferred |
| The PDF's file name | Print sets the iframe's `title` and, for a second, the main `document.title`. Whether the system dialog takes the name from either is **not verified**; on Windows "Microsoft Print to PDF" opens its own Save As. | Read (what Print does); excerpt (the rest) |

## Lint rules that shape the build

Read from the rules' docs: no `innerHTML` (build the iframe's DOM by cloning nodes); `document` and
`window` are flagged, use the element's own `doc` and `win`; no `el.style.x = …`, use classes or
`setCssStyles`; Node modules need a `Platform.isDesktopApp` guard, and none is needed here.

## Not covered

- Anything in a running Obsidian, on any system. The four "not verified" rows above are the open
  risks, and the first (`@page` in the system dialog) decides whether the app's own page breaks land
  on the paper's pages.
- Real printers.
- Obsidian's reviewers' view of `electron.remote`, which the chosen route doesn't use.
