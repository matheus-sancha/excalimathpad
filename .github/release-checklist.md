## Before Publish

Tick each one on this draft (docs/spec-v1.md section 12a, Releases; the same list is in CONTRIBUTING.md, Releasing):

- [ ] Install the release's three files in a test vault, by hand or with BRAT
- [ ] Open a sheet
- [ ] Type a line and see its result
- [ ] Close and reopen it, and see the line kept
- [ ] Rename a name from the ✎ on its Variables row, see every line that used it change, and take it all back with one Ctrl+Z
- [ ] Choose ☰ → Language → Português (Brasil), restart Obsidian, see it still chosen, then choose English again
- [ ] Repeat on one phone or tablet
- [ ] Run the odd-values probe, `npm run test:probe` (about 8 minutes), and see it pass
- [ ] For a release that changes `src/assistant/`, `plugin/assistant.ts` or a default model (otherwise say in the notes that the conversation was skipped): Math assistant, in the test vault and in the web app, with Anthropic and with one built-in that isn't Anthropic: enter the key; Check key; Send and accept the confirm; see the answer arrive as it is written; Stop one, and see it end; a wrong key reads "refused this key"; Remove
- [ ] Write in the release notes which providers were tried, and which were not
- [ ] The device checklist, on an iPhone, an iPad, an Android phone and an Android tablet, before the first release with `isDesktopOnly: false` and before any release that changes touch, panel or overlay code (otherwise say in the notes that it was skipped): open a sheet from the vault; Add math from More tools, then a tap; double-tap a line and the title, and see the keyboard come up; Done, ↑ ↓ and Edit; format, with a rule; Symbols and the quick keys; a tap's tip, and the unit slots and ⚙ a touch selection shows; save, close and reopen; a sync round trip; on a phone, the bottom sheet stays above the keyboard
- [ ] Write each device's result, with the device and OS versions, in the release notes. If any device failed, don't publish: set `isDesktopOnly: true` in `manifest.json` and release again

