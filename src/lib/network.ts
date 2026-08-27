/**
 * Thermal resistance networks: a composite wall as a series circuit.
 *
 * Every element between the two fluids is a resistor:
 *   conduction layer   R = L / (k A)
 *   convection film    R = 1 / (h A)     — the law-of-cooling module's h,
 *                                          wearing its circuit costume
 *
 * Series resistances add, the same Q flows through every element (energy
 * conservation — the circuit version of "Q is constant through the wall"),
 * and the temperature drop across each element is Q·R_i. That last line is
 * the whole reason to build the circuit at all: the ΔT budget distributes
 * in proportion to resistance, so the dominant resistor is visible as the
 * biggest drop. Add a 1 cm air gap to a glass pane and watch it take over.
 *
 * Conduction + films only — no radiation resistors. For a glazing cavity
 * that omission matters (pane-to-pane radiation roughly halves the gap's
 * real benefit); the UI copy owns that where it quotes real U-values.
 *
 * Internal unit system is SI, matching the heat modules.
 */

export interface WallLayer {
  /** Display name, e.g. "Glass". */
  name: string;
  /** Thermal conductivity, W/(m K) */
  k: number;
  /** Thickness, m */
  L: number;
}

export interface WallParams {
  /** Layers from the hot side to the cold side. */
  layers: WallLayer[];
  /** Wall area, m^2 */
  A: number;
  /** Hot-side fluid temperature, degC */
  Tin: number;
  /** Cold-side fluid temperature, degC */
  Tout: number;
  /** Hot-side convection film. */
  useFilmIn: boolean;
  hIn: number;
  /** Cold-side convection film. */
  useFilmOut: boolean;
  hOut: number;
}

export interface NetworkElement {
  kind: 'film' | 'layer';
  label: string;
  /** Resistance, K/W. */
  R: number;
  /** Thickness for drawing, m (films get 0). */
  L: number;
}

/** The series chain, hot side first. */
export function elements(p: WallParams): NetworkElement[] {
  const out: NetworkElement[] = [];
  if (p.useFilmIn) {
    out.push({ kind: 'film', label: 'film (h in)', R: 1 / (p.hIn * p.A), L: 0 });
  }
  for (const l of p.layers) {
    out.push({ kind: 'layer', label: l.name, R: l.L / (l.k * p.A), L: l.L });
  }
  if (p.useFilmOut) {
    out.push({ kind: 'film', label: 'film (h out)', R: 1 / (p.hOut * p.A), L: 0 });
  }
  return out;
}

/** Total series resistance, K/W. */
export function totalResistance(p: WallParams): number {
  return elements(p).reduce((s, e) => s + e.R, 0);
}

/** The one heat rate through every element, W. */
export function heatRate(p: WallParams): number {
  return (p.Tin - p.Tout) / totalResistance(p);
}

/**
 * The industry number: U = 1 / (R_total A), W/(m^2 K). A window catalog
 * speaks in U-values; this is where they come from.
 */
export function uValue(p: WallParams): number {
  return 1 / (totalResistance(p) * p.A);
}

/**
 * Node temperatures, hot fluid first, cold fluid last (n elements gives
 * n+1 nodes). Each element drops exactly Q * R_i — the budget line.
 */
export function nodeTemps(p: WallParams): number[] {
  const Q = heatRate(p);
  const out = [p.Tin];
  let T = p.Tin;
  for (const e of elements(p)) {
    T -= Q * e.R;
    out.push(T);
  }
  return out;
}

/** Each element's share of the total temperature drop, 0..1. */
export function budget(p: WallParams): number[] {
  const R = totalResistance(p);
  return elements(p).map((e) => e.R / R);
}

/** The element hogging the budget. */
export function dominant(p: WallParams): { index: number; share: number } {
  const b = budget(p);
  let index = 0;
  for (let i = 1; i < b.length; i++) if (b[i] > b[index]) index = i;
  return { index, share: b[index] };
}
