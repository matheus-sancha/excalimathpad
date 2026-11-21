/**
 * The English text table (docs/spec-v1.md section 14, 0.6.0: two text tables,
 * one shape): the app's own words, by key. `ptBR.ts` is typed against this
 * one's shape (`Words`), so a key missing from it or added to it alone fails
 * `tsc -b`. A message with arguments is a function of them, in each table, so
 * the plural, the article and the order of words belong to the language.
 *
 * Read a word through the reader (`words.ts`): `useWords()` in a component,
 * `words()` where it is worded outside React. Never copy one into a module
 * constant built at import, or a choice in ☰ → Language never reaches it.
 *
 * Groups follow where the words show. Each later issue adds its own group.
 */
export const en = {
  /** ☰'s own items (section 8, App chrome). */
  menu: {
    open: 'Open…',
    save: 'Save',
    saveAs: 'Save as…',
    print: 'Print…',
    mathGuide: 'Math guide',
    /** ☰ → Language's row (section 13, Rename and Language). */
    language: 'Language',
    /** The build stamp's tooltip, the menu's last line (section 12, Hosted build). */
    buildStamp: 'This build',
  },
  /** More tools' Math heading and its two items (section 8, App chrome). */
  tools: {
    heading: 'Math',
    addMath: 'Add math',
    addMathTitle: 'Add math — M',
    mathSettings: 'Math settings',
    mathSettingsTitle: 'Math settings: variables, problems and settings',
    /** The badge's accessible name: the sheet's error count. */
    errors: (count: number) => (count === 1 ? '1 error' : `${count} errors`),
  },
  /** The welcome screen of an empty untitled sheet (section 8, App chrome). */
  welcome: {
    hint: 'Press M, or choose Add math under More tools, then click the sheet to place math',
    /** After a touch press (section 13, In a vault). */
    hintTouch: 'Tap More tools, then Add math, then tap the sheet',
    open: 'Open…',
  },
  /** The canvas hint for one selected math element (section 13, App), set in CSS `content`. */
  hint: {
    selected: 'Double-click a line or press Enter to edit',
    /** After a touch press (section 4, Touch). */
    selectedTouch: 'Double-tap a line, or tap Edit in Math settings',
  },
  /** The web's sheet file in the browser's chrome (section 8, App chrome; section 7). */
  file: {
    /** An unsaved sheet's name: the window title, and beside ☰. */
    untitled: 'Untitled',
    /** The save picker's file type. */
    pickerType: 'Excalimathpad sheet',
  },
  /** The browser's own Print, on the web (section 13, App), set in CSS `content`. */
  print: {
    browserLine: "Use Print… from the app's menu",
  },
  /**
   * The web's file dialogs and their messages (section 13, App; section 7). A
   * `<reason>` the browser gives passes through as it arrives; `reasons` are
   * the ones the app words itself.
   */
  dialogs: {
    /** The recovery copy's question; `name` is null for an untitled sheet. */
    restore: (name: string | null) =>
      name ? `Restore unsaved changes to ${name}?` : 'Restore unsaved changes to an untitled sheet?',
    /** Opening with unsaved changes; `name` is the file's, `Untitled.excalimathpad` unsaved. */
    saveChanges: (name: string) => `Save changes to ${name}?`,
    restoreButton: 'Restore',
    discard: 'Discard',
    save: 'Save',
    dontSave: "Don't save",
    cancel: 'Cancel',
    newer: 'This sheet was saved by a newer Excalimathpad. Update the app.',
    notASheet: "This file isn't a sheet, so it wasn't opened.",
    saveFailed: (name: string, reason: string) => `Couldn't save ${name}: ${reason}`,
    openFailed: (reason: string) => `Couldn't open the file: ${reason}`,
    reasons: {
      writeRefused: 'permission to write the file was refused',
      cannotWriteBack: 'this browser cannot write back to a file',
      cannotReadAgain: 'this browser cannot read a file again',
      /** The recovery copy's three (`recovery.ts`). */
      storeWontOpen: 'IndexedDB would not open',
      storeFailed: 'IndexedDB transaction failed',
      storeAborted: 'IndexedDB transaction aborted',
    },
  },
  /** The print view's own words (section 11, Furniture) and Print…'s notice (section 13, App). */
  printView: {
    /** The footer's page count, at its right; the date beside it is ISO in both languages. */
    pageOf: (page: number, pages: number) => `${page} of ${pages}`,
    failed: "The pages couldn't be built, so nothing was printed.",
  },
  /**
   * Unexpected failures (section 4; section 13, Unexpected failures). The text
   * Copy details copies is not here: it stays English in both (`details.ts`).
   */
  failure: {
    element: 'this element hit an unexpected error in Excalimathpad',
    chart: 'this chart hit an unexpected error in Excalimathpad',
    tab: 'this tab hit an unexpected error in Excalimathpad',
    view: 'This sheet hit an unexpected error in Excalimathpad.',
    kept: 'Your sheet is kept up to the last finished line.',
    typing: 'You were typing:',
    reload: 'Reload the sheet',
    copyDetails: 'Copy details',
    copy: 'Copy',
    copied: 'Copied',
    report: 'Report this error',
  },
  /** A rename's offer on a committed line, its row on a phone and the toast after a rename (section 13, Rename and Language). */
  offer: {
    /** The card's question as plain text: its accessible name. */
    ask: (from: string, to: string, count: number) => `Rename ${from} to ${to} in ${count === 1 ? '1 line' : `${count} lines`}?`,
    /**
     * The card's question as drawn: the names show as code and the count is a
     * button, each where the language puts it among the words.
     */
    question: <T>(from: T, to: T, count: T): (string | T)[] => ['Rename ', from, ' to ', to, ' ', count, '?'],
    /** The count, after the names: it opens the list of lines. */
    count: (count: number) => (count === 1 ? 'in 1 line' : `in ${count} lines`),
    rename: 'Rename',
    keep: (from: string) => `Keep ${from}`,
    /** On a phone, with more than one offer waiting. */
    of: (index: number, total: number) => `${index} of ${total}`,
    results: (count: number) => (count === 1 ? 'This changes 1 result:' : `This changes ${count} results:`),
    /** A listed line's place: its element's title, else its place in reading order (from 1), and the line (from 1). */
    where: (title: string | null, element: number, line: number) => `${title ?? `Element ${element}`}, line ${line}`,
    /** The toast after a rename, from the form or the offer; on touch there is no Ctrl+Z to name. */
    renamed: (from: string, to: string, count: number, touch: boolean) =>
      `Renamed ${from} to ${to} in ${count === 1 ? '1 line' : `${count} lines`}. ${touch ? 'Undo' : 'Ctrl+Z'} takes it back.`,
  },
  /** The unit slot's field and list (section 5, Unit slot). Unit symbols stay as they are. */
  unitSlot: {
    field: 'Unit',
    list: 'Units',
    sheetUnits: 'Sheet units',
  },
  /** A plot's settings popover (section 10, Plots). The clause words a line holds stay as typed. */
  plotSettings: {
    dialog: 'Plot settings',
    mark: 'Mark',
    point: 'Point',
    circle: 'Circle',
    seriesNames: 'Series names',
    legend: 'Legend',
    atLineEnds: 'At line ends',
    points: 'Points',
    axis: (axis: string) => `${axis} axis`,
    scale: (axis: string) => `${axis} scale`,
    linear: 'Linear',
    log: 'Log',
    from: (axis: string) => `${axis} from`,
    to: (axis: string) => `${axis} to`,
    auto: 'auto',
    equalScales: 'Equal scales',
    size: 'Size',
    title: 'Title',
    none: 'None',
  },
  /** The plugin's own words in Obsidian (section 8, Language: In Obsidian; section 13, In a vault). */
  vault: {
    /** The command, the ribbon's tooltip and the folder menu's item (section 7, A sheet in a vault). */
    newSheet: 'New sheet',
    /** The commands that act on the active sheet tab (section 8, Inside an Obsidian tab). */
    addMath: 'Add math',
    toggleMathSettings: 'Toggle Math settings',
    openMathGuide: 'Open Math guide',
    print: 'Print…',
    /** A new sheet's name, before its number and extension: `Untitled`, `Untitled 1`… */
    untitled: 'Untitled',
    /** A busy tab's own version after an outside change, without extension; `stamp` is `YYYY-MM-DD HHmm`. */
    conflictCopy: (name: string, stamp: string) => `${name} (conflict ${stamp})`,
    /** Notices. Names as given; `reason` is Obsidian's, as it arrives. */
    conflict: (sheet: string, copy: string) => `${sheet} changed elsewhere. Your version was saved beside it as ${copy}.`,
    writeFailed: (file: string, reason: string) => `Couldn't save ${file}: ${reason}. Your work is still open.`,
    createFailed: (file: string, reason: string) => `Couldn't create ${file}: ${reason}.`,
    noLookbehind: 'Excalimathpad needs iOS 16.4 or later.',
    /** The vault image picker's field. */
    pickImage: 'Pick an image from the vault to place on the sheet',
    /** Print…'s notice: the paper to choose in the system's dialog. */
    paper: (size: string, orientation: string) => `Choose ${size}, ${orientation} in the print dialog.`,
    /** The stored Page setting's words, as the paper notice names them. */
    paperSize: { A4: 'A4', Letter: 'Letter' },
    orientation: { portrait: 'portrait', landscape: 'landscape' },
  },
}

/** The shape every text table has: the English table's keys, each word a string or a function of its arguments. */
export type Words = typeof en
