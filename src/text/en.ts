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
}

/** The shape every text table has: the English table's keys, each word a string or a function of its arguments. */
export type Words = typeof en
