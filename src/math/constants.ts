/**
 * The built-in constants (docs/spec-v1.md section 5, Constants): every
 * constant math.js has, in groups, each with what it is. Pure data, with no
 * math.js: `name` is the name math.js gives it, as a line reads it.
 *
 * A constant with a `short` name can also be written that way, as in Mathcad
 * (`c`, `k`, `R`): the engine registers the short names once at setup, beside
 * the long ones. Standard gravity has none: `g` is the gram, so it stays
 * `gravity`. `h` is Planck's constant, so the hour is written `hr`.
 */
export interface ConstantEntry {
  /** math.js's name, always readable in a line. */
  name: string
  /** The short name it can also be written by. */
  short?: string
  /** What it is, in a few words. */
  label: string
}

export interface ConstantGroup {
  label: string
  constants: readonly ConstantEntry[]
}

export const CONSTANT_GROUPS: readonly ConstantGroup[] = [
  {
    label: 'Mathematical',
    constants: [
      { name: 'pi', label: 'Circle circumference over diameter' },
      { name: 'tau', label: '2π' },
      { name: 'e', label: "Euler's number" },
      { name: 'phi', label: 'Golden ratio' },
      { name: 'i', label: 'Imaginary unit' },
      { name: 'Infinity', label: 'Infinity' },
      { name: 'SQRT2', label: 'Square root of 2' },
      { name: 'SQRT1_2', label: 'Square root of ½' },
      { name: 'LN2', label: 'Natural logarithm of 2' },
      { name: 'LN10', label: 'Natural logarithm of 10' },
      { name: 'LOG2E', label: 'Base-2 logarithm of e' },
      { name: 'LOG10E', label: 'Base-10 logarithm of e' },
    ],
  },
  {
    label: 'Universal',
    constants: [
      { name: 'speedOfLight', short: 'c', label: 'Speed of light in vacuum' },
      { name: 'gravitationConstant', short: 'G', label: 'Newtonian constant of gravitation' },
      { name: 'planckConstant', short: 'h', label: 'Planck constant' },
      { name: 'reducedPlanckConstant', short: 'hbar', label: 'Reduced Planck constant' },
    ],
  },
  {
    label: 'Adopted values',
    constants: [
      { name: 'gravity', label: 'Standard acceleration of gravity' },
      { name: 'molarMass', label: 'Molar mass constant' },
      { name: 'molarMassC12', label: 'Molar mass of carbon-12' },
    ],
  },
  {
    label: 'Physico-chemical',
    constants: [
      { name: 'gasConstant', short: 'R', label: 'Molar gas constant' },
      { name: 'boltzmann', short: 'k', label: 'Boltzmann constant' },
      { name: 'avogadro', short: 'N_A', label: 'Avogadro constant' },
      { name: 'stefanBoltzmann', short: 'sigma', label: 'Stefan–Boltzmann constant' },
      { name: 'atomicMass', short: 'm_u', label: 'Atomic mass constant' },
      { name: 'faraday', label: 'Faraday constant' },
      { name: 'molarVolume', label: 'Molar volume of an ideal gas (273.15 K, 101.325 kPa)' },
      { name: 'loschmidt', label: 'Loschmidt constant (273.15 K, 101.325 kPa)' },
      { name: 'molarPlanckConstant', label: 'Molar Planck constant' },
      { name: 'firstRadiation', label: 'First radiation constant' },
      { name: 'secondRadiation', label: 'Second radiation constant' },
      { name: 'wienDisplacement', label: 'Wien displacement law constant' },
      { name: 'sackurTetrode', label: 'Sackur–Tetrode constant (1 K, 100 kPa)' },
    ],
  },
  {
    label: 'Electromagnetic',
    constants: [
      { name: 'elementaryCharge', short: 'e_c', label: 'Elementary charge' },
      { name: 'electricConstant', short: 'epsilon_0', label: 'Vacuum electric permittivity' },
      { name: 'magneticConstant', short: 'mu_0', label: 'Vacuum magnetic permeability' },
      { name: 'vacuumImpedance', short: 'Z_0', label: 'Characteristic impedance of vacuum' },
      { name: 'coulomb', label: 'Coulomb constant' },
      { name: 'bohrMagneton', label: 'Bohr magneton' },
      { name: 'nuclearMagneton', label: 'Nuclear magneton' },
      { name: 'magneticFluxQuantum', label: 'Magnetic flux quantum' },
      { name: 'conductanceQuantum', label: 'Conductance quantum' },
      { name: 'inverseConductanceQuantum', label: 'Inverse conductance quantum' },
      { name: 'klitzing', label: 'Von Klitzing constant' },
    ],
  },
  {
    label: 'Atomic and nuclear',
    constants: [
      { name: 'electronMass', short: 'm_e', label: 'Electron mass' },
      { name: 'protonMass', short: 'm_p', label: 'Proton mass' },
      { name: 'neutronMass', short: 'm_n', label: 'Neutron mass' },
      { name: 'deuteronMass', label: 'Deuteron mass' },
      { name: 'bohrRadius', short: 'a_0', label: 'Bohr radius' },
      { name: 'fineStructure', short: 'alpha', label: 'Fine-structure constant' },
      { name: 'rydberg', short: 'R_inf', label: 'Rydberg constant' },
      { name: 'classicalElectronRadius', label: 'Classical electron radius' },
      { name: 'hartreeEnergy', label: 'Hartree energy' },
      { name: 'quantumOfCirculation', label: 'Quantum of circulation' },
      { name: 'thomsonCrossSection', label: 'Thomson cross section' },
      { name: 'fermiCoupling', label: 'Fermi coupling constant' },
      { name: 'weakMixingAngle', label: 'Weak mixing angle' },
      { name: 'efimovFactor', label: 'Efimov factor' },
    ],
  },
  {
    label: 'Planck units',
    constants: [
      { name: 'planckLength', label: 'Planck length' },
      { name: 'planckMass', label: 'Planck mass' },
      { name: 'planckTime', label: 'Planck time' },
      { name: 'planckCharge', label: 'Planck charge' },
      { name: 'planckTemperature', label: 'Planck temperature' },
    ],
  },
]

/** Short name → math.js's name, for every constant that has one. */
export const SHORT_CONSTANTS: ReadonlyMap<string, string> = new Map(
  CONSTANT_GROUPS.flatMap((group) => group.constants).flatMap(({ name, short }) => (short ? [[short, name] as const] : [])),
)
