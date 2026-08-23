import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const FOURIER_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'In the diffusion module the dots physically travel across the wall. Here no molecule ever leaves its spot — yet energy still gets from the hot side to the cold side. What, exactly, is moving?',
    probe: 'Watch the lattice with molecules on. Compare with the Fick module side by side.',
    resolution:
      'Energy is moving; matter is not. Each collision hands kinetic energy between neighbours, and a hot molecule gives more than it gets back, so energy drifts down the temperature gradient while every molecule stays bonded to its site. Conduction is diffusion of energy — the same mathematics as Fick, with a different cargo. In fluids and metals other carriers (bulk motion, free electrons) join in, which is why those conduct better.',
  },
  {
    q: 'Every pair of neighbouring molecules exchanges energy in BOTH directions, constantly. So why does heat flow only one way?',
    probe: 'Watch the midplane counter: compare the two one-way figures with the net.',
    resolution:
      'It does not flow only one way — the ledger shows enormous energy traffic in each direction, and conduction is the small imbalance between the two. The hot side sends slightly more per hand-off because it has slightly more to send. This is the same statistical structure as diffusion: the macroscopic law describes the imbalance, not the traffic.',
  },
  {
    q: 'The temperature profile is a straight line in the slab but bends in the cylinder and sphere. Same law — what changed?',
    probe: 'Switch geometries and watch the profile and the q″ chart together.',
    resolution:
      'Energy conservation pins the total rate Q at every radius. In curved geometries the area facing the flux grows with r, so q″ = Q/A must fall, so the gradient must flatten as you move outward — logarithmic in the cylinder, hyperbolic in the sphere. The bending is geometry, not physics.',
  },
  {
    q: 'q″ at the inner face of the sphere is much larger than at the outer face. Is energy piling up inside the wall?',
    resolution:
      'No — Q is identical at both faces. q″ and Q are different quantities: local flux versus total rate, W/m² versus W. Only Q is conserved along the path. This is the exact trap the mass module sets with j and J, wearing a heat costume.',
  },
  {
    q: 'A metal doorknob and a wooden door are both at 15 °C. The knob feels much colder. Your skin is not lying — what is it actually measuring?',
    resolution:
      'Flux, not temperature. Skin reports the rate at which heat leaves it. But be careful with the tempting k-ratio argument: touching is TRANSIENT contact, governed by effusivity e = √(kρc), not by k alone — your skin is itself part of the series path, and it is the bottleneck. The metal drags your skin surface down toward ~17 °C while wood holds it near ~31 °C (the sudden-contact module computes exactly this), so the flux difference is a factor of a few, not the thousand the k-ratio suggests. Thermometers measure T; nerves measure the flux at that shifted contact temperature. Confusing the two is the everyday version of confusing T with heat.',
  },
  {
    q: 'The jiggle amplitude on screen changes a lot between the hot and cold walls. Physically, should it?',
    resolution:
      'Barely. Vibration amplitude scales with the square root of ABSOLUTE temperature, so 0 °C vs 100 °C is √(373/273) ≈ 1.17 — a 17% difference, invisible in an animation. The on-screen amplitude is normalized to the current temperature range and says so, exactly as the particle speed in the diffusion module is decoupled from D. The energy bookkeeping underneath is honest; the amplitude is a legibility compromise. Knowing which is which is the skill.',
  },
];
