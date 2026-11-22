import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { ASSISTANT_SWITCH, assistantSwitch } from './assistantSwitch.ts'
import { buildStamp } from './buildStamp.ts'
import { GUIDE_QUERY, GUIDE_TEXT_QUERY, guideModule, guideTextModule } from './src/guide/markdown.ts'

/**
 * `docs/math-guide.md?guide`: the Math guide, turned into elements at build
 * time (docs/spec-v1.md section 8, Math guide). `esbuild.plugin.mjs` does the
 * same for the plugin.
 */
const mathGuide: Plugin = {
  name: 'excalimathpad-math-guide',
  enforce: 'pre',
  async load(id) {
    // `?text` is the guide's own text, for the Math assistant's model (section 14, 0.7.0).
    const query = id.endsWith(GUIDE_QUERY) ? GUIDE_QUERY : id.endsWith(GUIDE_TEXT_QUERY) ? GUIDE_TEXT_QUERY : null
    if (!query || !id.slice(0, -query.length).endsWith('.md')) return null
    const file = id.slice(0, -query.length)
    this.addWatchFile(file)
    const text = await readFile(file, 'utf8')
    return query === GUIDE_QUERY ? guideModule(text) : guideTextModule(text)
  },
}

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [mathGuide, react()],
  // Relative asset URLs, so `dist/` works from any static host and sub-path
  // (e.g. GitHub Pages at /excalimathpad/) without rebuilding.
  base: './',
  // math.js's help texts, read only by `help()`, which the engine disables
  // (docs/spec-v1.md section 14, M4e, Lighter plugin): one empty module in
  // their place, as `esbuild.plugin.mjs` does for the plugin.
  resolve: {
    alias: [
      {
        find: /^(?:\.\.?\/)+(?:expression\/)?embeddedDocs\/embeddedDocs\.js$/,
        replacement: fileURLToPath(new URL('./src/math/noHelpTexts.ts', import.meta.url)),
      },
    ],
  },
  // GitHub Actions sets GITHUB_SHA; a local build has none and reads `dev`.
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp(process.env.GITHUB_SHA, new Date())),
    // Section 4, Unexpected failures: Copy details names the version.
    __APP_VERSION__: JSON.stringify(version),
    // Section 14, 0.7.0: the Math assistant is off unless the build says on.
    __ASSISTANT__: JSON.stringify(assistantSwitch(process.env[ASSISTANT_SWITCH])),
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The plugin's tests run against a hand-written fake of Obsidian's module
    // (docs/spec-v1.md section 12a, Tests); Obsidian itself isn't on npm.
    alias: { obsidian: fileURLToPath(new URL('./plugin/test/obsidian.ts', import.meta.url)) },
    css: false,
    // Excalidraw's ESM build imports JSON without import attributes, which
    // Node rejects; let Vite transform it instead of loading it natively.
    server: { deps: { inline: ['@excalidraw/excalidraw'] } },
  },
})
