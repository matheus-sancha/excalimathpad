import { useContext, useState } from 'react'
import { FailureContext } from './context.ts'
import {
  failureDetails,
  FAILURE_MESSAGES,
  REPORT_URL,
  type FailedThing,
  type Failure,
} from './details.ts'

/**
 * A button that copies `text()` and says so. Where the clipboard refuses (no
 * permission, an old WebView), the text shows in a box to copy by hand.
 */
export function CopyButton({ label, text }: { label: string; text: () => string }) {
  const [state, setState] = useState<'idle' | 'copied' | { shown: string }>('idle')
  return (
    <>
      <button
        type="button"
        className="failure-actions__button"
        // Never takes focus: on a failed element, a press mustn't leave the open line.
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          const copied = text()
          // The button's own window: in an Obsidian pop-out it isn't the code's.
          const clipboard = event.currentTarget.ownerDocument.defaultView?.navigator.clipboard
          const refused = () => setState({ shown: copied })
          if (!clipboard) return refused()
          clipboard.writeText(copied).then(() => setState('copied'), refused)
        }}
      >
        {state === 'copied' ? FAILURE_MESSAGES.copied : label}
      </button>
      {typeof state === 'object' && (
        <textarea className="failure-actions__text" readOnly aria-label={label} value={state.shown} rows={6} />
      )}
    </>
  )
}

/**
 * Copy details and Report this error (docs/spec-v1.md section 4, Unexpected
 * failures): on the failure screen, a failed element and a failed line's row
 * in the Problems tab. The link is plain and carries nothing.
 */
export function FailureActions({ what, failure }: { what: FailedThing; failure: Failure }) {
  const report = useContext(FailureContext)
  return (
    <span className="failure-actions">
      <CopyButton
        label={FAILURE_MESSAGES.copyDetails}
        text={() => failureDetails(what, failure, report.home, report.words())}
      />
      <a className="failure-actions__report" href={REPORT_URL} target="_blank" rel="noreferrer" tabIndex={-1}>
        {FAILURE_MESSAGES.report}
      </a>
    </span>
  )
}
