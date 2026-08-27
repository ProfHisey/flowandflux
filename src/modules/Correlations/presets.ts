import { FLUIDS, type CorrGeometry, type Fluid } from '../../lib/correlations';

export interface Preset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  geometry: CorrGeometry;
  fluid: Fluid;
  v: number;
  L: number;
  D: number;
  check?: string;
}

const AIR = FLUIDS[0];
const WATER = FLUIDS[1];

export const PRESETS: Preset[] = [
  {
    id: 'windchill',
    name: 'Wind on a bare arm',
    source: 'Wind chill',
    blurb:
      'A 5 m/s breeze across an arm (a 7 cm cylinder). Compare h against the still-air ~10 W/m²K from the cooling module — that difference IS wind chill.',
    geometry: 'cylinder', fluid: AIR, v: 5, L: 0.07, D: 2.6e-5,
    check: 'Re ≈ 2.3×10⁴, Nu ≈ 86 → h ≈ 32 W/m²K: the breeze triples still-air cooling. Wind chill is a Nusselt number',
  },
  {
    id: 'droplet',
    name: 'A drying droplet',
    source: 'Sphere',
    blurb:
      'A 1 mm water droplet falling through air at 4 m/s, losing vapor. Ranz–Marshall was fitted on exactly this experiment.',
    geometry: 'sphere', fluid: AIR, v: 4, L: 1e-3, D: 2.6e-5,
    check: 'Re ≈ 267, Sh = 2 + 0.6·Re^½·Sc^⅓ ≈ 10: convection is ~5× the pure-diffusion (Sh = 2) evaporation rate',
  },
  {
    id: 'tubing',
    name: 'Slow flow in fine tubing',
    source: 'Laminar tube',
    blurb:
      'Warm water creeping through 1 mm tubing. Below Re = 2300 the answer is scandalously simple — and independent of how fast you pump.',
    geometry: 'tube', fluid: WATER, v: 0.05, L: 1e-3, D: 1e-9,
    check: 'Re = 50, laminar: Nu = 3.66 — a constant. Pumping harder does NOT improve fully developed laminar transfer; only a thinner tube does',
  },
  {
    id: 'pond',
    name: 'Breeze over a pond',
    source: 'Flat plate',
    blurb:
      'A 3 m/s breeze along a meter of water surface, carrying off heat and vapor at once. The two films — and the two coefficients — part company in the water below.',
    geometry: 'plate', fluid: AIR, v: 3, L: 1, D: 2.6e-5,
    check: 'Re = 2×10⁵ (still laminar), Nu ≈ 264. In air Pr ≈ Sc so Sh ≈ Nu — the films coincide; switch the fluid to water to watch them split',
  },
];

export const DEFAULT_PRESET = PRESETS[0];
