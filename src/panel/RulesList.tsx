import { useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import { isLineField } from '../canvas/panelPresses.ts'
import type { RuleState } from '../math/evaluate.ts'
import {
  applyFormatWord,
  conditionText,
  formatWords,
  newRule,
  NO_FORMAT,
  type FormatRule,
  type LineFormat,
  type RuleRow,
} from '../math/lineForm.ts'
import type { Suggested } from '../overlay/suggest.ts'
import { ConditionField } from './ConditionField.tsx'
import { HighlightRow, PanelButton, Row, TextRow, Toggle } from './formatControls.tsx'
import { FORMAT_HINTS } from './formatTab.ts'

/** What the Rules list does: each acts on the open line (`LineEditControl`). */
export interface RulesActions {
  /** A press: the rows are written to the line's stored format, one undo step. */
  setRules: (rows: readonly RuleRow[]) => void
  /** A condition being typed: the sheet runs from the rows, and nothing is written yet. */
  typeRules: (rows: readonly RuleRow[]) => void
  /** Enter, or the keyboard back in the line: the typed condition is written, one undo step. */
  saveRules: () => void
  /** The keyboard left a condition for something that isn't the line: the edit leaves the line, as from its own field. */
  leave: () => void
  /** The suggestions the open line's field offers. */
  suggest: (text: string, caret: number) => Suggested | null
}

export interface RulesListProps {
  /** The line's rules: those typed in its text first, then the stored ones. */
  rules: readonly FormatRule[]
  /** Each rule's live state; null while the evaluation hasn't caught up with the rules. */
  states: readonly RuleState[] | null
  /** What + Add rule names: null on a table line, whose new rule starts with no condition. */
  name: string | null
  actions: RulesActions
}

/**
 * The Rules list (docs/spec-v1.md section 4, Rules list): on a math line,
 * under the Format tab's rows, one row per rule in the line's order, the first
 * true winning, top to bottom. A row holds its format chip, which opens that
 * rule's Text, Highlight and Style rows; its condition, in a text field (M4e);
 * ↑ ↓ and ✕; and its live state, which follows the field as it is typed. The
 * condition's field is the one control here that takes the keyboard, and the
 * open line stays open while it has it. Every write goes to the line's stored
 * format: a row the list changes is written as one joined word and one
 * condition; the others keep their exact text.
 */
export function RulesList({ rules, states, name, actions }: RulesListProps) {
  // The rule whose format controls are open.
  const [open, setOpen] = useState<number | null>(null)
  // The condition being typed, as typed: a rule's own is trimmed, which would eat a space as it is typed.
  const [typing, setTyping] = useState<{ index: number; text: string } | null>(null)
  const fields = useRef(new Map<number, HTMLInputElement>())
  // + Add rule's new row takes the keyboard once it is drawn, the caret after its condition.
  const toFocus = useRef<number | null>(null)
  useLayoutEffect(() => {
    const field = toFocus.current === null ? undefined : fields.current.get(toFocus.current)
    if (!field) return
    toFocus.current = null
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  })

  const formatOf = (rule: FormatRule): LineFormat => rule.words.reduce(applyFormatWord, NO_FORMAT)
  /** A press: what was being typed is written with it, so the field shows the rule's own condition again. */
  const write = (rows: readonly RuleRow[]) => {
    setTyping(null)
    actions.setRules(rows)
  }
  const setFormat = (index: number, format: LineFormat) =>
    write(
      rules.map((rule, at): RuleRow =>
        at === index ? { words: formatWords(format), condition: rule.condition, text: null } : rule,
      ),
    )
  const move = (index: number, by: -1 | 1) => {
    const to = index + by
    if (to < 0 || to >= rules.length) return
    const rows: RuleRow[] = [...rules]
    ;[rows[index], rows[to]] = [rows[to], rows[index]]
    write(rows)
    if (open === index) setOpen(to)
    else if (open === to) setOpen(index)
  }
  const remove = (index: number) => {
    write(rules.filter((_, at) => at !== index))
    setOpen((current) => (current === null || current === index ? null : current > index ? current - 1 : current))
  }
  const add = () => {
    const row = newRule(name)
    actions.setRules([...rules, row])
    // The new rule is last, its format controls open, its condition ready to go on: `v ` and the caret.
    setOpen(rules.length)
    setTyping({ index: rules.length, text: row.condition === '' ? '' : `${row.condition} ` })
    toFocus.current = rules.length
  }
  const type = (index: number, typed: string) => {
    const text = conditionText(typed)
    setTyping({ index, text })
    actions.typeRules(
      rules.map((rule, at): RuleRow =>
        // A rule whose condition is as it was keeps its exact text.
        at === index && text.trim() !== rule.condition ? { words: rule.words, condition: text.trim(), text: null } : rule,
      ),
    )
  }
  const blur = (index: number, event: FocusEvent<HTMLInputElement>) => {
    const field = event.currentTarget
    // Not another row's: + Add rule's new row may already hold its start.
    setTyping((now) => (now?.index === index ? null : now))
    // Saved when the field loses the keyboard. The line stays open when the
    // keyboard went back to it or to another condition, when the window lost
    // focus, or when the field itself went (its rule removed, the tab changed);
    // anything else has left the line, as a blur of its own field does.
    const stays =
      isLineField(event.relatedTarget) || field.ownerDocument.activeElement === field || !field.isConnected
    if (stays) actions.saveRules()
    else actions.leave()
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
            const n = index + 1
            const condition = typing?.index === index ? typing.text : rule.condition
            // An empty condition removes nothing: its row says what it needs (section 13, Panel).
            const state: RuleState | undefined =
              condition.trim() === '' ? { kind: 'warning', message: FORMAT_HINTS.noCondition } : states?.[index]
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
                  <div className="sheet-rules__condition">
                    <span className="sheet-rules__if">if</span>
                    <ConditionField
                      label={`Condition of rule ${n}`}
                      value={condition}
                      fieldRef={(field) => {
                        if (field) fields.current.set(index, field)
                        else fields.current.delete(index)
                      }}
                      onType={(text) => type(index, text)}
                      onEnter={actions.saveRules}
                      onBlur={(event) => blur(index, event)}
                      suggest={actions.suggest}
                    />
                  </div>
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
      <PanelButton className="sheet-rules__add" label="+ Add rule" onPress={add}>
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
