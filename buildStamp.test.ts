import { describe, expect, it } from 'vitest'
import { buildStamp } from './buildStamp.ts'

describe('buildStamp', () => {
  const now = new Date('2026-11-12T23:30:00Z')

  it('is the short commit and the UTC date', () => {
    expect(buildStamp('389dd51c0ffee0123456789abcdef0123456789a', now)).toBe('389dd51 · 2026-11-12')
  })

  it('is dev when the build has no commit', () => {
    expect(buildStamp(undefined, now)).toBe('dev')
    expect(buildStamp('  ', now)).toBe('dev')
  })
})
