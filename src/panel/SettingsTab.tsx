import { useId, useState } from 'react'
import { TEXT_COLORS, type TextColor } from '../math/lineForm.ts'
import type { PageSetting } from '../print/pages.ts'
import {
  isCustom,
  KINDS,
  SLOT_UNITS,
  unitsFor,
  type Kind,
  type UnitSettings,
  type UnitSystemName,
} from '../math/unitSystems.ts'
import { useWords } from '../text/words.ts'

/**
 * The Settings tab (docs/spec-v1.md section 8): the unit system, Custom's
 * kind → unit table, Digits, the Result colour and, from M5, the Page (section
 * 11). A change goes straight to the sheet: it is saved with the sheet and
 * isn't part of undo. Its words, the systems' and the kinds' names included,
 * are the text table's, in the language shown (0.6.0). From 0.6.0 a kind's
 * default option in Custom's table shows its unit or range only: the system
 * is named once, in Starts from (section 5, Unit systems).
 */

/** What the tab edits. */
export interface SettingsValue {
  units: UnitSettings
  digits: number
  resultColor: TextColor
  page: PageSetting
}

const SIZES: PageSetting['size'][] = ['A4', 'Letter']
const ORIENTATIONS: PageSetting['orientation'][] = ['portrait', 'landscape']
const SYSTEMS: UnitSystemName[] = ['si-prefixed', 'si-base', 'uscs']

export function SettingsTab<T extends SettingsValue>({
  settings,
  onChange,
}: {
  settings: T
  onChange: (next: T) => void
}) {
  // Custom with nothing chosen yet still shows its table.
  const [customOpen, setCustomOpen] = useState(false)
  const pageLabel = useId()
  const w = useWords()
  const words = w.panel.settings
  const colors = w.panel.format.colors
  const custom = customOpen || isCustom(settings.units)
  const setUnits = (units: UnitSettings) => onChange({ ...settings, units })
  const base = { ...settings.units, custom: {} }

  return (
    <div className="sheet-panel sheet-settings">
      <label className="sheet-settings__field">
        <span>{words.unitSystem}</span>
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
            <option key={system} value={system}>
              {words.systems[system]}
            </option>
          ))}
          <option value="custom">{words.custom}</option>
        </select>
      </label>

      {custom && (
        <>
          <label className="sheet-settings__field">
            <span>{words.startsFrom}</span>
            <select
              value={settings.units.system}
              onChange={(event) =>
                setUnits({ ...settings.units, system: event.target.value as UnitSystemName })
              }
            >
              {SYSTEMS.map((system) => (
                <option key={system} value={system}>
                  {words.systems[system]}
                </option>
              ))}
            </select>
          </label>
          <table className="sheet-settings__kinds" aria-label={words.customUnits}>
            <tbody>
              {KINDS.map((kind) => (
                <tr key={kind}>
                  <th scope="row">{w.kinds.name[kind]}</th>
                  <td>
                    <select
                      aria-label={w.kinds.name[kind]}
                      value={settings.units.custom[kind] ?? ''}
                      onChange={(event) => setUnits(withKind(settings.units, kind, event.target.value))}
                    >
                      {/* Its unit or range only: the system is named in Starts from (0.6.0). */}
                      <option value="">{fromSystem(base, kind)}</option>
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
        <span>{words.resultColor}</span>
        <select
          value={settings.resultColor}
          onChange={(event) => onChange({ ...settings, resultColor: event.target.value as TextColor })}
        >
          {TEXT_COLORS.map((color) => (
            <option key={color} value={color}>
              {capital(colors[color])}
            </option>
          ))}
        </select>
      </label>

      {/* The Page row (section 11): its two choices one under the other, so both fit at 280 px. */}
      <div className="sheet-settings__field" role="group" aria-labelledby={pageLabel}>
        <span id={pageLabel}>{words.page}</span>
        <span className="sheet-settings__page">
          <select
            aria-label={words.paperSize}
            value={settings.page.size}
            onChange={(event) =>
              onChange({ ...settings, page: { ...settings.page, size: event.target.value as PageSetting['size'] } })
            }
          >
            {SIZES.map((size) => (
              <option key={size} value={size}>
                {words.sizes[size]}
              </option>
            ))}
          </select>
          <select
            aria-label={words.orientation}
            value={settings.page.orientation}
            onChange={(event) =>
              onChange({
                ...settings,
                page: { ...settings.page, orientation: event.target.value as PageSetting['orientation'] },
              })
            }
          >
            {ORIENTATIONS.map((orientation) => (
              <option key={orientation} value={orientation}>
                {words[orientation]}
              </option>
            ))}
          </select>
        </span>
      </div>
    </div>
  )
}

/** A colour's name as a choice: its first letter in capitals, in either language. */
function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
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
  const label = useWords().panel.settings.digits
  return (
    <label className="sheet-settings__field">
      <span>{label}</span>
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
