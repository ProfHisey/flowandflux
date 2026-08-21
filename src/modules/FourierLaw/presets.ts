import type { FourierParams } from '../../lib/fourier';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose. */
  source: string;
  blurb: string;
  params: FourierParams;
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'pane',
    name: 'Single-glazed window',
    source: 'Building',
    blurb:
      'A 1 m² window pane, 5 mm of glass. Room side held at 20 °C, outside at 0 °C. Single glazing is a spectacular way to heat the outdoors.',
    check: 'R_th = 0.005 K/W and Q = 4000 W — glass is not the insulator, the air gap is',
    params: {
      geometry: 'slab', k: 1.0, T1: 20, T2: 0, L: 0.005, A: 1, r1: 0.05, r2: 0.15,
    },
  },
  {
    id: 'fat',
    name: 'Subcutaneous fat layer',
    source: 'Physiology',
    blurb:
      'Core at 37 °C, skin surface at 25 °C, across a 2 cm fat layer wrapping about 1.5 m² of body. Fat conducts poorly — that is rather the point of it.',
    check: 'Q = 180 W — the right order for resting metabolic heat',
    params: {
      geometry: 'slab', k: 0.2, T1: 37, T2: 25, L: 0.02, A: 1.5, r1: 0.05, r2: 0.15,
    },
  },
  {
    id: 'pipe',
    name: 'Insulated hot pipe',
    source: 'Process',
    blurb:
      'A pipe at 120 °C wrapped in foam insulation from r₁ = 2 cm out to r₂ = 5 cm, per metre of length. The classic cylindrical-shell problem.',
    check: 'R_th ≈ 2.92 K/W, Q ≈ 33 W per metre of pipe',
    params: {
      geometry: 'cylinder', k: 0.05, T1: 120, T2: 25, L: 1, A: 1, r1: 0.02, r2: 0.05,
    },
  },
  {
    id: 'coldsphere',
    name: 'Cold-shipping sphere',
    source: 'Cold chain',
    blurb:
      'A spherical foam container: 4 °C inside, 25 °C room outside, wall from r₁ = 15 cm to r₂ = 20 cm. Heat leaks inward — note the sign of Q.',
    check: 'about 4.8 W leaking in (Q is negative: heat flows from 2 to 1)',
    params: {
      geometry: 'sphere', k: 0.03, T1: 4, T2: 25, L: 1, A: 1, r1: 0.15, r2: 0.2,
    },
  },
];

export const DEFAULT_PARAMS: FourierParams = PRESETS[0].params;

/** Landmark k values for the "how big is k, really" scale, W/(m·K). */
export const K_LANDMARKS: { label: string; k: number }[] = [
  { label: 'Air', k: 0.026 },
  { label: 'Fat', k: 0.2 },
  { label: 'Water', k: 0.6 },
  { label: 'Glass', k: 1.0 },
  { label: 'Steel', k: 45 },
  { label: 'Copper', k: 400 },
];
