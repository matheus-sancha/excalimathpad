import { Fragment, useDeferredValue, useMemo, useState, type MouseEvent, type Ref } from 'react'
import type { DisplaySettings } from '../math/display.ts'
import type { SheetBlock } from '../math/evaluate.ts'
import { planOffer, type MarkedPart } from '../math/rename.ts'
import { useWords } from '../text/words.ts'
import { offerLines, target, type FollowedOffer, type OfferLine } from './renameOffer.ts'

/**
 * The offer's card (docs/spec-v1.md section 4, Renaming a name: The offer, on
 * a committed line; section 13, Rename and Language): "Rename `rho` to
 * `rho_w` in 6 lines?", Rename and Keep rho. The count opens the list of
 * lines, as the form shows it, and a rename that would change a result is
 * said in amber.
 *
 * It takes no keyboard and stops nothing (section 14, 0.5.0): every button is
 * a no-focus control, so an open line keeps its field, its text and its
 * caret. Beside a line it is drawn in the overlay; on a phone it is the row at
 * the top of the bottom sheet (`row`), with the count of offers waiting.
 */
export interface OfferCardProps {
  followed: FollowedOffer
  /** The scene's blocks in reading order, as JSON: the amber check follows them at lower priority. */
  blocks: string
  /** Each element's title, for "Fluid and pipe, line 2". */
  titles: ReadonlyMap<string, string | null>
  settings?: DisplaySettings
  /** On a phone: the row at the top of the bottom sheet, and how many wait. */
  row?: { total: number }
  /** The last press was a touch: buttons for a finger. */
  touch?: boolean
  onRename: () => void
  onKeep: () => void
  ref?: Ref<HTMLDivElement>
}

export function OfferCard({ followed, blocks, titles, settings, row, touch, onRename, onKeep, ref }: OfferCardProps) {
  const { offer, plan } = followed
  const { offer: words } = useWords()
  const [listOpen, setListOpen] = useState(false)
  // "Changes a result" runs the sheet twice: the card is drawn first, and the check follows (section 14).
  const checked = useDeferredValue(blocks)
  const sheet = useMemo(() => JSON.parse(checked) as SheetBlock[], [checked])
  // Keyed by the offer's fields: its object is new after each scene change, and the check waits for the deferred sheet.
  const { anchorId, line, from, to } = offer
  const changes = useMemo(
    () => planOffer(sheet, target({ anchorId, line, from, to, key: 0 }), settings)?.changes ?? [],
    [sheet, anchorId, line, from, to, settings],
  )
  const now = useMemo(() => JSON.parse(blocks) as SheetBlock[], [blocks])
  const count = plan.lines.length
  return (
    <div
      ref={ref}
      className={`math-offer${row ? ' is-row' : ''}${touch ? ' is-touch' : ''}`}
      role="group"
      aria-label={words.ask(offer.from, offer.to, count)}
      data-offer={`${offer.anchorId}:${offer.line}`}
      // A press here isn't the canvas's, and never takes the keyboard from an open line.
      onMouseDown={keepFocus}
    >
      <p className="math-offer__ask">
        {row && row.total > 1 && <span className="math-offer__of">{words.of(1, row.total)}</span>}
        {words
          .question(
            <code>{offer.from}</code>,
            <code>{offer.to}</code>,
            <button
              type="button"
              className="math-offer__count"
              tabIndex={-1}
              aria-expanded={listOpen}
              onClick={() => setListOpen((open) => !open)}
            >
              {words.count(count)}
            </button>,
          )
          // The words and the parts, in the order the language puts them.
          .map((part, i) => (typeof part === 'string' ? part : <Fragment key={i}>{part}</Fragment>))}
      </p>
      {listOpen && <Lines lines={offerLines(plan.lines, now, titles)} label={words.count(count)} />}
      {changes.length > 0 && (
        <>
          <p className="math-offer__results" role="status">
            {words.results(changes.length)}
          </p>
          <Lines lines={offerLines(changes, sheet, titles)} label={words.results(changes.length)} />
        </>
      )}
      <div className="math-offer__actions">
        <button type="button" className="math-offer__button is-primary" tabIndex={-1} onClick={onRename}>
          {words.rename}
        </button>
        <button type="button" className="math-offer__button" tabIndex={-1} onClick={onKeep}>
          {words.keep(offer.from)}
        </button>
      </div>
    </div>
  )
}

const keepFocus = (event: MouseEvent) => event.preventDefault()

function Lines({ lines, label }: { lines: readonly OfferLine[]; label: string }) {
  return (
    <ul className="math-offer__lines" aria-label={label}>
      {lines.map((line) => (
        <li key={line.key} className="math-offer__line">
          <span className="math-offer__where">{line.where}</span>
          <code className="math-offer__source">
            <Parts parts={line.text} />
            {line.stored.length > 0 && (
              <span className="math-offer__stored">
                {' '}
                <Parts parts={line.stored} />
              </span>
            )}
          </code>
        </li>
      ))}
    </ul>
  )
}

function Parts({ parts }: { parts: readonly MarkedPart[] }) {
  return parts.map((part, i) => (part.marked ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>))
}
