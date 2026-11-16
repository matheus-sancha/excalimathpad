/**
 * The parts of Observable Plot a chart uses, imported by name (docs/spec-v1.md
 * section 14, M4e), so both builds leave the rest of Plot out. Loaded only
 * behind `import()` (`loadPlot` in `plotDrawing.ts`): its own chunk on the
 * web, folded into `main.js` in the plugin.
 */
export { dot, frame, line, plot, ruleX, ruleY, text } from '@observablehq/plot'
