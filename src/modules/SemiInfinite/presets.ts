import type { Cargo, Surface } from './SemiCanvas';

/**
 * Invented, course-neutral setups. Units: mass in cm, cm^2/s, mM, cm/s;
 * heat in m, W/m.K, kg/m^3, J/kg.K, degC, W/m^2.K. Times in seconds.
 */

export interface MassVals {
  D: number;      // cm^2/s
  v0: number;     // mM, initial
  vS: number;     // mM, surface (held) or bulk (film)
  h: number;      // cm/s, film coefficient
  tMax: number;   // s
  L: number;      // cm, a finite slab's thickness, if shown
}

export interface HeatVals {
  k: number;      // W/(m K)
  rho: number;    // kg/m^3
  cp: number;     // J/(kg K)
  v0: number;     // degC
  vS: number;     // degC
  h: number;      // W/(m^2 K)
  tMax: number;   // s
  L: number;      // m
}

export const MASS_DEFAULT: MassVals = { D: 5e-6, v0: 0, vS: 10, h: 1e-4, tMax: 7200, L: 0.5 };
export const HEAT_DEFAULT: HeatVals = {
  k: 0.52, rho: 2050, cp: 1840, v0: 10, vS: -10, h: 20, tMax: 30 * 86400, L: 1.5,
};

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  cargo: Cargo;
  surface: Surface;
  mass?: Partial<MassVals>;
  heat?: Partial<HeatVals>;
}

export const SEMI_PRESETS: Preset[] = [
  {
    id: 'dye',
    name: 'A dye soaking into a gel',
    blurb: 'The face is held by a well-stirred bath. Play it and watch the front slow down: twice as deep takes four times as long.',
    cargo: 'mass', surface: 'held',
    mass: { D: 5e-6, v0: 0, vS: 10, tMax: 7200 },
  },
  {
    id: 'oxygen',
    name: 'Oxygen into a still layer of tissue',
    blurb: 'A small, fast molecule — and still barely over a millimeter in a minute. Why cells never sit far from a supply.',
    cargo: 'mass', surface: 'held',
    mass: { D: 2e-5, v0: 0, vS: 0.2, tMax: 60 },
  },
  {
    id: 'film',
    name: 'The same gel, fed through a film',
    blurb: 'Now the face is not held: it starts empty and fills on its own clock, D/h². Switch the collapse chart to η — the curves refuse to line up.',
    cargo: 'mass', surface: 'film',
    mass: { D: 5e-6, v0: 0, vS: 10, h: 1e-4, tMax: 7200 },
  },
  {
    id: 'frost',
    name: 'Frost creeping into soil',
    blurb: 'A month of cold at the surface. How deep must a pipe be buried to stay above freezing? The answer is a front, and fronts go as √t.',
    cargo: 'heat', surface: 'held',
    heat: { k: 0.52, rho: 2050, cp: 1840, v0: 10, vS: -10, tMax: 30 * 86400, L: 5 },
  },
  {
    id: 'wood',
    name: 'A hot face on a slab of wood',
    blurb: 'Ten minutes at 200 °C. A poor conductor keeps the heat in a thin skin — which is why the inside of a log stays cool long after the outside chars.',
    cargo: 'heat', surface: 'held',
    heat: { k: 0.12, rho: 500, cp: 2000, v0: 20, vS: 200, tMax: 600, L: 0.05 },
  },
  {
    id: 'steelfilm',
    name: 'Steel warmed through a weak film',
    blurb: 'A good conductor behind a poor film: the face lags far behind the bulk because heat conducts away from the face, into the steel, faster than the film can supply it.',
    cargo: 'heat', surface: 'film',
    heat: { k: 45, rho: 7800, cp: 470, v0: 20, vS: 200, h: 50, tMax: 600, L: 0.1 },
  },
];
