import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const UNSTEADY_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'The cloud spreads as √t, not t. A walker takes just as many steps in the second minute as in the first — so where does the slowdown come from?',
    probe: 'Burst the capsule and watch the σ readout. Compare the first few seconds with the next thirty.',
    resolution:
      'Each step forgets the last, so steps cancel as often as they add. After N steps the typical displacement is not N step-lengths but √N — progress made by random motion, not by intent. Run it backwards and you get the diffusion clock t = L²/2D: to get twice as far takes four times as long. Everything slow about diffusion is in that square.',
  },
  {
    q: 'The peak concentration falls exactly as 1/√t — not roughly, exactly. What forces that precise rate?',
    probe: 'Watch the C(x,t) chart: the curve flattens and widens at once.',
    resolution:
      'Conservation. The area under C(x,t) is the amount released, and nothing is created or destroyed, so if the width grows as √t the height has no choice but to fall as 1/√t. The shape is doing bookkeeping. This is the same conservation statement that will pin J constant through the wall in the steady-state module — met here first, where you can watch it work.',
  },
  {
    q: 'The synapse preset says 0.5 µs; the tea preset says 28 hours. Same law, same kind of molecule motion. What should this pair of numbers tell you about how living things are built?',
    resolution:
      'Diffusion is free, fast, and reliable below ~100 µm and useless beyond ~1 mm. So cells are small; tissues that outgrow the limit are threaded with capillaries every few tens of microns; lungs shred a breath across 100 m² of surface so no molecule diffuses far; and anything that must travel a distance gets a pump, a heartbeat, or a stir. Half of physiology is engineering around t = L²/2D.',
  },
  {
    q: 'On screen, the amber curve and the walker cloud eventually stop agreeing. Who is wrong?',
    resolution:
      'Neither — they are solving different problems. The curve is the solution for an unbounded medium; the walkers live in a box with reflecting walls. The moment the cloud feels the walls, the real answer changes and the open-medium formula stops applying. Knowing the domain of validity of a solution is worth more than the solution — every formula in this subject has a fine-print clause like this one.',
  },
  {
    q: 'Where is the steady state in this module?',
    resolution:
      'There is none, and that is the point of showing this first. Nothing holds the boundaries at fixed concentrations, so the system just relaxes toward uniform — C changes everywhere, forever (until flat). The steady-state module adds exactly one ingredient: reservoirs that pin the two ends. Then ∂C/∂t = D ∂²C/∂x² loses its left side, the profile freezes into a straight line, and flux becomes constant. Steady state is not the default condition of the world; it is what sources and sinks buy you.',
  },
];
