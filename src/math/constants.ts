/**
 * The built-in constants (docs/spec-v1.md section 5, Constants): every
 * constant math.js has, in groups. Pure data, with no math.js and no words:
 * `name` is the name math.js gives it, as a line reads it, and the text
 * tables say what each one is (`constants.description`, by `name`) and name
 * each group (`constants.groups`, by `id`), in the language shown (0.6.0).
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
}

/** A group's key in the text tables' `constants.groups`. */
export type ConstantGroupId = 'mathematical' | 'universal' | 'adopted' | 'physicoChemical' | 'electromagnetic' | 'atomic' | 'planck'

export interface ConstantGroup {
  id: ConstantGroupId
  constants: readonly ConstantEntry[]
}

export const CONSTANT_GROUPS: readonly ConstantGroup[] = [
  {
    id: 'mathematical',
    constants: [
      { name: 'pi' },
      { name: 'tau' },
      { name: 'e' },
      { name: 'phi' },
      { name: 'i' },
      { name: 'Infinity' },
      { name: 'SQRT2' },
      { name: 'SQRT1_2' },
      { name: 'LN2' },
      { name: 'LN10' },
      { name: 'LOG2E' },
      { name: 'LOG10E' },
    ],
  },
  {
    id: 'universal',
    constants: [
      { name: 'speedOfLight', short: 'c' },
      { name: 'gravitationConstant', short: 'G' },
      { name: 'planckConstant', short: 'h' },
      { name: 'reducedPlanckConstant', short: 'hbar' },
    ],
  },
  {
    id: 'adopted',
    constants: [
      { name: 'gravity' },
      { name: 'molarMass' },
      { name: 'molarMassC12' },
    ],
  },
  {
    id: 'physicoChemical',
    constants: [
      { name: 'gasConstant', short: 'R' },
      { name: 'boltzmann', short: 'k' },
      { name: 'avogadro', short: 'N_A' },
      { name: 'stefanBoltzmann', short: 'sigma' },
      { name: 'atomicMass', short: 'm_u' },
      { name: 'faraday' },
      { name: 'molarVolume' },
      { name: 'loschmidt' },
      { name: 'molarPlanckConstant' },
      { name: 'firstRadiation' },
      { name: 'secondRadiation' },
      { name: 'wienDisplacement' },
      { name: 'sackurTetrode' },
    ],
  },
  {
    id: 'electromagnetic',
    constants: [
      { name: 'elementaryCharge', short: 'e_c' },
      { name: 'electricConstant', short: 'epsilon_0' },
      { name: 'magneticConstant', short: 'mu_0' },
      { name: 'vacuumImpedance', short: 'Z_0' },
      { name: 'coulomb' },
      { name: 'bohrMagneton' },
      { name: 'nuclearMagneton' },
      { name: 'magneticFluxQuantum' },
      { name: 'conductanceQuantum' },
      { name: 'inverseConductanceQuantum' },
      { name: 'klitzing' },
    ],
  },
  {
    id: 'atomic',
    constants: [
      { name: 'electronMass', short: 'm_e' },
      { name: 'protonMass', short: 'm_p' },
      { name: 'neutronMass', short: 'm_n' },
      { name: 'deuteronMass' },
      { name: 'bohrRadius', short: 'a_0' },
      { name: 'fineStructure', short: 'alpha' },
      { name: 'rydberg', short: 'R_inf' },
      { name: 'classicalElectronRadius' },
      { name: 'hartreeEnergy' },
      { name: 'quantumOfCirculation' },
      { name: 'thomsonCrossSection' },
      { name: 'fermiCoupling' },
      { name: 'weakMixingAngle' },
      { name: 'efimovFactor' },
    ],
  },
  {
    id: 'planck',
    constants: [
      { name: 'planckLength' },
      { name: 'planckMass' },
      { name: 'planckTime' },
      { name: 'planckCharge' },
      { name: 'planckTemperature' },
    ],
  },
]

/** Short name → math.js's name, for every constant that has one. */
export const SHORT_CONSTANTS: ReadonlyMap<string, string> = new Map(
  CONSTANT_GROUPS.flatMap((group) => group.constants).flatMap(({ name, short }) => (short ? [[short, name] as const] : [])),
)
