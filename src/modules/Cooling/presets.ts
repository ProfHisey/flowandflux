import type { CoolingParams } from '../../lib/cooling';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose. */
  source: string;
  blurb: string;
  params: CoolingParams;
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'coffee',
    name: 'Forgotten coffee',
    source: 'Desk',
    blurb:
      '250 mL of coffee at 90 °C in a 22 °C room, still air (h ≈ 10 W/m²K) over ~0.05 m² of mug and surface. How long until it is disappointing?',
    check: 'τ = ρVc/hA = 2093 s ≈ 35 min — one τ closes 63% of the gap',
    params: {
      h: 10, A: 0.05, V: 2.5e-4, rho: 1000, cp: 4186, k: 0.6, T0: 90, Tinf: 22, t: 1000,
    },
  },
  {
    id: 'thermometer',
    name: 'Clinical thermometer',
    source: 'Clinic',
    blurb:
      'A glass bulb at room temperature goes under a tongue at 37 °C. This one HEATS — the same law with the sign flipped. Why do you have to wait?',
    check: 'τ ≈ 14 s, so ~4τ ≈ 1 minute to close 98% of the gap. That is the waiting',
    params: {
      h: 100, A: 5.03e-5, V: 3.35e-8, rho: 2500, cp: 840, k: 1.0, T0: 22, Tinf: 37, t: 15,
    },
  },
  {
    id: 'quench',
    name: 'Steel ball quenched in oil',
    source: 'Workshop',
    blurb:
      'A 1 cm steel ball drops from the furnace into stirred oil (h ≈ 400 W/m²K). Metals are the lumped model at its best — check the Biot number.',
    check: 'τ ≈ 32 s and Bi ≈ 0.03: the inside keeps up with the surface easily',
    params: {
      h: 400, A: 1.26e-3, V: 4.19e-6, rho: 7800, cp: 490, k: 45, T0: 150, Tinf: 40, t: 20,
    },
  },
  {
    id: 'roast',
    name: 'Roast resting on the counter',
    source: 'Kitchen',
    blurb:
      'A 3 L roast out of the oven, cooling in kitchen air. Try it — and then look at the Biot readout before trusting the curve.',
    check: 'Bi ≈ 0.8 ≫ 0.1: the inside cannot keep up, the lumped curve is only a sketch. Honest tools say so',
    params: {
      h: 15, A: 0.12, V: 3e-3, rho: 1050, cp: 3500, k: 0.45, T0: 80, Tinf: 22, t: 3000,
    },
  },
];

export const DEFAULT_PARAMS: CoolingParams = PRESETS[0].params;

/** Landmark h values, W/(m² K) — five decades between a still room and a
 *  boiling surface, and none of them a material property. */
export const H_LANDMARKS: { label: string; h: number }[] = [
  { label: 'Still air', h: 10 },
  { label: 'Fan', h: 100 },
  { label: 'Water', h: 1000 },
  { label: 'Boiling', h: 10000 },
];
