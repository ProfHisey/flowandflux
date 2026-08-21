import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const PERFUSION_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Why is the starved region always a CORNER — far end, bottom — rather than a stripe or a patch?',
    resolution:
      'Two independent drains stack. Along x, the flow loses concentration linearly as the tissue upstream eats its share — worst at the outlet. Into y, diffusion pays a parabolic toll to reach the floor — worst at the bottom. The cell at (L, h₂) sits at the end of BOTH supply chains, so it starves first, and any design margin must be budgeted for that one address.',
  },
  {
    q: 'Doubling the flow rescued the corner. Doubling it again buys almost nothing. What did the flow fix, and what can it never fix?',
    resolution:
      'Flow only fixes the AXIAL drain — the R h₂ W L / Q term shrinks as 1/Q. The depth drop R h₂²/2D has no Q in it: it is a private matter between the tissue and diffusion. Once the axial term is small, the corner deficit is all depth-drop, and more pumping just wastes medium. The design lesson: match the tool to the term.',
  },
  {
    q: 'The depth penalty scales as h₂². What does that square do to the dream of thick engineered tissue?',
    resolution:
      'It caps it, hard. Doubling thickness quadruples the drop; at some h₂ the floor starves even with infinite flow overhead (when Rh₂²/2D > C₀ − C_crit — a limit worth solving for). Nature\'s answer to the square law is to never let tissue get thick without threading vessels through it: capillaries every ~100 µm. Tissue engineering keeps rediscovering that number from the outside.',
  },
  {
    q: 'The model treats the channel fluid as well-mixed vertically at each x. When is that fair, and what did the Péclet module teach about the case where it is not?',
    resolution:
      'Fair when the channel is thin enough that transverse diffusion equilibrates it faster than the flow traverses it (h₁²/D ≪ L/v). Fail that, and a concentration film forms above the tissue — the fluid near the cells is poorer than the average, and the mixing-cup average from convection theory becomes the honest bookkeeping. That refinement is exactly where h_m and Sherwood correlations enter real bioreactor design.',
  },
  {
    q: 'Set C_crit to zero and the design "works." Why is that the least trustworthy line on the whole page?',
    resolution:
      'Because zero is a mathematical courtesy, not a biology. Cells falter well above zero (oxygen: consumption becomes transport-limited, then injury pathways start), consumption R is not truly constant near starvation, and every parameter here carries uncertainty. Designing to C = 0 spends the entire margin on the model being exactly right. The threshold slider exists to make that argument physically: watch how far the corner moves for a modest, honest C_crit.',
  },
];
