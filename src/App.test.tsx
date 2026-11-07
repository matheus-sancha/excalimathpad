import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'
import { fakeFileAccess, fakeRecovery } from './test/files.ts'
import { linesOf, resultsOf } from './test/sheetView.ts'

const renderApp = () => render(<App files={fakeFileAccess()} recovery={fakeRecovery()} />)

describe('App', () => {
  it('mounts the Excalidraw editor as the sheet canvas', async () => {
    const { container } = renderApp()

    await waitFor(() => {
      expect(container.querySelector('.excalidraw')).toBeInTheDocument()
    })
    // The editor's own UI is up, not just an empty wrapper.
    expect(await screen.findAllByRole('radio')).not.toHaveLength(0)
  })

  it('seeds inputs above and U = I * R below, evaluating to 20 V', async () => {
    renderApp()

    const [inputs, result] = await screen.findAllByRole('list', { name: 'Lines' })
    expect(linesOf(inputs)).toEqual(['R = 10 kohm', 'I = 2 mA'])
    expect(linesOf(result)).toEqual(['U = I * R'])
    expect(resultsOf(result)).toBe('20 V')
  })

  it('starts on a clean untitled sheet', async () => {
    renderApp()

    expect(await screen.findByTestId('file-name')).toHaveTextContent(/^Untitled$/)
    await waitFor(() => expect(document.title).toBe('Untitled'))
  })
})
