import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so `dist/` works from any static host and sub-path
  // (e.g. GitHub Pages at /excalimathpad/) without rebuilding.
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Excalidraw's ESM build imports JSON without import attributes, which
    // Node rejects; let Vite transform it instead of loading it natively.
    server: { deps: { inline: ['@excalidraw/excalidraw'] } },
  },
})
