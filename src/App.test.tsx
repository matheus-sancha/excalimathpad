import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('mounts the Excalidraw editor as the sheet canvas', async () => {
    const { container } = render(<App />)

    await waitFor(() => {
      expect(container.querySelector('.excalidraw')).toBeInTheDocument()
    })
    // The editor's own UI is up, not just an empty wrapper.
    expect(await screen.findAllByRole('radio')).not.toHaveLength(0)
  })

  it('shows the seeded math element evaluating I * R to 20 V', async () => {
    render(<App />)

    const source = await screen.findByRole('textbox', { name: 'Math source' })
    expect(source).toHaveValue('R = 10 kohm\nI = 2 mA\nI * R')
    expect(screen.getByRole('list', { name: 'Results' })).toHaveTextContent(
      '= 20 V',
    )
  })
})
