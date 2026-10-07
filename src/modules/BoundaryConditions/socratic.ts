import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const BC_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Seal both faces of a slab that is generating heat. The module refuses to draw a profile at all. Is that a limitation of the solver, or a fact about the slab?',
    probe: 'Write the steady balance for the whole slab: what goes in, what comes out, what is made.',
    resolution:
      'A fact about the slab. Steady state means nothing accumulates, so over the whole body In + Generation = Out. Sealed on both sides, Out is zero and In is zero, but Generation is not — the balance cannot be satisfied by ANY temperature profile. The body simply keeps warming; the problem has no steady solution to find. The honest answer to "solve this" is that it is unsolvable as posed, and noticing that is worth more than an algebra slip that hides it.',
  },
  {
    q: 'Now let exactly as much leave the surface as the body makes. A shape appears, but the module says the level is arbitrary. What single extra piece of information would pin it down, and why does no amount of flux data ever do it?',
    resolution:
      'Any one value, anywhere — a held face, a known bulk plus a film, a measured temperature at a point. Flux conditions constrain the DERIVATIVE, and integrating a derivative always leaves a constant. Two flux conditions give you the same constraint twice over and still never mention where the curve sits. This is the clearest argument for why a second-order problem needs two conditions and why they cannot both be of the same unhelpful kind.',
  },
  {
    q: 'A stirred bath holds the surface at T₀. A film with a huge h sits over a bulk at the same T₀. Are these the same boundary condition?',
    resolution:
      'In the limit, yes — and that is exactly what Bi tells you. The film drop is j/h, so as h grows the surface is dragged onto the bulk value and the mixed condition degenerates into a value condition. Large Bi IS "the surface is held". The reverse limit is just as useful: tiny h makes the body nearly uniform and all the drop sits in the film, which is the lumped-capacity assumption a later module leans on. A mixed condition is a dial between the other two.',
  },
  {
    q: 'Nobody ever imposes a boundary condition at the center of a solid sphere, yet the problem is fully determined. Where did the second condition come from?',
    probe: 'Write the general solution of the shell balance for a sphere, including the branch the module throws away.',
    resolution:
      'From regularity. The general solution carries a 1/r term (ln r for a cylinder), which is infinite at r = 0 — physically impossible for a body with no source at its center. Killing that branch IS the second condition, and it is equivalent to zero slope at the center. Symmetry is not an extra assumption here, it is the only finite answer. In a slab the same flat-slope condition is a genuine modeling choice — you are asserting a midplane.',
  },
  {
    q: 'Switch the module to mass and raise Φ. The surface concentration moves even though the bulk did not. Try to tell the same story about a temperature.',
    resolution:
      'You cannot. Φ exists because a solute can be more soluble in one phase than another, so equilibrium at the interface means C₁ = ΦC₂ rather than C₁ = C₂ — the concentration genuinely steps across the boundary. Temperature has no analogue: thermal equilibrium at a contact means equal temperature, full stop. Flux is continuous in both cases, because there is nowhere else for it to go. This is the one place the heat–mass analogy, which carries the whole course, actually breaks.',
  },
  {
    q: 'The same generation, the same k, the same radius: a slab, a cylinder and a sphere. The interior drop falls by factors of 2 and 3. Where does that come from, without doing the integral?',
    resolution:
      'Surface per unit volume. A sphere of radius R has 3/R of surface area per unit volume, a cylinder 2/R, a slab of thickness L only 1/L. The same generation per unit volume therefore has three times as much escape route per unit of production in a sphere, so it needs less of a gradient to drive it out. The factors of (n+1) in the solutions are that geometry, written down.',
  },
  {
    q: 'A classmate solves the slab with generation, gets a profile, and checks nothing else. Name the one-line check that would have caught almost any algebra slip.',
    resolution:
      'The overall balance: k dT/dx at the open face must equal S·L (and S·R/2, S·R/3 for cylinder and sphere). Everything made inside has to leave through the surface, so the surface flux is fixed by the generation before you solve anything at all. If the profile disagrees, the profile is wrong. Units are the other half of the same habit — and in this course, the half that costs all the credit.',
  },
];
