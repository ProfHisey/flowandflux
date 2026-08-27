import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const DIVIDER_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'You pulled the divider and the crowded side emptied into the sparse side. Nothing pushed the particles. What made them go?',
    probe: 'Watch a single particle for ten seconds. Does it care where the crowd is?',
    resolution:
      'Nothing made them go — each particle wanders exactly as it did before, blind to the crowd. More particles simply start on the crowded side, so more of the random crossings happen crowd-to-empty than the reverse. "Diffusion down the gradient" is a headcount, not a force. Every module on this site is a variation on that sentence.',
  },
  {
    q: 'Set 100 cyan on the left and 100 orange on the right, then pull the divider. Each color moves into territory that is already fully occupied by the other. Why does either of them bother?',
    resolution:
      'Because each species only counts its own kind. Cyan has a cyan gradient regardless of how much orange is present, so cyan spreads right while orange spreads left, straight through each other. Fick\'s law applies to each species separately — a fact that matters enormously in physiology, where dozens of solutes diffuse through the same water at once without waiting in line.',
  },
  {
    q: 'In the heat version, the right half warms up — but watch closely: not a single molecule moves across the middle. What crossed?',
    resolution:
      'Energy crossed; matter did not. Each molecule stays bonded to its site and merely hands kinetic energy to its neighbors, collision by collision. This is the whole difference between diffusion of mass and conduction of heat, and the two boxes side by side are the cleanest way to see it: same mathematics, different cargo.',
  },
  {
    q: 'Both boxes end up uniform and then nothing more happens. The Fick and Fourier modules end with a gradient that lasts forever. What do those setups have that this box lacks?',
    resolution:
      'Boundaries held by reservoirs. This box is sealed and insulated, so it can only relax to uniformity — equilibrium. The steady-state modules pin the two ends at fixed values, and it is that continuous feeding and removing which sustains a permanent gradient and a permanent flux. Equilibrium is what happens when you close the box; steady state is what sources and sinks buy you. Confusing the two is the classic first-week error.',
  },
];
