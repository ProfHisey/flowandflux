import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const MIXINGCUP_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Nothing in the cup code averages by velocity — it just adds up whatever falls in. Yet the cup lands on the velocity-weighted mean, not the area average. Who did the weighting?',
    probe: 'Watch a tracer crawling along the wall. How often does IT reach the cup, compared to one in the core?',
    resolution:
      'The flow did. Fast lanes deliver more tracers per second, in exact proportion to their velocity, so arrival statistics ARE the velocity weighting. That is not a trick of the simulation — it is the physical content of the definition: a cup collects fluid, and more fluid per second comes from where the fluid moves faster.',
  },
  {
    q: 'An area-weighted survey of the cross-section (each annulus counted by its 2πr dr of area) averages to 50 °C; the collected outflow measures 40 °C. Neither number is wrong. Which one belongs in the energy balance, and what question does the other answer? (Careful bonus: a probe dragged along a diameter and averaged uniformly gives yet a THIRD number.)',
    resolution:
      'The 40 °C — energy travels with the fluid, so the balance ṁc dT/dx tracks the flow-weighted temperature. The area average answers a different question: "what is the mean temperature of the material sitting in this cross-section right now," a fine number for, say, stored energy — but not the temperature of what the pipe DELIVERS. (The bonus: a uniform diameter traverse weights by dr, not 2πr dr, giving T_w + ΔT·n/(n+1) — for this profile 40 °C, coincidentally the cup\'s number. Three averages, one honest for each question.)',
  },
  {
    q: 'With the wall hot and the core cold, the cup reads cooler than the area average. Flip it — wall cold, core hot. Predict which way the gap goes before you move the slider.',
    resolution:
      'The gap flips sign with the profile: now the fast core is the HOT part, so the cup over-weights hot fluid and reads warmer than the area average. The rule that survives both cases: the cup leans toward whatever the fast fluid is doing. The slow fluid near the wall barely votes.',
  },
  {
    q: 'Push the fullness slider from 2 to 8, so the temperature is flat almost everywhere with a thin hot skin at the wall. The gap readout barely moves — it even grows at first. Yet turbulent pipe flow rarely needs this module\'s distinction. What does turbulence flatten that this slider cannot?',
    resolution:
      'The velocity profile. The slider flattens only T, and with v still parabolic the fast core keeps out-voting the wall skin, so the gap dies slowly (~2ΔT/n — still 8 °C of the parabolic 10 at n = 8, after peaking near n ≈ 2.8). Turbulence flattens BOTH profiles into fat plugs, and with uniform v the two averages coincide identically, whatever T(r) does. The mixing-cup distinction matters precisely when the velocity profile is round and laminar, which is why it is taught next to Poiseuille flow and not next to the Moody chart.',
  },
  {
    q: 'The speed slider changes nothing in any readout. The tube radius does not even appear on the page. Why do the two quantities that describe "how much pipe and how much flow" both cancel?',
    resolution:
      'Both averages are ratios: flow-of-energy over flow-of-fluid, or area-integral over area. Double v̄ and you double numerator and denominator together; same for R². What survives is only the SHAPE of the two profiles — which is the honest lesson: the mixing-cup correction is a shape effect, and any time you know only shapes you can still compute it.',
  },
];
