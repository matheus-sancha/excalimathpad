// The plugin build (docs/spec-v1.md section 12a, One source, two builds; ADR 0006).
//
// One CommonJS `main.js` and one `styles.css` in `dist-plugin/`, with a copy
// of `manifest.json`: everything an install delivers. The web build stays on
// Vite and is untrimmed; everything below is the plugin's alone.
//
// - No splitting: the KaTeX and Plot `import()`s fold into `main.js`.
// - Fonts are `data:` URLs: KaTeX's through its CSS (woff2 only), Excalidraw's
//   by rewriting the `./fonts/…` strings it resolves at run time.
// - Trims: Mermaid to Excalidraw, the code editor of its dialog (CodeMirror),
//   the non-English locales, font subsetting and math.js's help texts are
//   stubbed; Xiaolai's paths become `local:`, so CJK text uses system fonts;
//   four KaTeX font families are dropped (`src/overlay/katexFonts.ts`).
// - Network and storage: the `esm.sh` fallback, excalidraw.com's service URLs
//   and its Firebase config (`AIza…`) are blanked, and every `localStorage`
//   read and write in Excalidraw's packages is taken out.
// - Each trim and rewrite is counted (`TALLY`), and the build fails on one
//   that found nothing: an upgrade that moves the text stops here.
//   `scripts/audit-plugin.mjs` then checks the result.
//
// Run: `node esbuild.plugin.mjs` (`npm run build:plugin`).

import { build } from 'esbuild'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GUIDE_QUERY, guideModule } from './src/guide/markdown.ts'
import { neutralise } from './scripts/neutralise.mjs'
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

/**
 * A path inside the production build of one of Excalidraw's packages. From
 * the canary its code is in several (`excalidraw`, `common`, `element`,
 * `math`), and the storage and the environment values are in more than one.
 */
const inExcalidraw = (path) => /\/@excalidraw\/[^/]+\/dist\/prod\//.test(path.replaceAll('\\', '/'))

/**
 * What each trim and each rewrite found, by name, in one build. Every one is
 * needed against the pinned Excalidraw (and math.js), so `buildPlugin` fails
 * on a zero: the text has moved, and the rule that named it does nothing.
 */
const TALLY = {
  'Mermaid to Excalidraw': 0,
  "the Mermaid dialog's code editor (CodeMirror)": 0,
  'the non-English locales': 0,
  'font subsetting': 0,
  "math.js's help texts": 0,
  'localStorage reads': 0,
  'localStorage writes': 0,
  'the esm.sh font fallback': 0,
  "excalidraw.com's environment values": 0,
}

/** The plugin-only trims, as one esbuild plugin. */
const trims = {
  name: 'excalimathpad-plugin-trims',
  setup(b) {
    // Mermaid to Excalidraw: hidden in the plugin (section 8), so its dialog never runs.
    b.onResolve({ filter: /^@excalidraw\/mermaid-to-excalidraw$/ }, () => {
      TALLY['Mermaid to Excalidraw']++
      return { path: 'mermaid-to-excalidraw', namespace: 'trimmed' }
    })
    // The code editor of that dialog's Mermaid tab (CodeMirror, about 296 kB,
    // with a <style> made at run time): Excalidraw loads it only when the
    // dialog opens, which it can't in the plugin. The stub fails to load, the
    // case Excalidraw itself answers with a plain text box.
    b.onResolve({ filter: /^\.\/components\/TTDDialog\/CodeMirrorEditor-[^/]+\.js$/ }, (args) => {
      if (!inExcalidraw(args.importer)) return undefined
      TALLY["the Mermaid dialog's code editor (CodeMirror)"]++
      return { path: args.path, namespace: 'trimmed-editor' }
    })
    // The non-English locales: the plugin sets no language, so English (bundled) is all it reads.
    b.onResolve({ filter: /^\.\/locales\/[^/]+\.js$/ }, (args) => {
      if (!inExcalidraw(args.importer) || args.path.startsWith('./locales/en-')) return undefined
      TALLY['the non-English locales']++
      return { path: args.path, namespace: 'trimmed-locale' }
    })
    // Font subsetting: only Excalidraw's own image export embeds fonts with it.
    b.onResolve({ filter: /^\.\/subset-(worker|shared)\.chunk\.js$/ }, (args) => {
      if (!inExcalidraw(args.importer)) return undefined
      TALLY['font subsetting']++
      return { path: args.path, namespace: 'trimmed' }
    })
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
    b.onLoad({ filter: /.*/, namespace: 'trimmed-editor' }, (args) => ({
      contents: `throw new Error(${JSON.stringify(`${args.path} is not in the plugin`)})`,
      loader: 'js',
    }))

    // Excalidraw's own code: no storage, no service URLs, no Firebase key.
    b.onLoad({ filter: /\.js$/ }, async (args) => {
      if (!inExcalidraw(args.path)) return undefined
      return { contents: neutralise(await readFile(args.path, 'utf8'), TALLY), loader: 'js' }
    })

    // math.js's help texts: one empty module, from wherever math.js imports them.
    b.onResolve({ filter: /embeddedDocs\.js$/ }, (args) => {
      if (!HELP_TEXTS.test(join(args.resolveDir, args.path))) return undefined
      TALLY["math.js's help texts"]++
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
  for (const name of Object.keys(TALLY)) TALLY[name] = 0
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

  const missed = Object.keys(TALLY).filter((name) => TALLY[name] === 0)
  if (missed.length) {
    throw new Error(
      `The plugin build found nothing to trim or rewrite for: ${missed.join('; ')}. ` +
        "Excalidraw's or math.js's text has moved; redo the rule against it (esbuild.plugin.mjs).",
    )
  }

  const mainPath = join(outDir, 'main.js')
  const fonts = await inlineFonts(await readFile(mainPath, 'utf8'))
  if (!fonts.inlined || !fonts.local) {
    throw new Error(`The plugin build inlined ${fonts.inlined} fonts and made ${fonts.local} paths local: both must be found`)
  }
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
  log(Object.entries(TALLY).map(([name, count]) => `  ${String(count).padStart(3)} × ${name}`).join('\n'))
  return result
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await buildPlugin()
}
