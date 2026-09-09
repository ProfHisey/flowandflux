import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const WALKER_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'The Péclet module and this one run the identical walker step. What changed, and why does it feel like a different subject?',
    probe: 'Switch the view from "the cloud" to "one walker" and back, without touching v or D.',
    resolution:
      'Nothing physical changed; the bookkeeping did. The cloud is the Eulerian view — a concentration field that slides at v and spreads as √(2Dt), smooth and predictable. The single walker is the Lagrangian view — one particle\'s actual path, jagged and unrepeatable. Every transport equation you have solved describes the field; every particle you could actually follow lives the path. The two are the same physics, and reconciling them is the definition of a diffusivity.',
  },
  {
    q: 'Drift distance grows as t, spread as √t. What does that guarantee, and what does it not?',
    probe: 'Load "The contested walk," then "Drift wins." Same v, same D.',
    resolution:
      'It guarantees that drift eventually wins — Pe(T) = vT/√(2DT) grows without bound, and the crossover T* = 2D/v² is the horizon past which wandering becomes a detail on a straight line. It does not guarantee anything about a particular walker before T*: at the crossover itself, one walker in six is still behind where it started. "Eventually" is doing all the work, and T* says how long eventually is.',
  },
  {
    q: 'Bachelier wrote the diffusion equation for prices in 1900, before Einstein wrote it for pollen. Where in the price-face sliders is the diffusivity, and where is the drift?',
    probe: 'Switch to the price face and slide the volatility σ with μ held fixed.',
    resolution:
      'In log-price coordinates the dictionary is exact: D = σ²/2 and v = μ − σ²/2. Volatility is a diffusivity — it sets how fast the cloud widens — and the expected return, minus half the variance, is the drift. The correction term is the surprise: raising σ with μ fixed LOWERS the drift of the log price, which is why "One company, ten years" has a negative v and a median path that loses money even though its mean gains. The same term appears in physics as the Itô–Stratonovich distinction; finance calls it volatility drag.',
  },
  {
    q: 'The cloud\'s heads keep landing inside the amber bell. Does that mean the bell predicts where THIS walker will be?',
    probe: 'Watch one walker cross the ±2 spread band, then hit replay a few times.',
    resolution:
      'No — and the distinction is the whole reason a single-walker view exists. The bell is the distribution across walkers, or across replays; it is a statement about the ensemble and says nothing about which member you are. A person following one price, one cell, one molecule gets one draw from that bell and never sees the rest. The field is what you can compute; the path is what you get.',
  },
];
