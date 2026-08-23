import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const CORR_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Nu = hL/k. What is Nu = 1, physically — and what does Nu = 100 say the flow has accomplished?',
    resolution:
      'Nu = 1 is pure conduction across the length scale: h = k/L, a stagnant film as thick as the object. Nu = 100 says the flow has shaved that film to a hundredth of L — h is conduction across the film that SURVIVES, h ≈ k/δ. Every correlation is an empirical report on how thin the flow can shave δ, which is why they all grow with Re and why the canvas draws them as films.',
  },
  {
    q: 'The stagnant sphere has Nu = 2, not zero. Where does heat go with no flow at all — and why exactly 2?',
    resolution:
      'Into the infinite surroundings by pure conduction: the sphere is the one shape whose steady conduction to infinity converges (R_th → 1/4πkR), giving h = k/R = 2k/d, i.e. Nu = 2 exactly — a theorem, not a fit, and the verify suite checks it against the conduction library. Ranz–Marshall is that theorem plus a flow correction: 2 + 0.6Re^½Pr^⅓. Every mist droplet, cell, and micro-bubble lives near the "2".',
  },
  {
    q: 'In water, Sh outruns Nu by a factor of ~5 in every one of these correlations. What property gap is that, and why ⅓-power?',
    resolution:
      'Sc/Pr = (ν/D)/(ν/α) = α/D ≈ 144 in water (this page\'s own property table) — heat diffuses two decades faster than solutes. The films scale with the ⅓ power of that (boundary-layer mathematics compresses diffusivity contrasts), so Sh/Nu = (Sc/Pr)^⅓ ≈ 5 for the ⅓-power correlations. The concentration film is the thinnest thing in the whole flow — which is precisely why mass transfer at surfaces is so often the bottleneck in bioreactors and membranes.',
  },
  {
    q: 'Fully developed laminar tube flow: Nu = 3.66, no Re anywhere in it. You double the pump speed and transfer per area does not improve. Why not — and what WOULD improve it?',
    resolution:
      'Fully developed means the profile has stopped changing shape: the film has grown to fill the tube radius and stays there, so h ≈ k/R regardless of speed — pumping faster only makes the SAME transfer happen over more length before saturation. To improve it: thinner tubes (h ~ 1/d — why capillaries and dialysis fibres are hair-fine), disrupt the development (bends, pulsation), or go turbulent and pay the pressure bill.',
  },
  {
    q: 'Wind chill: the air temperature has not changed, yet you lose heat faster in wind. Which number changed, and why does a thermometer not feel it?',
    resolution:
      'h did — the wind thinned the film on your skin, tripling or worse the still-air coefficient (the canvas preset shows ~10 → ~33 W/m²K at 5 m/s). Your body senses heat FLUX, so it reads "colder"; a dry thermometer eventually equilibrates to the same air temperature either way and reports no change. Wind chill is a Nusselt number wearing a weather-report costume — the doorknob lesson from the conduction module, now with flow.',
  },
];
