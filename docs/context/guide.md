# guide

One module of Excalimathpad, as the code is today. [`CONTEXT.md`](../../CONTEXT.md) holds the
model, the terms and the load-bearing rules, and names every module; the behaviour is in
[the spec](../spec-v1.md), by the section numbers cited here. Read this file when an issue
touches this module, and keep it true in the pull request that changes the module.

**guide** (`src/guide/`, spec section 8, Math guide, M4d, #148) — the Math
guide in the app. `markdown.ts` (pure, no DOM and no Node) turns
`docs/math-guide.md` into a tree of elements (`guideTree`, `GuideNode`):
`#`–`###` headings with GitHub's anchors (`slug`) behind `math-guide-`,
paragraphs, lists, tables (`\|` for a pipe), fenced code with an info string,
inline code, bold, italic and links to the guide's own headings. It refuses
anything else, so a link to a file or a site, or a construct the dialog
can't draw, fails the build. `guideModule` is the module both builds hand
the app for `?guide` (typed in `mathGuide.d.ts`): the tree as JSON, so the
bundle holds no Markdown code and nothing sets `innerHTML`. `MathGuide.tsx`
is the dialog: React draws the tree in a box that scrolls and starts at
the top (the contents list) with the keyboard; it closes on Esc, ✕ or a
click outside that also started outside; its links scroll within it; its
keys stop at its box. `guideBox.ts` holds `MATH_GUIDE_CLASS` and
`isInMathGuide`, which `listenToCanvas` reads. Depends on: nothing.
