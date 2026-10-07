/**
 * Steady diffusion with uniform generation, and the boundary conditions that
 * close it. One second-order ODE, three geometries, and the small taxonomy of
 * conditions that can stand at a surface:
 *
 *   (1) VALUE     the surface value is known        T(s0) = T0
 *   (2) FLUX      the gradient is known             -k dT/ds = q
 *   (3) MIXED     a relation between the two        -k dT/ds = h (T_s - T_inf)
 *
 * plus SYMMETRY, which is a flux condition the geometry hands you for free at
 * the center of a cylinder or sphere.
 *
 * The governing balance, with n = 0 slab / 1 cylinder / 2 sphere:
 *
 *   (1/s^n) d/ds ( s^n k dT/ds ) + S = 0
 *
 * Regularity at s = 0 kills the singular branch (ln s, 1/s) in the curved
 * geometries, so a solid cylinder or sphere ALWAYS carries zero slope at its
 * center. That is not an extra assumption, it is the only finite answer, and
 * it is why the symmetry condition is free there and a choice in a slab.
 *
 * Writing Q = S / (2(n+1)k), every geometry collapses to
 *
 *   T(s) = -Q s^2 + a s + b        (a is present only for the slab)
 *   q(s) = -k T'(s) = 2kQ s - k a  (flux in the +s direction)
 *
 * and the two boundary conditions become two linear equations in (a, b).
 *
 * MASS IS THE SAME EQUATION: D for k, eps_dot for S, h_m for h, C for T. The
 * one asymmetry is the partition coefficient Phi in the mixed condition —
 * -D dC/ds = h_m (C_s - Phi C_inf) — because a concentration may jump across
 * a phase boundary where a temperature never can. See lib interfaceJump().
 *
 * UNITS follow the course: SI for heat (k W/m.K, S W/m^3, h W/m^2.K, L m),
 * CGS for mass (D cm^2/s, eps_dot mol/cm^3.s, h_m cm/s, L cm). The algebra is
 * identical; only the labels differ, which is the point.
 */

/** 0 slab, 1 cylinder, 2 sphere — the exponent in the shell balance. */
export type Geometry = 'slab' | 'cylinder' | 'sphere';

export function shapeExponent(g: Geometry): number {
  return g === 'slab' ? 0 : g === 'cylinder' ? 1 : 2;
}

export type BCKind = 'value' | 'flux' | 'mixed' | 'symmetry';

export interface BCSpec {
  kind: BCKind;
  /** 'value': the held surface value (degC, or mol/cm^3). */
  value?: number;
  /**
   * 'flux', and the sign convention is chosen to read naturally at each face:
   * at the INNER face it is what you push IN (a heater, a producing surface),
   * at the OUTER face it is what LEAVES. Both are zero for a sealed or
   * insulated face, which is the case that matters most.
   */
  flux?: number;
  /** 'mixed': film coefficient h (W/m^2.K) or h_m (cm/s). */
  h?: number;
  /** 'mixed': the bulk value out in the fluid. */
  inf?: number;
  /** 'mixed', mass only: partition coefficient Phi (1 for heat). */
  phi?: number;
}

export interface ProfileParams {
  geometry: Geometry;
  /** Slab thickness, or outer radius. m (heat) or cm (mass). */
  L: number;
  /** k, W/(m K) — or D, cm^2/s. */
  kD: number;
  /** Uniform generation S, W/m^3 — or eps_dot, mol/(cm^3 s). */
  gen: number;
  /** Condition at s = 0: the center of a curved body, or the far face of a
   *  slab. Forced to symmetry for cylinder and sphere. */
  inner: BCSpec;
  /** Condition at s = L: the outer surface. */
  outer: BCSpec;
}

/**
 * Whether the two conditions actually pin a steady profile down.
 *
 *  'ok'              a unique steady profile exists
 *  'no-steady-state' the fluxes cannot balance what is generated, so nothing
 *                    steady exists: the body just keeps heating up
 *  'floating'        the fluxes DO balance, so the shape is fixed but the
 *                    level is not — two flux conditions never set a datum
 */
export type Closure = 'ok' | 'no-steady-state' | 'floating';

export interface Solved {
  closure: Closure;
  /** Coefficients of T(s) = -Q s^2 + a s + b. */
  a: number;
  b: number;
  Q: number;
  /** True when the level was anchored arbitrarily because it is undetermined. */
  anchored: boolean;
}

/** The quadratic coefficient Q = S / (2(n+1)k). */
export function quadCoeff(p: ProfileParams): number {
  const n = shapeExponent(p.geometry);
  return p.gen / (2 * (n + 1) * p.kD);
}

/** The effective bulk value a mixed condition drives toward. For heat Phi is
 *  1; for mass it is the partition coefficient, so the surface equilibrates
 *  with Phi*C_inf rather than C_inf. */
function bulk(b: BCSpec): number {
  return (b.inf ?? 0) * (b.phi ?? 1);
}

/**
 * Solve the two-point problem. Returns the coefficients of
 * T(s) = -Q s^2 + a s + b together with an honest closure flag.
 *
 * Each condition contributes one linear equation in (a, b):
 *
 *   inner symmetry / sealed   a = 0
 *   inner value               b = V
 *   inner flux (pushed in)    -k a = q_in
 *   inner mixed               k a = h (b - bulk)
 *   outer value               -Q L^2 + a L + b = V
 *   outer flux (leaving)      2kQL - k a = q_out
 *   outer mixed               2kQL - k a = h(-Q L^2 + a L + b - bulk)
 *
 * In a cylinder or sphere a is identically zero (regularity), so only the
 * outer condition is used and the inner one is ignored.
 */
export function solveProfile(p: ProfileParams): Solved {
  const n = shapeExponent(p.geometry);
  const Q = quadCoeff(p);
  const k = p.kD;
  const L = p.L;
  const curved = n > 0;

  // Row i: m[0]*a + m[1]*b = rhs
  const rowInner = (): [number, number, number] => {
    const c = p.inner;
    switch (c.kind) {
      case 'value':
        return [0, 1, c.value ?? 0];
      case 'flux':
        return [-k, 0, c.flux ?? 0];
      case 'mixed':
        return [k, -(c.h ?? 0), -(c.h ?? 0) * bulk(c)];
      case 'symmetry':
      default:
        return [1, 0, 0];
    }
  };
  const rowOuter = (): [number, number, number] => {
    const c = p.outer;
    switch (c.kind) {
      case 'flux':
        return [-k, 0, (c.flux ?? 0) - 2 * k * Q * L];
      case 'mixed': {
        const h = c.h ?? 0;
        // 2kQL - k a = h(-Q L^2 + a L + b - bulk)
        // => -(k + hL) a - h b = -h Q L^2 - h*bulk - 2kQL
        return [-(k + h * L), -h, -h * Q * L * L - h * bulk(c) - 2 * k * Q * L];
      }
      case 'value':
      case 'symmetry':
      default:
        return [L, 1, (c.value ?? 0) + Q * L * L];
    }
  };

  if (curved) {
    // a == 0 by regularity at the center; one unknown, one condition.
    const [ma, mb, rhs] = rowOuter();
    void ma;
    if (Math.abs(mb) < 1e-12) {
      // An outer FLUX condition on a symmetric body says nothing about the
      // level: the flux is already fixed by the generation inside. It is
      // consistent only if the number matches, and even then b floats.
      const required = 2 * k * Q * L;
      const given = p.outer.flux ?? 0;
      const scale = Math.max(Math.abs(required), Math.abs(given), 1e-30);
      const consistent = Math.abs(required - given) <= 1e-9 * scale;
      return {
        closure: consistent ? 'floating' : 'no-steady-state',
        a: 0, b: consistent ? 0 : Number.NaN, Q, anchored: consistent,
      };
    }
    return { closure: 'ok', a: 0, b: rhs / mb, Q, anchored: false };
  }

  const [a1, b1, r1] = rowInner();
  const [a2, b2, r2] = rowOuter();
  const det = a1 * b2 - b1 * a2;
  const scale = Math.max(Math.abs(a1 * b2), Math.abs(b1 * a2), 1e-30);
  if (Math.abs(det) > 1e-12 * scale) {
    return { closure: 'ok', a: (r1 * b2 - b1 * r2) / det, b: (a1 * r2 - r1 * a2) / det, Q, anchored: false };
  }

  // Degenerate: both conditions are flux-like, so they constrain only the
  // slope. Steady state then requires that what leaves equals what is pushed
  // in plus what is generated; if it does, the shape is set and the level is
  // free. This is the "sealed on both sides with a heater running" case, and
  // it is a real answer, not a numerical failure.
  const aFromInner = Math.abs(a1) > 1e-30 ? r1 / a1 : Number.NaN;
  const aFromOuter = Math.abs(a2) > 1e-30 ? r2 / a2 : Number.NaN;
  const consistent =
    Number.isFinite(aFromInner) && Number.isFinite(aFromOuter)
      ? Math.abs(aFromInner - aFromOuter) <=
        1e-9 * Math.max(Math.abs(aFromInner), Math.abs(aFromOuter), 1e-30)
      : false;
  if (!consistent) {
    return { closure: 'no-steady-state', a: Number.NaN, b: Number.NaN, Q, anchored: false };
  }
  return { closure: 'floating', a: Number.isFinite(aFromInner) ? aFromInner : aFromOuter, b: 0, Q, anchored: true };
}

/** The profile value at s, 0 <= s <= L. NaN when no steady state exists. */
export function valueAt(p: ProfileParams, s: number, sol = solveProfile(p)): number {
  return -sol.Q * s * s + sol.a * s + sol.b;
}

/** The gradient dT/ds at s. */
export function slopeAt(p: ProfileParams, s: number, sol = solveProfile(p)): number {
  return -2 * sol.Q * s + sol.a;
}

/** Flux in the +s direction, -k dT/ds. At s = L this is what leaves; at
 *  s = 0 a positive number is heat travelling inward. */
export function fluxAt(p: ProfileParams, s: number, sol = solveProfile(p)): number {
  return -p.kD * slopeAt(p, s, sol);
}

/**
 * Everything generated inside has to leave, and this is that statement as a
 * number: generation per unit outer area, S*L/(n+1). It equals fluxAt(L)
 * minus whatever was pushed in at the inner face, for every geometry.
 */
export function generatedPerArea(p: ProfileParams): number {
  const n = shapeExponent(p.geometry);
  return (p.gen * p.L) / (n + 1);
}

/** The Biot number, h L / k — convection at the surface over conduction
 *  inside. Only meaningful when the outer condition is mixed. */
export function biot(p: ProfileParams): number {
  const h = p.outer.h ?? 0;
  return (h * p.L) / p.kD;
}

/**
 * How the total drop splits. Returns the fraction of the gap between the
 * hottest point and the bulk fluid that sits INSIDE the material rather than
 * across the film. For the lecture's symmetric slab this is
 * (Bi/2)/(1 + Bi/2); small Bi puts everything in the film, large Bi puts it
 * all inside. Returns NaN unless the outer condition is mixed.
 */
export function insideDropFraction(p: ProfileParams): number {
  if (p.outer.kind !== 'mixed') return Number.NaN;
  const sol = solveProfile(p);
  if (sol.closure === 'no-steady-state') return Number.NaN;
  const core = valueAt(p, 0, sol);
  const surf = valueAt(p, p.L, sol);
  const inf = bulk(p.outer);
  const total = core - inf;
  if (Math.abs(total) < 1e-30) return Number.NaN;
  return (core - surf) / total;
}

/* ------------------------------------------------------------------ *
 * The jump: two materials in contact
 *
 * At an interface the FLUX is always continuous — whatever leaves one side
 * enters the other, there is nowhere else for it to go. The VALUE is where
 * heat and mass part company:
 *
 *   temperature:   T1 = T2            (no jump, ever)
 *   concentration: C1 = Phi C2        (a jump, set by the materials)
 *
 * Phi is the partition coefficient; Henry's law C_water = H p_gas is the same
 * statement for a gas over a liquid. A solute can be twice as comfortable in
 * one phase as the other, and the profile steps at the boundary to say so.
 *
 * Two slabs, no generation, so each side is a straight line. Outer faces are
 * held at the two bulk values; everything in between follows from flux
 * continuity and the jump rule.
 * ------------------------------------------------------------------ */

export interface JumpParams {
  /** Thickness and diffusivity of the left material. */
  L1: number;
  kD1: number;
  /** Thickness and diffusivity of the right material. */
  L2: number;
  kD2: number;
  /** Held value at the far left face, and at the far right face. */
  left: number;
  right: number;
  /** Partition coefficient: value_1 = phi * value_2 at the interface.
   *  Exactly 1 for heat — a temperature cannot jump. */
  phi: number;
}

export interface JumpSolution {
  /** Value at the interface approached from the left, and from the right. */
  interfaceLeft: number;
  interfaceRight: number;
  /** The single flux through the stack (positive left to right). */
  flux: number;
}

/**
 * Solve the two-material stack. With j the common flux,
 *
 *   left  side:  value falls linearly from `left` to C1 over L1
 *                j = kD1 (left - C1) / L1
 *   right side:  from C2 to `right` over L2
 *                j = kD2 (C2 - right) / L2
 *   interface:   C1 = phi C2
 *
 * Eliminating gives j, and the two interface values follow. With phi = 1 the
 * two coincide and the familiar series-resistance answer drops out.
 */
export function solveJump(p: JumpParams): JumpSolution {
  const r1 = p.L1 / p.kD1;
  const r2 = p.L2 / p.kD2;
  // left - j r1 = C1 = phi C2 = phi (right + j r2)
  // => left - phi*right = j (r1 + phi r2)
  const flux = (p.left - p.phi * p.right) / (r1 + p.phi * r2);
  const interfaceLeft = p.left - flux * r1;
  const interfaceRight = p.right + flux * r2;
  return { interfaceLeft, interfaceRight, flux };
}
