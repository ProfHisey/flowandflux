import type { UnsteadyParams } from '../../lib/unsteady';

export interface Preset {
  id: string;
  name: string;
  /** Short context tag shown beside the name. Course-neutral on purpose. */
  source: string;
  blurb: string;
  params: UnsteadyParams;
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
