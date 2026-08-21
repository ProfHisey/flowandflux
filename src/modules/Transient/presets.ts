import type { ContactBody, HeislerParams } from '../../lib/transient';

/** Contact-material palette: k (W/m·K), rho (kg/m³), c (J/kg·K).
 *  Effusivity e = sqrt(k·rho·c) is what touching actually measures.
 *  Values follow the course's own 60 °C-touch table where it has them
 *  (skin, foam, wood, water, steel, aluminum). */
export const TOUCH_MATERIALS: Omit<ContactBody, 'T'>[] = [
  { name: 'Skin', k: 0.21, rho: 1200, c: 3600 },
  { name: 'Aluminum', k: 250, rho: 2700, c: 903 },
  { name: 'Steel', k: 14.9, rho: 7900, c: 477 },
  { name: 'Marble', k: 2.5, rho: 2600, c: 880 },
  { name: 'Glass', k: 1.0, rho: 2500, c: 840 },
  { name: 'Water', k: 0.6, rho: 997, c: 4200 },
  { name: 'Wood', k: 0.16, rho: 720, c: 1255 },
  { name: 'Carpet', k: 0.06, rho: 200, c: 1300 },
  { name: 'Foam', k: 0.026, rho: 30, c: 1450 },
];

export interface TouchPreset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  /** Right-hand material name (left is always skin at 33 degC). */
  material: string;
  T: number;
  check?: string;
}

export const TOUCH_PRESETS: TouchPreset[] = [
  {
    id: 'steel60',
    name: 'Steel at 60 °C',
    source: 'Will it hurt?',
    blurb:
      'A finger (37 °C) touches steel at 60 °C. Pain starts above 44 °C. Sixty degrees does not sound like much — the contact temperature says otherwise.',
    material: 'Steel',
    T: 60,
    check: 'T_contact = (e₁T₁ + e₂T₂)/(e₁+e₂) ≈ 57.4 °C — nearly the full 60, far past the 44 °C pain line',
  },
  {
    id: 'wood60',
    name: 'Wood at 60 °C',
    source: 'Will it hurt?',
    blurb:
      'The same finger, the same 60 °C — but wood. Same temperature, different effusivity, completely different verdict.',
    material: 'Wood',
    T: 60,
    check: 'T_contact ≈ 43.6 °C — just under the 44 °C pain threshold. Touchable, barely',
  },
  {
    id: 'aluminum60',
    name: 'Aluminum at 60 °C',
    source: 'Will it hurt?',
    blurb:
      'The extreme case: aluminum has the highest effusivity on the list — touching it is nearly the same as being aluminum.',
    material: 'Aluminum',
    T: 60,
    check: 'T_contact ≈ 59.1 °C — your skin is dragged essentially all the way to 60',
  },
  {
    id: 'tile',
    name: 'Bare feet on marble',
    source: 'Morning',
    blurb: 'The bathroom floor at 20 °C, met by a 37 °C foot. Why does it feel cold?',
    material: 'Marble',
    T: 20,
    check: 'T_contact ≈ 24.8 °C — the skin surface is dragged most of the way to the floor',
  },
  {
    id: 'carpet',
    name: 'Bare feet on carpet',
    source: 'Morning',
    blurb:
      'The carpet next to that marble is at exactly the same 20 °C. Nobody complains about the carpet.',
    material: 'Carpet',
    T: 20,
    check: 'T_contact ≈ 35 °C — barely below skin. Same floor temperature, opposite verdict',
  },
];

export interface HeislerPreset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: HeislerParams;
  check?: string;
}

export const HEISLER_PRESETS: HeislerPreset[] = [
  {
    id: 'pea',
    name: 'Frozen pea, boiling water',
    source: 'Kitchen',
    blurb:
      'A 4 mm pea from the freezer into a rolling boil (h ≈ 3000 W/m²K). The surface is at 100 °C almost instantly — the centre has other plans.',
    check: 'Bi = hR/k = 24: surface capitulates immediately; the centre follows on the Fo clock',
    params: {
      geometry: 'sphere', L: 0.004, k: 0.5, rho: 1000, c: 3600,
      h: 3000, Ti: -18, Tinf: 100, t: 30,
    },
  },
  {
    id: 'egg',
    name: 'The boiled egg',
    source: 'Kitchen',
    blurb:
      'A 2 cm-radius egg from the fridge (4 °C) into boiling water (h ≈ 1200 W/m²K). Soft or hard is entirely a question of the Fourier number.',
    check: 'Bi = hR/k = 48 — the surface hits 100 °C almost at once, and the centre needs ~9 minutes to reach ~71 °C. Bigger egg: time scales as R²',
    params: {
      geometry: 'sphere', L: 0.02, k: 0.5, rho: 1030, c: 3400,
      h: 1200, Ti: 4, Tinf: 100, t: 560,
    },
  },
  {
    id: 'basement',
    name: 'Concrete wall in a heat wave',
    source: 'Building',
    blurb:
      'A 20 cm concrete wall, 15 °C from a cool night, hit by a 35 °C day on both faces. How long before the middle of the wall knows?',
    check: 'Fo reaches 0.2 only after ~8 hours — massive walls time-shift the heat of the day, which is the whole trick of thermal mass',
    params: {
      geometry: 'wall', L: 0.1, k: 1.4, rho: 2400, c: 880,
      h: 10, Ti: 15, Tinf: 35, t: 28800,
    },
  },
];

export const DEFAULT_HEISLER: HeislerParams = HEISLER_PRESETS[0].params;
