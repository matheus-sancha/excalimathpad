import { useState } from 'react'
import type { RuleState } from '../math/evaluate.ts'
import { applyFormatWord, formatWords, NO_FORMAT, type FormatRule, type LineFormat } from '../math/lineForm.ts'
import type { RuleEdit } from '../overlay/MathOverlay.tsx'
import { HighlightRow, PanelButton, Row, TextRow, Toggle } from './formatControls.tsx'

/** What the Rules list's presses do: each acts on the open line (`LineEditControl`). */
export interface RulesActions {
  setRules: (rows: readonly RuleEdit[]) => void
  caretToRule: (index: number) => void
  addRule: (name: string | null) => void
}

export interface RulesListProps {
  rules: readonly FormatRule[]
  /** Each rule's live state; null while the evaluation hasn't caught up with the typed rules. */
  states: readonly RuleState[] | null
  /** What + Add rule names: null on a table line, which writes ` @text-red if ` alone. */
  name: string | null
  actions: RulesActions
}

/**
 * The Rules list (docs/spec-v1.md section 4, Rules list, M4d): on a math line,
 * under the Format tab's rows, one row per rule in the line's order, the first
 * true winning, top to bottom. A row holds its format chip, which opens that
 * rule's Text, Highlight and Style rows; its condition, read-only, which puts
 * the caret at its end; ↑ ↓ and ✕; and its live state. The condition is typed
 * in the line itself, so nothing here takes the keyboard. A row the list
 * changes is written as one joined word and one condition; the others keep
 * their exact text.
 */
export function RulesList({ rules, states, name, actions }: RulesListProps) {
  // The rule whose format controls are open.
  const [open, setOpen] = useState<number | null>(null)

  const unchanged = (rule: FormatRule, from: number): RuleEdit => ({ ...rule, from })
  const write = (rows: RuleEdit[]) => actions.setRules(rows)
  const formatOf = (rule: FormatRule): LineFormat => rule.words.reduce(applyFormatWord, NO_FORMAT)
  const setFormat = (index: number, format: LineFormat) =>
    write(
      rules.map((rule, from) =>
        from === index ? { words: formatWords(format), condition: rule.condition, text: null, from } : unchanged(rule, from),
      ),
    )
  const move = (index: number, by: -1 | 1) => {
    const to = index + by
    if (to < 0 || to >= rules.length) return
    const rows = rules.map(unchanged)
    ;[rows[index], rows[to]] = [rows[to], rows[index]]
    write(rows)
    if (open === index) setOpen(to)
    else if (open === to) setOpen(index)
  }
  const remove = (index: number) => {
    write(rules.map(unchanged).filter(({ from }) => from !== index))
    setOpen((current) => (current === null || current === index ? null : current > index ? current - 1 : current))
  }

  return (
    <section className="sheet-rules" aria-label="Rules">
      <p className="sheet-rules__header">
        <span className="sheet-rules__title">Rules</span>
        <span className="sheet-rules__hint">first true wins, top to bottom</span>
      </p>
      {rules.length > 0 && (
        <ol className="sheet-rules__list">
          {rules.map((rule, index) => {
            const format = formatOf(rule)
            const state = states?.[index]
            const n = index + 1
            return (
              <li key={index} className="sheet-rules__item" aria-label={`Rule ${n}: ${rule.text}`}>
                <div className="sheet-rules__row">
                  <PanelButton
                    className={`sheet-rules__chip${chipClasses(format)}`}
                    label={`Format of rule ${n}`}
                    pressed={open === index}
                    onPress={() => setOpen(open === index ? null : index)}
                  >
                    Aa
                  </PanelButton>
                  <PanelButton
                    className="sheet-rules__condition"
                    label={`Condition of rule ${n}: ${rule.condition || 'none yet'}`}
                    onPress={() => actions.caretToRule(index)}
                  >
                    <span className="sheet-rules__if">if</span> {rule.condition || '…'}
                  </PanelButton>
                  {state && <RuleStateText state={state} />}
                  <span className="sheet-rules__keys">
                    <PanelButton
                      className="sheet-rules__key"
                      label={`Move rule ${n} up`}
                      disabled={index === 0}
                      onPress={() => move(index, -1)}
                    >
                      ↑
                    </PanelButton>
                    <PanelButton
                      className="sheet-rules__key"
                      label={`Move rule ${n} down`}
                      disabled={index === rules.length - 1}
                      onPress={() => move(index, 1)}
                    >
                      ↓
                    </PanelButton>
                    <PanelButton className="sheet-rules__key" label={`Remove rule ${n}`} onPress={() => remove(index)}>
                      ✕
                    </PanelButton>
                  </span>
                </div>
                {open === index && <RuleFormat format={format} onChange={(next) => setFormat(index, next)} n={n} />}
              </li>
            )
          })}
        </ol>
      )}
      <PanelButton
        className="sheet-rules__add"
        label="+ Add rule"
        onPress={() => {
          actions.addRule(name)
          // The new rule is last; its format controls open at once.
          setOpen(rules.length)
        }}
      >
        + Add rule
      </PanelButton>
    </section>
  )
}

/** A rule's Text, Highlight and Style rows. Its last property can't be taken off: ✕ removes the rule. */
function RuleFormat({ format, onChange, n }: { format: LineFormat; onChange: (format: LineFormat) => void; n: number }) {
  const last = [format.textColor, format.color, format.bold || null, format.underline || null].filter(Boolean).length === 1
  return (
    <div className="sheet-rules__format" role="group" aria-label={`Rule ${n} format`}>
      <TextRow
        color={format.textColor}
        locked={last && format.textColor !== null}
        onChange={(textColor) => onChange({ ...format, textColor })}
      />
      <HighlightRow
        color={format.color}
        locked={last && format.color !== null}
        onChange={(color) => onChange({ ...format, color })}
      />
      <Row label="Style">
        <Toggle kind="bold" pressed={format.bold} locked={last} onPress={() => onChange({ ...format, bold: !format.bold })} />
        <Toggle
          kind="underline"
          pressed={format.underline}
          locked={last}
          onPress={() => onChange({ ...format, underline: !format.underline })}
        />
      </Row>
    </div>
  )
}

/** A rule's live state, beside its condition. */
function RuleStateText({ state }: { state: RuleState }) {
  switch (state.kind) {
    case 'true':
    case 'false':
      return <span className={`sheet-rules__state is-${state.kind}`}>{state.kind}</span>
    case 'overridden':
      return <span className="sheet-rules__state is-overridden">true, overridden</span>
    case 'count':
      return (
        <span className="sheet-rules__state is-count">
          {state.count} of {state.of} {state.unit}
        </span>
      )
    case 'warning':
      return <span className="sheet-rules__state is-warning">⚠ {state.message}</span>
  }
}

/** A chip drawn in its rule's format: the classes the swatches and a row use. */
function chipClasses({ bold, underline, color, textColor }: LineFormat): string {
  return `${bold ? ' is-bold' : ''}${underline ? ' is-underline' : ''}${color ? ` is-${color}` : ''}${
    textColor ? ` is-text-${textColor}` : ''
  }`
}
