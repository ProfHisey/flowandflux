# FlowAndFlux

Interactive simulations for transport phenomena — diffusion, conduction, fluid flow,
and convective transport — built to replace static slides with something a student
can push on.

Built first for **BME 378, Biomedical Mass and Heat Transfer** at Northwestern, and
written to be useful to anyone learning transport: principles first, with the
course's own derivations and problems layered on as worked examples.

**[flowandflux.org](https://flowandflux.org)**

---

## What's here

**Module 1 · Fick's Law of Diffusion** — steady-state one-dimensional diffusion
through a wall, in Cartesian, cylindrical, and spherical geometry.

The centrepiece is a cloud of random walkers drawn on top of the concentration
field. Every walker takes steps that are equally likely to go left or right;
nothing in the simulation knows which way is downhill. A counter at the midplane
tallies crossings in each direction — roughly five hundred per second each way —
and the net transport turns out to be the four-percent imbalance between them.
That imbalance is then compared against `j = −D ∂C/∂x` evaluated on the density
gradient those same walkers are carrying. Two independent measurements of one
quantity, agreeing to within noise.

Which is Fick's law, arrived at from underneath rather than asserted.

---

## Running it

```bash
npm install
npm run dev      # localhost:5173
```

```bash
npm run verify   # physics regression checks
npm run build
```

`npm run verify` checks the simulation against hand-worked answers from the course
— the transdermal drug problem from HW1, species conservation across all three
geometries, the resistance formulas from Lecture 8, Stokes–Einstein from Lecture 3.
It runs in CI and blocks deployment on failure. Physics before pixels.

---

## Stack

React 19 + TypeScript, Vite, Tailwind, HTML5 Canvas for the particle physics,
Recharts for the live profiles, KaTeX for equations. No backend; the whole thing is
static.

## Contributing

`CLAUDE.md` documents the design constraints — why the animation speed is
deliberately unphysical, why the walkers have no drift term, why `j` and `J` are
never conflated. Worth reading before changing the simulation.

## Licence

MIT for the code. Course materials referenced in the presets belong to their
authors and are not distributed here.
