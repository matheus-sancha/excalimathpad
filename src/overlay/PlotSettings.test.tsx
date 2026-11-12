import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlotClause } from '../math/plotLine.ts'
import { PlotSettings } from './PlotSettings.tsx'

afterEach(cleanup)

function open(clauses: PlotClause[] = []) {
  const onChange = vi.fn<(clauses: PlotClause[]) => void>()
  const onClose = vi.fn()
  render(<PlotSettings clauses={clauses} onChange={onChange} onClose={onClose} />)
  return { onChange, onClose }
}

describe('the plot settings popover (docs/spec-v1.md section 10)', () => {
  it('shows the line’s clauses', () => {
    open([
      { kind: 'mark', expression: 'Q_op' },
      { kind: 'mark', expression: 'Q_d' },
      { kind: 'points' },
      { kind: 'log', axis: 'y' },
      { kind: 'range', axis: 'x', start: '0', end: '30 L/s' },
      { kind: 'size', size: 'L' },
      { kind: 'title', text: 'Pump' },
    ])
    expect(screen.getByLabelText('Mark')).toHaveValue('Q_op; Q_d')
    expect(screen.getByLabelText('Points')).toBeChecked()
    expect(screen.getByLabelText('y scale')).toHaveValue('log')
    expect(screen.getByLabelText('x to')).toHaveValue('30 L/s')
    expect(screen.getByLabelText('Size')).toHaveValue('L')
    expect(screen.getByLabelText('Title')).toHaveValue('Pump')
  })

  it('hands back the whole clause list for each change, in the popover’s order', () => {
    const { onChange } = open([{ kind: 'title', text: 'Pump' }, { kind: 'mark', expression: 'Q_op' }])
    fireEvent.click(screen.getByLabelText('Points'))
    expect(onChange).toHaveBeenLastCalledWith([
      { kind: 'mark', expression: 'Q_op' },
      { kind: 'points' },
      { kind: 'title', text: 'Pump' },
    ])
    fireEvent.change(screen.getByLabelText('Series names'), { target: { value: 'direct' } })
    expect(onChange.mock.lastCall?.[0]).toContainEqual({ kind: 'labels-direct' })
  })

  it('commits text on Enter, only if it changed; marks split at ;', () => {
    const { onChange } = open()
    const mark = screen.getByLabelText('Mark')
    fireEvent.keyDown(mark, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(mark, { target: { value: 'Q_op; Q_d' } })
    fireEvent.keyDown(mark, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([
      { kind: 'mark', expression: 'Q_op' },
      { kind: 'mark', expression: 'Q_d' },
    ])
  })

  it('writes an axis range only with both ends, and the default size as none', () => {
    const { onChange } = open([{ kind: 'size', size: 'L' }])
    const from = screen.getByLabelText('y from')
    fireEvent.change(from, { target: { value: '0 m' } })
    fireEvent.keyDown(from, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith([{ kind: 'size', size: 'L' }])
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'M' } })
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('closes on Esc, keeping the canvas’s keys away', () => {
    const { onClose } = open()
    const outside = vi.fn()
    document.addEventListener('keydown', outside)
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' })
    document.removeEventListener('keydown', outside)
    expect(onClose).toHaveBeenCalled()
    expect(outside).not.toHaveBeenCalled()
  })
})
