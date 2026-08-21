import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const TRANSIENT_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Steel at 60 °C burns you; wood at 60 °C is pleasant. A thermometer pressed to either would read exactly 60. What is your finger measuring that the thermometer is not?',
    probe: 'Compare the two presets. Watch the contact-temperature chip, not the material temperatures.',
    resolution:
      'The moment of contact sets the interface to the effusivity-weighted average T = (e₁T₁+e₂T₂)/(e₁+e₂), e = √(kρc) — and your nerves live at that interface. Steel (e ≈ 13,000) barely budges, so your skin surface is dragged to 57.8 °C; wood (e ≈ 400) is dragged nearly to skin temperature instead. Your finger measures a contest of effusivities, not a temperature. Same reason 20 °C tile "is" cold and 20 °C carpet "is" not — the floor temperature was never the question.',
  },
  {
    q: 'The contact temperature appears INSTANTLY and then never changes, even as heat keeps flowing. How can the interface be finished when the process has barely started?',
    resolution:
      'Both sides are semi-infinite: each sees only "a wall whose temperature just jumped," and each responds with its own erf profile growing as √(αt). The fluxes the two sides demand at the interface balance at exactly one temperature — the effusivity-weighted one — and since both profiles scale identically in x/√t, that balance never shifts. It holds until one body runs out of thickness and stops looking infinite; then the story becomes a finite-body (Heisler) problem.',
  },
  {
    q: 'The surface flux decays as 1/√t — infinite at the first instant. Is that physical, and what does it mean for burns?',
    resolution:
      'The 1/√t spike is the mathematics saying the initial gradient is a step — infinitely steep for an infinitely short time, with finite delivered energy (∫q″dt ∝ √t). Practically: the first fraction of a second of contact does the damage, which is why you can tap a hot pan but not hold it, and why burn severity depends on contact TIME as much as temperature. Pull away fast and the √t integral stays small.',
  },
  {
    q: 'For the finite wall, everything collapses into two numbers, Bi and Fo. What question does each one answer?',
    probe: 'Load the pea preset: Bi = 24. Then slide h down and watch the profile change shape.',
    resolution:
      'Bi = hL/k asks WHERE the resistance lives: small Bi, the bottleneck is the surface film and the inside stays uniform (lumped — the law-of-cooling module); large Bi, the surface instantly takes the fluid temperature and the bottleneck is conduction inside. Fo = αt/L² asks WHAT TIME IT IS in units the body cares about — it is t/(diffusion time across L). Two bodies with matching Bi and Fo are the same problem wearing different dimensions, which is why one chart used to serve every material and size ever built.',
  },
  {
    q: 'This module replaces the Heisler chart with a slider. What was the chart actually encoding, and why did it need Fo > 0.2 in fine print?',
    resolution:
      'The full solution is an infinite series of decaying modes; the chart plots only the slowest one, θ₀/θᵢ = C₁exp(−ζ₁²Fo), because after Fo ≈ 0.2 every faster mode has already died. Before that, the higher modes still matter and the one-term line (and this module — the canvas says so) underestimates how much the early profile still remembers its initial shape. The chart was a pre-computer lookup table for a one-line formula; knowing its fine print is knowing which regime you are in.',
  },
];
