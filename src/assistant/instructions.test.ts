import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import guide from '../../docs/math-guide.md?text'
import { INSTRUCTIONS } from './instructions.ts'

/**
 * The instructions are the spec's text word for word (docs/spec-v1.md section 8, The model's
 * job), and the guide the model gets is the English file as it is (section 14, 0.7.0, The
 * Math guide for the model).
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

it('the instructions are the spec’s text, word for word', () => {
  const spec = read('../../docs/spec-v1.md')
  const from = spec.indexOf('```\n', spec.indexOf("**The model's job**")) + 4
  expect(INSTRUCTIONS).toBe(spec.slice(from, spec.indexOf('\n```', from)))
  expect(INSTRUCTIONS.startsWith('You are the Math assistant of Excalimathpad')).toBe(true)
})

it('the guide for the model is the English file, unchanged', () => {
  expect(guide).toBe(read('../../docs/math-guide.md'))
})
