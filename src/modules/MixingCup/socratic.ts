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
    q: 'A thermocouple traversed across the pipe and averaged over positions reads 50 °C; the collected outflow measures 40 °C. Neither instrument is broken. Which number belongs in the energy balance, and what question does the other one answer?',
    resolution:
      'The 40 °C — energy travels with the fluid, so the balance ṁc dT/dx tracks the flow-weighted temperature. The traverse answers a different question: "what is the average temperature of the metal-and-fluid at this cross-section right now," which is a fine number for, say, thermal stress — but it is not the temperature of what the pipe DELIVERS.',
  },
  {
    q: 'With the wall hot and the core cold, the cup reads cooler than the area average. Flip it — wall cold, core hot. Predict which way the gap goes before you move the slider.',
    resolution:
      'The gap flips sign with the profile: now the fast core is the HOT part, so the cup over-weights hot fluid and reads warmer than the area average. The rule that survives both cases: the cup leans toward whatever the fast fluid is doing. The slow fluid near the wall barely votes.',
  },
  {
    q: 'Push the fullness slider to n = 8, so the temperature is flat almost everywhere with a thin hot skin at the wall. The two averages nearly agree. Why does turbulent pipe flow rarely need this module\'s distinction while laminar flow always does?',
    resolution:
      'Turbulence flattens both profiles — velocity and temperature — into fat plugs with thin wall layers, which is exactly the n-large limit where every average of the profile is the same number. The mixing-cup distinction matters precisely when profiles are round and laminar, which is why it is taught next to Poiseuille flow and not next to the Moody chart.',
  },
  {
    q: 'The speed slider changes nothing in any readout. The tube radius does not even appear on the page. Why do the two quantities that describe "how much pipe and how much flow" both cancel?',
    resolution:
      'Both averages are ratios: flow-of-energy over flow-of-fluid, or area-integral over area. Double v̄ and you double numerator and denominator together; same for R². What survives is only the SHAPE of the two profiles — which is the honest lesson: the mixing-cup correction is a shape effect, and any time you know only shapes you can still compute it.',
  },
];
