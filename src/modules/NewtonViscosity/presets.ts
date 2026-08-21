import type { NewtonParams } from '../../lib/newton';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose. */
  source: string;
  blurb: string;
  params: NewtonParams;
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'slide',
    name: 'Slide on a water film',
    source: 'Lab bench',
    blurb:
      'A microscope slide (20 cm² wetted) glides at 1 cm/s on a 100 µm film of water. The everyday physics of things that feel “slippery”.',
    check: 'du/dy = 100 s⁻¹, τ = 0.1 Pa, F = 0.2 mN',
    params: { mu: 1e-3, U: 0.01, H: 1e-4, A: 2e-3, rho: 1000 },
  },
  {
    id: 'honey',
    name: 'Spreading honey',
    source: 'Kitchen',
    blurb:
      'A knife (10 cm²) drags honey at 5 cm/s across a 2 mm layer. Same law as the water film — four decades more viscosity.',
    check: 'τ = 250 Pa and F = 0.25 N — you can feel a quarter of a newton',
    params: { mu: 10, U: 0.05, H: 2e-3, A: 1e-3, rho: 1400 },
  },
  {
    id: 'air',
    name: 'Air in a narrow gap',
    source: 'Everyday',
    blurb:
      'A surface moving at 10 m/s over a 1 mm air gap (100 cm²). Even air resists shear — this is where aerodynamic drag on skin begins.',
    check: 'τ = 0.18 Pa, F ≈ 1.8 mN',
    params: { mu: 1.8e-5, U: 10, H: 1e-3, A: 1e-2, rho: 1.2 },
  },
];

export const DEFAULT_PARAMS: NewtonParams = PRESETS[0].params;

/** Landmark viscosities for the "how big is μ, really" scale, Pa·s. */
export const MU_LANDMARKS: { label: string; mu: number }[] = [
  { label: 'Air', mu: 1.8e-5 },
  { label: 'Water', mu: 1e-3 },
  { label: 'Blood', mu: 3.5e-3 },
  { label: 'Olive oil', mu: 0.08 },
  { label: 'Honey', mu: 10 },
];
