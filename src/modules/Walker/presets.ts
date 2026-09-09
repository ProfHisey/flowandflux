/**
 * Two faces of one walker. Transport presets speak cm and seconds; price
 * presets speak years and per-year fractions, and are translated through
 * Bachelier's dictionary (lib/walker.ts) before they reach the canvas.
 */

export interface TransportParams {
  /** cm/s */
  v: number;
  /** cm²/s */
  D: number;
  /** s */
  T: number;
}

export interface PriceParams {
  /** Expected return per year, as a fraction. */
  mu: number;
  /** Volatility per year, as a fraction. */
  sigma: number;
  /** Horizon, years. */
  T: number;
}

export interface TransportPreset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: TransportParams;
  check?: string;
}

export interface PricePreset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: PriceParams;
  check?: string;
}

export const TRANSPORT_PRESETS: TransportPreset[] = [
  {
    id: 'wander',
    name: 'Pure wander',
    source: 'Pe = 0',
    blurb:
      'No current at all. Watch one walker for 100 s: it goes somewhere, and the somewhere means nothing. The cloud stays centered on the start.',
    check:
      'v = 0, so the mean never moves; the spread after 100 s is √(2DT) = √(2 × 10⁻⁵ × 100) = 0.045 cm, and the walker is as likely behind the start as ahead',
    params: { v: 0, D: 1e-5, T: 100 },
  },
  {
    id: 'contested',
    name: 'The contested walk',
    source: 'Pe = 1',
    blurb:
      'A gentle drift, watched for exactly the crossover time T* = 2D/v². Drift and spread are the same size: a 1-in-6 chance the walker ends up behind where it started.',
    check:
      'T* = 2D/v² = 2 × 10⁻⁵ / (10⁻³)² = 20 s. At T*, drift vT = 0.02 cm equals the spread √(2DT) = 0.02 cm, so Pe = 1 and P(ahead) = Φ(1) ≈ 84%',
    params: { v: 1e-3, D: 1e-5, T: 20 },
  },
  {
    id: 'destiny',
    name: 'Drift wins',
    source: 'Pe = 10',
    blurb:
      'Same walker, watched a hundred times longer. Drift grows as T, spread only as √T; by 100 T* the wandering is a detail on a straight line.',
    check:
      'Pe(T) = √(T/T*) = √(2000/20) = 10. Drift 2 cm against a spread of 0.2 cm: P(behind) = 1 − Φ(10), about one in 10²³',
    params: { v: 1e-3, D: 1e-5, T: 2000 },
  },
  {
    id: 'perfume',
    name: 'Perfume, one molecule',
    source: 'Callback',
    blurb:
      'The Péclet module’s draft (10 cm/s) and the diffusivity of a gas. Follow one molecule across the room: its wandering is invisible against the ride.',
    check:
      'T* = 2D/v² = 2 × 0.1 / 100 = 0.002 s. Over 30 s, Pe = √(30/0.002) ≈ 122 — the molecule’s 3 m of travel carries about ±2.4 cm of wander',
    params: { v: 10, D: 0.1, T: 30 },
  },
];

export const PRICE_PRESETS: PricePreset[] = [
  {
    id: 'index-year',
    name: 'A broad stock index, one year',
    source: 'Pe ≈ 0.4',
    blurb:
      'Roughly the long-run numbers for a diversified stock market: 7% a year expected, 16% a year of wobble. One year is mostly wobble.',
    check:
      'v = μ − σ²/2 = 0.0572 per year, D = σ²/2 = 0.0128. Pe(1) = v/√(2D) = 0.36; the chance of ending the year ahead is Φ(0.36) ≈ 64%',
    params: { mu: 0.07, sigma: 0.16, T: 1 },
  },
  {
    id: 'index-decade',
    name: 'The same index, ten years',
    source: 'Pe ≈ 1.1',
    blurb:
      'Nothing changed but the horizon. T* = 2D/v² is about eight years for these numbers — so at ten, drift has just pulled level with the noise.',
    check:
      'T* = 2D/v² = 2 × 0.0128 / 0.0572² ≈ 7.8 yr. Pe(10) = √(10/7.8) ≈ 1.13; P(ahead) ≈ 87%. The median outcome is e^{vT} ≈ ×1.77',
    params: { mu: 0.07, sigma: 0.16, T: 10 },
  },
  {
    id: 'single',
    name: 'One company, ten years',
    source: 'v < 0',
    blurb:
      'Same 7% expected return, but a single company wobbles far more — 40% a year. Now the Itô correction bites: the drift of the LOG price is negative.',
    check:
      'v = 0.07 − 0.40²/2 = −0.01 per year: the median path loses money even though the mean gains. D = 0.08, T* = 2D/v² = 1,600 yr — the noise never gets outrun',
    params: { mu: 0.07, sigma: 0.4, T: 10 },
  },
  {
    id: 'cash',
    name: 'Cash-like, ten years',
    source: 'Pe ≫ 1',
    blurb:
      'A 4% return with almost no wobble. The walker is a straight line: this is what "safe" looks like in this picture, and why it is boring on purpose.',
    check:
      'v ≈ 0.04, D = 5 × 10⁻⁵. Pe(10) = vT/√(2DT) = 0.4/0.032 ≈ 12.6: drift is destiny',
    params: { mu: 0.04, sigma: 0.01, T: 10 },
  },
];

export const DEFAULT_TRANSPORT: TransportParams = TRANSPORT_PRESETS[1].params;
export const DEFAULT_PRICE: PriceParams = PRICE_PRESETS[1].params;
