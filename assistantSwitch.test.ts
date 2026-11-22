import { describe, expect, it } from 'vitest'
import { assistantSwitch } from './assistantSwitch.ts'

describe('the Math assistant’s build-time switch (section 14, 0.7.0)', () => {
  it('is off by default, and on only for a build that says on', () => {
    expect(assistantSwitch(undefined)).toBe(false)
    expect(assistantSwitch('')).toBe(false)
    expect(assistantSwitch('off')).toBe(false)
    expect(assistantSwitch('1')).toBe(false)
    expect(assistantSwitch('on')).toBe(true)
  })
})
