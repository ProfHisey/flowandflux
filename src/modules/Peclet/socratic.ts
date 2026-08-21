import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const PECLET_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Pe = vL/D is a ratio. A ratio of what to what — in units of time?',
    probe: 'Compare the t_diff and t_conv readouts as you slide v.',
    resolution:
      'Of clocks: the time diffusion needs to cross L (t_diff ~ L²/D) against the time the flow needs (t_conv = L/v). Their ratio IS Pe (within a factor of 2). Every dimensionless group in transport is secretly a race between two timescales, and reading them that way — rather than as letter soup — is the skill: Pe ≪ 1 means diffusion finished before the flow showed up; Pe ≫ 1 means the flow delivered while diffusion was still tying its shoes.',
  },
  {
    q: 'At Pe ≫ 1 the profile becomes a plug at C₀ with a thin layer at the far end. Why does the UPSTREAM value win, and why does a layer survive at all?',
    resolution:
      'The flow carries whatever it was given — information travels downstream, so the upstream boundary rules the interior; the downstream bath can only make itself felt as far as diffusion can fight back upstream, which is a distance ~L/Pe. That surviving sliver is a boundary layer — the module\'s single most load-bearing idea, because ALL of convective transfer theory (h, h_m, Nu, Sh) is bookkeeping for what happens inside such layers. Convection never kills molecular transport; it corners it.',
  },
  {
    q: 'Same channel, same flow: is Pe for heat the same as Pe for mass?',
    resolution:
      'Almost never. Pe_mass = vL/D and Pe_heat = vL/α use different diffusivities, and in water α ≈ 100 D: heat is a hundred times better at fighting the flow than a solute is. A channel can easily be convection-dominated for mass while still conduction-dominated for heat. And momentum has its own copy: vL/ν, better known as Re — one ratio in three costumes, with the costume ratios (Sc = ν/D, Pr = ν/α) organizing everything that comes later.',
  },
  {
    q: 'The flux chart has a flat floor and a slope-1 climb. What is each regime saying, in purchasing terms?',
    resolution:
      'The floor: below Pe ~ 1, pumping harder buys nothing — diffusion sets the rate and the flow is decoration. The climb: above Pe ~ 1, flux is vC₀, so every increment of flow is an increment of delivery, and diffusion is along for the ride. Engineering a delivery system is deciding which side of the knee to operate on — and noticing that near the knee, both mechanisms bill you.',
  },
  {
    q: 'The bolus-dispersion module said perfume needs five days to cross a still room. You smell it in seconds. Reconcile.',
    probe: 'Load the "Perfume, revisited" preset.',
    resolution:
      'No room is still. A 10 cm/s draft gives Pe = 30,000 over 3 m: convection hauls the scent across the room in 30 seconds, and diffusion does only the final, unavoidable millimetres — through the still air layer at your nostrils, where no draft reaches. That division of labour is universal in physiology: bulk flow (blood, breath, stirring) covers distance; diffusion covers the last 100 µm. Pe tells you where the handoff happens.',
  },
];
