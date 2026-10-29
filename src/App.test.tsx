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

  it('seeds inputs above and V = I * R below, evaluating to 20 V', async () => {
    render(<App />)

    const sources = await screen.findAllByRole('textbox', { name: 'Math source' })
    expect(sources.map((source) => (source as HTMLTextAreaElement).value)).toEqual([
      'R = 10 kohm\nI = 2 mA',
      'V = I * R',
    ])
    const [, results] = screen.getAllByRole('list', { name: 'Results' })
    expect(results).toHaveTextContent('= 20 V')
  })
})
