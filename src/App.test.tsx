import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'
import { WELCOME_HINT } from './canvas/SheetCanvas.tsx'
import { fakeFileAccess, fakeRecovery } from './test/files.ts'
import { clickOnCanvas } from './test/gestures.ts'
import { createMathAnchorElements } from './canvas/mathAnchor.ts'
import { sampleSheet } from './test/sheets.ts'
import { linesOf, resultsOf } from './test/sheetView.ts'

const renderApp = (props: Parameters<typeof App>[0] = {}) => {
  const files = fakeFileAccess()
  render(<App files={files} recovery={fakeRecovery()} {...props} />)
  return { files }
}

const mathElements = () => screen.queryAllByRole('list', { name: 'Lines' })
const lineField = () => screen.queryByRole<HTMLInputElement>('textbox', { name: 'Line source' })

/** Opens Excalidraw's More tools, where Add math and Math Settings are (section 8). */
async function openMoreTools() {
  if (!document.querySelector('.math-tools')) fireEvent.click(await screen.findByTitle('More tools'))
  await waitFor(() => expect(document.querySelector('.math-tools button')).not.toBeNull())
}
const addMath = async () => {
  await openMoreTools()
  return screen.getByRole('button', { name: /Add math/ })
}
/** More tools' button reads as selected while placing, the dropdown being closed. */
const placing = () => document.querySelector('[data-math-placing]') !== null

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
    it('the item starts placing and closes More tools, and the click places an element ready to type in', async () => {
      renderApp()
      await ready()
      const item = await addMath()
      expect(item).toHaveAttribute('aria-pressed', 'false')
      expect(placing()).toBe(false)

      fireEvent.click(item)
      await waitFor(() => expect(document.querySelector('.math-tools')).toBeNull())
      expect(placing()).toBe(true)
      // The keyboard goes back to the canvas, so Esc and M reach it.
      expect(document.activeElement).toHaveClass('excalidraw')

      clickOnCanvas({ clientX: 300, clientY: 400 })

      expect(mathElements()).toHaveLength(1)
      expect(lineField()).toHaveFocus()
      expect(placing()).toBe(false)
      expect(screen.queryByText(WELCOME_HINT)).toBeNull()
      await waitFor(() => expect(document.title).toBe('● Untitled'))
    })

    it('chosen again while placing, the item reads as pressed and keeps placing', async () => {
      renderApp()
      await ready()

      fireEvent.click(await addMath())
      await waitFor(() => expect(document.querySelector('.math-tools')).toBeNull())
      const again = await addMath()
      expect(again).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(again)

      expect(placing()).toBe(true)
    })

    it('M starts placing too, and Esc cancels with the sheet still clean', async () => {
      renderApp()
      await ready()
      await screen.findByTitle('More tools')
      const canvas = document.querySelector('.excalidraw')!

      act(() => {
        fireEvent.keyDown(canvas, { key: 'm' })
      })
      expect(placing()).toBe(true)

      act(() => {
        fireEvent.keyDown(canvas, { key: 'Escape' })
      })
      expect(placing()).toBe(false)
      expect(mathElements()).toHaveLength(0)
      expect(document.title).toBe('Untitled')
    })
  })

  describe('anchor style (docs/spec-v1.md section 4)', () => {
    // A hand-edited file, or one saved before the style was fixed.
    it('restores a changed style, and the sheet stays clean', async () => {
      const [changed, other] = sampleSheet()
      const { files } = renderApp({
        initialElements: [{ ...changed, strokeColor: '#e03131', backgroundColor: 'transparent' }, other],
      })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      expect(document.title).toBe('Untitled')

      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      await waitFor(() => expect(files.saveAs).toHaveBeenCalledOnce())

      const saved = files.disk.get('Untitled.excalimathpad')!
      expect(saved).not.toContain('#e03131')
      expect(saved).toContain('#ffffff01')
    })
  })

  describe('Math Settings (docs/spec-v1.md section 8)', () => {
    const sheetButton = async () => {
      await openMoreTools()
      return screen.getByRole('button', { name: /^Math Settings/ })
    }
    const problemSheet = () =>
      createMathAnchorElements([
        { id: 'm1', x: 100, y: 100, width: 300, height: 72, source: 'K = 5.4\nx = 1 m + 1 s', title: 'Pipe flow' },
      ])

    it('the item and the More tools button carry a red badge counting errors and warnings', async () => {
      renderApp({ initialElements: problemSheet() })
      await ready()

      // With More tools closed, its button shows the count.
      await waitFor(() => expect(document.querySelector('[data-math-problems]')).not.toBeNull())
      const root = document.querySelector<HTMLElement>('[data-math-problems]')!
      expect(root.style.getPropertyValue('--math-problems')).toBe('"2"')

      expect(await sheetButton()).toHaveTextContent('Math Settings2')
      expect(screen.getByLabelText('2 problems')).toBeInTheDocument()
    })

    it('has no badge while the sheet has no problems', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      expect(await sheetButton()).toHaveTextContent(/^Math Settings$/)
      expect(document.querySelector('[data-math-problems]')).toBeNull()
    })

    it('the item reads as pressed while the panel is open, and choosing it closes the panel and More tools', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())
      await waitFor(() => expect(document.querySelector('.math-tools')).toBeNull())
      expect(document.querySelector('.sheet-sidebar')).not.toBeNull()

      const item = await sheetButton()
      expect(item).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(item)
      await waitFor(() => expect(document.querySelector('.sheet-sidebar')).toBeNull())
      expect(document.querySelector('.math-tools')).toBeNull()
    })

    it('Constants lists the built-in constants with their values, and filters by name or description', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })
      fireEvent.click(await sheetButton())

      // Radix's tabs switch on mouse down.
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Constants' }))

      expect(await screen.findByLabelText('Speed of light in vacuum: c or speedOfLight = 2.998·10⁵ km / s')).toBeInTheDocument()
      expect(screen.getByLabelText('Standard acceleration of gravity: gravity = 9.807 m / s^2')).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Mathematical' })).toBeInTheDocument()

      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter constants' }), { target: { value: 'boltz' } })
      const rows = Array.from(document.querySelectorAll('.sheet-panel__constant'), (row) => row.getAttribute('aria-label'))
      expect(rows).toEqual([
        'Boltzmann constant: k or boltzmann = 1.381·10⁻²³ (kg m^2) / (s^2 K)',
        'Stefan–Boltzmann constant: sigma or stefanBoltzmann = 5.67·10⁻⁸ kg / (s^3 K^4)',
      ])

      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter constants' }), { target: { value: 'zzz' } })
      expect(screen.getByText('No constant matches.')).toBeInTheDocument()
    })

    it('opens on Variables: names in reading order, by element, values in the system', async () => {
      renderApp({ initialElements: sampleSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())

      expect(await screen.findByRole('button', { name: 'R: 10 kohm' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'I: 2 mA' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'U: 20 V' })).toBeInTheDocument()
      expect(screen.getByRole('region', { name: 'Element 1' })).toBeInTheDocument()
      expect(document.title).toBe('Untitled')
    })

    it('lists problems with where they are, and a click jumps: selects the element and flashes the line', async () => {
      renderApp({ initialElements: problemSheet() })
      await ready()
      await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())
      // Radix's tabs switch on mouse down.
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Problems' }))
      const problem = await screen.findByText('Units do not match', { selector: '.sheet-panel__message' })
      expect(screen.getByText('Pipe flow, line 2 · x')).toBeInTheDocument()
      expect(screen.getByText('K shadows the unit K')).toBeInTheDocument()

      fireEvent.click(problem)

      const row = document.querySelector('[data-anchor-id="m1"] [data-line="1"]')!
      await waitFor(() => expect(row).toHaveClass('is-flash'))
      // The jump selects the element, adds no undo step and leaves the sheet clean.
      expect(document.title).toBe('Untitled')
      // The next click clears the flash.
      fireEvent.pointerDown(window)
      await waitFor(() =>
        expect(document.querySelector('[data-anchor-id="m1"] [data-line="1"]')).not.toHaveClass('is-flash'),
      )
    })

    it('Settings: the unit system and Digits re-show every result, mark the sheet dirty, and undo never reaches them', async () => {
      renderApp({
        initialElements: createMathAnchorElements([
          { id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'p = 45430 Pa * 1\nq = 45430 Pa * 1 in kPa' },
        ]),
      })
      await ready()
      const [element] = await screen.findAllByRole('list', { name: 'Lines' })
      await waitFor(() => expect(resultsOf(element)).toBe('45.43 kPa 45.43 kPa'))

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      fireEvent.change(await screen.findByLabelText('Unit system'), { target: { value: 'si-base' } })

      // A chosen unit keeps it.
      await waitFor(() => expect(resultsOf(element)).toBe('4.543·10⁴ Pa 45.43 kPa'))
      await waitFor(() => expect(document.title).toBe('● Untitled'))

      fireEvent.change(screen.getByLabelText('Digits'), { target: { value: '6' } })
      await waitFor(() => expect(resultsOf(element)).toBe('45430 Pa 45.43 kPa'))

      act(() => {
        document
          .querySelector('.excalidraw')!
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
      })
      expect(resultsOf(element)).toBe('45430 Pa 45.43 kPa')
    })

    it('Settings: Custom changes the unit for a chosen kind', async () => {
      renderApp({
        initialElements: createMathAnchorElements([
          { id: 'm1', x: 100, y: 100, width: 300, height: 48, source: 'p = 45430 Pa * 1\nw = 5412 W * 1' },
        ]),
      })
      await ready()
      const [element] = await screen.findAllByRole('list', { name: 'Lines' })

      fireEvent.click(await sheetButton())
      fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Settings' }))
      fireEvent.change(await screen.findByLabelText('Unit system'), { target: { value: 'custom' } })
      fireEvent.change(await screen.findByLabelText('Pressure'), { target: { value: 'bar' } })

      await waitFor(() => expect(resultsOf(element)).toBe('0.4543 bar 5.412 kW'))
      expect(screen.getByLabelText('Unit system')).toHaveValue('custom')
    })
  })
})
