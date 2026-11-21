// The plugin build (docs/spec-v1.md section 12a, One source, two builds; ADR 0006).
//
// One CommonJS `main.js` and one `styles.css` in `dist-plugin/`, with a copy
// of `manifest.json`: everything an install delivers. The web build stays on
// Vite and is untrimmed; everything below is the plugin's alone.
//
// - No splitting: the KaTeX and Plot `import()`s fold into `main.js`.
// - Fonts are `data:` URLs: KaTeX's through its CSS (woff2 only), Excalidraw's
//   by rewriting the `./fonts/…` strings it resolves at run time.
// - Trims: Mermaid to Excalidraw, the locales but English and Brazilian
//   Portuguese (☰ → Language, 0.5.0), font subsetting and
//   math.js's help texts are stubbed; Xiaolai's paths become `local:`, so CJK
//   text uses system fonts; four KaTeX font families are dropped
//   (`src/overlay/katexFonts.ts`).
// - Network: the `esm.sh` fallback, excalidraw.com's service URLs and its
//   Firebase config (`AIza…`) are blanked; its `EditorLocalStorage` gets no
//   storage. `scripts/audit-plugin.mjs` then checks the result.
//
// Run: `node esbuild.plugin.mjs` (`npm run build:plugin`).

import { build } from 'esbuild'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUIDE_QUERY, guideModule } from './src/guide/markdown.ts'
import { trimKatexCss } from './src/overlay/katexFonts.ts'

const root = dirname(fileURLToPath(import.meta.url))
const out = join(root, 'dist-plugin')
const excalidrawDist = join(root, 'node_modules/@excalidraw/excalidraw/dist/prod')
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))

/**
 * math.js's help texts (`embeddedDocs.js`), read only by `help()`, which the
 * engine disables: the module both builds put in their place
 * (docs/spec-v1.md section 14, M4e, Lighter plugin; `vite.config.ts` aliases it).
 */
const HELP_TEXTS = /[\\/]expression[\\/]embeddedDocs[\\/]embeddedDocs\.js$/
const NO_HELP_TEXTS = join(root, 'src/math/noHelpTexts.ts')

/** The Excalidraw locales the plugin keeps: the two ☰ → Language offers (`src/canvas/language.ts`). */
const KEPT_LOCALES = ['en', 'pt-BR']

/** A path inside Excalidraw's production build. */
const inExcalidraw = (path) => path.replaceAll('\\', '/').includes('/@excalidraw/excalidraw/dist/prod/')

/** How many imports of math.js's help texts the build stubbed: none means math.js moved them. */
let helpTextsStubbed = 0

/** The kept locales the build met: one missing means Excalidraw renamed or moved it. */
const localesKept = new Set()

/** The plugin-only trims, as one esbuild plugin. */
const trims = {
  name: 'excalimathpad-plugin-trims',
  setup(b) {
    // Mermaid to Excalidraw: hidden in the plugin (section 8), so its dialog never runs.
    b.onResolve({ filter: /^@excalidraw\/mermaid-to-excalidraw$/ }, () => ({
      path: 'mermaid-to-excalidraw',
      namespace: 'trimmed',
    }))
    // The locales ☰ → Language doesn't offer (section 12a, Trims): English is
    // bundled, and Brazilian Portuguese folds in, so choosing it makes no request.
    b.onResolve({ filter: /^\.\/locales\/[^/]+\.js$/ }, (args) => {
      if (!inExcalidraw(args.importer)) return undefined
      const kept = KEPT_LOCALES.find((locale) => args.path.startsWith(`./locales/${locale}-`))
      if (!kept) return { path: args.path, namespace: 'trimmed-locale' }
      localesKept.add(kept)
      return undefined
    })
    // Font subsetting: only Excalidraw's own image export embeds fonts with it.
    b.onResolve({ filter: /^\.\/subset-(worker|shared)\.chunk\.js$/ }, (args) =>
      inExcalidraw(args.importer) ? { path: args.path, namespace: 'trimmed' } : undefined,
    )
    b.onLoad({ filter: /.*/, namespace: 'trimmed' }, (args) => ({
      contents: `const trimmed = () => { throw new Error(${JSON.stringify(`${args.path} is not in the plugin`)}) }
        export const parseMermaidToExcalidraw = trimmed
        export const subsetToBase64 = trimmed
        export const subsetToBinary = trimmed
        export const toBase64 = trimmed
        export const subsetWorker = trimmed
        export default trimmed`,
      loader: 'js',
    }))
    b.onLoad({ filter: /.*/, namespace: 'trimmed-locale' }, () => ({ contents: 'export default {}', loader: 'js' }))

    // Excalidraw's own code: no storage, no service URLs, no Firebase key.
    b.onLoad({ filter: /\.js$/ }, async (args) => {
      if (!inExcalidraw(args.path)) return undefined
      return { contents: neutralise(await readFile(args.path, 'utf8')), loader: 'js' }
    })

    // math.js's help texts: one empty module, from wherever math.js imports them.
    b.onResolve({ filter: /embeddedDocs\.js$/ }, (args) => {
      if (!HELP_TEXTS.test(join(args.resolveDir, args.path))) return undefined
      helpTextsStubbed++
      return { path: NO_HELP_TEXTS }
    })

    // KaTeX's CSS lists woff2, woff and ttf for each face; browsers that run
    // Obsidian read woff2, so only it is kept (and inlined), and the four
    // families the app never asks for have no face at all.
    b.onLoad({ filter: /katex(\.min)?\.css$/ }, async (args) => ({
      contents: trimKatexCss(await readFile(args.path, 'utf8')),
      loader: 'css',
    }))
  },
}

/**
 * `docs/math-guide.md?guide`: the Math guide, turned into elements at build
 * time, as `vite.config.ts` does for the web (docs/spec-v1.md section 8).
 */
const mathGuide = {
  name: 'excalimathpad-math-guide',
  setup(b) {
    b.onResolve({ filter: /\.md\?guide$/ }, (args) => ({
      path: resolve(args.resolveDir, args.path.slice(0, -GUIDE_QUERY.length)),
      namespace: 'math-guide',
    }))
    b.onLoad({ filter: /.*/, namespace: 'math-guide' }, async (args) => ({
      contents: guideModule(await readFile(args.path, 'utf8')),
      loader: 'js',
      watchFiles: [args.path],
    }))
  },
}

/**
 * The cascade layer the app's and Excalidraw's CSS sit in, in the plugin
 * (docs/spec-v1.md section 12a, The view is confined to itself).
 */
export const APP_LAYER = 'excalimathpad'

/**
 * Rewrites one of Excalidraw's files so it reaches nothing outside the vault.
 * Each replacement is checked: an upgrade that moves the text fails the build
 * here, not silently in the audit.
 */
export function neutralise(code) {
  return (
    code
      // EditorLocalStorage (the Publish library and Mermaid dialogs only): no storage.
      .replaceAll('window.localStorage', '(void 0)')
      .replaceAll('localStorage.', 'storage.')
      // The font fallback: a font the bundle lacks is never fetched.
      .replace(/https:\/\/esm\.sh\//g, 'about:blank#')
      // excalidraw.com's build environment: collaboration, sharing, AI and
      // library backends, and the Firebase config, none of which the app starts.
      .replace(/(VITE_APP_[A-Z0-9_]+):("[^"]*"|'[^']*'|`[^`]*`)/g, (_, key) => `${key}:""`)
  )
}

/** Excalidraw's run-time font paths: data URLs, except Xiaolai, which is `local:`. */
async function inlineFonts(code) {
  const paths = [...new Set(code.match(/\.\/fonts\/[^"'`]+?\.woff2/g) ?? [])]
  let inlined = 0
  for (const path of paths) {
    const replacement = path.startsWith('./fonts/Xiaolai/')
      ? 'local:Xiaolai'
      : `data:font/woff2;base64,${(await readFile(join(excalidrawDist, path))).toString('base64')}`
    if (!replacement.startsWith('local:')) inlined++
    code = code.replaceAll(`"${path}"`, `"${replacement}"`).replaceAll(`'${path}'`, `'${replacement}'`)
  }
  return { code, inlined, local: paths.length - inlined }
}

export async function buildPlugin({ outDir = out, log = console.log } = {}) {
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })
  helpTextsStubbed = 0
  localesKept.clear()
  const result = await build({
    absWorkingDir: root,
    entryPoints: ['plugin/main.ts'],
    outfile: join(outDir, 'main.js'),
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: ['es2022'],
    splitting: false,
    minify: true,
    conditions: ['production'],
    external: ['obsidian'],
    tsconfig: 'tsconfig.plugin.json',
    jsx: 'automatic',
    legalComments: 'eof',
    loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' },
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.MODE': '"production"',
      // Section 12, Hosted build: the plugin's stamp is its version.
      __BUILD_STAMP__: JSON.stringify(pkg.version),
      // Section 4, Unexpected failures: Copy details names the version.
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [mathGuide, trims],
    metafile: true,
    logLevel: 'warning',
  })

  if (helpTextsStubbed === 0) throw new Error("math.js's help texts weren't stubbed: embeddedDocs.js has moved")
  for (const locale of KEPT_LOCALES.filter((locale) => locale !== 'en' && !localesKept.has(locale))) {
    throw new Error(`Excalidraw's ${locale} locale wasn't found: ☰ → Language would show English (section 12a, Trims)`)
  }

  const mainPath = join(outDir, 'main.js')
  const fonts = await inlineFonts(await readFile(mainPath, 'utf8'))
  await writeFile(mainPath, fonts.code)

  // esbuild writes the CSS the JS imports beside it as main.css: that, in the
  // app's cascade layer, and the view's own rules are the one styles.css.
  // `plugin/styles.css`'s guard sends every property inside the view back to
  // this layer, past Obsidian's global rules for buttons, inputs and the rest.
  const cssPath = join(outDir, 'main.css')
  const app = (await readFile(cssPath, 'utf8')).replace(/^@charset "UTF-8";\s*/, '')
  const css = `@charset "UTF-8";\n@layer ${APP_LAYER} {\n${app}\n}\n${await readFile(join(root, 'plugin/styles.css'), 'utf8')}`
  await writeFile(join(outDir, 'styles.css'), css)
  await rm(cssPath)
  await copyFile(join(root, 'manifest.json'), join(outDir, 'manifest.json'))

  log(`dist-plugin/: main.js with ${fonts.inlined} fonts inlined and ${fonts.local} paths local:`)
  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await buildPlugin()
}
