import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell } from './AppShell.tsx'

describe('AppShell', () => {
  it('renders only the canvas when no overlay or side panel is given', () => {
    render(<AppShell canvas={<div>canvas</div>} />)

    expect(screen.getByText('canvas')).toBeInTheDocument()
    expect(screen.queryByTestId('app-shell-overlay')).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('stacks the overlay over the canvas, in the same stage', () => {
    render(<AppShell canvas={<div>canvas</div>} overlay={<div>overlay</div>} />)

    const overlay = screen.getByTestId('app-shell-overlay')
    const stage = screen.getByRole('main')
    expect(overlay).toHaveTextContent('overlay')
    expect(stage).toContainElement(overlay)
    expect(stage).toContainElement(screen.getByText('canvas'))
    // Later in DOM order = painted above the canvas at equal z-index.
    expect(stage.lastElementChild).toBe(overlay)
  })

  it('docks the side panel beside the stage, not over it', () => {
    render(<AppShell canvas={<div>canvas</div>} sidePanel={<div>panel</div>} />)

    const panel = screen.getByRole('complementary', { name: 'Side panel' })
    expect(panel).toHaveTextContent('panel')
    expect(screen.getByRole('main')).not.toContainElement(panel)
  })
})
