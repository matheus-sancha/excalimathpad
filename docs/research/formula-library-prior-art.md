Research for wayfinder ticket #349, 2026-11-25.

# Formula libraries in comparable calculation tools

Question: how do Mathcad, SMath Studio, CalcPad and similar tools offer
ready-made formulas, and what lands on the sheet? The working decision to test:
a pick inserts a filled-in block with example values, and the library has a
built-in set plus the user's own formulas.

**How this was read.** This session could reach only GitHub. Every vendor
help site, forum and wiki below was refused by the session's network proxy
(`support.ptc.com`, `community.ptc.com`, `smath.com`, `wiki.smath.com`,
`calcpad.eu`, `fchartsoftware.com`, `support.tekla.com`, `maplesoft.com`,
`blockpad.net`, `engineeringpaper.xyz`, `skyciv.com`,
`engineeringtoolbox.com`, `calctree.gitbook.io`, `calcs.com`,
`support.microsoft.com`, `eng-tips.com`, `reddit.com`, `peer.asee.org`). The
claims below come from the web search tool's excerpts of those pages. The
links go to the page that owns each claim, but I did not open the pages
myself, so wording may be the search tool's paraphrase. Treat every linked
claim as "seen in an excerpt of the primary page", and check a page before a
spec rule leans on its exact words. Claims with no page behind them are in
[Unverified](#unverified).

## Answer

- **The working decision matches the most common pattern, and the one users
  ask for when it is missing.** Old Mathcad's QuickSheets and Electronic
  Books, SMath's snippets, Tedds' calc items and EES's Function Info all put
  live, editable content with example values into the user's document. None
  inserts an empty skeleton with blank inputs.
- **Three things get inserted, and tools usually pick one:**
  1. *A worked block*: definitions with example values, the formula and its
     result, as ordinary editable content (Mathcad QuickSheets and Electronic
     Books, SMath snippets, Tedds calc items, Knovel's Roark's worksheets).
  2. *A function call*: one line that calls a library function, with example
     arguments (EES Function Info's Paste; Mathcad's Include Worksheet and
     CalcPad's `#include` give the functions and the user types the call).
  3. *A whole sheet*: a template or example the user opens and edits
     (Mathcad Prime templates, Maple Flow's Application Gallery,
     EngineeringPaper.xyz links, CalcTree, SkyCiv, ClearCalcs, Excel).
- **Finding is a named tree first, text search second, figures last.** Most
  libraries are a tree by discipline or by book chapter. SMath adds
  type-ahead by a short name. Calculator sites add a filter and search panel.
  Only the handbook libraries (Roark's) are organised around a figure of the
  case.
- **Units are whatever the host document does.** In the unit-aware tools the
  example values carry units and the user overtypes them. Knovel shipped each
  Roark's worksheet twice, in US Customary and in metric, which is the cost of
  example values with units: somebody's unit system is the wrong one.
- **The user's own entries are ordinary documents in a known folder**, saved
  by "make this selection, or this file, a library item": SMath `.sm` files
  in a snippets folder, Tedds `MyCalcs.lbr`, EES `.LIB` files in `USERLIB`,
  Mathcad's My Templates folder, Excel's Custom Office Templates. Team sharing
  is a second folder (Mathcad's Shared Templates).
- **What users complain about** is the library's edges, not the insert: no
  way to keep their own equations (Mathcad Prime), a fixed storage folder
  (SMath), an entry that needs hidden metadata before it shows (SMath),
  descriptions that show in one place and not another (SMath), content tied
  to one country's codes (PTC's civil library), paid content that later
  disappeared (Roark's), thin built-in sets (Blockpad).

## 1. Tool by tool

### Mathcad 15 and earlier: Resource Center, QuickSheets, Electronic Books

- **Find.** The Resource Center opened from the Help menu and held tutorials,
  QuickSheets and Reference Tables. The Mathcad User's Guide calls QuickSheets
  "working examples of Mathcad functions and applications" and says the
  Reference Tables hold "math, science, and engineering formulas"; it
  describes all of them as live worksheets
  ([Mathcad User's Guide, as hosted by USPAS](https://uspas.fnal.gov/materials/19Knoxville/g-2/CompLabs/Mathcad%2011%20Users%20Guide.pdf)).
  Navigation was a table of contents by topic. I found no source for a
  search box or figure index in the Resource Center itself.
- **What lands.** Live regions. The older manuals say Electronic Book content
  is "live and ready to be dragged and dropped into your worksheets" (same
  guide; the 2000-era copies on Scribd have the same sentence). A QuickSheet
  could also be opened and saved as the user's own worksheet
  ([PTC Community, Reference tables in Mathcad 7](https://community.ptc.com/mathcad-7/reference-tables-in-mathcad-7-119386)).
  So a pick gave a worked block with the book's example values.
- **Roark's Formulas for Stress and Strain** was an Electronic Book, adapted
  from the 6th edition by Mathsoft and McGraw-Hill. The rights later moved to
  Knovel, which sold it sheet by sheet
  ([PTC Community, Roark's equations worksheets](https://community.ptc.com/mathcad-7/roarks-equations-worksheets-172842)).
  Knovel's version shipped each worksheet in both US Customary and metric
  units with a matching PDF, found through Knovel's search and browse, and
  free to modify
  ([ASEE paper, Mathcad enabling of engineering e-content on Knovel](https://peer.asee.org/mathcad-enabling-of-engineering-e-content-on-knovel.pdf)).
- **Own entries.** Users kept a "library" worksheet and either copied from it
  or referenced it, so its definitions took effect in the new sheet
  ([PTC Community, Storing frequently used equations](https://community.ptc.com/mathcad-7/storing-frequently-used-equations-47273)).
  I found no source for adding a user's own QuickSheet to the Resource Center
  (see Unverified).

### PTC Mathcad Prime

- **No Resource Center.** PTC's support article is titled "About worksheet
  libraries formerly known as Quick Sheets in Mathcad 15 and Mathcad Prime"
  and has a section "Where have Mathcad QuickSheets gone?"
  ([CS330916](https://www.ptc.com/en/support/article/CS330916); the body was
  not in the excerpt). A community reply says the legacy libraries and
  e-books were converted to Prime format as free downloads on the community
  site, and that "PTC … has meanwhile discontinued sale of all worksheet
  libraries"
  ([PTC Community, spur gear design](https://community.ptc.com/t5/Mathcad-Installation/spur-gear-design/m-p/874343)).
  PTC also lists free worksheets on its site
  ([Free Mathcad Worksheets](https://www.ptc.com/en/products/mathcad/mathcad-worksheets)).
- **Three routes remain, none a formula picker:**
  - *Copy from Help.* A Help example has a Copy Expressions button; the user
    pastes with Ctrl+V. PTC's own page warns the pasted regions can show
    different results from the Help page, and says to retry from another
    browser
    ([Copying Math Examples from the Help](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_copy_math_examples_from_the_help.html)).
  - *Templates.* New → From My Templates, From Shared Templates or From
    Default Templates makes a new worksheet from a template
    ([To Use a Template](https://help.ptc.com/mathcad/en/PTC_Mathcad_Help/to_use_a_template.html)).
    Save As → Template writes to the My Templates folder; the shared folder
    is for colleagues; the Default Templates folder is PTC's and not for the
    user's files
    ([To Create a Template](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_create_a_template.html),
    [About Templates](https://help.ptc.com/mathcad/en/PTC_Mathcad_Help/about_templates.html)).
    A template is a whole sheet, not an insert.
  - *Include Worksheet.* Definitions in a referenced worksheet take effect as
    though typed in, below the include region only; solve blocks in it are
    ignored
    ([Referencing Worksheets](https://support.ptc.com/help/mathcad/r12.0/en/PTC_Mathcad_Help/to_reference_worksheets.html)).
    This gives functions, with nothing visible on the sheet.
- **What users say.** The gap is asked about repeatedly: "Storing frequently
  used equations" (2016) and "Equation Library" ("how to save an equation in
  a library" in Prime 2.0), with replies offering only the three routes above
  and the collapsed Area at the top of a sheet
  ([Storing frequently used equations](https://community.ptc.com/mathcad-7/storing-frequently-used-equations-47273),
  [Equation Library](https://community.ptc.com/mathcad-7/equation-library-32615)).
  On the paid Civil & Structural library, a retired engineer notes it is
  "American code based so has some limitation if you are not in America", and
  the asker mainly wanted the sheets "to see how Mathcad can be applied"
  ([Is the PTC Civil & Structural Worksheet Library worth the cost](https://community.ptc.com/mathcad-7/is-the-ptc-civil-structural-worksheet-library-worth-the-cost-67606)).
  A 2026 post reports the purchase links for the Roark's library in Prime
  format are broken or removed (same Roark's thread as above).

### SMath Studio: snippets

The closest prior art to the working decision.

- **What a snippet is.** An ordinary `.sm` worksheet placed in a special
  snippets folder
  ([SMath wiki, Snippets](https://wiki.smath.com/en-US/Snippets)).
- **Find.** Two ways: the Snippet Manager (Tools menu), a browsable list
  with descriptions; or Dynamic Assistance, the type-ahead list, by the
  snippet's shortcut name (same wiki page).
- **What lands.** The snippet's regions, by the user's choice of key:
  "pressing TAB will insert snippet inside the collapsed Area Region;
  pressing Shift+TAB will insert just all snippet expressions without Area
  Region" (same wiki page, and the
  [Snippets feature](https://www.smath.com/en-US/forum/topic/QBhcab/Snippets-feature)
  forum thread). So the same entry is either a closed box or open, editable
  lines.
- **Units.** Nothing special: the regions are normal SMath math, so example
  values carry whatever units the author typed.
- **Own entries.** Save a worksheet into the snippets folder and give it a
  shortcut under File → Properties → File attributes. Without the shortcut
  it "is just a smath worksheet in the snippet folder" and does not show
  ([Snippet Disappears](https://smath.com/en-US/forum/topic/6xF8us/Snippet-Disappears),
  [Snippets definition](https://smath.com/en-US/forum/topic/xpGsG3/Snippets-definition)).
  Other users' snippets download through the Snippet Manager or Extensions
  Manager into `%APPDATA%\SMath\extensions\snippets` (wiki page above).
- **Complaints.**
  - The folder is fixed. Asked about a shared network folder in 2020, a
    moderator answered that it "currently is not possible through the
    program" and suggested a symbolic link
    ([Snippet configurability](https://smath.com/en-US/forum/topic/88LDZs/Snippet-configurability)).
  - The description shown in the Snippet Manager comes from file properties
    and "does not show up in the dynamic assistant"
    ([Snippet Descriptions](https://smath.com/en-US/forum/topic/SZ3DDc/Snippet-Decriptions)).
  - Sources disagree on the install folder
    (`…\SMath Studio\snippets` or `…\SMath\SMath Studio\snippets`); it differs
    by version.

### CalcPad

- **No formula picker in the editor, as far as I found.** Reuse is by code:
  `#include filename` pulls in another file (a module), with `#local` and
  `#global` marking what is included
  ([Calcpad 5.8 quick reference, mirror](https://www.oldergeeks.com/downloads/files/calcpad-quick-reference.pdf)),
  plus user functions and macros
  ([CalcpadCE README](https://github.com/imartincei/CalcpadCE#readme), read
  directly; CalcpadCE is a community fork, not Proektsoft's build).
- **What lands.** Nothing visible unless the module prints. The user gets
  functions and macros and types the call.
- **Whole sheets.** The fork publishes "200+ Examples" as worksheets to open
  (same README), and CalcPad turns a worksheet into an HTML input form where
  only chosen values can be changed (same README: "interactive HTML input
  forms"). That is the template route, not an insert.
- **Own entries.** Any file on disk; `#include` takes a full path, so a
  shared formulas file need not be copied per project. One user complains
  that `#include` "takes everything inside the file" and asks for importing
  named functions only
  ([Calcpad issue 283](https://www.github.com/Proektsoftbg/Calcpad/issues/283);
  the repository was not readable from this session).
- **Snippets exist only in the VS Code extension** (same README:
  "syntax highlighting, snippets, and more").

### Maple Flow

- **Find.** Help → Application Gallery opens in-product examples "across many
  disciplines"; more are on Maplesoft's site
  ([Maple Flow Getting Started Guide](https://desktopfaq.maplesoft.com/support/training/PDF/Maple-Flow-Getting-Started-Guide.pdf)).
- **What lands.** A whole example document. The only "templates" that insert
  into the canvas are expression and programming templates with placeholders
  (a `for` loop, an `if`), with Tab moving between placeholders
  ([What's New in Maple Flow](https://www.maplesoft.com/products/mapleflow/new-features/)).
  Those are syntax, not formulas.
- **Units.** A units placeholder or palette; Flow can add units to balance a
  partial one (same Getting Started Guide and
  [Announcing Maple Flow 2023](https://mapleprimes.com/maplesoftblog/221092-Announcing-Maple-Flow-2023)).
- **Own entries.** I found no user formula library (see Unverified).

### Blockpad

- I could not reach Blockpad's own documentation, and search returned none of
  it. Second-hand only: a Reddit commenter who says they work with Blockpad
  wrote that "the engineering library actually comes with all paid licenses.
  There's not much on it"
  ([r/StructuralEngineering, Nov 2024, mirror](https://pol1.lr.ggtyler.dev/r/StructuralEngineering/comments/1guxrbn/software_for_hand_calculations));
  a review says the features for saving templates and reusable calculation
  elements are "still getting further refined and documented"
  ([Software Advice reviews](https://www.softwareadvice.com/za/spreadsheet/blockpad-profile/reviews/));
  an Eng-Tips tester said building productive templates would take
  substantial time
  ([Eng-Tips, Blockpad](https://www.eng-tips.com/threads/blockpad.514698/)).
  How a library item is found and what it inserts is unverified.

### EngineeringPaper.xyz

- **No library.** Reuse is a shareable link "that anyone can open and build
  off of", and the examples are sheets linked from the project's blog and a
  built-in editable tutorial
  ([README](https://github.com/mgreminger/EngineeringPaper.xyz#readme), read
  directly). A pick is a whole sheet opened as the user's own copy.
- Units are the app's normal unit handling (same README). Users' own sheets
  are saved to the cloud by link or to a local file (same README).

### Engineering Equation Solver (EES)

The clearest example of "insert a call with an example".

- **Find.** Options → Function Information: a dialog listing built-in
  functions and library routines, with buttons for Heat Transfer, Mechanical
  Design, Component Library and User-Defined libraries
  ([EES help, Function Info](https://fchartsoftware.com/ees/eeshelp/dbyi68.htm)).
  The application libraries can be browsed by pictures
  ([EES help, Visual access libraries](https://fchartsoftware.com/ees/eeshelp/visual_access_libraries.htm);
  title only, body not seen).
- **What lands.** Each function has an Example box. "If you click the Paste
  button, the contents of the Example box will be pasted into the Equations
  window at the cursor position", and the example can be edited in the box
  first (Function Info page). A university tutorial shows the result: one
  line such as `VOLUME(Water,T=T1,P=P1)`
  ([UW-Madison EES example](https://sel.me.wisc.edu/ees/example/example2.html)).
  The example uses variable names, not numbers, because EES solves equations
  in any order.
- **Own entries.** A library is an ordinary EES file of functions saved as
  `.LIB`, with help text as a comment in braces; files in the `USERLIB`
  folder load at startup
  ([EES help, Library files](https://fchartsoftware.com/ees/eeshelp/library_files.htm)).
  A user-defined button in the dialog is set up by a `.TOC` file whose
  entries give a name, the file and an example
  ([EES help, Creating entries to the visual library](https://fchartsoftware.com/ees/eeshelp/creating_entries_to_the_visual_library_.htm)).

### Tekla Tedds (not on the ticket's list, but the nearest commercial match)

- **Find.** The Library Access System, a tree of calc sets by design code.
- **What lands.** A calc item is retrieved, placed in the Word document and
  calculated; the Insert Calc Item dialog offers New document, Append to
  active document, Insert in active document or Add new Calc Section
  ([Using library calculations in Tedds for Word](https://support.tekla.com/doc/tekla-tedds/2025/qsg_usinglibrarycalculations_ec)).
- **Own entries.** The user highlights content in the document and saves it
  as a new item. User libraries are files; the default is `MyCalcs.lbr` in a
  My Libraries folder. A calc set is only an index of references to items.
  The library is read-only until the user turns on an advanced mode
  ([How to store your own calculations](https://support.tekla.com/article/how-to-store-your-own-calculations),
  [Add new items into a set](https://support.tekla.com/doc/tekla-tedds/2025/las_addnewitems)).
  Worked examples are a separate kind of entry, reached from a "My
  Calculations" index
  ([How to create example calculations](https://support.tekla.com/article/how-to-create-example-calculations)).

### Calculator sites and template platforms

- **SkyCiv Quick Design.** A library of 70 to 90+ pre-built calculators
  (pages disagree on the count), with tabs by standard and a filter and
  search panel. A pick opens a form. Users can build their own calculators
  with a config-based framework and share them with colleagues
  ([SkyCiv Quick Design](https://skyciv.com/structural-software/quick-design),
  [Quick Design framework](https://skyciv.com/structural-software/web-tool/)).
  How inputs declare units was not in the excerpts.
- **CalcTree.** Templates are "verified CalcTree pages used as calculation
  sources". A template is not editable on the page it is used in; the user
  links a parameter to one of its inputs
  ([CalcTree docs, Sources and Parameters](https://calctree.gitbook.io/docs/create-calculations/sources-and-parameters)).
  That is a black box with inputs, the opposite of an editable block.
- **ClearCalcs / Calcs.com.** Ready-made calculators, plus a no-code
  Calculator Builder for a team's own: "Create a new calculator", name it,
  give it a code
  ([Calcs Builder quick start](https://calcs.com/docs/calcs_builder/quick_start_guide),
  [ClearCalcs contact page](https://clearcalcs.com/contact)).
  That the two names are one product line is my reading, not confirmed.
- **Engineering ToolBox.** Topic pages by discipline that pair a formula and
  tables with a calculator on the same page; the site says most calculators
  work offline once a page has been visited
  ([Engineering ToolBox, shortcut and offline page](https://www.engineeringtoolbox.com/amp/shortcut-webpage-homescreen-desktop-d_2230.html)).
  Nothing is inserted anywhere, and there are no user entries. Default
  values and unit choices per calculator were not in the excerpts.
- **Knovel Interactive Equations.** Browse collections of "equations and
  worked examples", open one in the browser, change the given values or
  units, export as a worksheet, PDF, Mathcad or HTML
  ([Elsevier support, What is Knovel Interactive Equations?](https://www.elsevier.support/knovel/answer/what-is-knovel-interactive-equations)).

### Spreadsheet templates

- **Excel.** A workbook saved as a template (`.xltx`) goes by default to a
  Custom Office Templates folder under Documents, and appears under File →
  New → Personal. The folder can be changed under File → Options → Save
  ([Save a workbook as a template](https://support.microsoft.com/en-us/excel/save-a-workbook-as-a-template)).
  A pick makes a new workbook with example values in its cells.
- **What engineers say.** On Eng-Tips, posters stay with Excel because they
  "like the feel and usability of checking formulas in excel", and one keeps
  old SMath installers to protect "template investment" after SMath moved to
  online accounts
  ([Eng-Tips, SMath](https://www.eng-tips.com/threads/smath.499311/),
  [Eng-Tips, Mathcad worth it](https://eng-tips.com/threads/mathcad-worth-it.498769/)).
  The asset people protect is their own templates, not the vendor's.

## 2. Patterns that recur

| | Finds by | A pick gives | Own entries |
|---|---|---|---|
| Mathcad 15 QuickSheets, E-Books | topic tree, book chapters | live regions with example values | a library worksheet, by hand |
| Mathcad Prime | Help, template folders | copied regions, or a new sheet | My Templates, Shared Templates |
| SMath snippets | manager list, type-ahead name | regions, boxed or loose | `.sm` file in snippets folder |
| CalcPad | file names | functions and macros (`#include`) | any file |
| Maple Flow | gallery | a whole example | not found |
| EngineeringPaper.xyz | links | a whole sheet | own sheets |
| EES | dialog by library, pictures | one call line, from an editable example | `.LIB` in `USERLIB`, `.TOC` |
| Tedds | tree by code | calc item into the document | selection saved to `.lbr` |
| Calculator sites | filter, search | a form | builder (SkyCiv, ClearCalcs) |
| Excel | File → New | a new workbook | templates folder |

1. **Live and editable beats boxed.** The tools engineers praise for
   checking put ordinary content on the page. CalcTree's read-only template
   and the calculator sites are the boxed alternative, and they sell
   "verified", not "see the working".
2. **Example values come with the entry.** No tool found inserts blanks.
   EES is the one variation: its example is names, not numbers.
3. **An entry is the host's own content.** A snippet is a worksheet, a
   template is a worksheet, a `.LIB` is an EES file. No tool has a second
   format for library entries, so "save this as a formula" is cheap and the
   entry can use everything the sheet can.
4. **Each entry carries a name, a group and a description**, and tools that
   keep them in a side channel get complaints (SMath's shortcut in file
   properties, its description missing from type-ahead).
5. **Built-in and own sit side by side** (EES's User-Defined button, Tedds'
   My Calculations, Mathcad's three template folders), and the built-in set
   is read-only.
6. **Where own entries live is where the complaints are**: a fixed folder,
   no team folder, a library that died with a licence or a rights deal.
7. **Units and codes make a built-in set regional.** Knovel doubled every
   worksheet for two unit systems; PTC's civil library is US-code based.

## 3. What this implies for this app

The working decision holds. The prior art adds these points.

- **Insert a math element, not a function.** Pattern 1 and 3: the pick should
  land as an ordinary element (title, comment lines, inputs with example
  values and units, the formula line), which the user edits like any other.
  SMath's TAB / Shift+TAB choice has no need here: an element is already the
  box.
- **The sheet is one scope, so example names can collide.** A later
  assignment silently redefines a name for the lines below
  (`CONTEXT.md`, Domain). An inserted `L = 2 m` placed above the user's lines
  that use their own `L` changes their results with no warning. Mathcad and
  SMath have the same rule and I found no tool that guards the insert; this
  app would be the first, so it needs its own decision: warn on insert, or
  leave it and rely on placing new elements at the click point. This is the
  main cost the working decision carries.
- **Example values need units a metric user and a US user both accept.**
  One set of SI example values is the cheap choice (pattern 7). The Roark's
  doubling shows what the alternative costs.
- **An entry needs a name, a group, a one-line description and the text
  used for the filter, stored with the entry** (pattern 4), and shown the
  same wherever the entry is listed.
- **A user's formula should be "save this element"**, the Tedds and SMath
  gesture, with the entry being the element's own source and title
  (pattern 3). No second format.
- **Storage is the part to design with care** (pattern 6). The two homes
  differ: the web app has only this browser's storage, and the plugin stores
  nothing outside the vault (ADR 0006). The prior art says users will want
  the library to outlive the app, move between machines and be shared, which
  argues for entries that are plain files (in the vault for the plugin) and
  an export and import for the web. A per-browser store with no way out
  repeats SMath's fixed folder.
- **A filter by name in a grouped list is enough to start.** That is what
  the Constants tab already is. Figures per case are what made Roark's
  usable, but only handbook-scale libraries have them.
- **Keep the built-in set small and code-free.** Physics and geometry
  formulas travel; design-code checks date and are regional (PTC's library,
  Tedds' per-country lists).

## Unverified

- **Nothing here was observed in a running tool**, and no vendor page was
  opened directly (see the top of this note). The two READMEs on GitHub
  (EngineeringPaper.xyz, CalcpadCE) are the only sources read in full.
- **Mathcad 15's Resource Center**: whether it had search, and whether a user
  could add their own QuickSheets to it. From memory, Mathcad 2001 to 15 let
  a user author a "handbook" (`.hbk`) Electronic Book that appeared under the
  Help menu; no source found this session.
- **Mathcad's redefinition warning.** From memory, Mathcad 15 underlines a
  redefined name with a green squiggle; not checked, and Prime's behaviour
  not known.
- **PTC article CS330916's body**: only its title and outline were seen.
- **The ASEE paper on Knovel and the Roark's community thread**: excerpts
  only. Whether Roark's worksheets are still sold anywhere is unknown.
- **CalcPad's desktop editor**: whether it has an insert menu or snippet
  list of its own. The official repository and `calcpad.eu` were unreachable;
  the claims rest on a mirrored quick reference for version 5.8 and on the
  community fork.
- **Blockpad**: everything. No first-party source was reached.
- **Maple Flow**: whether a user can add entries to the Application Gallery
  or keep a personal library. The user manual was not readable.
- **EES**: the body of the "Visual access libraries" page.
- **SkyCiv, Engineering ToolBox, CalcTree, ClearCalcs**: how each
  calculator's inputs take units and what defaults they show. CalcTree's own
  template gallery page was not found.
- **Praise and complaints** rest on a handful of forum posts found by search,
  not on a survey; the Reddit thread was seen through a mirror.
