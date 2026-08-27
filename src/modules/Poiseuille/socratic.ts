import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const POISEUILLE_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Flow through a tube goes as R⁴ — not R² like the area. Where do the two extra powers of R come from?',
    probe: 'Load the "narrowed 20%" preset and account for the missing 59% of the flow.',
    resolution:
      'Two effects multiply. A wider tube has more area (R²) — that is the obvious part. But a wider tube also lets the fluid at the center sit FARTHER from the drag of the walls, so the average speed itself rises as R². Area times speed gives R⁴. This is why radius is the most powerful control knob in any flow network: vessels regulate blood pressure with muscle tone rather than with the heart, and a mild-looking stenosis costs far more flow than its geometry suggests.',
  },
  {
    q: 'The velocity profile is a parabola. In the Couette module it was a straight line. Same fluid, same law — what changed?',
    resolution:
      'The force balance. In Couette flow nothing pushes the interior, so τ must be the SAME at every height — constant τ = μ dv/dy means a straight profile. Here pressure pushes every layer of fluid, so the shear force must grow toward the wall to hold back an ever-larger share of the cross-section: τ rises linearly, and integrating a linear dv/dr gives a parabola. Read profiles backwards: straight means momentum passing through, curved means momentum being fed in along the way.',
  },
  {
    q: 'Where is the shear stress largest, and why should a red blood cell care?',
    probe: 'Compare the τ(s) chart with the v(s) chart.',
    resolution:
      'At the wall — exactly where the velocity is zero, which surprises people until they recall τ tracks the GRADIENT, not the speed. The wall is where flowing blood touches biology: endothelial cells sense τ_wall and remodel vessels around it, hemolysis in devices happens where shear peaks, and the force balance says the wall drag exactly equals the pressure push (τ_w·2πRL = ΔP·πR²). The center of the tube is, mechanically, the calmest place in the flow.',
  },
  {
    q: 'Solving the tube ODE produces a ln(r) term that we throw away. On what grounds — and what would keeping it mean physically?',
    resolution:
      'ln(r) → −∞ at the axis, and the center of the tube is ordinary fluid that cannot have infinite velocity — so its coefficient must be zero. "Finite at r = 0" is a boundary condition just as real as no-slip, and it is bought by geometry: an annulus (flow AROUND an inner rod) has no r = 0 in the domain, keeps the ln term, and that is exactly how annular-flow profiles differ.',
  },
  {
    q: 'The falling film has no pump, no pressure difference — yet it flows steadily. What plays the role of ΔP/L, and what does the wall shear have to equal?',
    resolution:
      'Gravity: ρg is a force per volume exactly as ΔP/L is, and swapping one for the other converts every plate formula into the film formulas. At steady state nothing accelerates, so the wall must carry the film\'s entire weight: τ_w = ρgh, no integration needed. And the free surface, with only air above it, can support no shear — so the gradient dies there and the speed peaks at the surface: half a parabola, the top half.',
  },
  {
    q: 'The hydraulic resistance R = 8μL/πR⁴ makes tubes into resistors. How far does the circuit analogy carry for a vascular network?',
    resolution:
      'Series resistances add and parallel conductances add, exactly as for R_D and R_th — the third appearance of the same circuit. Capillaries are astronomically resistive one by one (R⁻⁴!) but come in billions in parallel, so the capillary BED is not where the pressure drops; the muscular arterioles are, which is what makes them the control valves. The analogy\'s fine print is the same as ever: steady, laminar, rigid tubes — pulsatility adds capacitors (compliance) and inertia adds inductors, and that richer circuit is real cardiovascular modeling.',
  },
];
