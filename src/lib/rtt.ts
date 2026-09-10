/**
 * The Reynolds transport theorem, as bookkeeping.
 *
 * For any extensive property B = ∫ ρ b dV carried by a moving material, the
 * rate of change of B for a SYSTEM (a fixed set of material) equals the rate
 * of change inside a fixed CONTROL VOLUME plus the net rate B is carried out
 * through the control surface:
 *
 *   dB_sys/dt = d/dt ∫_CV ρ b dV + ∮_CS ρ b (v · n) dA
 *
 * Physics then says what dB_sys/dt IS: zero for mass, the net force for
 * momentum, the heat added for energy. So the identity becomes a balance,
 *
 *   source = storage + outflux − influx,
 *
 * and the same four words describe a pipe, a heater, a pump, and a brokerage
 * statement (market gain = Δbalance + withdrawals − deposits). Choosing b is
 * the whole job; the theorem never changes.
 *
 * This file is the discrete version the canvas runs: parcels of material
 * carrying b, a box, a step. `stepParcels` returns the four terms with the
 * bookkeeping arranged so the residual is zero to floating point — not
 * approximately, exactly — which is what lets verify.ts pin it.
 *
 * Units are the caller's. The canvas uses SI for the physics faces (kg, m,
 * s, °C with c_p outside) and shares/dollars/years for the wealth face; the
 * step function never needs to know.
 */

export type RttFace = 'mass' | 'momentum' | 'energy' | 'wealth';

export interface Parcel {
  /** Position along the duct (m, or years of holding age on the wealth face). */
  x: number;
  /** Cross-stream position, 0..1 of the duct height. Cosmetic except that the
   *  parabolic profile reads it. */
  y: number;
  /** Velocity along the duct. Equals b on the momentum face. */
  u: number;
  /** The intensive property: 1, u, T, or price. */
  b: number;
  /** Mass (or shares) this parcel stands for. */
  m: number;
  /** Member of the tagged system — the dye. */
  tagged: boolean;
}

export interface Box {
  x0: number;
  x1: number;
}

/**
 * What changes b while the material moves.
 *   none        — a conserved scalar (mass).
 *   inBox       — a device inside the box adds B to its contents at a fixed
 *                 total rate, shared among whatever is inside: a heater (Q/c_p
 *                 in kg·K/s), a pump (F in N). Σ m·Δb over the contents is
 *                 exactly `total · dt`.
 *   everywhere  — every parcel's b is multiplied by `factor` this step,
 *                 inside the box or not: the market moving every share.
 */
export type Source =
  | { kind: 'none' }
  | { kind: 'inBox'; total: number }
  | { kind: 'everywhere'; factor: number };

export interface StepResult {
  /** Σ m·Δb over parcels that were inside the box when the step began. */
  source: number;
  /** B carried out through the downstream face this step (post-step b). */
  outflux: number;
  /** B carried in through the upstream face this step (post-step b). */
  influx: number;
  /** B_box after the step minus B_box before it. */
  storage: number;
  /** source − (storage + outflux − influx). Zero to floating point. */
  residual: number;
  /** Mass (or shares) inside the box before the step. */
  massInBox: number;
}

export function inBox(x: number, box: Box): boolean {
  return x >= box.x0 && x < box.x1;
}

/**
 * Advance every parcel by dt and return the ledger for the box. The
 * bookkeeping that makes the residual exactly zero:
 *   - the source is credited to parcels by their membership BEFORE the move;
 *   - a parcel that exits carries its post-step b (it received the source
 *     while it was still inside);
 *   - a parcel that enters carries its post-step b too (an "everywhere"
 *     source acted on it in transit; an "inBox" source did not).
 * Work through the four membership cases and every term cancels except the
 * ones written on the theorem. A parcel that jumps clean across a box
 * narrower than u·dt is counted in and straight back out.
 */
export function stepParcels(
  parcels: Parcel[],
  dt: number,
  box: Box,
  source: Source,
  bIsVelocity: boolean,
): StepResult {
  const n = parcels.length;
  const wasIn = new Uint8Array(n);
  const xBefore = new Float64Array(n);
  let Bbefore = 0;
  let massInBox = 0;
  for (let i = 0; i < n; i++) {
    const p = parcels[i];
    xBefore[i] = p.x;
    if (inBox(p.x, box)) {
      wasIn[i] = 1;
      Bbefore += p.m * p.b;
      massInBox += p.m;
    }
  }

  let sourceSum = 0;
  for (let i = 0; i < n; i++) {
    const p = parcels[i];
    let db = 0;
    if (source.kind === 'inBox') {
      if (wasIn[i] && massInBox > 0) db = (source.total * dt) / massInBox;
    } else if (source.kind === 'everywhere') {
      db = p.b * (source.factor - 1);
    }
    p.x += p.u * dt;
    p.b += db;
    if (bIsVelocity) p.u = p.b;
    if (wasIn[i]) sourceSum += p.m * db;
  }

  let Bafter = 0;
  let outflux = 0;
  let influx = 0;
  for (let i = 0; i < n; i++) {
    const p = parcels[i];
    const isIn = inBox(p.x, box);
    if (isIn) Bafter += p.m * p.b;
    if (wasIn[i] && !isIn) outflux += p.m * p.b;
    else if (!wasIn[i] && isIn) influx += p.m * p.b;
    else if (!wasIn[i] && !isIn && xBefore[i] < box.x0 && p.x >= box.x1) {
      influx += p.m * p.b;
      outflux += p.m * p.b;
    }
  }

  const storage = Bafter - Bbefore;
  return {
    source: sourceSum,
    outflux,
    influx,
    storage,
    residual: sourceSum - (storage + outflux - influx),
    massInBox,
  };
}

// ----------------------------------------------------------- steady state

/**
 * The steady balance every face reduces to once storage averages out:
 * whatever the device adds per second leaves as a jump in b times the mass
 * flow. b_out = b_in + total/ṁ. Energy: T_out = T_in + Q/(ṁ c_p). Momentum:
 * u_out = u_in + F/ṁ.
 */
export function steadyOutlet(bIn: number, mdot: number, total: number): number {
  return bIn + total / mdot;
}

// ---------------------------------------------------- the velocity profile

/**
 * Plug flow, or the 2D-channel parabola with the same mean: u(y) = 6 ū y(1−y)
 * for y in [0, 1], so u_max = 1.5 ū and ∫u dy = ū.
 */
export function profileVelocity(y: number, uMean: number, parabolic: boolean): number {
  return parabolic ? 6 * uMean * y * (1 - y) : uMean;
}

/**
 * A cross-stream position for a parcel ENTERING the duct, drawn from the
 * FLUX-weighted distribution P(y) ∝ u(y). Sample area-weighted instead and
 * the fast core is under-populated — the same trap the mixing-cup canvas
 * documents. CDF of 6y(1−y) is 3y² − 2y³; inverted by a few Newton steps.
 */
export function fluxWeightedY(uniform: number, parabolic: boolean): number {
  if (!parabolic) return uniform;
  let y = uniform;
  for (let k = 0; k < 6; k++) {
    const f = 3 * y * y - 2 * y * y * y - uniform;
    const df = 6 * y - 6 * y * y;
    if (df < 1e-9) break;
    y -= f / df;
    y = Math.min(0.999, Math.max(0.001, y));
  }
  return y;
}

// -------------------------------------------- Reynolds decomposition

/**
 * ⟨n b⟩ = ⟨n⟩⟨b⟩ + ⟨n' b'⟩. The last term is the whole content of turbulent
 * transport — and of "buying high": a flow that surges when the property is
 * high carries more than the mean flow times the mean property. Sample
 * covariance over a window of paired observations.
 */
export function reynoldsCovariance(
  n: ArrayLike<number>,
  b: ArrayLike<number>,
): { meanN: number; meanB: number; meanNB: number; cov: number } {
  const N = Math.min(n.length, b.length);
  if (N === 0) return { meanN: 0, meanB: 0, meanNB: 0, cov: 0 };
  let sn = 0;
  let sb = 0;
  let snb = 0;
  for (let i = 0; i < N; i++) {
    sn += n[i];
    sb += b[i];
    snb += n[i] * b[i];
  }
  const meanN = sn / N;
  const meanB = sb / N;
  const meanNB = snb / N;
  return { meanN, meanB, meanNB, cov: meanNB - meanN * meanB };
}

/**
 * One Euler step of a unit-variance Ornstein–Uhlenbeck process with
 * correlation time tau: dη = −η dt/τ + √(2 dt/τ) Z. Stationary variance 1.
 */
export function ouStep(eta: number, dt: number, tau: number, z: number): number {
  const a = Math.min(1, dt / tau);
  return eta - eta * a + Math.sqrt(2 * a) * z;
}

// ----------------------------------------------------------- the money face

/** The trend price: P0 e^{μt}. */
export function priceTrend(P0: number, mu: number, t: number): number {
  return P0 * Math.exp(mu * t);
}

/**
 * Time-weighted return, continuously compounded and annualized: what one
 * unit that stayed the whole time experienced. Follows the material.
 */
export function timeWeightedRate(P0: number, P1: number, T: number): number {
  if (T <= 0 || P0 <= 0 || P1 <= 0) return 0;
  return Math.log(P1 / P0) / T;
}

export interface CashFlow {
  /** Time of the flow, from the start of the window. */
  t: number;
  /** Signed: deposits positive, withdrawals negative. */
  f: number;
}

/**
 * Dollar-weighted (money-weighted) return: the single continuously
 * compounded rate R at which the opening balance and every flow, grown to
 * the horizon, reproduce the closing balance:
 *
 *   V0 e^{RT} + Σ f_i e^{R(T − t_i)} = V_T.
 *
 * Follows the account, not the material — which is why it depends on WHEN
 * the flows happened. Bisection on [−5, 5] per unit time.
 */
export function dollarWeightedRate(
  V0: number,
  flows: readonly CashFlow[],
  VT: number,
  T: number,
): number {
  if (T <= 0) return 0;
  const g = (R: number) => {
    let s = V0 * Math.exp(R * T);
    for (const c of flows) s += c.f * Math.exp(R * (T - c.t));
    return s - VT;
  };
  let lo = -5;
  let hi = 5;
  let glo = g(lo);
  const ghi = g(hi);
  if (glo * ghi > 0) return glo > 0 ? lo : hi;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    const gm = g(mid);
    if (gm === 0) return mid;
    if (gm * glo < 0) hi = mid;
    else {
      lo = mid;
      glo = gm;
    }
  }
  return (lo + hi) / 2;
}
