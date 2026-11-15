import type { MouseEvent, ReactNode } from 'react'
import { COMMENT_SIZES, FORMAT_COLORS, TEXT_COLORS, type CommentSize, type FormatColor, type TextColor } from '../math/lineForm.ts'

/**
 * The Format tab's controls (docs/spec-v1.md section 4, Format tab, M4d): the
 * labelled rows of large buttons, shared by the open line's rows and a rule's
 * in the Rules list. Every one is a no-focus button.
 */

const TOGGLES = {
  bold: ['Bold (Ctrl+B)', 'B'],
  italic: ['Italic (Ctrl+I)', 'I'],
  underline: ['Underline (Ctrl+U)', 'U'],
} as const

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
  const [label, glyph] = TOGGLES[kind]
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
  return (
    <Row label="Size">
      {COMMENT_SIZES.map((each) => (
        <PanelButton
          key={each}
          className="sheet-format__button is-size"
          label={`Size ${each}`}
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
  return (
    <SwatchRow
      label="Text"
      names={TEXT_COLORS}
      prefix="Text "
      classOf={(each) => `is-text-${each}`}
      none="No text colour"
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
  return (
    <SwatchRow
      label="Highlight"
      names={FORMAT_COLORS}
      prefix="Highlight "
      classOf={(each) => `is-${each}`}
      none="No highlight"
      color={color}
      onChange={onChange}
      locked={locked}
    />
  )
}

function SwatchRow<C extends string>({
  label,
  names,
  prefix,
  classOf,
  none,
  color,
  onChange,
  locked,
}: {
  label: string
  names: readonly C[]
  prefix: string
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
          label={`${prefix}${each}`}
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
