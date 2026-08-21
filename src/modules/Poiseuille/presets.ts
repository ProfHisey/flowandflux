import type { PoiseuilleParams } from '../../lib/poiseuille';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose. */
  source: string;
  blurb: string;
  params: PoiseuilleParams;
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'capillary',
    name: 'Water in a capillary tube',
    source: 'Lab bench',
    blurb:
      'A 1 mm-bore glass capillary, 10 cm long, driven by 1000 Pa (a 10 cm water column). The baseline Poiseuille problem.',
    check: 'Q = πΔPR⁴/8μL ≈ 0.245 mL/s, v̄ = 0.31 m/s, Re ≈ 313 — comfortably laminar',
    params: {
      geometry: 'tube', mu: 1e-3, rho: 1000, dP: 1000, L: 0.1, R: 5e-4, h: 1e-3, W: 0.01,
    },
  },
  {
    id: 'stenosis',
    name: 'The same tube, narrowed 20%',
    source: 'The R⁴ law',
    blurb:
      'Identical setup, radius down to 0.4 mm. A 20% narrowing sounds mild. The fourth power disagrees — and this is why small changes in vessel radius control blood flow.',
    check: 'Q(0.8R) = 0.8⁴ = 41% of before. Radius is the most powerful knob in fluid transport',
    params: {
      geometry: 'tube', mu: 1e-3, rho: 1000, dP: 1000, L: 0.1, R: 4e-4, h: 1e-3, W: 0.01,
    },
  },
  {
    id: 'syrup',
    name: 'Syrup between plates',
    source: 'Kitchen',
    blurb:
      'Glycerin squeezed through a 1 mm slot, 10 cm long, 10 kPa of driving pressure. Viscosity three decades up; watch what it costs.',
    check: 'v̄ = h²ΔP/12μL ≈ 6 mm/s — a thousand times slower than the water capillary',
    params: {
      geometry: 'plates', mu: 1.4, rho: 1260, dP: 10000, L: 0.1, R: 5e-4, h: 1e-3, W: 0.05,
    },
  },
  {
    id: 'rain',
    name: 'Rain sheet on a window',
    source: 'Weather',
    blurb:
      'A 0.2 mm film of water running down glass, driven by nothing but its own weight. No pump anywhere — gravity is the pressure gradient.',
    check: 'v̄ = ρgh²/3μ ≈ 13 cm/s, and the wall shear τ = ρgh ≈ 2 Pa carries the entire weight of the sheet',
    params: {
      geometry: 'film', mu: 1e-3, rho: 1000, dP: 0, L: 0.3, R: 5e-4, h: 2e-4, W: 0.5,
    },
  },
];

export const DEFAULT_PARAMS: PoiseuilleParams = PRESETS[0].params;
