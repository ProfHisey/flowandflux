import type { SocraticQuestion } from '../../components/ui/SocraticPanel';

/**
 * Qualitative questions for oral exams and live discussion — authored, per
 * house policy, but not rendered in the UI yet.
 */
export const GASLIQUID_QUESTIONS: SocraticQuestion[] = [
  {
    q: 'Both boxes sit at the same temperature, so the tagged molecule moves just as fast in the liquid as in the gas. Yet the "net wander" readout says it gets almost nowhere. Where does all that speed go?',
    probe: 'Watch the orange trail in the liquid for ten seconds. How far apart are its farthest two points, in molecule widths?',
    resolution:
      'Into reversals. The liquid molecule covers just as much PATH as the gas one, but every fraction of a diameter it hits a neighbor and its direction is randomized, so the path folds back on itself almost perfectly. Displacement grows as √(number of flights) × flight length — that is, √(path × step length) — so at equal path and equal time, the box with the longer step wins. In a liquid the step is a fraction of a diameter. Fast motion, tiny steps, slow diffusion.',
  },
  {
    q: 'Turn the temperature up. Both boxes speed up by the same factor — but which box\'s diffusion benefits more, and why does heating a liquid do more than this simulation shows?',
    resolution:
      'On screen, both wander distances scale together, since D ~ (step length) x (speed) and only speed changed. In a real liquid, heating ALSO loosens the cage itself — viscosity drops steeply with temperature — so liquid D rises much faster than the sqrt(T) of gas kinetic theory at fixed density — which is what this simulation holds; at fixed PRESSURE a gas manages T^(3/2). The simulation holds the crowding fixed; nature does not. That is why the Stokes-Einstein card has viscosity in the denominator where the gas card has pressure.',
  },
  {
    q: 'Rarefy the gas with the crowding slider. The mean free flight readout grows — but the collisions were what randomized the walk. If you could remove ALL collisions, would the molecule diffuse infinitely fast, or stop diffusing altogether?',
    resolution:
      'Neither — it would stop DIFFUSING at all and simply fly ballistically, crossing the box in straight lines. Diffusion is not fast motion; it is randomized motion, and the collisions are what randomize it. D = (1/3) lambda v_bar grows as the gas rarefies only while collisions still happen often enough for the walk to be a walk. The random-walk picture every other module relies on is BUILT from these collisions.',
  },
  {
    q: 'The gas box on screen gives the tagged molecule a free flight of ten-or-so diameters. The card next to it says a real air molecule flies about 180 diameters. Why did we not just draw it to scale?',
    resolution:
      'A gas drawn to scale is overwhelmingly empty space — at atmospheric density the molecules would be a few pixels in an essentially blank box, and you would wait a long time to see a single collision. The site\'s standing rule: clarity beats scale, and every such compromise is labeled on the canvas. The RATIO the picture teaches — long flights vs sub-diameter rattling — survives the compression honestly.',
  },
  {
    q: 'The course tells you D ~ 0.1 cm^2/s for gases and ~1e-5 cm^2/s for small solutes in water, four decades apart. Point at the one visual difference between the two boxes that carries all four decades.',
    resolution:
      'The length of the free flight. Speeds are comparable (same T, similar masses), so D = (1/3) lambda v_bar says the whole gap lives in lambda: ~180 diameters in the gas versus a fraction of a diameter in the liquid — a factor of ~1000 in step length, times the residual speed and cage-escape statistics. Once you have seen the two trails, the four decades stop being a table entry and become geography.',
  },
];
