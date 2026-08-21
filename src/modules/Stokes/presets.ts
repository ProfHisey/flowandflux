import type { StokesParams } from '../../lib/stokes';

export interface Preset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: StokesParams;
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'cell',
    name: 'A cell in still water',
    source: 'Microscale',
    blurb:
      'A 1 µm particle, barely denser than the water around it, left to settle under gravity. How long until it reaches the bottom of a 1 cm tube?',
    check: 'v∞ = 2Δρ·g·a²/9μ ≈ 0.11 µm/s — about a centimetre per DAY. And τ ≈ 0.2 µs: terminal velocity is not approached, it simply is',
    params: { a: 1e-6, rhoP: 1050, rhoF: 1000, mu: 1e-3, gFactor: 1, Lint: 0.01 },
  },
  {
    id: 'spin',
    name: 'The same cell at 100,000 g',
    source: 'Centrifuge',
    blurb:
      'Identical particle, identical fluid — but now the tube is spinning. v∞ scales linearly with g, and g is the only knob left when a² has made things hopeless.',
    check: 'v∞ ×100,000 → the 1 cm takes ~1 s instead of a day. This is the entire reason ultracentrifuges exist',
    params: { a: 1e-6, rhoP: 1050, rhoF: 1000, mu: 1e-3, gFactor: 1e5, Lint: 0.01 },
  },
  {
    id: 'esr',
    name: 'Red cells in plasma',
    source: 'Clinic',
    blurb:
      'An erythrocyte (as a ~4 µm effective sphere) settling in plasma. Hospitals literally run this experiment in a glass tube and call it the ESR.',
    check: 'v∞ ≈ 6 mm/h — squarely in the clinical sedimentation-rate range. Inflammation makes cells clump: bigger a, faster fall, higher ESR',
    params: { a: 4e-6, rhoP: 1100, rhoF: 1025, mu: 1.6e-3, gFactor: 1, Lint: 0.01 },
  },
  {
    id: 'fog',
    name: 'A fog droplet',
    source: 'Weather',
    blurb:
      'A 5 µm water droplet in air. Fog is water that has been sentenced to fall at Stokes speed.',
    check: 'v∞ ≈ 3 mm/s — hours to fall out of a cloud layer, which is why fog hangs. Re ≈ 0.002: Stokes holds comfortably',
    params: { a: 5e-6, rhoP: 1000, rhoF: 1.2, mu: 1.8e-5, gFactor: 1, Lint: 10 },
  },
  {
    id: 'raindrop',
    name: 'A raindrop that breaks the rules',
    source: 'Fine print',
    blurb:
      'A 1 mm raindrop, same formula. Stokes cheerfully predicts over 100 m/s — faster than a skydiver. Something has gone wrong, and the Re readout says what.',
    check: 'Stokes gives v∞ ≈ 121 m/s — nonsense (real drops: ~6 m/s). Re ≫ 1: the formula has left its validity range, and honest tools say so',
    params: { a: 1e-3, rhoP: 1000, rhoF: 1.2, mu: 1.8e-5, gFactor: 1, Lint: 100 },
  },
];

export const DEFAULT_PARAMS: StokesParams = PRESETS[0].params;
