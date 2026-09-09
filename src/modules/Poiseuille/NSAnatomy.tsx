import { useState, type ReactNode } from 'react';
import { BlockMath } from 'react-katex';

import { Panel } from '../../components/ui/Panel';
import type { FlowGeometry } from '../../lib/poiseuille';

/**
 * The Navier-Stokes term killer, in the coordinate system the geometry
 * actually lives in: cylindrical for the tube, Cartesian for the plates and
 * the film. Nine terms in and two out every time — but WHICH two, and which
 * assumption kills what, differs by geometry, and showing the same ritual
 * three times in three frames is most of the value.
 *
 * The film is not merely a change of coordinates. It is the one case where
 * the PRESSURE term is the casualty and gravity is the survivor: the free
 * surface sits at atmospheric pressure, so dP/dz = 0, and the fluid is
 * driven by its own weight. Tube and plates do the exact opposite — they
 * discard gravity and keep the pressure gradient. A student who has only
 * ever seen the pipe derivation reads "horizontal" as a free move; the film
 * is where that reflex costs them the entire driving force.
 *
 * The survivor equations and their boundary conditions match lib/poiseuille
 * term for term — the same three solutions verify.ts checks.
 */

interface NSAssumption {
  id: string;
  label: string;
  why: string;
  /** How many of the nine terms this assumption removes. */
  kills: number;
}

interface NSSpec {
  /** The coordinate system, named on the page. */
  frame: string;
  /** Which momentum component is on display. */
  component: string;
  assumptions: readonly NSAssumption[];
  /** `c(id, term)` wraps a term in \cancel once its assumption is checked. */
  latex: (c: (id: string, term: string) => string) => string;
  survivors: string;
  survivorProse: ReactNode;
}

/** Nine terms in every geometry: 4 inertial, 1 pressure, 3 viscous, 1 body force. */
const NS_TERMS = 9;

const NS_SPECS: Record<FlowGeometry, NSSpec> = {
  tube: {
    frame: 'cylindrical coordinates (r, θ, z)',
    component: 'z-momentum',
    assumptions: [
      { id: 'steady', label: 'Steady', why: 'nothing changes in time', kills: 1 },
      { id: 'developed', label: 'Fully developed', why: '∂v_z/∂z = 0 past the entrance', kills: 2 },
      { id: 'noradial', label: 'No radial flow', why: 'v_r = 0: fluid moves only axially', kills: 1 },
      { id: 'axisym', label: 'No swirl, axisymmetric', why: 'v_θ = 0 and ∂/∂θ = 0', kills: 2 },
      { id: 'horizontal', label: 'Horizontal', why: 'gravity has no axial component', kills: 1 },
    ],
    latex: (c) =>
      String.raw`\rho\!\left(${c('steady', String.raw`\frac{\partial v_z}{\partial t}`)} + ${c('noradial', String.raw`v_r\frac{\partial v_z}{\partial r}`)} + ${c('axisym', String.raw`\frac{v_\theta}{r}\frac{\partial v_z}{\partial \theta}`)} + ${c('developed', String.raw`v_z\frac{\partial v_z}{\partial z}`)}\right) = -\frac{\partial P}{\partial z} + \mu\!\left[\frac{1}{r}\frac{\partial}{\partial r}\!\left(r\frac{\partial v_z}{\partial r}\right) + ${c('axisym', String.raw`\frac{1}{r^2}\frac{\partial^2 v_z}{\partial \theta^2}`)} + ${c('developed', String.raw`\frac{\partial^2 v_z}{\partial z^2}`)}\right] + ${c('horizontal', String.raw`\rho g_z`)}`,
    survivors: String.raw`0 = -\frac{dP}{dz} + \frac{\mu}{r}\frac{d}{dr}\!\left(r\frac{dv_z}{dr}\right)\;\;\xrightarrow[\;v_z(R)=0,\ v_z(0)\ \text{finite}\;]{\;dP/dz = -\Delta P/L\;}\;\;\boxed{v_z = \frac{\Delta P}{4\mu L}\left(R^2 - r^2\right)}`,
    survivorProse: (
      <>
        Pressure pushing, viscosity resisting, nothing else left. Two boundary
        conditions — no slip at the wall, and "finite at the axis" (which quietly
        executes a ln(r) term) — and out falls the parabola. Integrate it over the
        cross-section and Q = πΔPR⁴/8μL appears. That is the whole game with
        Navier–Stokes at this level: it is rarely solved, it is <em>disarmed</em>.
      </>
    ),
  },

  plates: {
    frame: 'Cartesian coordinates (x, y, z)',
    component: 'x-momentum',
    assumptions: [
      { id: 'steady', label: 'Steady', why: 'nothing changes in time', kills: 1 },
      { id: 'developed', label: 'Fully developed', why: '∂v_x/∂x = 0 past the entrance', kills: 2 },
      { id: 'nocross', label: 'No cross-flow', why: 'v_y = 0: fluid moves only along the slot', kills: 1 },
      { id: 'wide', label: 'Wide plates', why: 'v_z = 0 and ∂/∂z = 0: the side edges are far away', kills: 2 },
      { id: 'horizontal', label: 'Horizontal', why: 'gravity has no component along the slot', kills: 1 },
    ],
    latex: (c) =>
      String.raw`\rho\!\left(${c('steady', String.raw`\frac{\partial v_x}{\partial t}`)} + ${c('developed', String.raw`v_x\frac{\partial v_x}{\partial x}`)} + ${c('nocross', String.raw`v_y\frac{\partial v_x}{\partial y}`)} + ${c('wide', String.raw`v_z\frac{\partial v_x}{\partial z}`)}\right) = -\frac{\partial P}{\partial x} + \mu\!\left[${c('developed', String.raw`\frac{\partial^2 v_x}{\partial x^2}`)} + \frac{\partial^2 v_x}{\partial y^2} + ${c('wide', String.raw`\frac{\partial^2 v_x}{\partial z^2}`)}\right] + ${c('horizontal', String.raw`\rho g_x`)}`,
    survivors: String.raw`0 = -\frac{dP}{dx} + \mu\frac{d^2 v_x}{dy^2}\;\;\xrightarrow[\;v_x(0)=0,\ v_x(h)=0\;]{\;dP/dx = -\Delta P/L\;}\;\;\boxed{v_x = \frac{\Delta P}{2\mu L}\,y\,(h - y)}`,
    survivorProse: (
      <>
        The same two survivors as the tube — pressure pushing, viscosity resisting —
        but in a flat frame, so the curvature term is a plain second derivative
        instead of the tube's (1/r)d/dr(r d/dr). Both walls are solid here, which
        buys two honest no-slip conditions and removes any need for the "finite at
        the axis" dodge. A parabola falls out again, and integrating it gives
        Q = Wh³ΔP/12μL — the cube, not the fourth power, because a slot has no
        radius to square twice.
      </>
    ),
  },

  film: {
    frame: 'Cartesian coordinates (x, y, z), with z pointing down the wall',
    component: 'z-momentum',
    assumptions: [
      { id: 'steady', label: 'Steady', why: 'nothing changes in time', kills: 1 },
      { id: 'developed', label: 'Fully developed', why: '∂v_z/∂z = 0 once the film settles', kills: 2 },
      { id: 'nocross', label: 'No cross-flow', why: 'v_x = 0: nothing moves toward the wall', kills: 1 },
      { id: 'wide', label: 'Wide film', why: 'v_y = 0 and ∂/∂y = 0: the side edges are far away', kills: 2 },
      { id: 'open', label: 'Open to the air', why: 'the free surface sits at atmospheric pressure, so ∂P/∂z = 0', kills: 1 },
    ],
    latex: (c) =>
      String.raw`\rho\!\left(${c('steady', String.raw`\frac{\partial v_z}{\partial t}`)} + ${c('nocross', String.raw`v_x\frac{\partial v_z}{\partial x}`)} + ${c('wide', String.raw`v_y\frac{\partial v_z}{\partial y}`)} + ${c('developed', String.raw`v_z\frac{\partial v_z}{\partial z}`)}\right) = ${c('open', String.raw`-\frac{\partial P}{\partial z}`)} + \mu\!\left[\frac{\partial^2 v_z}{\partial x^2} + ${c('wide', String.raw`\frac{\partial^2 v_z}{\partial y^2}`)} + ${c('developed', String.raw`\frac{\partial^2 v_z}{\partial z^2}`)}\right] + \rho g`,
    survivors: String.raw`0 = \rho g + \mu\frac{d^2 v_z}{dx^2}\;\;\xrightarrow[\;v_z(0)=0,\ \left.\frac{dv_z}{dx}\right|_{x=h}=0\;]{\;\text{no slip at the wall, no shear at the free surface}\;}\;\;\boxed{v_z = \frac{\rho g}{\mu}\left(h x - \frac{x^2}{2}\right)}`,
    survivorProse: (
      <>
        A different pair survives. There is no pump and no pressure gradient — the
        free surface is open to the atmosphere — so the term the other two geometries
        keep is the one that dies here, and the term they discard is what drives the
        whole flow. The second boundary condition changes with it: the film has only
        one wall, and at the free surface there is nothing to grip the fluid, so it
        is the SHEAR that goes to zero, not the velocity. That is why the profile is
        half a parabola with its flat top at the surface, and why the fastest fluid
        in a falling film is the fluid touching the air.
      </>
    ),
  },
};

export function NSAnatomy({ geometry }: { geometry: FlowGeometry }) {
  const spec = NS_SPECS[geometry];
  const [on, setOn] = useState<Record<string, boolean>>({});
  // Each geometry carries its own assumption set, and two of the ids are
  // shared. Without this reset, checking "Steady" for the tube would leave a
  // box pre-checked when the reader switches to the film — arriving at a
  // half-disarmed equation nobody disarmed.
  const [shownFor, setShownFor] = useState<FlowGeometry>(geometry);
  if (shownFor !== geometry) {
    setShownFor(geometry);
    setOn({});
  }

  const toggle = (id: string) => setOn((o) => ({ ...o, [id]: !o[id] }));
  const allOn = spec.assumptions.every((a) => on[a.id]);
  const killed = spec.assumptions.reduce((n, a) => n + (on[a.id] ? a.kills : 0), 0);
  const checkedCount = spec.assumptions.filter((a) => on[a.id]).length;

  const c = (id: string, term: string) => (on[id] ? String.raw`\cancel{${term}}` : term);

  return (
    <Panel
      title="Navier–Stokes, disarmed term by term"
      subtitle={`The ${spec.component} equation in ${spec.frame} — nine terms. Check the assumptions this geometry allows, and watch which two are left standing.`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {spec.assumptions.map((a) => (
          <label
            key={a.id}
            title={a.why}
            className={
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ' +
              (on[a.id]
                ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300')
            }
          >
            <input
              type="checkbox"
              checked={!!on[a.id]}
              onChange={() => toggle(a.id)}
              className="h-3.5 w-3.5 accent-emerald-600"
            />
            {a.label}
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
              — {a.why}
            </span>
          </label>
        ))}
        <span className="ml-auto self-center font-mono text-xs text-slate-500 dark:text-slate-400">
          {NS_TERMS - killed} of {NS_TERMS} terms standing
        </span>
      </div>

      <div className="overflow-x-auto py-1 text-slate-900 dark:text-slate-100">
        <BlockMath math={spec.latex(c)} />
      </div>

      {allOn ? (
        <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
            The survivors, and their surrender
          </p>
          <div className="overflow-x-auto">
            <BlockMath math={spec.survivors} />
          </div>
          <p className="mt-1 text-xs leading-relaxed">{spec.survivorProse}</p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {checkedCount === 0
            ? 'Every fluid flow in this geometry, all at once — nobody solves this directly. Start checking assumptions.'
            : 'Keep going — every checked assumption is a physical claim about this flow, and each one takes its terms with it.'}
        </p>
      )}
    </Panel>
  );
}
