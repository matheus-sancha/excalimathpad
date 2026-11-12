/**
 * The unit systems (docs/spec-v1.md section 5, Unit systems): the kinds a
 * result can be, and the unit each system shows a kind in. Pure data, with no
 * math.js: units are written as math.js reads them.
 *
 * A kind not listed here shows in composed base units of the system
 * (`kg / (m s)`); so does any kind whose unit a system leaves out.
 */

export const KINDS = [
  'length',
  'area',
  'volume',
  'volumeFlow',
  'massFlow',
  'velocity',
  'acceleration',
  'force',
  'pressure',
  'energy',
  'power',
  'density',
  'dynamicViscosity',
  'kinematicViscosity',
  'frequency',
  'mass',
  'time',
  'temperature',
] as const

export type Kind = (typeof KINDS)[number]

/** One SI unit of each kind, which fixes the kind's dimension. */
export const KIND_REFERENCE: Record<Kind, string> = {
  length: 'm',
  area: 'm^2',
  volume: 'm^3',
  volumeFlow: 'm^3/s',
  massFlow: 'kg/s',
  velocity: 'm/s',
  acceleration: 'm/s^2',
  force: 'N',
  pressure: 'Pa',
  energy: 'J',
  power: 'W',
  density: 'kg/m^3',
  dynamicViscosity: 'Pa s',
  kinematicViscosity: 'm^2/s',
  frequency: 'Hz',
  mass: 'kg',
  time: 's',
  temperature: 'K',
}

export type UnitSystemName = 'si-prefixed' | 'si-base' | 'uscs'

/** The sheet's unit settings (section 7): a system, and Custom's per-kind units. */
export interface UnitSettings {
  system: UnitSystemName
  /** Kind → unit. Non-empty makes the system Custom; other kinds follow `system`. */
  custom: Readonly<Partial<Record<string, string>>>
}

/**
 * SI with prefixes: each kind's units from small to large. A result shows in
 * the largest one that keeps its number at 1 or above, so the number stays
 * between 1 and 1000 where the steps allow (`45.43 kPa`, `1.002 mPa s`); one
 * below the smallest unit shows in that.
 */
export const SI_PREFIXED: Record<Kind, readonly string[]> = {
  length: ['um', 'mm', 'm', 'km'],
  area: ['mm^2', 'cm^2', 'm^2', 'km^2'],
  volume: ['mm^3', 'cm^3', 'L', 'm^3'],
  volumeFlow: ['mL/s', 'L/s', 'm^3/s'],
  massFlow: ['g/s', 'kg/s'],
  velocity: ['mm/s', 'm/s', 'km/s'],
  acceleration: ['m/s^2'],
  force: ['mN', 'N', 'kN', 'MN'],
  pressure: ['Pa', 'kPa', 'MPa', 'GPa'],
  energy: ['mJ', 'J', 'kJ', 'MJ', 'GJ'],
  power: ['mW', 'W', 'kW', 'MW', 'GW'],
  density: ['kg/m^3'],
  dynamicViscosity: ['uPa s', 'mPa s', 'Pa s'],
  kinematicViscosity: ['mm^2/s', 'm^2/s'],
  frequency: ['Hz', 'kHz', 'MHz', 'GHz'],
  mass: ['mg', 'g', 'kg', 'tonne'],
  time: ['us', 'ms', 's'],
  temperature: ['K'],
}

/** SI base units: no prefixes (`4.543·10⁴ Pa`, `5412 W`). */
export const SI_BASE: Record<Kind, string> = { ...KIND_REFERENCE }

/** USCS: ft, ft², ft³/s, ft/s, psi, hp, lb/ft³ and so on. */
export const USCS: Record<Kind, string> = {
  length: 'ft',
  area: 'ft^2',
  volume: 'ft^3',
  volumeFlow: 'ft^3/s',
  massFlow: 'lbm/s',
  velocity: 'ft/s',
  acceleration: 'ft/s^2',
  force: 'lbf',
  pressure: 'psi',
  energy: 'BTU',
  power: 'hp',
  density: 'lbm/ft^3',
  dynamicViscosity: 'lbf s/ft^2',
  kinematicViscosity: 'ft^2/s',
  frequency: 'Hz',
  mass: 'lbm',
  time: 's',
  temperature: 'degR',
}

/**
 * Named SI units for dimensions off the kinds list (electrical), shown in
 * every system before falling back to composed base units: `I * R` is `20 V`,
 * not `20 (kg m^2) / (s^3 A)`. SI with prefixes picks among the prefixes, as
 * for a kind. (An engineering addition to section 5's rule, from the Mathcad
 * research's formatter: a derived unit of the system that names the dimension.)
 */
export const NAMED_SI_UNITS = ['A', 'C', 'V', 'ohm', 'F', 'H', 'S', 'Wb', 'T'] as const

const SI_PREFIXES = ['p', 'n', 'u', 'm', '', 'k', 'M', 'G'] as const

/** A named SI unit's choices in a system, from small to large. */
export function namedUnitsFor(settings: UnitSettings, name: string): readonly string[] {
  return settings.system === 'si-prefixed' ? SI_PREFIXES.map((prefix) => `${prefix}${name}`) : [name]
}

/**
 * The base unit of each of math.js's base dimensions, in its order (mass,
 * length, time, current, temperature, luminous intensity, amount, angle,
 * bit), for a kind not on the list: composed, they are the result's unit.
 */
export const BASE_UNITS: Record<'si' | 'uscs', readonly string[]> = {
  si: ['kg', 'm', 's', 'A', 'K', 'cd', 'mol', 'rad', 'bits'],
  uscs: ['lbm', 'ft', 's', 'A', 'degR', 'cd', 'mol', 'rad', 'bits'],
}

/** The units a system offers for a kind, from small to large; one unless prefixed. */
export function unitsFor(settings: UnitSettings, kind: Kind): readonly string[] {
  const custom = settings.custom[kind]
  if (custom) return [custom]
  switch (settings.system) {
    case 'si-prefixed':
      return SI_PREFIXED[kind]
    case 'si-base':
      return [SI_BASE[kind]]
    case 'uscs':
      return [USCS[kind]]
  }
}

/** The system whose base units a kind off the list composes from. */
export function baseSystem(settings: UnitSettings): 'si' | 'uscs' {
  return settings.system === 'uscs' ? 'uscs' : 'si'
}

/** Each kind's name, as the Settings tab and the unit slot show it. */
export const KIND_LABELS: Record<Kind, string> = {
  length: 'Length',
  area: 'Area',
  volume: 'Volume',
  volumeFlow: 'Volume flow',
  massFlow: 'Mass flow',
  velocity: 'Velocity',
  acceleration: 'Acceleration',
  force: 'Force',
  pressure: 'Pressure',
  energy: 'Energy, torque',
  power: 'Power',
  density: 'Density',
  dynamicViscosity: 'Dynamic viscosity',
  kinematicViscosity: 'Kinematic viscosity',
  frequency: 'Frequency',
  mass: 'Mass',
  time: 'Time',
  temperature: 'Temperature',
}

/**
 * The units offered for each kind (section 5, Unit slot: a fixed list in app
 * code), in Custom's table and the unit slot's list. The app units join their
 * kinds' lists (section 5, App units).
 */
export const SLOT_UNITS: Record<Kind, readonly string[]> = {
  length: ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'],
  area: ['mm^2', 'cm^2', 'm^2', 'km^2', 'in^2', 'ft^2'],
  volume: ['mL', 'L', 'm^3', 'in^3', 'ft^3', 'gal'],
  volumeFlow: ['L/s', 'L/minute', 'm^3/s', 'm^3/hr', 'ft^3/s', 'gpm', 'cfm'],
  massFlow: ['kg/s', 'kg/hr', 'tonne/hr', 'lbm/s', 'lbm/hr'],
  velocity: ['mm/s', 'm/s', 'km/hr', 'ft/s', 'mi/hr'],
  acceleration: ['m/s^2', 'ft/s^2'],
  force: ['N', 'kN', 'MN', 'lbf', 'kgf', 'tonf', 'tf'],
  pressure: ['Pa', 'kPa', 'MPa', 'mbar', 'bar', 'psi', 'atm'],
  // Torque has energy's dimension, so its units are offered here too: a
  // result can't tell the app which of the two it is.
  energy: ['J', 'kJ', 'MJ', 'kWh', 'BTU', 'kcal', 'N m', 'kN m', 'lbf ft', 'lbf in'],
  power: ['W', 'kW', 'MW', 'hp', 'BTU/hr'],
  density: ['kg/m^3', 'g/cm^3', 'lbm/ft^3'],
  dynamicViscosity: ['Pa s', 'mPa s', 'cP', 'poise'],
  kinematicViscosity: ['m^2/s', 'mm^2/s', 'cSt', 'St'],
  frequency: ['Hz', 'kHz', 'rpm'],
  mass: ['g', 'kg', 'tonne', 'lbm'],
  time: ['ms', 's', 'minute', 'hr', 'day'],
  temperature: ['K', 'degC', 'degF', 'degR'],
}

/** The unit settings' system name for the Settings tab: Custom when any kind is chosen. */
export function isCustom(settings: UnitSettings): boolean {
  return Object.values(settings.custom).some((unit) => unit)
}
