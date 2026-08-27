import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const COOLING_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Why is the cooling curve an exponential, of all shapes?',
    probe: 'Watch T(t) and Q(t) side by side: what does the rate depend on?',
    resolution:
      'Because the rate of loss is proportional to what remains. Q = hA(T − T∞), and (T − T∞) is exactly the thing being spent — so the process consumes its own driving force. Any process with that structure (RC circuits, drug elimination, radioactive decay, beer going flat) relaxes exponentially, with a time constant that is capacity over conductance: τ = ρVc/hA.',
  },
  {
    q: 'k for air is 0.026 W/m·K, yet h for air ranges from 5 to 250. How can one fluid have fifty different h values?',
    probe: 'Slide h across its landmarks with the same object.',
    resolution:
      'Because h is not a fluid property — it is a bundle: fluid, flow speed, and geometry, compressed into one number. Conduction across a stagnant film would give h ≈ k/δ; what flow does is thin that film δ by constantly replacing the fluid at the surface (watch the tracers do it). Blowing on soup does not change the air; it changes the film. That is also all a fan, wind chill, or stirring a quench bath do.',
  },
  {
    q: 'The whole object is drawn as one uniform color. What is that assuming, and when is it a lie?',
    probe: 'Load the quenched steel ball, then the resting roast, and compare the Biot readouts.',
    resolution:
      'It assumes the inside of the object equilibrates much faster than the surface loses heat — conduction inside easily outrunning convection outside. Bi = hL_c/k is precisely that race, and below ~0.1 the single-temperature picture is honest (steel ball: Bi ≈ 0.03). The roast fails it (Bi ≈ 0.8): its center lags its surface by a lot, the one-color drawing becomes a lie, and you need the spatial solutions — Heisler-chart territory, in the unsteady conduction module.',
  },
  {
    q: 'Double every linear dimension of the object. What happens to τ, and what does that have to do with why mice lose heat faster than elephants?',
    resolution:
      'τ = ρVc/hA scales as V/A — a length. Double the size and τ doubles: big things coast on their thermal inertia, small things track their surroundings almost instantly. This is why a large roast rests for half an hour while a pea is cold in seconds, why small animals need ferocious metabolisms, and why the thermometer preset equilibrates in a minute while the coffee takes an afternoon.',
  },
  {
    q: 'The mass-transfer twin is j = h_m(C_s − C∞). Name the film, the wake, and the τ for a mint dissolving on your tongue.',
    resolution:
      'Same picture, new cargo: a saturated film of sugar solution hugs the mint (C_s is the solubility), your saliva flow thins that film and sweeps the dissolved sugar away as a wake, and the mint shrinks with its own time constant. Sucking harder is raising h_m — literally the same act as blowing on soup. Every convection idea in the course will come in this matched pair, h and h_m, Nu and Sh.',
  },
];
