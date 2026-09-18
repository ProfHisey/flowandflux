# FlowAndFlux — notes for contributors

Interactive transport-phenomena simulations — diffusion, conduction, viscous
flow, convective transport. React 19 + TypeScript + Vite, HTML5 Canvas for the
particle physics and the 3D views, no backend, deployed as a static site.

> **Maintainer note.** The authoritative working-notes document for this project
> is **`notes/CLAUDE.md`**, kept in a separate private repository cloned to
> `notes/` (gitignored). **If that folder is present, read `notes/CLAUDE.md`
> first** — it carries the design direction, the full module inventory, the
> verification table, and the accumulated audit lessons. What follows here is
> only the part that is useful to everyone. Setup is at the bottom.

---

## Commands

```bash
npm run dev        # localhost:5173
npm run build      # tsc -b && vite build
npm run verify     # physics regression checks — run before every commit
npm run lint
```

`npm run verify` is not optional. It checks every simulation function against
hand-worked answers — flux and holdup through a membrane, species and energy
conservation across slab / cylinder / sphere, Stokes–Einstein round-trips,
Gaussian spreading moments, lumped-cooling time constants, settling velocities,
control-volume ledger closure, and much more. It runs in CI and blocks
deployment on failure. If it fails, the physics is wrong regardless of how the
page looks. **When you add physics, add its check.**

---

## Non-negotiables

1. **Units are never optional.** Every number surfaced in the UI carries its
   unit. `src/lib/format.ts` exists to make that painless.
2. **Physical values are honest; cosmetic values are labeled.** The particle
   animations run at a fixed visual diffusivity (`D_VIS`) unrelated to the
   physical `D`, because D spans ten decades here and a faithful animation would
   freeze or blur at almost every setting. That compromise is stated on the
   page. Any new compromise gets the same treatment: say so in the UI.
3. **Symbolic before numeric.** Equation cards show the symbolic form; readouts
   show the evaluated number. They stay visually distinct.
4. **`j` and `J` are different quantities** — local flux vs. total transfer
   rate. The curved geometries exist to make the difference visible. Never label
   one with the other's units.
5. **CGS for mass transfer, SI for heat** (D in cm²/s, k in W/m·°C). Don't force
   one system on both.
6. **Emergence over assertion.** Walkers never consult the gradient; net
   transport emerges from counting. Do not add a drift term to a diffusion
   demo — it would smooth the animation and destroy the entire point.

---

## Where the code lives

```
src/
  lib/          All physics, as pure functions. No React, no algebra in
                components. One file per topic (fick, fourier, newton,
                unsteady, cooling, network, poiseuille, stokes, peclet,
                correlations, transient, kinetics, mixingcup, rtt, walker…).
  hooks/
    useCanvas.ts  rAF loop + DPR scaling + ResizeObserver. Stops when paused,
                  repaints once on `redrawKey` change — and repaints static
                  canvases after a resize (don't remove that; paused canvases
                  otherwise stay blank after a late layout shift).
  components/ui/  Slider, Segmented, Panel/Stat, EquationCard, FitMath.
                  Generic; no module-specific knowledge.
  modules/
    <Topic>/      Page composition + 2D canvas + 3D canvas + chart +
                  presets.ts + socratic.ts (question sets are authored but
                  deliberately not rendered yet).
    shared/paint3d.ts  The shared 3D engine: useOrbitCam + useOrbitControls +
                  makePainter. Orthographic, depth-sorted painter's algorithm
                  on plain canvas 2D — no 3D library. Include `cam.camTick`
                  in `redrawKey`.
scripts/verify.ts  The physics regression suite.
```

**Adding a module:** mirror `src/modules/FicksLaw/`. Put the math in
`src/lib/<topic>.ts` as pure functions, add cases to `scripts/verify.ts` that
check it against a hand-worked answer, *then* build the UI on top. The physics
should be correct before a single pixel is drawn.

---

## Conventions worth knowing before you edit

- **Night mode is the site default** (`App.tsx` `dark=true`, and `index.html`
  carries `class="dark"` so there is no light flash). White objects vanish on a
  light background.
- **Contrast pair is `text-slate-500 dark:text-slate-400`** — never write it
  inverted; the reverse fails AA at 10–12 px in both themes.
- **Responsive grid:** every module is three placed items — canvas `order-1`,
  controls `order-2` (col-2, row-span-2), readouts+charts `order-3` — so on
  narrow screens the sliders land directly under the canvas.
- **Every module has a 2D and a 3D tab.** 2D is the default and keeps all
  measurements; 3D is for geometric intuition and carries no readouts.
- **2D drag pans, the wheel zooms about the cursor, double-click resets both**
  (`useWheelZoom`/`applyZoom` in `FickCanvas.tsx`, per-canvas pan in a WeakMap).
  All 2D canvases get this for free — never thread a pan through call sites.
  Camera only: the simulation always runs in unzoomed pixels.
- **Every spatial slider must visibly change the drawing.** A slider that
  changes nothing on screen teaches nothing.
- **Nav dropdown panels must never live inside an `overflow-x` container** — it
  clips them invisibly.
- **Use `FitMath` for any new display equation** (it scales font-size to the
  container instead of adding a horizontal scrollbar).
- **Accessibility:** every `<canvas>` carries `role="img"` alongside its
  `aria-label`; `Segmented` takes `ariaLabel`; log-mapped sliders need
  `aria-valuetext` (the input rides on log10, so a reader would otherwise
  announce "−3.2" where the readout says "6e-4 cm²/s").
- **Prose numbers are the most common failure class.** Any number in a blurb,
  hint, or caption must be hand-checked, and preferably pinned in `verify.ts`.
- **American English** throughout — code, comments, copy, docs.

---

## Maintainer setup

The private notes repository is cloned into **`notes/`** inside this working
tree. It is gitignored, so `git status` here never sees it, `tsc` never includes
it, and the build never touches it.

Maintainers: clone it to that path, run `npm install`, then read
`notes/CLAUDE.md` before doing anything else. Its own README carries the rest of
the per-machine setup. Day-to-day, **both** repos need pulling and pushing —
`notes/` is where the state of the project is recorded, so a commit there
matters as much as a commit here.

Everyone else: you can ignore all of this. The code, the physics suite, and the
site are complete without it.
