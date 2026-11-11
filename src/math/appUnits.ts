/**
 * The app units (docs/spec-v1.md section 5, App units): a fixed list,
 * registered once at engine setup, so every sheet has the same ones. Each name
 * is registered as written, with no prefixes, and the file stores nothing
 * about them. There is no bare `P`, so `P` stays free for power or pressure.
 */
export const APP_UNITS = [
  // Viscosity
  { name: 'cP', definition: '0.001 Pa s' },
  { name: 'poise', definition: '0.1 Pa s' },
  { name: 'cSt', definition: '1e-6 m^2/s' },
  { name: 'St', definition: '1e-4 m^2/s' },
  // Rotation and flow
  { name: 'rpm', definition: '1 / minute' },
  { name: 'gpm', definition: '1 gal / minute' },
  { name: 'cfm', definition: '1 ft^3 / minute' },
  // Energy and force (kcal is the thermochemical calorie)
  { name: 'kcal', definition: '4184 J' },
  { name: 'tonf', definition: '2000 lbf' },
  { name: 'tf', definition: '1000 kgf' },
] as const
