import type { BCKind, Geometry } from '../../lib/bcprofile';
import type { Cargo } from './BCCanvas';

/**
 * Invented, course-neutral setups. Each one exists to make a single sentence
 * about boundary conditions land; the blurb says which sentence.
 *
 * Units follow the module: SI for heat (m, W/m·K, W/m³, W/m²·K, °C) and
 * cm-based for mass (cm, cm²/s, mM/s, cm/s, mM). Within each system the
 * numbers are self-consistent, which is the only thing the algebra cares
 * about — and checking that is half of what the course asks for.
 */

export interface Vals {
  L: number;
  kD: number;
  gen: number;
  innerValue: number;
  innerFlux: number;
  outerValue: number;
  outerFlux: number;
  h: number;
  inf: number;
  phi: number;
}

export const DEFAULTS: Record<Cargo, Vals> = {
  heat: {
    L: 0.03, kD: 0.5, gen: 700,
    innerValue: 37, innerFlux: 0,
    outerValue: 33, outerFlux: 0,
    h: 8, inf: 22, phi: 1,
  },
  mass: {
    L: 0.1, kD: 1e-5, gen: -2e-3,
    innerValue: 5, innerFlux: 0,
    outerValue: 6, outerFlux: 0,
    h: 2e-3, inf: 6, phi: 1,
  },
};

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  cargo: Cargo;
  geometry: Geometry;
  inner: BCKind;
  outer: BCKind;
  vals: Partial<Vals>;
}

export const BC_PRESETS: Preset[] = [
  {
    id: 'metabolic',
    name: 'Warm slab, cooled by air',
    blurb:
      'A slab making heat throughout, symmetric about its midplane, losing it through a film. Most of the drop is across the film, not inside: Bi is well under 1.',
    cargo: 'heat', geometry: 'slab', inner: 'symmetry', outer: 'mixed',
    vals: { L: 0.03, kD: 0.5, gen: 700, h: 8, inf: 22 },
  },
  {
    id: 'held',
    name: 'The same slab, face held',
    blurb:
      'Swap the film for a stirred bath and the surface value stops being an answer and becomes a given. The curve pins to it; only the interior is left to solve.',
    cargo: 'heat', geometry: 'slab', inner: 'symmetry', outer: 'value',
    vals: { L: 0.03, kD: 0.5, gen: 700, outerValue: 33 },
  },
  {
    id: 'sealed',
    name: 'Sealed on both sides',
    blurb:
      'Generation running, nothing allowed out. There is no steady profile at all — the body just keeps warming. Worth seeing once: not every pair of conditions has an answer.',
    cargo: 'heat', geometry: 'slab', inner: 'flux', outer: 'flux',
    vals: { L: 0.03, kD: 0.5, gen: 700, innerFlux: 0, outerFlux: 0 },
  },
  {
    id: 'balanced',
    name: 'Sealed one side, exactly drained the other',
    blurb:
      'Let out precisely what is made and a steady shape appears — but nothing anywhere fixes the level. Two flux conditions talk only about slopes.',
    cargo: 'heat', geometry: 'slab', inner: 'flux', outer: 'flux',
    vals: { L: 0.03, kD: 0.5, gen: 700, innerFlux: 0, outerFlux: 21 },
  },
  {
    id: 'rod',
    name: 'Heated rod in a stirred bath',
    blurb:
      'A cylinder generating throughout. Nobody imposed a condition at the center — a finite answer requires zero slope there, so symmetry comes free with the geometry.',
    cargo: 'heat', geometry: 'cylinder', inner: 'symmetry', outer: 'value',
    vals: { L: 0.02, kD: 15, gen: 1.2e6, outerValue: 40 },
  },
  {
    id: 'oxygen',
    name: 'Oxygen eaten in a sphere of tissue',
    blurb:
      'Consumption is generation with a minus sign, so the profile sags instead of bulging. The sphere divides by three where the slab divides by one.',
    cargo: 'mass', geometry: 'sphere', inner: 'symmetry', outer: 'mixed',
    vals: { L: 0.05, kD: 2e-5, gen: -1.5e-3, h: 5e-3, inf: 6 },
  },
  {
    id: 'hydrogel',
    name: 'Drug degrading in a hydrogel disk',
    blurb:
      'A slab losing its cargo to a reaction inside while a well-stirred bath holds both faces. Symmetric, so only half the disk needs solving.',
    cargo: 'mass', geometry: 'slab', inner: 'symmetry', outer: 'value',
    vals: { L: 0.1, kD: 1e-5, gen: -2e-3, outerValue: 6 },
  },
  {
    id: 'heater',
    name: 'A heater on the back face',
    blurb:
      'No generation inside; the power all enters through one face and leaves through the other. A flux condition on the left, a film on the right — the straight-line case.',
    cargo: 'heat', geometry: 'slab', inner: 'flux', outer: 'mixed',
    vals: { L: 0.02, kD: 1.2, gen: 0, innerFlux: 600, h: 25, inf: 20 },
  },
];
