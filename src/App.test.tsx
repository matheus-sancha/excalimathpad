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
})
