import { describe, expect, it } from 'vitest'
import { assistantSwitch } from './assistantSwitch.ts'

describe('the Math assistant’s build-time switch (section 14, 0.7.0)', () => {
  it('is on by default since the assistant run proved it (#312), and off only for a build that says off', () => {
    expect(assistantSwitch(undefined)).toBe(true)
    expect(assistantSwitch('')).toBe(true)
    expect(assistantSwitch('on')).toBe(true)
    expect(assistantSwitch('off')).toBe(false)
  })
})
