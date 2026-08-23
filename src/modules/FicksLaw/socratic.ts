import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion. Each one should be
 * answerable by driving the simulation and then saying why — not by recalling
 * a formula.
 */
export const FICK_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Every particle on the canvas takes steps that are equally likely to go left or right. Nothing in the update rule knows where the high concentration is. So why is there net transport at all?',
    probe: 'Turn particles on, watch the midplane. Then set C₁ = C₂ and watch it again.',
    resolution:
      'Because flux is a difference of two one-way traffic counts, not a single directed motion. More particles sit on the left, so more of them happen to wander right across the midplane than happen to wander left. Set C₁ = C₂ and the two counts match: the walking does not stop, but the net goes to zero. Fick\'s law is bookkeeping on random motion, which is exactly why D turns out to be v̄λ/3 — a property of the wandering, not of the gradient.',
  },
  {
    q: 'In the slab, the concentration profile is a straight line. Why straight, and not curved?',
    probe: 'Switch between slab, cylinder, and sphere and watch the profile bend.',
    resolution:
      'At steady state with no reaction, whatever enters a slice must leave it, so the total transfer rate J is the same at every station. In a slab the area is also the same at every station, so j = J/A is constant, so dC/dx is constant — a straight line. The moment the area starts growing with position, j has to fall to keep J fixed, and the profile bends to match. Straightness is a statement about geometry, not about diffusion.',
  },
  {
    q: 'Switch to the sphere. The local flux at the outer surface is far smaller than at the inner surface. Is species piling up somewhere in between?',
    probe: 'Compare the two flux readouts, then look at the total transfer rate J.',
    resolution:
      'No — J is identical at both faces. The area of a spherical shell goes as r², so j must fall as 1/r² to keep J = j·4πr² constant. Nothing accumulates. This is the standard trap: j and J are different physical quantities, and only J is conserved along the path. Transport texts write them as separate symbols for exactly this reason.',
  },
  {
    q: 'Double the thickness L. What happens to the flux, and what happens to the total amount of drug sitting inside the layer?',
    probe: 'Load the drug-through-skin example, note both readouts, then drag L.',
    resolution:
      'Flux halves: the gradient ΔC/L is halved and D has not changed. The holdup doubles, and the reason is worth saying out loud — the profile stays linear between the same two boundary values, so the average concentration through the layer is still (C₁+C₂)/2 — here C₂ = 0, so ΔC/2 — no matter how thick it is. Only the volume changed. One slider, two quantities moving in opposite directions.',
  },
  {
    q: 'D for a gas is about 0.1 cm²/s; for a large complex or a piece of DNA in cytoplasm it can reach 10⁻⁹ cm²/s (a typical free protein sits nearer 10⁻⁷–10⁻⁸). That is eight orders of magnitude end to end. What physically differs?',
    probe: 'Use the D scale markers under the slider.',
    resolution:
      'Both numbers come from D ≈ v̄λ/3. In a gas the mean free path λ is enormous relative to the molecule and thermal speeds are hundreds of m/s. In a crowded cytoplasm λ collapses to essentially a molecular diameter and the effective drag is huge, so Stokes–Einstein D = k_BT/6πμa takes over: bigger a, bigger μ, smaller D. Same physics, wildly different regime.',
  },
  {
    q: 'The resistance readout R_D = ΔC/J has the same algebraic role as electrical resistance. Where does the analogy start to mislead you?',
    resolution:
      'Series and parallel combination rules carry over exactly, and that is genuinely useful for layered tissue. What does not carry over: R_D is only defined at steady state with no generation. Add a reaction term, or ask a transient question, and there is no single resistance any more — you are back to solving the differential equation. The analogy is a shortcut for one specific case, not a replacement for the conservation statement.',
  },
  {
    q: 'The animation speed does not change when you change D. Is that a bug?',
    resolution:
      'It is deliberate, and worth being annoyed by. D spans ten decades across real problems; an animation faithful to D would either freeze or blur at almost every setting. The particle speed here is fixed for legibility, while the *shape* of the field and every number in the readouts are physical. Any simulation you meet will make a compromise like this somewhere — the useful habit is asking which quantities are honest and which are cosmetic.',
  },
];
