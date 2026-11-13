import { useState } from 'react'
import { TEXT_COLORS, type TextColor } from '../math/lineForm.ts'
import {
  isCustom,
  KIND_LABELS,
  KINDS,
  SLOT_UNITS,
  unitsFor,
  type Kind,
  type UnitSettings,
  type UnitSystemName,
} from '../math/unitSystems.ts'

/**
 * The Settings tab (docs/spec-v1.md section 8): the unit system, Custom's
 * kind → unit table, Digits and the Result colour. A change goes straight to the sheet: it
 * re-shows every result, is saved with the sheet and isn't part of undo. The
 * Page row arrives in M5.
 */

/** What the tab edits; the sheet's settings carry more (the page). */
export interface SettingsValue {
  units: UnitSettings
  digits: number
  resultColor: TextColor
}

const SYSTEMS: { value: UnitSystemName; label: string }[] = [
  { value: 'si-prefixed', label: 'SI with prefixes' },
  { value: 'si-base', label: 'SI base units' },
  { value: 'uscs', label: 'USCS' },
]

export function SettingsTab<T extends SettingsValue>({
  settings,
  onChange,
}: {
  settings: T
  onChange: (next: T) => void
}) {
  // Custom with nothing chosen yet still shows its table.
  const [customOpen, setCustomOpen] = useState(false)
  const custom = customOpen || isCustom(settings.units)
  const setUnits = (units: UnitSettings) => onChange({ ...settings, units })
  const base = { ...settings.units, custom: {} }
  const systemLabel = (system: UnitSystemName) => SYSTEMS.find((s) => s.value === system)?.label

  return (
    <div className="sheet-panel sheet-settings">
      <label className="sheet-settings__field">
        <span>Unit system</span>
        <select
          value={custom ? 'custom' : settings.units.system}
          onChange={(event) => {
            const value = event.target.value
            if (value === 'custom') {
              setCustomOpen(true)
            } else {
              setCustomOpen(false)
              setUnits({ system: value as UnitSystemName, custom: {} })
            }
          }}
        >
          {SYSTEMS.map((system) => (
            <option key={system.value} value={system.value}>
              {system.label}
            </option>
          ))}
          <option value="custom">Custom</option>
        </select>
      </label>

      {custom && (
        <>
          <label className="sheet-settings__field">
            <span>Starts from</span>
            <select
              value={settings.units.system}
              onChange={(event) =>
                setUnits({ ...settings.units, system: event.target.value as UnitSystemName })
              }
            >
              {SYSTEMS.map((system) => (
                <option key={system.value} value={system.value}>
                  {system.label}
                </option>
              ))}
            </select>
          </label>
          <table className="sheet-settings__kinds" aria-label="Custom units">
            <tbody>
              {KINDS.map((kind) => (
                <tr key={kind}>
                  <th scope="row">{KIND_LABELS[kind]}</th>
                  <td>
                    <select
                      aria-label={KIND_LABELS[kind]}
                      value={settings.units.custom[kind] ?? ''}
                      onChange={(event) => setUnits(withKind(settings.units, kind, event.target.value))}
                    >
                      <option value="">
                        {`${systemLabel(settings.units.system)}: ${fromSystem(base, kind)}`}
                      </option>
                      {SLOT_UNITS[kind].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <DigitsField digits={settings.digits} onChange={(digits) => onChange({ ...settings, digits })} />

      <label className="sheet-settings__field">
        <span>Result colour</span>
        <select
          value={settings.resultColor}
          onChange={(event) => onChange({ ...settings, resultColor: event.target.value as TextColor })}
        >
          {TEXT_COLORS.map((color) => (
            <option key={color} value={color}>
              {color[0].toUpperCase() + color.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** What the system shows a kind in, before Custom: one unit, or its prefixed range. */
function fromSystem(units: UnitSettings, kind: Kind): string {
  const list = unitsFor(units, kind)
  return list.length === 1 ? list[0] : `${list[0]} … ${list[list.length - 1]}`
}

function withKind(units: UnitSettings, kind: Kind, unit: string): UnitSettings {
  const custom = { ...units.custom }
  if (unit) custom[kind] = unit
  else delete custom[kind]
  return { ...units, custom }
}

/** Digits, an integer from 2 to 15; anything else typed isn't applied. */
function DigitsField({ digits, onChange }: { digits: number; onChange: (digits: number) => void }) {
  const [typed, setTyped] = useState<string | null>(null)
  const valid = (text: string) => /^\d+$/.test(text) && Number(text) >= 2 && Number(text) <= 15
  const text = typed ?? String(digits)
  return (
    <label className="sheet-settings__field">
      <span>Digits</span>
      <input
        type="number"
        min={2}
        max={15}
        step={1}
        value={text}
        aria-invalid={!valid(text)}
        onChange={(event) => {
          const next = event.target.value
          setTyped(next)
          if (valid(next)) onChange(Number(next))
        }}
        onBlur={() => setTyped(null)}
      />
    </label>
  )
}
