import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const NEWTON_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'The top plate never touches the bottom plate, and no fluid particle travels from one to the other. So how does the bottom plate ever feel that the top plate is moving?',
    probe: 'Watch the links between layers: tilt, stretch, release, catch. Follow the hand-off from the top layer to the bottom.',
    resolution:
      'The momentum is relayed, not delivered. Each layer grips the one beneath it — the tilting links — and hands its motion down one step at a time, so the plate\'s pull reaches the bottom wall through nine hand-offs without any single messenger making the trip. Microscopically the grip is intermolecular attraction plus molecules straying between layers; the animation suppresses the straying on purpose, because the relaying is the lesson. Viscosity is, at bottom, diffusion of momentum — that statistical story gets its own module.',
  },
  {
    q: 'The velocity profile is a straight line and the stress chart is completely flat. Are those two statements related?',
    resolution:
      'They are the same statement. At steady state no fluid layer is accelerating, so the momentum flowing into any layer must equal the momentum flowing out — τ must be identical at every height, exactly as J and Q were constant through the wall. With τ = μ du/dy constant and μ uniform, du/dy must be constant: a straight line. The profile is straight because nothing is accumulating momentum.',
  },
  {
    q: 'Honey has a viscosity ten thousand times water’s. What, physically, is different when a molecule hops between layers in honey?',
    resolution:
      'In honey the molecules are large, entangled, and strongly attracted to each other, so momentum is passed not just by molecules hopping between layers but through sustained intermolecular tugging — each layer grips its neighbour. μ measures how effectively x-momentum is communicated in y. In gases, hotter means MORE viscous (faster molecules ferry momentum quicker); in liquids, hotter means less viscous (the grip loosens). That opposite temperature dependence is a fingerprint of the two mechanisms.',
  },
  {
    q: 'Why must the fluid velocity be exactly zero at the bottom plate and exactly U at the top plate? Could the fluid slip a little?',
    resolution:
      'The no-slip condition is an empirical fact for ordinary fluids at ordinary scales: molecules within a few diameters of a wall collide with it so often that they equilibrate to its motion. It is a boundary condition, not a law of nature — it genuinely fails in rarefied gases and in some micro/nano-channels — but every problem in this course assumes it, and it is what couples the plate’s motion into the fluid at all.',
  },
  {
    q: 'ν = μ/ρ for water is about 10⁻⁶ m²/s — a thousand times bigger than a small solute’s D in the same water. Stir milk into coffee and both momentum and milk spread. Which arrives first at the far side of the cup, and why?',
    resolution:
      'The swirl (momentum) arrives long before the milk does by diffusion — which is precisely why we stir: bulk motion does the mass transport that diffusion cannot manage on human timescales. ν ≫ D in liquids because momentum can be handed between molecules without anybody travelling, exactly like heat, while a milk protein must physically walk the whole way. The ratio ν/D (the Schmidt number, ~1000 for liquids) will organise everything in convective mass transfer later.',
  },
  {
    q: 'The particles on screen slide in perfect layers and never wander between them. Real molecules certainly wander. What is the animation choosing to show, and what is it choosing to hide?',
    resolution:
      'It shows the continuum picture — laminar shear, layers dragging layers — and hides the molecular chaos underneath, because superimposing the two makes both unreadable. The hidden part matters: molecular straying between layers is one of the two mechanisms that transmit the grip (with intermolecular attraction), and it is why ν has the units of a diffusivity. The honest statement is that this is the fluid as Navier–Stokes sees it, not as a molecule sees it — and knowing which picture you are in is precisely the skill the course is building.',
  },
];
