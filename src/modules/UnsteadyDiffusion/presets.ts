import type { UnsteadyParams } from '../../lib/unsteady';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose. */
  source: string;
  blurb: string;
  params: UnsteadyParams;
  /** Release geometry the preset assumes. Default 'plane'. */
  release?: 'plane' | 'point';
  /** Cargo: molecules with D, or thermal energy with alpha. Default 'mass'. */
  cargo?: 'mass' | 'heat';
  /** Optional hand-checkable answer, so the simulator can be trusted. */
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'capsule',
    name: 'Drug burst from a capsule',
    source: 'Pharma',
    blurb:
      'A capsule coating fails all at once, releasing 10 nmol of drug across a 1 cm² tissue plane. Watch the cloud at t = 100 s. How far will it usefully reach?',
    check: 'σ(100 s) = 141 µm, and the 100 µm mark takes t = L²/2D = 50 s',
    params: { D: 1e-6, M: 1e-8, A: 1, t: 100, Lint: 0.01 },
  },
  {
    id: 'synapse',
    name: 'Neurotransmitter in a synapse',
    source: 'Neuro',
    blurb:
      'A vesicle dumps its contents into a 20 nm synaptic cleft. Diffusion has a bad reputation for being slow — is it, at this distance?',
    check: 't = L²/2D = 0.5 µs. At 20 nm, diffusion is effectively instantaneous',
    params: { D: 4e-6, M: 1e-16, A: 1e-9, t: 5e-7, Lint: 2e-6 },
  },
  {
    id: 'tea',
    name: 'Sugar in unstirred tea',
    source: 'Kitchen',
    blurb:
      'Sugar dissolves at the bottom of the cup. Wait for diffusion alone to sweeten the top — one centimetre away.',
    check: 't = L²/2D = 10⁵ s ≈ 28 hours. This is why you stir',
    params: { D: 5e-6, M: 1e-4, A: 20, t: 1e5, Lint: 1 },
  },
  {
    id: 'depot',
    name: 'Drug depot at a point',
    source: 'Pharma',
    blurb:
      'One nanomole injected at a point in tissue — a depot, not a plane. After an hour, how big is the treated region, and how dilute has the dose become?',
    release: 'point',
    check: 'σᵣ = √(6Dt) ≈ 2.1 mm, and C(0) = M/(4πDt)^(3/2) ≈ 3.7 × 10⁻⁸ mol/cm³',
    params: { D: 2e-6, M: 1e-9, A: 1, t: 3600, Lint: 0.2 },
  },
  {
    id: 'weld',
    name: 'Weld spot on a steel plate',
    source: 'Workshop',
    blurb:
      'A tack weld dumps heat into one face of a 1 cm steel plate. Steel has α ≈ 0.12 cm²/s — how long before the back face knows?',
    cargo: 'heat',
    check: 't = L²/2α ≈ 4 s for the back of a 1 cm plate. Same clock as diffusion, thermal cargo',
    params: { D: 0.118, M: 1e-8, A: 1, t: 4.2, Lint: 1 },
  },
  {
    id: 'copperhandle',
    name: 'Copper pan handle',
    source: 'Kitchen',
    blurb:
      'The flame heats the pan; the 10 cm copper handle carries the news to your hand. Copper is the sprinter of conduction: α ≈ 1.2 cm²/s.',
    cargo: 'heat',
    check: 't = L²/2α ≈ 43 s down 10 cm of copper — a steel handle of the same length takes ~7 minutes, which is why it gets a grip and copper gets a warning',
    params: { D: 1.16, M: 1e-8, A: 1, t: 43, Lint: 10 },
  },
  {
    id: 'stillwater',
    name: 'A warm patch in still water',
    source: 'Everyday',
    blurb:
      'Heat a spot in unstirred water and wait for pure conduction to carry it one centimetre. Water is a terrible conductor — that is why convection exists.',
    cargo: 'heat',
    release: 'point',
    check: 't = L²/2α ≈ 6 minutes per centimetre ALONG ONE AXIS (α ≈ 1.4×10⁻³ cm²/s); the radial readout above spreads over three. Buoyancy beats both easily — pots stir themselves',
    params: { D: 1.43e-3, M: 1e-8, A: 1, t: 350, Lint: 1 },
  },
  {
    id: 'perfume',
    name: 'Perfume in a still room',
    source: 'Everyday',
    blurb:
      'A bottle opens 3 m away, in air with zero drafts. Gases have the biggest D there is — a tenth of a cm²/s — and it still is not enough.',
    check: 't = L²/2D ≈ 4.5 × 10⁵ s ≈ 5 days. Smelling it in seconds is air currents, not diffusion',
    params: { D: 0.1, M: 1e-6, A: 100, t: 4.5e5, Lint: 300 },
  },
];

export const DEFAULT_PARAMS: UnsteadyParams = PRESETS[0].params;
