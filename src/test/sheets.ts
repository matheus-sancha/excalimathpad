import { createMathAnchorElements } from '../canvas/mathAnchor.ts'

/**
 * A small sheet for tests of the whole app, which starts empty: inputs above,
 * and a result below that uses them (20 V).
 */
export const sampleSheet = () =>
  createMathAnchorElements([
    {
      id: 'math-inputs',
      x: 100,
      y: 100,
      width: 420,
      height: 72,
      source: 'R = 10 kohm\nI = 2 mA',
    },
    { id: 'math-result', x: 100, y: 200, width: 420, height: 48, source: 'U = I * R' },
  ])
