import { describe, expect, it } from 'vitest'
import { clampPanelWidth, docksAbove, PANEL_WIDTH, PANEL_WIDTH_MAX, PANEL_WIDTH_MIN } from './panelWidth.ts'

describe('the Sheet panel’s width (docs/spec-v1.md section 8, M4e, #198)', () => {
  it('is 320 px, between 280 and 480 px', () => {
    expect([PANEL_WIDTH_MIN, PANEL_WIDTH, PANEL_WIDTH_MAX]).toEqual([280, 320, 480])
  })

  it('keeps a width in range, in whole px', () => {
    expect(clampPanelWidth(100)).toBe(280)
    expect(clampPanelWidth(280)).toBe(280)
    expect(clampPanelWidth(333.4)).toBe(333)
    expect(clampPanelWidth(480)).toBe(480)
    expect(clampPanelWidth(5000)).toBe(480)
  })

  it('reads no width, or one that isn’t a number, as the default', () => {
    expect(clampPanelWidth(null)).toBe(320)
    expect(clampPanelWidth(undefined)).toBe(320)
    expect(clampPanelWidth(NaN)).toBe(320)
    expect(clampPanelWidth(Infinity)).toBe(320)
  })

  it('docks above 640 px plus the width: 960 px at the default, 920 to 1120 px across the range', () => {
    expect(docksAbove(PANEL_WIDTH)).toBe(960)
    expect(docksAbove(PANEL_WIDTH_MIN)).toBe(920)
    expect(docksAbove(PANEL_WIDTH_MAX)).toBe(1120)
  })
})
