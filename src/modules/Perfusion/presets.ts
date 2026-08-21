import type { PerfusionParams } from '../../lib/perfusion';

export interface Preset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: PerfusionParams;
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'corner',
    name: 'The starved corner',
    source: 'Design flaw',
    blurb:
      'A perfused channel that looks fine at the inlet — and quietly runs dry at the far end of the cell layer. The classic failure of feeding cells with flow.',
    check: 'Supply drains 2.5×10⁻³ mM per cm and hits zero exactly at the outlet; the tissue floor there is starved. The corner fails before anywhere else',
    params: {
      D: 2e-5, v: 1, h1: 0.002, h2: 0.0025, W: 2, L: 2,
      C0: 5e-6, R: 2e-6, Ccrit: 0,
    },
  },
  {
    id: 'rescue',
    name: 'Rescue by flow',
    source: 'The fix',
    blurb:
      'The same channel with the flow turned up 4×. The axial drain scales as 1/Q — but note what the tissue-depth drop does: nothing. Flow cannot fix a thick layer.',
    check: 'The supply now loses only a quarter as much per cm and everyone lives; the tissue drop Rh₂²/2D is untouched by v',
    params: {
      D: 2e-5, v: 4, h1: 0.002, h2: 0.0025, W: 2, L: 2,
      C0: 5e-6, R: 2e-6, Ccrit: 0,
    },
  },
  {
    id: 'thick',
    name: 'A greedier, thicker layer',
    source: 'The h₂² tax',
    blurb:
      'Double the cell layer thickness, at high flow. Twice the cells — but the depth drop goes as h₂², and the floor pays it at every station.',
    check: 'The tissue drop quadruples (Rh₂²/2D). Depth is a square-law tax that no pump refunds — which is why engineered tissues are thin or vascularized',
    params: {
      D: 2e-5, v: 4, h1: 0.002, h2: 0.005, W: 2, L: 2,
      C0: 5e-6, R: 2e-6, Ccrit: 0,
    },
  },
  {
    id: 'margin',
    name: 'Designed with margin',
    source: 'Good practice',
    blurb:
      'Thinner tissue, faster flow, and a survival threshold set above zero — because real cells struggle long before the concentration reaches nothing.',
    check: 'With C_crit = 0.5 mM the alive/starved boundary moves upstream of where C = 0 would put it: designing to zero is designing to fail',
    params: {
      D: 2e-5, v: 3, h1: 0.002, h2: 0.002, W: 2, L: 2,
      C0: 5e-6, R: 2e-6, Ccrit: 5e-7,
    },
  },
];

export const DEFAULT_PARAMS: PerfusionParams = PRESETS[0].params;
