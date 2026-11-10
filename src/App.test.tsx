import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'
import { WELCOME_HINT } from './canvas/SheetCanvas.tsx'
import { fakeFileAccess, fakeRecovery } from './test/files.ts'
import { clickOnCanvas } from './test/gestures.ts'
import { sampleSheet } from './test/sheets.ts'
import { linesOf, resultsOf } from './test/sheetView.ts'

const renderApp = (props: Parameters<typeof App>[0] = {}) => {
  const files = fakeFileAccess()
  render(<App files={files} recovery={fakeRecovery()} {...props} />)
  return { files }
}

const mathElements = () => screen.queryAllByRole('list', { name: 'Lines' })
const lineField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Line source' })
const addMath = () => screen.findByRole('button', { name: /Add math/ })

/** The app, loaded and holding its clean mark. */
async function ready() {
  await screen.findByTestId('file-name')
  await waitFor(() => expect(document.title).toBe('Untitled'))
}

describe('App', () => {
  it('mounts the Excalidraw editor as the sheet canvas', async () => {
    const { container } = render(<App files={fakeFileAccess()} recovery={fakeRecovery()} />)

    await waitFor(() => {
      expect(container.querySelector('.excalidraw')).toBeInTheDocument()
    })
    // The editor's own UI is up, not just an empty wrapper.
    expect(await screen.findAllByRole('radio')).not.toHaveLength(0)
  })

  it('evaluates a sheet across its elements', async () => {
    renderApp({ initialElements: sampleSheet() })

    const [inputs, result] = await screen.findAllByRole('list', { name: 'Lines' })
    expect(linesOf(inputs)).toEqual(['R = 10 kohm', 'I = 2 mA'])
    expect(linesOf(result)).toEqual(['U = I * R'])
    expect(resultsOf(result)).toBe('20 V')
  })

  describe('the untitled sheet (docs/spec-v1.md section 8)', () => {
    it('starts empty and clean', async () => {
      renderApp()

      expect(await screen.findByTestId('file-name')).toHaveTextContent(/^Untitled$/)
      await waitFor(() => expect(document.title).toBe('Untitled'))
      expect(mathElements()).toHaveLength(0)
    })

    it('shows the welcome screen, with the hint for Add math and Open…', async () => {
      const { files } = renderApp()
      await ready()

      expect(await screen.findByText(WELCOME_HINT)).toBeInTheDocument()
      expect(screen.getByText('Excalimathpad')).toBeInTheDocument()
      // Excalidraw's own welcome items aren't there.
      expect(screen.queryByText(/Live collaboration/i)).toBeNull()

      fireEvent.click(screen.getByText('Open…'))
      await waitFor(() => expect(files.open).toHaveBeenCalled())
    })
  })

  describe('Add math (docs/spec-v1.md section 8)', () => {
    it('the button starts placing, and the click places an element ready to type in', async () => {
      renderApp()
      await ready()
      const button = await addMath()
      expect(button).toHaveAttribute('aria-pressed', 'false')

      fireEvent.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      // The keyboard goes back to the canvas, so Esc and M reach it.
      expect(document.activeElement).toHaveClass('excalidraw')

      clickOnCanvas({ clientX: 300, clientY: 400 })

      expect(mathElements()).toHaveLength(1)
      expect(lineField()).toHaveFocus()
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByText(WELCOME_HINT)).toBeNull()
      await waitFor(() => expect(document.title).toBe('● Untitled'))
    })

    it('pressed again while placing, the button keeps placing', async () => {
      renderApp()
      await ready()
      const button = await addMath()

      fireEvent.click(button)
      fireEvent.click(button)

      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('M starts placing too, and Esc cancels with the sheet still clean', async () => {
      renderApp()
      await ready()
      const button = await addMath()
      const canvas = document.querySelector('.excalidraw')!

      act(() => {
        fireEvent.keyDown(canvas, { key: 'm' })
      })
      expect(button).toHaveAttribute('aria-pressed', 'true')

      act(() => {
        fireEvent.keyDown(canvas, { key: 'Escape' })
      })
      expect(button).toHaveAttribute('aria-pressed', 'false')
      expect(mathElements()).toHaveLength(0)
      expect(document.title).toBe('Untitled')
    })
  })
})
