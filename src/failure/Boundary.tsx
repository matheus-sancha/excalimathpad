import { Component, type ReactNode } from 'react'
import { failureOf, type Failure } from './details.ts'

interface BoundaryProps {
  /**
   * What the failed part was drawn from. When any of these changes, the
   * boundary tries its children again (docs/spec-v1.md section 4, Unexpected
   * failures: "tries again when its element's lines or results change").
   */
  resetKeys: readonly unknown[]
  fallback: (failure: Failure) => ReactNode
  /**
   * Called once per failure, while React still renders: before anything of the
   * failed part is unmounted, so the sheet can still be read (the view's copy).
   */
  onFail?: (failure: Failure) => void
  children: ReactNode
}

/**
 * A boundary for an unexpected failure: a throw while its children render, or
 * in one of their effects, shows `fallback` in their place, and nothing outside
 * it is touched. The one class component in the app: React has no hook for it.
 */
export class Boundary extends Component<BoundaryProps, { failure: Failure | null }> {
  state: { failure: Failure | null } = { failure: null }
  /**
   * Whether `onFail` has been called for the failure showing. React can render
   * one failure more than once before it commits (it tries the whole render
   * again first), so this is cleared only by a commit that shows the children.
   */
  private told = false

  static getDerivedStateFromError(error: unknown) {
    return { failure: failureOf(error) }
  }

  componentDidMount() {
    if (!this.state.failure) this.told = false
  }

  componentDidUpdate(previous: BoundaryProps) {
    const { resetKeys } = this.props
    if (!this.state.failure) this.told = false
    if (
      this.state.failure &&
      (resetKeys.length !== previous.resetKeys.length ||
        resetKeys.some((key, i) => !Object.is(key, previous.resetKeys[i])))
    ) {
      this.told = false
      // oxlint-disable-next-line react/no-did-update-set-state -- the one extra render is the new try.
      this.setState({ failure: null })
    }
  }

  render() {
    const { failure } = this.state
    if (!failure) return this.props.children
    if (!this.told) {
      this.told = true
      this.props.onFail?.(failure)
    }
    return this.props.fallback(failure)
  }
}
