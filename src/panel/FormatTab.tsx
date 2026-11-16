import type { CSSProperties } from 'react'
import type { TitleFormat } from '../canvas/mathAnchor.ts'
import type { CommentFormat, LineFormat, TextColor } from '../math/lineForm.ts'
import { LineSample, TitleSample } from '../overlay/MathElementView.tsx'
import { TEXT_COLOR_VALUES } from '../overlay/textColors.ts'
import { FORMAT_HINTS, formatView, type FormatElement, type FormatTarget } from './formatTab.ts'
import { HighlightRow, PanelButton, Row, SizeRow, TextRow, Toggle } from './formatControls.tsx'
import { RulesList, type RulesActions } from './RulesList.tsx'

/** What the Format tab's presses do: each acts on the open line or title (`LineEditControl`). */
export interface FormatActions extends RulesActions {
  setFormat: (format: LineFormat) => void
  setCommentFormat: (format: CommentFormat) => void
  setTitleFormat: (format: TitleFormat) => void
  moveTo: (target: 'title' | 'first') => void
  move: (direction: 'up' | 'down') => void
  /** Leaves the line, as Esc does. */
  done: () => void
  /** Opens the element's last line, as Enter does. */
  edit: (anchorId: string) => void
}

export interface FormatTabProps {
  sheet: readonly FormatElement[]
  /** What is open; null when nothing is. */
  target: FormatTarget | null
  /** The one math element selected, alone; null otherwise. Edit opens it. */
  selected: string | null
  /** The sheet's result colour, which the sample's results take (section 4, Colours and rules). */
  resultColor?: TextColor
  /** On touch the hint names the taps (section 4, Touch, #147). */
  touch?: boolean
  actions: FormatActions
}

/**
 * The Format tab (docs/spec-v1.md section 4, Format tab, M4d): the only place
 * to format a line or a title, acting on the open one. At the top, a live
 * sample in a light box under a caption naming what is open; beside it the
 * link that moves the edit, and Done, ↑ and ↓. Then one labelled row of large
 * buttons per property the open thing takes. Every control is a no-focus
 * button (section 14): a blur would leave the line. The one field is a rule's
 * condition, in the Rules list, which keeps the line open (M4e).
 */
export function FormatTab({ sheet, target, selected, resultColor = 'blue', touch = false, actions }: FormatTabProps) {
  const view = formatView(sheet, target)

  if (view.kind === 'none') {
    return (
      <div className="sheet-panel sheet-format">
        <div className="sheet-format__hint">
          <p className="sheet-panel__empty">{touch ? FORMAT_HINTS.nothingOpenTouch : FORMAT_HINTS.nothingOpen}</p>
          {selected !== null && (
            <PanelButton className="sheet-format__nav-button" label="Edit (Enter)" onPress={() => actions.edit(selected)}>
              Edit
            </PanelButton>
          )}
        </div>
      </div>
    )
  }

  const sample =
    view.kind === 'title' ? (
      <TitleSample title={view.text} format={view.format} />
    ) : (
      view.line && <LineSample text={view.text} line={view.line} />
    )

  return (
    <div className="sheet-panel sheet-format">
      <section className="sheet-format__sample" aria-label="Sample">
        <p className="sheet-format__caption">{view.caption}</p>
        <div
          className="sheet-format__drawing"
          style={{ '--math-result': TEXT_COLOR_VALUES[resultColor] } as CSSProperties}
        >
          {sample}
        </div>
      </section>
      <div className="sheet-format__nav" role="toolbar" aria-label="Move the edit">
        <PanelButton
          className="sheet-format__link"
          label={view.link}
          onPress={() => actions.moveTo(view.kind === 'title' ? 'first' : 'title')}
        >
          {view.link}
        </PanelButton>
        <span className="sheet-format__nav-keys">
          <PanelButton className="sheet-format__nav-button" label="Done (Esc)" onPress={actions.done}>
            Done
          </PanelButton>
          <PanelButton className="sheet-format__nav-button" label="Up (↑)" onPress={() => actions.move('up')}>
            ↑
          </PanelButton>
          <PanelButton className="sheet-format__nav-button" label="Down (↓)" onPress={() => actions.move('down')}>
            ↓
          </PanelButton>
        </span>
      </div>
      {view.kind === 'math' &&
        view.overrides.map((note) => (
          <p key={note} className="sheet-format__override">
            {note}
          </p>
        ))}
      {view.kind === 'blank' && <p className="sheet-panel__empty">{FORMAT_HINTS.noFormat}</p>}
      {view.kind === 'math' && <MathRows format={view.format} onChange={actions.setFormat} />}
      {view.kind === 'math' && (
        <RulesList
          // A new line starts with every rule's controls closed.
          key={`${view.anchorId}:${target?.lineIndex}`}
          rules={view.rules}
          states={view.ruleStates}
          name={view.ruleName}
          actions={actions}
        />
      )}
      {view.kind === 'comment' && <CommentRows format={view.format} onChange={actions.setCommentFormat} />}
      {view.kind === 'title' && <TitleRows format={view.format} onChange={actions.setTitleFormat} />}
    </div>
  )
}

/** A math line: Style (B, U), Text and Highlight. */
function MathRows({ format, onChange }: { format: LineFormat; onChange: (format: LineFormat) => void }) {
  return (
    <>
      <Row label="Style">
        <Toggle kind="bold" pressed={format.bold} onPress={() => onChange({ ...format, bold: !format.bold })} />
        <Toggle
          kind="underline"
          pressed={format.underline}
          onPress={() => onChange({ ...format, underline: !format.underline })}
        />
      </Row>
      <TextRow color={format.textColor} onChange={(textColor) => onChange({ ...format, textColor })} />
      <HighlightRow color={format.color} onChange={(color) => onChange({ ...format, color })} />
    </>
  )
}

/** A comment line: Style (B, I pressed unless `@upright`, U), Size, Text and Highlight. */
function CommentRows({ format, onChange }: { format: CommentFormat; onChange: (format: CommentFormat) => void }) {
  return (
    <>
      <Row label="Style">
        <Toggle kind="bold" pressed={format.bold} onPress={() => onChange({ ...format, bold: !format.bold })} />
        <Toggle kind="italic" pressed={!format.upright} onPress={() => onChange({ ...format, upright: !format.upright })} />
        <Toggle
          kind="underline"
          pressed={format.underline}
          onPress={() => onChange({ ...format, underline: !format.underline })}
        />
      </Row>
      <SizeRow size={format.size} onChange={(size) => onChange({ ...format, size })} />
      <TextRow color={format.textColor} onChange={(textColor) => onChange({ ...format, textColor })} />
      <HighlightRow color={format.color} onChange={(color) => onChange({ ...format, color })} />
    </>
  )
}

const ALIGNS = [
  ['left', 'Align left', '⇤'],
  ['centre', 'Centre', '↔'],
  ['right', 'Align right', '⇥'],
] as const

/** The title: Style (B pressed by default, I, U), Size, Align, Text and Highlight. Its "no text colour" is black. */
function TitleRows({ format, onChange }: { format: TitleFormat; onChange: (format: TitleFormat) => void }) {
  return (
    <>
      <Row label="Style">
        <Toggle kind="bold" pressed={format.bold} onPress={() => onChange({ ...format, bold: !format.bold })} />
        <Toggle kind="italic" pressed={format.italic} onPress={() => onChange({ ...format, italic: !format.italic })} />
        <Toggle
          kind="underline"
          pressed={format.underline}
          onPress={() => onChange({ ...format, underline: !format.underline })}
        />
      </Row>
      <SizeRow size={format.size} onChange={(size) => onChange({ ...format, size })} />
      <Row label="Align">
        {ALIGNS.map(([align, label, glyph]) => (
          <PanelButton
            key={align}
            className="sheet-format__button"
            label={label}
            pressed={format.align === align}
            // Pressing the pressed alignment takes it off: left, the default.
            onPress={() => onChange({ ...format, align: format.align === align ? 'left' : align })}
          >
            {glyph}
          </PanelButton>
        ))}
      </Row>
      <TextRow
        color={format.color === 'black' ? null : format.color}
        onChange={(color) => onChange({ ...format, color: color ?? 'black' })}
      />
      <HighlightRow color={format.highlight} onChange={(highlight) => onChange({ ...format, highlight })} />
    </>
  )
}
