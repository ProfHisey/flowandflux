import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const WALL_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Load the single-glazing preset. The glass is the only solid in the path — yet it takes almost none of the temperature drop. Who does?',
    probe: 'Read the circuit: compare the film resistances with the glass.',
    resolution:
      'The two air films (1/hA ≈ 0.125 and 0.04 K/W) dwarf the glass (L/kA = 0.004 K/W). A single-glazed window is mostly two layers of reluctant air with a formality of glass between them — which is why wind (thinner outside film, bigger h) makes a cold window so much worse, and why curtains (an extra still-air film) work at all.',
  },
  {
    q: 'Switch from single to double glazing. One 12 mm layer of ordinary air cuts the heat loss almost four-fold. Why does THAT layer matter when the air films already present did not do the job?',
    resolution:
      'Because it is sealed. The gap is a captive slab of the best cheap insulator there is (k = 0.026 W/m·K), thick enough to add ~0.46 K/W by conduction — instantly the dominant resistor, taking ~73% of the whole ΔT in this circuit. (Honesty note: a real gap gives up roughly half of that, because the panes also exchange heat by radiation, a parallel path this conduction-only circuit omits — which is exactly what low-e coatings exist to suppress.) In series circuits only the biggest resistance matters much; the design lesson is to find the budget hog before optimizing anything else. Improving the glass here is polishing a doorknob on a house with no roof.',
  },
  {
    q: 'The temperature profile is steep in some layers and nearly flat in others. Same Q everywhere — so what sets the slope?',
    resolution:
      'q″ = −k dT/dx with q″ fixed by the series circuit, so dT/dx = −q″/k: the slope is inversely proportional to conductivity. Insulators must be steep to push the same flux; copper is flat because it barely needs a gradient. Reading slopes off a temperature profile and ranking the layers by k is a skill worth having in the fingers.',
  },
  {
    q: 'The convection films appear on the chart as temperature cliffs — a drop with no thickness. Is that physical?',
    resolution:
      'Almost. The drop really happens across the boundary layer — a few millimetres of nearly-still air for the natural-convection films here (δ ≈ k/h), thinner for water or forced flow — which at wall scale draws as a cliff. R = 1/hA is that thin film in circuit costume — the same h from the law-of-cooling module. Series-circuit thinking does not care whether a resistance is a solid layer or a film; ΔT_i = Q·R_i either way.',
  },
  {
    q: 'When is this whole circuit picture allowed — and what breaks it?',
    resolution:
      'Steady state, one-dimensional, no generation. Those three conditions make Q the same through every element, which is what lets resistances simply add. Transients (the wall warming up in the morning) reintroduce capacitors; heat generation (a wire, a metabolizing tissue) injects current mid-circuit; and 2-D paths (a stud in an insulated wall — a thermal short) demand parallel branches. The parallel rule, 1/R = Σ1/Rᵢ, carries over from circuits too.',
  },
];
