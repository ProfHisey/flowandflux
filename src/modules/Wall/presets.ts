import type { WallParams } from '../../lib/network';

/** The material palette for the stack editor, W/(m K). */
export const MATERIALS: { name: string; k: number }[] = [
  { name: 'Copper', k: 400 },
  { name: 'Steel', k: 45 },
  { name: 'Concrete', k: 1.4 },
  { name: 'Glass', k: 1.0 },
  { name: 'Brick', k: 0.7 },
  { name: 'Water (still)', k: 0.6 },
  { name: 'Skin', k: 0.37 },
  { name: 'Fat', k: 0.2 },
  { name: 'Wood', k: 0.15 },
  { name: 'Wool', k: 0.04 },
  { name: 'Foam', k: 0.03 },
  { name: 'Air gap', k: 0.026 },
];

export interface Preset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: WallParams;
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'single',
    name: 'Single glazing',
    source: 'Building',
    blurb:
      'One 4 mm pane between a 20 °C room and a 0 °C night, with the two air films. Look where the temperature actually drops.',
    check: 'R = 0.169 K/W, U = 5.9 W/m²K — and the films, not the glass, do most of the resisting',
    params: {
      layers: [{ name: 'Glass', k: 1.0, L: 0.004 }],
      A: 1, Tin: 20, Tout: 0, useFilmIn: true, hIn: 8, useFilmOut: true, hOut: 25,
    },
  },
  {
    id: 'double',
    name: 'Double glazing',
    source: 'Building',
    blurb:
      'Same window, but with a 12 mm sealed air gap between two panes. One added layer of still air, nothing exotic.',
    check: 'conduction-only U drops from 5.9 to 1.6 W/m²K, the air gap seizing ~73% of the ΔT — real units land nearer 2.8, because radiation between the panes shorts part of the gap',
    params: {
      layers: [
        { name: 'Glass', k: 1.0, L: 0.004 },
        { name: 'Air gap', k: 0.026, L: 0.012 },
        { name: 'Glass', k: 1.0, L: 0.004 },
      ],
      A: 1, Tin: 20, Tout: 0, useFilmIn: true, hIn: 8, useFilmOut: true, hOut: 25,
    },
  },
  {
    id: 'insulated',
    name: 'Insulated house wall',
    source: 'Building code',
    blurb:
      'Brick, 10 cm of foam, drywall. The reason building codes obsess over one layer and ignore the others.',
    check: 'the foam takes ~90% of the ΔT; U ≈ 0.27 W/m²K',
    params: {
      layers: [
        { name: 'Brick', k: 0.7, L: 0.1 },
        { name: 'Foam', k: 0.03, L: 0.1 },
        { name: 'Wood', k: 0.15, L: 0.013 },
      ],
      A: 1, Tin: 20, Tout: 0, useFilmIn: true, hIn: 8, useFilmOut: true, hOut: 25,
    },
  },
  {
    id: 'winter',
    name: 'Dressed for winter',
    source: 'Physiology',
    blurb:
      'Core at 37 °C, air at −5 °C: a fat layer, a wool coat, and the outdoor film, over ~1.5 m² of body. Your metabolism pays whatever Q this circuit demands.',
    check: 'the coat takes ~75% of the drop, and Q lands near a brisk-walk metabolic rate',
    params: {
      layers: [
        { name: 'Fat', k: 0.2, L: 0.005 },
        { name: 'Wool', k: 0.04, L: 0.008 },
      ],
      A: 1.5, Tin: 37, Tout: -5, useFilmIn: false, hIn: 8, useFilmOut: true, hOut: 25,
    },
  },
];

export const DEFAULT_PARAMS: WallParams = PRESETS[1].params;
