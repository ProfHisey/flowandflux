import type { PecletParams } from '../../lib/peclet';
import { mMToMolPerCm3 } from '../../lib/fick';

export interface Preset {
  id: string;
  name: string;
  source: string;
  blurb: string;
  params: PecletParams;
  check?: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'tie',
    name: 'The contested channel',
    source: 'Pe ≈ 3',
    blurb:
      'A 1 mm channel where the flow is just fast enough to matter and just slow enough not to win. Neither mechanism can be dropped.',
    check: 'Pe = vL/D = 3: the profile is the exponential negotiation between the two — neither the diffusion line nor the convection plug',
    params: { D: 1e-5, v: 3e-4, L: 0.1, C0: mMToMolPerCm3(5), CL: mMToMolPerCm3(1) },
  },
  {
    id: 'pore',
    name: 'A membrane pore',
    source: 'Pe ≪ 1',
    blurb:
      'A 10 µm pore with a gentle seep of fluid through it. Does the flow change what diffusion would have done alone?',
    check: 'Pe = 0.002 — the profile is indistinguishable from the pure-diffusion straight line. Below Pe ~ 0.1, pretend the flow is not there',
    params: { D: 5e-6, v: 1e-5, L: 1e-3, C0: mMToMolPerCm3(5), CL: 0 },
  },
  {
    id: 'tubing',
    name: 'IV tubing',
    source: 'Pe ≫ 1',
    blurb:
      'Drug solution moving at 10 cm/s down 10 cm of tubing. Ask diffusion how long it would have needed, then thank the pump.',
    check: 'Pe = 2×10⁷. The flux is vC₀ exactly: whatever is upstream simply arrives. Diffusion survives only in a boundary layer ~L/Pe thick at the far end',
    params: { D: 5e-6, v: 10, L: 10, C0: mMToMolPerCm3(5), CL: 0 },
  },
  {
    id: 'draft',
    name: 'Perfume, revisited',
    source: 'Callback',
    blurb:
      'The bolus-dispersion module found that 3 m of still air takes ~5 days by diffusion. Now add the gentlest draft — 10 cm/s. That is why you smell it in seconds.',
    check: 'Pe = vL/D = 30,000, and t_conv = L/v = 30 s against t_diff ≈ 5 days. Real rooms are never still; convection does the delivery, diffusion does the last millimetre',
    params: { D: 0.1, v: 10, L: 300, C0: mMToMolPerCm3(0.001), CL: 0 },
  },
];

export const DEFAULT_PARAMS: PecletParams = PRESETS[0].params;
