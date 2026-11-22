import { engineEn } from './engine.en.ts'

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
  /** The engine's messages, by code (section 13; ADR 0007): read through `wordMessage` (`engine.ts`). */
  engine: engineEn,
  /**
   * The Sheet panel (section 8, Sheet panel; section 13, Panel, and Rename and
   * Language's form; 0.6.0, #293): its frame and the bottom sheet, every tab's
   * words, and the rename form under a Variables row.
   */
  panel: {
    /** Each tab's name: its tooltip, its accessible name, its heading, and the bottom sheet's active pill. */
    tabs: {
      format: 'Format',
      symbols: 'Symbols',
      variables: 'Variables',
      problems: 'Problems',
      constants: 'Constants',
      settings: 'Settings',
    },
    /** The bottom sheet's region and its tab row (section 8, On a phone). */
    region: 'Math settings',
    tabList: 'Math settings tabs',
    close: 'Close',
    /** The quick keys' row (section 4, Touch), and each key's name. */
    quickKeys: 'Quick keys',
    keys: {
      underscore: 'Underscore',
      power: 'To the power',
      equals: 'Equals',
      open: 'Open bracket',
      close: 'Close bracket',
      times: 'Times',
      divide: 'Divide',
      comma: 'Comma',
      range: 'Range',
      quotes: 'Quotes',
    },
    /** An element with no title, named by its place in reading order. */
    element: (n: number) => `Element ${n}`,
    /** A line, named as Variables, Problems and the rename form name it: "Pipe flow, line 3". */
    line: (element: string, n: number) => `${element}, line ${n}`,
    /** Symbols and Constants, with nothing to insert into (section 13, Panel). */
    openALine: 'Open a line to insert',
    variables: {
      filter: 'Filter names',
      noMatch: 'No name matches.',
      none: 'No variables yet.',
      function: 'function',
      solveFunction: 'solve function',
      error: 'error',
    },
    problems: {
      none: 'No problems.',
      error: 'error',
      warning: 'warning',
    },
    constants: {
      filter: 'Filter constants',
      noMatch: 'No constant matches.',
      /** The names a line reads a constant by (section 5, Constants). */
      names: (short: string, name: string) => `${short} or ${name}`,
      insert: (name: string) => `Insert ${name}`,
    },
    symbols: {
      filter: 'Filter symbols',
      noMatch: 'No symbol matches.',
    },
    /** The Format tab (section 4, Format tab; section 13, Panel). */
    format: {
      nothingOpen: 'Open a line or a title to format it: double-click it, or select its element and press Enter.',
      nothingOpenTouch: 'Double-tap a line, or tap Edit',
      noFormat: 'This line takes no format.',
      /** Under a plot line's sample, which never draws the chart (M4e). */
      chartOnSheet: 'Its chart is drawn on the sheet.',
      edit: 'Edit',
      editKey: 'Edit (Enter)',
      done: 'Done',
      doneKey: 'Done (Esc)',
      up: 'Up (↑)',
      down: 'Down (↓)',
      sample: 'Sample',
      moveEdit: 'Move the edit',
      /** The link beside the sample that moves the edit: its arrow stays with its last word. */
      links: { editTitle: 'Edit title ↑', addTitle: 'Add title ↑', firstLine: 'First line ↓' },
      /** The caption over the sample, shown in capitals: what is open, and where. */
      captions: {
        title: (element: string) => `Title — ${element}`,
        math: (line: string) => `Math line — ${line}`,
        comment: (line: string) => `Comment line — ${line}`,
        blank: (line: string) => `Line — ${line}`,
      },
      /** A true rule over a pressed property; the condition is kept whole when the note wraps. */
      ruleSets: (property: 'bold' | 'underline' | 'text' | 'highlight', condition: string) =>
        `A rule sets ${{ bold: 'bold', underline: 'underline', text: 'the text colour', highlight: 'the highlight' }[property]} while ${condition}.`,
      rows: { style: 'Style', size: 'Size', align: 'Align', text: 'Text', highlight: 'Highlight' },
      bold: 'Bold (Ctrl+B)',
      italic: 'Italic (Ctrl+I)',
      underline: 'Underline (Ctrl+U)',
      size: (size: string) => `Size ${size}`,
      alignLeft: 'Align left',
      alignCentre: 'Centre',
      alignRight: 'Align right',
      /** The six text colours, the five highlights (section 4, Colours and rules), and their buttons. */
      colors: {
        black: 'black',
        blue: 'blue',
        red: 'red',
        green: 'green',
        orange: 'orange',
        gray: 'gray',
        yellow: 'yellow',
      },
      textColor: (color: string) => `Text ${color}`,
      highlightColor: (color: string) => `Highlight ${color}`,
      noTextColor: 'No text colour',
      noHighlight: 'No highlight',
    },
    /** The Rules list (section 4, Rules list). */
    rules: {
      title: 'Rules',
      hint: 'first true wins, top to bottom',
      rule: (n: number, text: string) => `Rule ${n}: ${text}`,
      chip: (n: number) => `Format of rule ${n}`,
      formatGroup: (n: number) => `Rule ${n} format`,
      condition: (n: number) => `Condition of rule ${n}`,
      up: (n: number) => `Move rule ${n} up`,
      down: (n: number) => `Move rule ${n} down`,
      remove: (n: number) => `Remove rule ${n}`,
      add: '+ Add rule',
      /** A rule with an empty condition (section 13, Panel). */
      noCondition: 'a rule needs a condition',
      suggestions: 'Suggestions',
      /** Its live state beside its condition. */
      true: 'true',
      false: 'false',
      overridden: 'true, overridden',
      count: (count: number, of: number, unit: 'points' | 'rows') =>
        `${count} of ${of} ${{ points: of === 1 ? 'point' : 'points', rows: of === 1 ? 'row' : 'rows' }[unit]}`,
    },
    /** The Settings tab (section 8; section 5, Unit systems; section 11's Page). */
    settings: {
      unitSystem: 'Unit system',
      systems: { 'si-prefixed': 'SI with prefixes', 'si-base': 'SI base units', uscs: 'USCS' },
      custom: 'Custom',
      startsFrom: 'Starts from',
      customUnits: 'Custom units',
      digits: 'Digits',
      resultColor: 'Result colour',
      page: 'Page',
      paperSize: 'Paper size',
      orientation: 'Orientation',
      sizes: { A4: 'A4', Letter: 'Letter' },
      portrait: 'Portrait',
      landscape: 'Landscape',
    },
    /** The rename form on a Variables row (section 13, Rename and Language). */
    rename: {
      /** A Variables row's ✎: its name and its tooltip. */
      start: (name: string) => `Rename ${name}`,
      /** The heading over the field, the old name kept whole: its words before and after the name. */
      heading: { before: 'Rename', after: 'to' },
      /** The field's name. */
      field: (name: string) => `Rename ${name} to`,
      lines: (count: number) => (count === 1 ? 'Changes 1 line:' : `Changes ${count} lines:`),
      results: (count: number) => (count === 1 ? 'This changes 1 result:' : `This changes ${count} results:`),
      rename: 'Rename',
      cancel: 'Cancel',
    },
  },
  /**
   * The kinds (section 5, Unit systems): each one's name, as the Settings tab
   * and the suggestions show it, and the kind with its article, for a sentence.
   */
  kinds: {
    name: {
      length: 'Length',
      area: 'Area',
      volume: 'Volume',
      volumeFlow: 'Volume flow',
      massFlow: 'Mass flow',
      velocity: 'Velocity',
      acceleration: 'Acceleration',
      force: 'Force',
      pressure: 'Pressure',
      energy: 'Energy, torque',
      power: 'Power',
      density: 'Density',
      dynamicViscosity: 'Dynamic viscosity',
      kinematicViscosity: 'Kinematic viscosity',
      frequency: 'Frequency',
      mass: 'Mass',
      time: 'Time',
      temperature: 'Temperature',
    },
    a: {
      length: 'a length',
      area: 'an area',
      volume: 'a volume',
      volumeFlow: 'a volume flow',
      massFlow: 'a mass flow',
      velocity: 'a velocity',
      acceleration: 'an acceleration',
      force: 'a force',
      pressure: 'a pressure',
      energy: 'an energy',
      power: 'a power',
      density: 'a density',
      dynamicViscosity: 'a dynamic viscosity',
      kinematicViscosity: 'a kinematic viscosity',
      frequency: 'a frequency',
      mass: 'a mass',
      time: 'a time',
      temperature: 'a temperature',
    },
  },
  /** The built-in constants (section 5, Constants): each group's name, and what each constant is, by math.js's name. */
  constants: {
    groups: {
      mathematical: 'Mathematical',
      universal: 'Universal',
      adopted: 'Adopted values',
      physicoChemical: 'Physico-chemical',
      electromagnetic: 'Electromagnetic',
      atomic: 'Atomic and nuclear',
      planck: 'Planck units',
    },
    description: {
      pi: 'Circle circumference over diameter',
      tau: '2π',
      e: "Euler's number",
      phi: 'Golden ratio',
      i: 'Imaginary unit',
      Infinity: 'Infinity',
      SQRT2: 'Square root of 2',
      SQRT1_2: 'Square root of ½',
      LN2: 'Natural logarithm of 2',
      LN10: 'Natural logarithm of 10',
      LOG2E: 'Base-2 logarithm of e',
      LOG10E: 'Base-10 logarithm of e',
      speedOfLight: 'Speed of light in vacuum',
      gravitationConstant: 'Newtonian constant of gravitation',
      planckConstant: 'Planck constant',
      reducedPlanckConstant: 'Reduced Planck constant',
      gravity: 'Standard acceleration of gravity',
      molarMass: 'Molar mass constant',
      molarMassC12: 'Molar mass of carbon-12',
      gasConstant: 'Molar gas constant',
      boltzmann: 'Boltzmann constant',
      avogadro: 'Avogadro constant',
      stefanBoltzmann: 'Stefan–Boltzmann constant',
      atomicMass: 'Atomic mass constant',
      faraday: 'Faraday constant',
      molarVolume: 'Molar volume of an ideal gas (273.15 K, 101.325 kPa)',
      loschmidt: 'Loschmidt constant (273.15 K, 101.325 kPa)',
      molarPlanckConstant: 'Molar Planck constant',
      firstRadiation: 'First radiation constant',
      secondRadiation: 'Second radiation constant',
      wienDisplacement: 'Wien displacement law constant',
      sackurTetrode: 'Sackur–Tetrode constant (1 K, 100 kPa)',
      elementaryCharge: 'Elementary charge',
      electricConstant: 'Vacuum electric permittivity',
      magneticConstant: 'Vacuum magnetic permeability',
      vacuumImpedance: 'Characteristic impedance of vacuum',
      coulomb: 'Coulomb constant',
      bohrMagneton: 'Bohr magneton',
      nuclearMagneton: 'Nuclear magneton',
      magneticFluxQuantum: 'Magnetic flux quantum',
      conductanceQuantum: 'Conductance quantum',
      inverseConductanceQuantum: 'Inverse conductance quantum',
      klitzing: 'Von Klitzing constant',
      electronMass: 'Electron mass',
      protonMass: 'Proton mass',
      neutronMass: 'Neutron mass',
      deuteronMass: 'Deuteron mass',
      bohrRadius: 'Bohr radius',
      fineStructure: 'Fine-structure constant',
      rydberg: 'Rydberg constant',
      classicalElectronRadius: 'Classical electron radius',
      hartreeEnergy: 'Hartree energy',
      quantumOfCirculation: 'Quantum of circulation',
      thomsonCrossSection: 'Thomson cross section',
      fermiCoupling: 'Fermi coupling constant',
      weakMixingAngle: 'Weak mixing angle',
      efimovFactor: 'Efimov factor',
      planckLength: 'Planck length',
      planckMass: 'Planck mass',
      planckTime: 'Planck time',
      planckCharge: 'Planck charge',
      planckTemperature: 'Planck temperature',
    },
  },
  /**
   * The Symbols catalogue's words (section 4, Symbols tab): each group's name,
   * and each button's hint, by its group and its spelling. A signature such as
   * `pow(x, y)` stays as a line writes it.
   */
  symbols: {
    groups: { greek: 'Greek', operators: 'Operators', functions: 'Functions', logic: 'Logic', forms: 'Sheet forms' },
    /** A Greek letter's hint and hover; one that is also a constant names it. */
    greek: 'type _ for a subscript',
    greekHover: (spelling: string) => `${spelling} — type _ for a subscript: ${spelling}_w`,
    greekConstantHover: (spelling: string, constant: string) =>
      `${spelling} — also the constant ${constant}; a sheet may take the name\ntype _ for a subscript: ${spelling}_w`,
    hints: {
      operators: {
        '+': 'plus',
        '-': 'minus',
        '*': 'times',
        '/': 'divided by',
        '^2': 'squared',
        '^': 'to the power',
        sqrt: 'square root',
        cbrt: 'cube root',
        nthRoot: 'nthRoot(x, n)',
        abs: 'absolute value',
        '!': 'factorial',
        '( )': 'brackets',
        '[ ]': 'a matrix, or an index',
        '<': 'less than',
        '>': 'greater than',
        '<=': 'less than or equal to',
        '>=': 'greater than or equal to',
      },
      functions: {
        exp: 'e to the power x',
        log: 'natural logarithm, or log(x, base)',
        log10: 'base-10 logarithm',
        log2: 'base-2 logarithm',
        pow: 'pow(x, y)',
        sin: 'sine',
        cos: 'cosine',
        tan: 'tangent',
        asin: 'inverse sine',
        acos: 'inverse cosine',
        atan: 'inverse tangent',
        atan2: 'atan2(y, x)',
        sinh: 'hyperbolic sine',
        cosh: 'hyperbolic cosine',
        tanh: 'hyperbolic tangent',
        min: 'smallest value',
        max: 'largest value',
        sum: 'sum of a list',
        mean: 'mean of a list',
        count: 'number of values in a list',
        round: 'round(x) or round(x, digits)',
        floor: 'round down',
        ceil: 'round up',
        sign: 'sign: -1, 0 or 1',
        mod: 'mod(x, y)',
        hypot: 'hypot(a, b)',
        factorial: 'n!',
      },
      logic: {
        if: 'if(cond, a, b)',
        '? :': 'cond ? a : b',
        '==': 'equal to',
        '!=': 'not equal to',
        and: 'both true',
        or: 'either true',
        not: 'not true',
        true: 'a condition that holds',
        false: 'a condition that fails',
        '" "': 'a text: "OK"',
      },
      forms: {
        solve: 'a solved value',
        for: 'a solve’s search range',
        '..': 'a range',
        step: 'a range’s step',
        table: 'table(a, b, …)',
        plot: 'plot(x, y1, …)',
        in: 'the result in a unit',
        '[ ]': 'a value out of a list',
        guess: 'a solve function’s starting value',
      },
    },
  },
  /** The typing suggestions' details (section 4, While editing a line, Suggestions). */
  suggest: {
    boldRow: 'bold row',
    underlinedRow: 'underlined row',
    textColor: 'text colour',
    highlight: 'highlight',
    boldComment: 'bold comment',
    upright: 'not italic',
    underlinedComment: 'underlined comment',
    size: (size: string, px: number) => `size ${size}, ${px} px`,
    if: 'a rule: the format applies while true',
    solveFunction: (signature: string) => `${signature} · solve function`,
    error: 'error',
    unit: 'unit',
    electrical: 'Electrical',
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
