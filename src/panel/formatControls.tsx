import type { MouseEvent, ReactNode } from 'react'
import { COMMENT_SIZES, FORMAT_COLORS, TEXT_COLORS, type CommentSize, type FormatColor, type TextColor } from '../math/lineForm.ts'
import { useWords } from '../text/words.ts'

/**
 * The Format tab's controls (docs/spec-v1.md section 4, Format tab, M4d): the
 * labelled rows of large buttons, shared by the open line's rows and a rule's
 * in the Rules list. Every one is a no-focus button. Their names are the text
 * table's (`panel.format`), in the language shown; a key stays the same in
 * both, only its name translates (section 13: `Negrito (Ctrl+B)`).
 */

/** Each toggle's glyph; its name is the table's `panel.format[kind]`. */
const TOGGLES = { bold: 'B', italic: 'I', underline: 'U' } as const

export function Toggle({
  kind,
  pressed,
  onPress,
  locked = false,
}: {
  kind: keyof typeof TOGGLES
  pressed: boolean
  onPress: () => void
  /** A rule's last property: pressed, it can't be taken off. */
  locked?: boolean
}) {
  const label = useWords().panel.format[kind]
  const glyph = TOGGLES[kind]
  return (
    <PanelButton
      className={`sheet-format__button is-${kind}`}
      label={label}
      pressed={pressed}
      disabled={locked && pressed}
      onPress={onPress}
    >
      {glyph}
    </PanelButton>
  )
}

/** S M L XL; pressing the pressed size takes it off, back to M. */
export function SizeRow({ size, onChange }: { size: CommentSize; onChange: (size: CommentSize) => void }) {
  const format = useWords().panel.format
  return (
    <Row label={format.rows.size}>
      {COMMENT_SIZES.map((each) => (
        <PanelButton
          key={each}
          className="sheet-format__button is-size"
          label={format.size(each)}
          pressed={size === each}
          onPress={() => onChange(size === each ? 'M' : each)}
        >
          {each}
        </PanelButton>
      ))}
    </Row>
  )
}

/**
 * The six text colours and none; pressing the pressed colour takes it off.
 * `locked`, it is a rule's last property: none is disabled, and the pressed
 * colour stays.
 */
export function TextRow({
  color,
  onChange,
  locked = false,
}: {
  color: TextColor | null
  onChange: (color: TextColor | null) => void
  locked?: boolean
}) {
  const format = useWords().panel.format
  return (
    <SwatchRow
      label={format.rows.text}
      names={TEXT_COLORS}
      nameOf={(each) => format.textColor(format.colors[each])}
      classOf={(each) => `is-text-${each}`}
      none={format.noTextColor}
      color={color}
      onChange={onChange}
      locked={locked}
    />
  )
}

/** The five highlights and none; pressing the pressed highlight takes it off. `locked` as for `TextRow`. */
export function HighlightRow({
  color,
  onChange,
  locked = false,
}: {
  color: FormatColor | null
  onChange: (color: FormatColor | null) => void
  locked?: boolean
}) {
  const format = useWords().panel.format
  return (
    <SwatchRow
      label={format.rows.highlight}
      names={FORMAT_COLORS}
      nameOf={(each) => format.highlightColor(format.colors[each])}
      classOf={(each) => `is-${each}`}
      none={format.noHighlight}
      color={color}
      onChange={onChange}
      locked={locked}
    />
  )
}

function SwatchRow<C extends string>({
  label,
  names,
  nameOf,
  classOf,
  none,
  color,
  onChange,
  locked,
}: {
  label: string
  names: readonly C[]
  /** A swatch's name: "Text red", in the language shown. */
  nameOf: (color: C) => string
  classOf: (color: C) => string
  none: string
  color: C | null
  onChange: (color: C | null) => void
  locked: boolean
}) {
  return (
    <Row label={label}>
      {names.map((each) => (
        <PanelButton
          key={each}
          className={`sheet-format__swatch ${classOf(each)}`}
          label={nameOf(each)}
          pressed={color === each}
          onPress={() => {
            if (color !== each) onChange(each)
            else if (!locked) onChange(null)
          }}
        />
      ))}
      <PanelButton
        className="sheet-format__swatch is-none"
        label={none}
        pressed={color === null}
        disabled={locked}
        onPress={() => onChange(null)}
      />
    </Row>
  )
}

/** One labelled row of buttons. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="sheet-format__row" role="group" aria-label={label}>
      <span className="sheet-format__row-label" aria-hidden="true">
        {label}
      </span>
      <span className="sheet-format__buttons">{children}</span>
    </div>
  )
}

/**
 * A no-focus button (section 14, Panel controls that act on the open line):
 * its `mousedown` is prevented and it is out of the tab order, so the open
 * field keeps the keyboard. Its tooltip names its key, where it has one.
 */
export function PanelButton({
  className,
  label,
  pressed,
  disabled,
  onPress,
  children,
}: {
  className: string
  label: string
  pressed?: boolean
  disabled?: boolean
  onPress: () => void
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      title={label}
      tabIndex={-1}
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

/**
 * A note that quotes a condition or a name (section 8, Sheet panel: longer
 * text wraps): the quoted text never breaks inside, so the line wraps before
 * it (`… enquanto u > 3 m/s.`).
 */
export function KeepWhole({ text, whole }: { text: string; whole: string }) {
  const at = whole === '' ? -1 : text.indexOf(whole)
  if (at === -1) return text
  // The punctuation that closes it goes with it, so a full stop never starts a line.
  const end = at + whole.length + (/^[.,;:]/.exec(text.slice(at + whole.length))?.[0].length ?? 0)
  return (
    <>
      {text.slice(0, at)}
      <span className="sheet-panel__whole">{text.slice(at, end)}</span>
      {text.slice(end)}
    </>
  )
}
