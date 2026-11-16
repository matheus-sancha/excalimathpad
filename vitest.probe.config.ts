import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config.ts'

/**
 * The odd-values probe (docs/spec-v1.md section 14, M4e): run by hand before a
 * release with `npm run test:probe`, never by `npm test`, whose files end in
 * `.test`.
 */
export default mergeConfig(base, defineConfig({ test: { include: ['src/**/*.probe.tsx'] } }))
