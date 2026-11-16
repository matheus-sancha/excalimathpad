import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Boundary } from './Boundary.tsx'

/** Throws while `on.current` is set. */
function Part({ on, label }: { on: { current: boolean }; label: string }) {
  if (on.current) throw new TypeError('injected')
  return <p>{label}</p>
}

let errors: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  // React prints each caught failure.
  errors = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errors.mockRestore())

describe('Boundary (docs/spec-v1.md section 4, Unexpected failures)', () => {
  const tree = (on: { current: boolean }, keys: unknown[], onFail?: () => void) => (
    <>
      <p>outside</p>
      <Boundary resetKeys={keys} onFail={onFail} fallback={(failure) => <p role="alert">{failure.text}</p>}>
        <Part on={on} label="inside" />
      </Boundary>
    </>
  )

  it('shows the fallback in place of what failed, with the failure, and leaves the rest', () => {
    render(tree({ current: true }, [1]))
    expect(screen.getByRole('alert')).toHaveTextContent('TypeError: injected')
    expect(screen.queryByText('inside')).toBeNull()
    expect(screen.getByText('outside')).toBeInTheDocument()
  })

  it('stays failed while its keys are the same, and tries again when one changes', () => {
    const on = { current: true }
    const lines = ['a = 1']
    const { rerender } = render(tree(on, [lines, 'x']))
    on.current = false

    rerender(tree(on, [lines, 'x']))
    expect(screen.getByRole('alert')).toBeInTheDocument()

    rerender(tree(on, [['a = 1'], 'x']))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('inside')).toBeInTheDocument()
  })

  it('shows the fallback again when the new try fails too', () => {
    const on = { current: true }
    const { rerender } = render(tree(on, [1]))
    rerender(tree(on, [2]))
    expect(screen.getByRole('alert')).toHaveTextContent('TypeError: injected')
  })

  it('catches a failure in an effect', () => {
    function Late() {
      useEffect(() => {
        throw new RangeError('in an effect')
      }, [])
      return <p>drawn</p>
    }
    render(
      <Boundary resetKeys={[]} fallback={(failure) => <p role="alert">{failure.text}</p>}>
        <Late />
      </Boundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('RangeError: in an effect')
  })

  it('calls onFail once per failure, before the failed part is unmounted, and again for the next', () => {
    const on = { current: true }
    const seen: (string | null)[] = []
    const onFail = () => seen.push(document.querySelector('[data-kept]')?.textContent ?? null)
    const view = (keys: unknown[]) => (
      <Boundary resetKeys={keys} onFail={onFail} fallback={() => <p role="alert">failed</p>}>
        <p data-kept>the sheet</p>
        <Part on={on} label="inside" />
      </Boundary>
    )
    on.current = false
    const { rerender } = render(view([1]))
    on.current = true
    rerender(view([1]))
    // What was drawn is still there to read when onFail runs.
    expect(seen).toEqual(['the sheet'])
    rerender(view([1]))
    expect(seen).toHaveLength(1)

    rerender(view([2]))
    expect(seen).toHaveLength(2)
  })
})
