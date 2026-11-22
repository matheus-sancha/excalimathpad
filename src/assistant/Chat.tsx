import { useEffect, useState, useSyncExternalStore, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { useWords } from '../text/words.ts'
import type { Answer, Conversation, SentWith } from './conversation.ts'
import { failureLines, QUIET_MS } from './answerWords.ts'
import { useHostGate } from './hostGate.tsx'
import guide from '../../docs/math-guide.md?text'
import type { AssistantRequest } from './ports.ts'
import type { SetupKeeper, Setup } from './setup.ts'
import { hostOfSetup, targetOf, type AssistantSheet } from './sheet.ts'

/**
 * The conversation in the Math assistant's tab (docs/spec-v1.md section 8, Math assistant,
 * The conversation; section 13's words): the list over the field, "Goes with your message"
 * above it, New chat and the key button in its header. Its state is the `Conversation`'s,
 * held above the tab, so this component can be removed and drawn again at any time.
 *
 * Every request goes through the host gate first. The field is a `<textarea>`: it takes
 * focus, so it leaves the open line; the chat's buttons never take it, and a Send from one
 * leaves the open line first. An answer shows as plain text until the answer's form (#311).
 */
export interface ChatProps {
  conversation: Conversation
  sheet: AssistantSheet
  setup: Setup
  keeper: SetupKeeper
  request: AssistantRequest
  /** The key button: opens the setup card, or closes it. */
  onKey: () => void
  /** The setup card, in the field's place: opened by the key button, or after Remove. */
  composer?: ReactNode
}

/** A chat button: never takes the keyboard, so a line stays open under it. */
const keep = (event: MouseEvent) => event.preventDefault()

export function Chat({ conversation, sheet, setup, keeper, request, onKey, composer }: ChatProps) {
  const w = useWords().assistant
  const { entries, busy, draft } = useSyncExternalStore(conversation.subscribe, conversation.state)
  // The sheet as it is now, for "Goes with your message": made again only when it may differ.
  const now = useSyncExternalStore(sheet.subscribe, sheet.now)
  const [opened, setOpened] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const gate = useHostGate(keeper.confirmHost)
  const host = hostOfSetup(setup)

  /** The sheet at this moment, as a Send carries it; null after saying it is too long. */
  const sentNow = (): SentWith | null => {
    const { listing } = sheet.now()
    if (listing.kind === 'tooLong') {
      setRefusal(listing.message)
      return null
    }
    setRefusal(null)
    return listing.kind === 'empty'
      ? { counts: null, listing: null, map: null }
      : { counts: listing.counts, listing: listing.text, map: listing.map }
  }
  const withThis = (sent: SentWith) => ({ request, target: targetOf(setup), model: setup.model, guide, sent })

  const send = (text: string, fromButton: boolean) => {
    if (busy || !text.trim()) return
    if (fromButton) sheet.leaveLine()
    if (!sentNow()) return
    gate.ask('send', setup, () => {
      // Read again: the sheet as it is when the request goes.
      const sent = sentNow()
      if (!sent) return
      conversation.send(text, withThis(sent))
      if (!fromButton) conversation.setDraft('')
    })
  }
  const retry = () => {
    sheet.leaveLine()
    if (!sentNow()) return
    gate.ask('send', setup, () => {
      const sent = sentNow()
      if (sent) conversation.retry(withThis(sent))
    })
  }
  const checkKey = (answer: Answer) =>
    gate.ask('check', setup, () => conversation.checkKey(answer.id, request, targetOf(setup)))

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      conversation.stop()
    } else if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(draft, false)
    }
  }

  const last = entries.at(-1)
  return (
    <div className="assistant-chat">
      <div className="assistant-chat__header">
        <button
          type="button"
          className="assistant-card__button"
          tabIndex={-1}
          onMouseDown={keep}
          disabled={entries.length === 0}
          onClick={() => {
            conversation.clear()
            setRefusal(null)
          }}
        >
          {w.newChat}
        </button>
        <button type="button" className="assistant-card__button is-eye" tabIndex={-1} onMouseDown={keep} aria-label={w.keyButton} title={w.keyButton} onClick={onKey}>
          <KeyIcon />
        </button>
      </div>

      <div className="assistant-chat__list" data-testid="assistant-list">
        {entries.length === 0 ? (
          <div className="assistant-chat__empty">
            <p>{w.emptyAbout}</p>
            <p>{w.emptySaved}</p>
            <div className="assistant-chat__suggested">
              {w.suggested.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="assistant-card__button"
                  tabIndex={-1}
                  onMouseDown={keep}
                  disabled={busy}
                  onClick={() => send(question, true)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          entries.map((entry) =>
            entry.kind === 'message' ? (
              <p key={entry.id} className="assistant-chat__message" data-testid="assistant-message">
                {entry.text}
              </p>
            ) : (
              <AnswerView
                key={entry.id}
                answer={entry}
                setup={setup}
                last={entry === last}
                busy={busy}
                onRetry={retry}
                onCheckKey={() => checkKey(entry)}
              />
            ),
          )
        )}
      </div>

      {gate.prompt}
      {refusal && (
        <p className="assistant-card__problem" role="alert">
          {refusal}
        </p>
      )}

      {composer ?? (
        <>
          <div className="assistant-chat__goes">
            <button type="button" className="assistant-card__link" tabIndex={-1} onMouseDown={keep} aria-expanded={opened} onClick={() => setOpened(!opened)}>
              {now.listing.kind === 'listing'
                ? w.goesWith(now.listing.counts.elements, now.listing.counts.lines, now.listing.counts.texts, host)
                : now.listing.kind === 'empty'
                  ? w.goesWithEmpty(host)
                  : now.listing.message}
            </button>
            {opened && (
              <div className="assistant-chat__goes-list">
                {now.elements.length > 0 && (
                  <ul>
                    {now.elements.map(({ name, lines }, index) => (
                      <li key={index}>{w.goesElement(name, lines)}</li>
                    ))}
                  </ul>
                )}
                <p>{w.goesNote}</p>
              </div>
            )}
          </div>

          <div className="assistant-chat__compose">
            <textarea
              className="assistant-chat__field"
              aria-label={w.placeholder}
              placeholder={w.placeholder}
              rows={3}
              value={draft}
              spellCheck
              onChange={(event) => conversation.setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
            {busy ? (
              <button type="button" className="assistant-card__button" tabIndex={-1} onMouseDown={keep} onClick={() => conversation.stop()}>
                {w.stop}
              </button>
            ) : (
              <button
                type="button"
                className="assistant-card__button is-primary"
                tabIndex={-1}
                onMouseDown={keep}
                disabled={!draft.trim() || gate.asking}
                onClick={() => send(draft, false)}
              >
                {w.send}
              </button>
            )}
          </div>
          <p className="assistant-chat__hint">{w.fieldHint}</p>
        </>
      )}
    </div>
  )
}

/** Re-draws once `at` has passed, so the waiting line's hint shows by itself. Nothing else happens then. */
function usePassed(at: number | null): boolean {
  const [passed, setPassed] = useState<number | null>(null)
  useEffect(() => {
    if (at === null) return
    const timer = window.setTimeout(() => setPassed(at), Math.max(0, at - Date.now()))
    return () => window.clearTimeout(timer)
  }, [at])
  return at !== null && passed === at
}

interface AnswerViewProps {
  answer: Answer
  setup: Setup
  /** Only the last answer has Try again: it asks the last message again. */
  last: boolean
  busy: boolean
  onRetry: () => void
  onCheckKey: () => void
}

function AnswerView({ answer, setup, last, busy, onRetry, onCheckKey }: AnswerViewProps) {
  const w = useWords().assistant
  const host = hostOfSetup(setup)
  const arriving = answer.state === 'waiting' || answer.state === 'arriving'
  const quiet = usePassed(arriving ? answer.quietSince + QUIET_MS : null)
  const failed = answer.state === 'failed' && answer.failure
  const online = navigator.onLine
  const lines = failed ? failureLines(answer, setup, w, online) : []
  // "You're offline." has Try again only: the device already said why.
  const canCheck = failed && online && answer.failure?.kind === 'nothing' && answer.check === null
  const canRetry = last && (answer.state === 'failed' || answer.state === 'cut')
  return (
    <div className="assistant-chat__answer" data-testid="assistant-answer" data-state={answer.state}>
      {answer.text && <p className="assistant-chat__text">{answer.text}</p>}
      {arriving && (
        <p className="assistant-chat__status" role="status">
          {answer.state === 'waiting' && w.reading} {quiet && w.stillWaiting(host)}
        </p>
      )}
      {answer.state === 'stopped' && <p className="assistant-chat__status">{w.stopped}</p>}
      {answer.state === 'cut' && <p className="assistant-chat__status">{w.cutShort}</p>}
      {lines.map((line, index) => (
        <p key={index} className="assistant-card__problem" role={index === 0 ? 'alert' : undefined}>
          {line}
        </p>
      ))}
      {(canCheck || canRetry) && (
        <div className="assistant-card__actions">
          {canCheck && (
            <button type="button" className="assistant-card__button" tabIndex={-1} onMouseDown={keep} disabled={busy} onClick={onCheckKey}>
              {w.checkKey}
            </button>
          )}
          {canRetry && (
            <button type="button" className="assistant-card__button" tabIndex={-1} onMouseDown={keep} disabled={busy} onClick={onRetry}>
              {w.tryAgain}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2 2M14 9l2 2" />
    </svg>
  )
}
