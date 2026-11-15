// Obsidian's lint (docs/spec-v1.md section 12a, Data protection):
// eslint-plugin-obsidianmd's recommended config over plugin/ and src/, run
// from the root (so manifest.json, package.json and LICENSE are checked too)
// with `--max-warnings 0` in `npm run lint`. oxlint stays the fast lint; this
// one is the community scanner's.

import { defineConfig, globalIgnores } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'

/**
 * The web app's own entry and browser-only ports. They never reach the
 * plugin: App takes them as props from `src/main.tsx`, and the bundle audit
 * (`scripts/audit-plugin.mjs`) fails if `indexedDB` or `localStorage` appears
 * in `main.js`. So the rules about browser storage and the active document,
 * which are about code that runs in Obsidian, don't apply to them.
 * `plugin/test/SheetView.test.ts` checks that a vault mounts no file chrome.
 */
const WEB_ONLY = [
  'src/main.tsx',
  'src/file/recovery.ts',
  'src/file/fileAccess.ts',
  // The window title, the leave prompt and the file dialogs: App mounts it only on the web.
  'src/file/FileChrome.tsx',
]

export default defineConfig([
  globalIgnores([
    'node_modules',
    'dist',
    'dist-plugin',
    'docs',
    'public',
    // Node build and check scripts, which never run in Obsidian.
    '*.mjs',
    'scripts',
    'vite.config.ts',
    'buildStamp.ts',
    // Tests and their helpers, as the community scanner leaves them out.
    '**/*.test.*',
    '**/test/**',
  ]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      // Sentence case for UI text in both homes (section 8). It reads Obsidian's
      // API calls and DOM properties, not JSX text: that is kept by hand.
      'obsidianmd/ui/sentence-case': [
        'warn',
        {
          brands: ['Excalimathpad', 'Excalidraw', 'Obsidian', 'KaTeX', 'Mermaid', 'GitHub'],
          acronyms: ['SI', 'USCS', 'PDF', 'PNG', 'SVG', 'CJK', 'URL', 'OK'],
        },
      ],
    },
  },
  {
    files: WEB_ONLY,
    rules: {
      'no-restricted-globals': 'off',
      'obsidianmd/prefer-active-doc': 'off',
      'obsidianmd/prefer-create-el': 'off',
    },
  },
  {
    // A suggestion, and from M4d a Symbols insert from the panel
    // (`LineEditControl.insert`), goes in with `execCommand('insertText')`,
    // the one way that keeps the field's own Ctrl+Z (section 6); where it's
    // gone, the field writes the text itself.
    files: ['src/overlay/MathElementView.tsx', 'src/overlay/MathOverlay.tsx'],
    rules: { '@typescript-eslint/no-deprecated': 'off' },
  },
  {
    // The leave prompt's `returnValue`: older Chromium asks only when it is set.
    files: ['src/file/FileChrome.tsx'],
    rules: { '@typescript-eslint/no-deprecated': 'off' },
  },
])
