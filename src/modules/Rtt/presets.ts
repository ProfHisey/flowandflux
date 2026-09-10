import type { RttFace } from '../../lib/rtt';

/**
 * One parameter shape serves all four faces; the sliders relabel it. The
 * comments give the four readings of each field in face order
 * (mass / momentum / energy / wealth).
 */
export interface RttParams {
  face: RttFace;
  /** Mean flow: kg/s / kg/s / kg/s / shares bought per year. */
  mdot: number;
  /** Mean inlet b: 1 / (derived u_in) / T_in °C / P₀ $ per share. */
  bIn: number;
  /** Inlet excursion: — / (locked) / K / fractional swing of price around trend. */
  bFluct: number;
  /** Relative std dev of the inflow rate, 0..1. */
  flowFluct: number;
  /** Correlation between inflow surges and inlet-b excursions, −1..1. */
  rho: number;
  /** The device: — / force on the contents, N / heater, W / trend return per year. */
  source: number;
  /** Duct length, m — or the holding period, years. */
  L: number;
  /** Correlation time of the fluctuations, s — or years. */
  tauC: number;
  /** Opening balance, $ (wealth only). */
  V0: number;
  /** Control-surface positions as fractions of L. */
  box0: number;
  box1: number;
  /** Plug flow or the 2D-channel parabola. */
  parabolic: boolean;
}

/** Water in a 10 cm² duct: u = ṁ / (ρA) = ṁ / 1.0, numerically ṁ in m/s. */
export const RHO_WATER = 1000; // kg/m³
export const DUCT_AREA = 1e-3; // m²
export const CP_WATER = 4186; // J/kg·K

export const FACE_DEFAULTS: Record<RttFace, RttParams> = {
  mass: {
    face: 'mass', mdot: 0.2, bIn: 1, bFluct: 0, flowFluct: 0.5, rho: 0, source: 0,
    L: 1, tauC: 1, V0: 0, box0: 0.35, box1: 0.65, parabolic: false,
  },
  momentum: {
    face: 'momentum', mdot: 0.2, bIn: 0.2, bFluct: 0, flowFluct: 0.3, rho: 1, source: 0.1,
    L: 1, tauC: 1, V0: 0, box0: 0.35, box1: 0.65, parabolic: false,
  },
  energy: {
    face: 'energy', mdot: 0.1, bIn: 20, bFluct: 5, flowFluct: 0.5, rho: 0.8, source: 500,
    L: 1, tauC: 1, V0: 0, box0: 0.35, box1: 0.65, parabolic: false,
  },
  wealth: {
    face: 'wealth', mdot: 200, bIn: 100, bFluct: 0.15, flowFluct: 0.6, rho: 0.8, source: 0.07,
    L: 3, tauC: 1, V0: 10000, box0: 0.05, box1: 0.95, parabolic: false,
  },
};

export interface RttPreset {
  id: string;
  face: RttFace;
  name: string;
  source: string;
  blurb: string;
  check?: string;
  params: Partial<RttParams>;
}

export const PRESETS: RttPreset[] = [
  // ------------------------------------------------------------ mass
  {
    id: 'steady-stream',
    face: 'mass',
    name: 'A steady stream',
    source: 'b = 1',
    blurb:
      'Nothing fluctuates and nothing is made. What crosses the upstream face crosses the downstream face — and the box\'s contents never change. The theorem with every term at rest.',
    check: 'Storage = 0, influx = outflux = ṁ = 0.20 kg/s, source = 0. Drag the box anywhere: the numbers do not move',
    params: { flowFluct: 0, rho: 0 },
  },
  {
    id: 'surges',
    face: 'mass',
    name: 'Surges',
    source: 'storage ≠ 0',
    blurb:
      'The inflow gusts. Mass still cannot be made, yet the box\'s contents swing — because for a moment more comes in than goes out. Storage is not a source. It is a delay.',
    check: 'Source stays exactly 0 while storage swings both ways. Averaged over a few correlation times, storage → 0 and ⟨in⟩ = ⟨out⟩',
    params: { flowFluct: 0.6, tauC: 1 },
  },
  // -------------------------------------------------------- momentum
  {
    id: 'pump',
    name: 'A push inside the box',
    face: 'momentum',
    source: 'F = ṁ Δu',
    blurb:
      'A steady stream at 0.2 m/s meets a 0.1 N push inside the box and leaves faster. The force on the contents is exactly the jump in momentum flux — the momentum balance, measured, not asserted.',
    check: 'u_out = u_in + F/ṁ = 0.20 + 0.10/0.20 = 0.70 m/s. Source = 0.10 N; outflux − influx = ṁ(u_out − u_in) = 0.10 N',
    params: { flowFluct: 0, source: 0.1 },
  },
  {
    id: 'gusty',
    name: 'A gusty inlet, no push',
    face: 'momentum',
    source: 'Reynolds stress',
    blurb:
      'No force anywhere, but the inlet velocity wobbles ±30%. The mean momentum flux is HIGHER than ρAū² — momentum is carried by the same velocity that fluctuates, so the correlation term cannot be switched off. This is a Reynolds stress.',
    check: '⟨u²⟩ = ū²(1 + 0.3²) = 1.09 ū²: the measured momentum flux runs ~9% above mean × mean. The slider is locked at ρ = 1 because ṁ ∝ u',
    params: { flowFluct: 0.3, source: 0 },
  },
  // ---------------------------------------------------------- energy
  {
    id: 'heater',
    name: 'An inline heater',
    face: 'energy',
    source: 'Q = ṁ c_p ΔT',
    blurb:
      '500 W into 0.1 kg/s of water. The outlet runs only a degree warmer — water is a big bucket per kilogram. The first law for an open system, closing live.',
    check: 'ΔT = Q/(ṁ c_p) = 500/(0.1 × 4186) = 1.19 K, so T_out = 21.19 °C. Halve ṁ and ΔT doubles',
    params: { flowFluct: 0, bFluct: 0, rho: 0, source: 500 },
  },
  {
    id: 'pulses-steady',
    name: 'Hot pulses, steady flow',
    source: '⟨ṁ′T′⟩ = 0',
    face: 'energy',
    blurb:
      'The inlet temperature swings ±5 K but the flow does not. No correlation, no extra heat: the flux is mean × mean, and the pulses just average out.',
    check: 'Correlation term ≈ 0 (it wanders around zero with the noise). Measured enthalpy flux ≈ ṁ c_p ⟨T⟩',
    params: { flowFluct: 0, bFluct: 5, rho: 0, source: 0 },
  },
  {
    id: 'pulses-surges',
    name: 'Hot pulses that arrive in surges',
    source: 'turbulent heat flux',
    face: 'energy',
    blurb:
      'Same ±5 K pulses, but now the flow surges WITH them (ρ = 0.8). The surges carry the hot water: the enthalpy flux runs above mean × mean by ⟨ṁ′T′⟩c_p. This is exactly what an eddy does.',
    check: '⟨ṁ′T′⟩ c_p = ρ σ_ṁ σ_T c_p = 0.8 × (0.5 × 0.1) × 5 × 4186 ≈ 840 W of extra heat carried by the correlation alone — with the mean flow and mean temperature unchanged',
    params: { flowFluct: 0.5, bFluct: 5, rho: 0.8, source: 0 },
  },
  // ---------------------------------------------------------- wealth
  {
    id: 'lump-sum',
    name: 'Lump sum, left alone',
    face: 'wealth',
    source: 'no flux',
    blurb:
      'Ten thousand dollars in at the start, nothing added, nothing taken, held longer than the window. No control-surface term at all — so the account\'s return IS the fund\'s return.',
    check: 'Deposits = withdrawals = 0 inside the window ⟹ dollar-weighted = time-weighted exactly. Gap = 0.000%/yr, not approximately',
    params: { mdot: 0, flowFluct: 0, rho: 0, L: 30, box0: 0.02, box1: 0.98 },
  },
  {
    id: 'random-flows',
    name: 'Flows that ignore the market',
    face: 'wealth',
    source: '⟨n′P′⟩ = 0',
    blurb:
      'Buying 200 shares a year on a schedule that swings but has nothing to do with the price. A control-surface term now exists, but it is uncorrelated with the market — the two returns agree on average and wander around each other.',
    check: 'The correlation term hovers near zero and the gap wanders around 0 with no trend. Restart (⚡) a few times: sometimes ahead, sometimes behind',
    params: { flowFluct: 0.6, rho: 0 },
  },
  {
    id: 'buy-high',
    name: 'Buying high',
    face: 'wealth',
    source: 'the behavior gap',
    blurb:
      'Same schedule, but the buying surges when the price sits above its trend (ρ = 0.8): the dollars go in dear and, a holding period later, come out after the price has settled back. The account now earns less than the fund it is invested in.',
    check: 'Dollar-weighted < time-weighted. The correlation term is positive: you paid above the average price. Published investor shortfalls are of order a percentage point a year — cite the current Mind the Gap edition for the figure',
    params: { flowFluct: 0.6, rho: 0.8 },
  },
  {
    id: 'buy-low',
    name: 'Buying the dips',
    face: 'wealth',
    source: 'ρ < 0',
    blurb:
      'The mirror image: buying surges when the price is BELOW trend. Same fund, same mean flows, opposite correlation — and now the account beats the fund. Dollar-cost averaging lives on this side, mildly: fixed dollars buy fewer shares when the price is high.',
    check: 'Dollar-weighted > time-weighted, correlation term negative. The gap flips sign with ρ and nothing else changed',
    params: { flowFluct: 0.6, rho: -0.8 },
  },
];

/** The preset each face opens on — the one whose story reads best cold. */
export const DEFAULT_PRESET: Record<RttFace, string> = {
  mass: 'surges',
  momentum: 'pump',
  energy: 'heater',
  wealth: 'buy-high',
};

export function presetParams(id: string): RttParams {
  const pr = PRESETS.find((p) => p.id === id);
  if (!pr) return FACE_DEFAULTS.energy;
  return { ...FACE_DEFAULTS[pr.face], ...pr.params };
}

/** Opens on the inline heater — steady flow, so measured meets predicted
 *  exactly and the surges are something the reader switches ON. */
export const DEFAULT_PARAMS: RttParams = presetParams(DEFAULT_PRESET.energy);
