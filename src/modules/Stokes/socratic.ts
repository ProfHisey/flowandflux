import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const STOKES_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'A cell-sized particle reaches terminal velocity in a fifth of a microsecond. What does that buy you, practically, when solving problems?',
    resolution:
      'The right to ignore acceleration entirely. For anything small in a viscous fluid, F = ma collapses to F = 0 — forces balance at every instant, and velocity is whatever makes the drag close the books. This "overdamped" regime is where cells, proteins, and every microfluidic device live: nothing coasts, nothing overshoots, and stopping the force stops the motion immediately. Microscale life has no momentum, only friction.',
  },
  {
    q: 'v∞ goes as a². A cell settles a centimeter per day; what about the protein a hundred times smaller, and what rescues the situation?',
    probe: 'Slide the radius down two decades and watch the settling-time readout.',
    resolution:
      'A hundred times smaller means ten thousand times slower — a quarter-century per centimeter. Gravity has effectively resigned. The rescue is the only linear knob left: g itself. Spin the sample at 100,000 g and the impossible decades become a workable afternoon. Every centrifugation protocol is this arithmetic — choosing g and time to catch particles of one size while leaving smaller ones suspended.',
  },
  {
    q: 'The drag force 6πμav contains the same 6πμa as the Stokes–Einstein diffusivity D = k_BT/6πμa. Coincidence?',
    resolution:
      'The opposite of coincidence — it is the same friction, met twice. Drag is that friction resisting motion you impose; diffusion is thermal energy k_BT rattling the particle against that same friction. One coefficient, two jobs, and their product hints at something deep: the fluid that damps you is the fluid that kicks you (the fluctuation–dissipation idea). Small dense particles both settle AND diffuse; which wins is yet another dimensionless contest — v∞a/D.',
  },
  {
    q: 'The raindrop preset produces an absurd 121 m/s. The algebra is flawless. What failed?',
    probe: 'Check the Re readout on that preset against the others.',
    resolution:
      'The assumption under the algebra. Stokes drag is the Re < 1 answer, where fluid creeps around the sphere; at Re in the thousands the wake separates, pressure drag takes over, and the real drag is far larger than 6πμav — so the real terminal velocity (~6 m/s) is far smaller. Every formula ships with a validity range, and the professional habit is checking the dimensionless number BEFORE trusting the output. This preset exists to reward that habit.',
  },
  {
    q: 'Blood in a tube: the red cells settle a few millimeters per hour, and hospitals bill for watching it happen. Why is that number diagnostically useful?',
    resolution:
      'Because v∞ ∝ a²: inflammation coats red cells with fibrinogen and makes them stack into rouleaux — effectively larger particles — and the sedimentation rate jumps quadratically with that size change. The ESR is Stokes law repurposed as a $10 inflammation assay: no molecular biology, just a glass tube, an hour, and a ruler. Transport physics as diagnostics.',
  },
];
