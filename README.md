# FlowAndFlux

Interactive simulations for transport phenomena — diffusion, conduction, fluid flow,
and convective transport — built to replace static slides with something a student
can push on.

Written to be useful to anyone learning transport: general principles only, with
invented, course-neutral examples throughout.

**[flowandflux.org](https://flowandflux.org)**

> An independent personal project, developed on personal time. It is not affiliated
> with, endorsed by, or a production of any university, department, or employer,
> and nothing here is official course material.
>
> Developed with AI assistance. Every physics function is checked against
> hand-worked solutions by `npm run verify`, which runs in CI and blocks
> deployment on failure; deliberate visual compromises are labelled on the page
> where they occur.

---

## What's here

Fifteen interactive modules, grouped by physics:

- **Start** — a PhET-style mixing box (mass and heat), zero equations by design;
  and gases vs. liquids, where hard-sphere molecules show why D spans four
  decades between the two.
- **The flux laws** — Fick's law (random walkers vs. `j = −D ∂C/∂x`, measured two
  independent ways), Fourier's law (an energy-exchange lattice), Newton's law of
  viscosity (sliding layers, grip links, dye kinematics), and composite-wall
  resistance networks with a live ΔT budget.
- **Unsteady** — bolus dispersion (a spreading Gaussian the walkers keep landing
  on, for a burst of mass or of heat), sudden contact (erf fronts, effusivity,
  why metal feels cold), and interactive Heisler charts (Bi and Fo decide).
- **Momentum** — Stokes drag and settling (true-magnitude force arrows, the a²
  law, the centrifuge), and Poiseuille flow with parallel plates and the falling
  film, derived on-page by cancelling Navier–Stokes terms.
- **Convection** — the Péclet number (walkers that wander *and* drift), Newton's
  law of cooling (the film-and-wake mechanism of h, plus a fin), the mixing cup
  (what "the" temperature of a flowing stream even means), and Nu & Sh
  correlations computed live.

Every module: real units on every number, symbolic before numeric, measured
quantities checked against analytic predictions on screen, and a rotatable 3D
view alongside the 2D canvas.

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

`npm run verify` checks every physics function against hand-worked answers —
flux and holdup through a membrane, species and energy conservation across slab /
cylinder / sphere, Stokes–Einstein round-trips, Gaussian spreading moments,
lumped-cooling time constants, one-term transient solutions, settling velocities,
and more. It runs in CI and blocks deployment on failure. Physics before pixels.

---

## Stack

React 19 + TypeScript, Vite, Tailwind, HTML5 Canvas for the particle physics and
the 3D views (orthographic painter's algorithm, no 3D library), Recharts for the
live profiles, KaTeX for equations. No backend; the whole thing is static.

## Design principles

- **Units are never optional.** Every readout carries them.
- **Physics before pixels.** The math lives in `src/lib/*.ts` as pure functions,
  verified in `scripts/verify.ts` before any UI is built on top.
- **Honest animations.** Cosmetic speeds are labelled as cosmetic; measured
  quantities are actually measured from the simulation, never assumed.
- **Emergence over assertion.** Walkers never consult the gradient; net transport
  emerges from counting. Ratios that matter (like Pe) are kept physical even when
  speeds are not.

## Licence

The source is public so it can be checked, not so it can be resold.

| Part | Licence |
| --- | --- |
| Source code | [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) — see [LICENSE](LICENSE) |
| Prose, question sets, worked-example blurbs, figures | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — see [LICENSE-CONTENT](LICENSE-CONTENT) |
| Name and branding | Not licensed — see [NOTICE](NOTICE) |

You may read, fork, adapt, and above all teach from any of this, with credit,
for free. **Classroom and institutional use is explicitly covered** — PolyForm
Noncommercial names educational institutions as a permitted use outright, which
is why it was chosen over a plain CC-NC licence. What is not permitted is
selling it, bundling it into a paid product, running it with advertising, or
putting it behind a paywall.

Fork it freely, but run it under your own name: neither licence grants rights to
the name *FlowAndFlux*, the domain, or the site's identity.

Third-party dependencies (React, Recharts, KaTeX, lucide-react) keep their own
permissive licences and are unaffected by any of the above. The underlying
physics is not owned by anyone — equations and standard results are facts, and
the licences cover only this expression of them.
