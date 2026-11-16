import { CopyButton, FailureActions } from './FailureActions.tsx'
import { FAILURE_MESSAGES, type Failure } from './details.ts'
import './Failure.css'

/**
 * The failure screen (docs/spec-v1.md section 4, Unexpected failures): what
 * replaces the view when a failure is outside every boundary. The line being
 * typed is text to copy, never put back by itself, since it may be the cause.
 */
export function FailureScreen({
  failure,
  typing,
  onReload,
}: {
  failure: Failure
  /** The line or title that was open, as typed; null with none open. */
  typing: string | null
  onReload: () => void
}) {
  return (
    <div className="failure-screen" role="alert">
      <p className="failure-screen__what">{FAILURE_MESSAGES.view}</p>
      <p>
        {FAILURE_MESSAGES.kept}
        {typing !== null && ` ${FAILURE_MESSAGES.typing}`}
      </p>
      {typing !== null && (
        <p className="failure-screen__typing">
          <code>{typing}</code>
          <CopyButton label={FAILURE_MESSAGES.copy} text={() => typing} />
        </p>
      )}
      <p className="failure-screen__actions">
        <button type="button" className="failure-actions__button" onClick={onReload}>
          {FAILURE_MESSAGES.reload}
        </button>
        <FailureActions what="view" failure={failure} />
      </p>
    </div>
  )
}
