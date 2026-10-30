import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const SEMI_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Press play and watch the front. Halfway through the time window, is the front halfway to where it ends up?',
    probe: 'Read δ at t and at t/2. What is their ratio?',
    resolution:
      'No — it is about 71% of the way, because δ goes as √t and √(1/2) ≈ 0.71. The front covers its first stretch fast and every further stretch more slowly. Put the other way round: to push the front twice as deep you have to wait four times as long. That deceleration is the signature of diffusion, and it is why diffusion is fast over a cell and hopeless over a room.',
  },
  {
    q: 'Plot the four profiles against η and they land on one curve. Why should a profile at one hour and a profile at sixteen hours be the same curve at all?',
    resolution:
      'Because the problem has no length scale of its own. A semi-infinite body with its face held has no thickness and no film, so the only length available is √(Dt), and the profile can only depend on depth measured in units of it. Any function of x and t that respects that must be a function of x/√(Dt) alone. The similarity variable is not a trick for solving the PDE; it is what the physics allows, and solving the ODE in η is the consequence.',
  },
  {
    q: 'Switch the face to a film and the curves refuse to collapse. What has the film added that the held face did not have?',
    probe: 'Look at the film-length readout. What are its units?',
    resolution:
      'A length: D/hₘ for mass, k/h for heat. Now there are two lengths in the problem, √(Dt) and D/hₘ, so the profile depends on their ratio as well as on η — two groups, not one. That is exactly why the semi-infinite-wall charts carry Bi as a second parameter. Once the front has gone far past D/hₘ, the film stops mattering, the face sits near the bulk, and the curves drift back toward the held-face erfc.',
  },
  {
    q: 'For a held face, the flux at t → 0 is infinite. That cannot be literally true. What does it tell you about the model?',
    resolution:
      'That a perfectly instantaneous step at the surface is an idealization. At the first instant the full jump in value sits across zero depth, so the gradient — and the flux — is unbounded; it is integrable, which is why the amount delivered stays finite and grows as √t. A real surface always has some resistance in front of it. Put in a film and the initial flux becomes finite, h·Δ, which is the physical version of the same story.',
  },
  {
    q: 'A real slab has a thickness L. When does the semi-infinite answer stop being right, and what should you use instead?',
    resolution:
      'When the front reaches the far side — roughly when δ becomes comparable to L, equivalently when Fo = Dt/L² is no longer small (order 0.1). Until then the far face has not heard about the near one, and the body cannot tell it is finite. After that, the finite-body solutions (the one-term series, or the charts) take over. "Semi-infinite" is a statement about time, not just about geometry.',
  },
  {
    q: 'The profile carries over from mass to heat by replacing D with α. Does the amount delivered carry over the same way?',
    resolution:
      'No. Replacing D with α in M/A = 2ΔC√(Dt/π) gives ΔT·√(αt), which has units of K·m — not an energy per area. The analogy maps C to ρcₚT, so a flux or an amount picks up the volumetric heat capacity: E/A = 2ρcₚΔT√(αt/π), in J/m², and q = kΔT/√(παt) carries k. The shape of the profile is shared; the bookkeeping is not.',
  },
];
