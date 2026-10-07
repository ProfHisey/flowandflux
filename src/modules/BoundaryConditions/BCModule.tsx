import { useState } from 'react';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  biot, fluxAt, generatedPerArea, insideDropFraction, solveProfile, valueAt,
  solveJump,
  type BCKind, type Geometry, type JumpParams, type ProfileParams,
} from '../../lib/bcprofile';
import { BCCanvas, type Cargo } from './BCCanvas';
import { BC3DCanvas } from './BC3DCanvas';
import { JumpCanvas } from './JumpCanvas';
import { BC_PRESETS, DEFAULTS, type Vals } from './presets';

/**
 * Steady diffusion with generation, and the three conditions that close it.
 *
 * One second-order equation needs two conditions, one on each bounding
 * surface, and there are only three kinds to choose from: a value, a flux, or
 * a relation between the two. This module is that sentence made draggable —
 * pick a condition for each face, watch the profile rearrange itself to obey.
 *
 * The honest cases are the interesting ones. Seal both faces with generation
 * running and there is no steady state at all; the module says so instead of
 * drawing a lie. Use two flux conditions that DO balance and the shape is
 * fixed while the level is not, which is the clearest possible argument that
 * a flux condition tells you about slopes and never about where the curve
 * sits.
 */

interface UnitSet {
  /** The dependent variable and its unit. */
  sym: string;
  unit: string;
  long: string;
  /** Transport coefficient. */
  kSym: string;
  kUnit: string;
  /** Generation. */
  genSym: string;
  genUnit: string;
  /** Film coefficient. */
  hSym: string;
  hUnit: string;
  lenUnit: string;
  fluxUnit: string;
  /** Slider ranges, in the same units. */
  lRange: [number, number];
  kRange: [number, number];
  genRange: [number, number];
  hRange: [number, number];
  valRange: [number, number];
  fluxRange: [number, number];
}

const UNITS: Record<Cargo, UnitSet> = {
  heat: {
    sym: 'T', unit: '°C', long: 'temperature',
    kSym: 'k', kUnit: 'W/m·K',
    genSym: 'S', genUnit: 'W/m³',
    hSym: 'h', hUnit: 'W/m²·K',
    lenUnit: 'm', fluxUnit: 'W/m²',
    lRange: [0.005, 0.12], kRange: [0.05, 60], genRange: [-3000, 6000],
    hRange: [0.5, 500], valRange: [0, 70], fluxRange: [-2000, 4000],
  },
  mass: {
    sym: 'C', unit: 'mM', long: 'concentration',
    kSym: 'D', kUnit: 'cm²/s',
    genSym: 'ε̇', genUnit: 'mM/s',
    hSym: 'hₘ', hUnit: 'cm/s',
    lenUnit: 'cm', fluxUnit: 'mM·cm/s',
    lRange: [0.01, 0.6], kRange: [1e-7, 1e-4], genRange: [-4e-3, 4e-3],
    hRange: [1e-5, 1e-1], valRange: [0, 12], fluxRange: [-2e-3, 4e-3],
  },
};

/** Curved bodies carry symmetry at the center whether you ask for it or not,
 *  so the inner selector is only offered for a slab. A film is deliberately
 *  NOT offered here: the lecture's far face is always a midplane, a held
 *  face or a sealed one, and a second h would double the controls to teach
 *  nothing the outer face does not already teach. */
const INNER_KINDS: { value: BCKind; label: string; title: string }[] = [
  { value: 'symmetry', label: 'Symmetry', title: 'A midplane: the two halves mirror, so the slope vanishes' },
  { value: 'value', label: 'Value', title: 'The far face is held at a known value' },
  { value: 'flux', label: 'Flux', title: 'A known power is pushed in — zero for a sealed face' },
];

const OUTER_KINDS: { value: BCKind; label: string; title: string }[] = [
  { value: 'value', label: 'Value', title: 'A stirred bath holds the surface at a known value' },
  { value: 'flux', label: 'Flux', title: 'A known flux leaves — zero for a sealed or insulated face' },
  { value: 'mixed', label: 'Mixed', title: 'A fluid film: neither the value nor the slope is yours to set' },
];

/** Enough digits to be honest, few enough to read while dragging. */
function fmt(v: number, unit: string): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return `${v.toExponential(2)} ${unit}`;
  const dp = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  return `${v.toFixed(dp)} ${unit}`;
}

export function BoundaryConditionsModule({ dark }: { dark: boolean }) {
  const [cargo, setCargo] = useState<Cargo>('heat');
  const [geometry, setGeometry] = useState<Geometry>('slab');
  const [innerKind, setInnerKind] = useState<BCKind>('symmetry');
  const [outerKind, setOuterKind] = useState<BCKind>('mixed');
  const [compareH, setCompareH] = useState(false);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [jumpPhi, setJumpPhi] = useState(2.5);
  const [jumpD2, setJumpD2] = useState(1e-5);
  const [store, setStore] = useState<Record<Cargo, Vals>>({
    heat: { ...DEFAULTS.heat },
    mass: { ...DEFAULTS.mass },
  });

  const u = UNITS[cargo];
  const v = store[cargo];
  const set = (patch: Partial<Vals>) =>
    setStore((s) => ({ ...s, [cargo]: { ...s[cargo], ...patch } }));

  // A cylinder or a sphere carries symmetry at its center by regularity, so
  // the inner selector is hidden and the condition forced.
  const effInner: BCKind = geometry === 'slab' ? innerKind : 'symmetry';

  const params: ProfileParams = {
    geometry,
    L: v.L,
    kD: v.kD,
    gen: v.gen,
    inner:
      effInner === 'value' ? { kind: 'value', value: v.innerValue }
        : effInner === 'flux' ? { kind: 'flux', flux: v.innerFlux }
        : { kind: 'symmetry' },
    outer:
      outerKind === 'value' ? { kind: 'value', value: v.outerValue }
        : outerKind === 'flux' ? { kind: 'flux', flux: v.outerFlux }
        : { kind: 'mixed', h: v.h, inf: v.inf, phi: cargo === 'mass' ? v.phi : 1 },
  };

  const sol = solveProfile(params);
  const ok = sol.closure !== 'no-steady-state';
  const vInner = ok ? valueAt(params, 0, sol) : Number.NaN;
  const vSurf = ok ? valueAt(params, params.L, sol) : Number.NaN;
  const bulk = v.inf * (cargo === 'mass' ? v.phi : 1);
  const Bi = biot(params);
  const ghostH = compareH && outerKind === 'mixed' ? v.h / 6 : null;

  const jumpParams: JumpParams = {
    L1: 0.05, kD1: 1e-6, L2: 0.02, kD2: jumpD2,
    left: 10, right: 2, phi: jumpPhi,
  };
  const jump = solveJump(jumpParams);

  const applyPreset = (id: string) => {
    const p = BC_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setCargo(p.cargo);
    setGeometry(p.geometry);
    setInnerKind(p.inner);
    setOuterKind(p.outer);
    setStore((s) => ({ ...s, [p.cargo]: { ...DEFAULTS[p.cargo], ...p.vals } }));
  };

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The profile, and what closes it"
            subtitle="One equation, two conditions. Change a condition and watch the curve rearrange itself to obey."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'The profile against position — this is the view that carries the numbers' },
                      { value: '3d', label: '3D', title: 'The same profile painted on a cut through the body' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <div className="w-44">
                  <Segmented<Cargo>
                    ariaLabel="Heat or mass"
                    value={cargo}
                    options={[
                      { value: 'heat', label: 'Heat', title: 'Temperature, k, S — SI units' },
                      { value: 'mass', label: 'Mass', title: 'Concentration, D, ε̇ — cm-based units' },
                    ]}
                    onChange={setCargo}
                  />
                </div>
              </div>
            }
          >
            {dim === '3d' ? (
              <BC3DCanvas params={params} cargo={cargo} dark={dark} />
            ) : (
              <BCCanvas params={params} cargo={cargo} ghostH={ghostH} dark={dark} />
            )}

            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              The equation in the middle never changes — it is the same second-order
              balance whichever faces you pick. What the conditions decide is which of
              its solutions you get. A <strong>value</strong> nails the curve to a
              number; a <strong>flux</strong> nails its slope and says nothing about
              where it sits; a <strong>film</strong> nails neither on its own and ties
              them to each other instead. Everything on this page is read from the
              closed forms in <code>lib/bcprofile.ts</code>, checked against a
              hand-worked slab before any of it was drawn.
            </p>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel
            title="Read off the profile"
            subtitle={
              sol.closure === 'no-steady-state'
                ? 'No steady state exists for this pair of conditions.'
                : sol.closure === 'floating'
                  ? 'Shape determined, level not — the numbers below are relative.'
                  : 'Computed from the closed form, not measured off the picture.'
            }
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={geometry === 'slab' ? `${u.sym} at x = 0` : `${u.sym} at the center`}
                value={fmt(vInner, '')}
                unit={u.unit}
                tone="accent"
                hint={effInner === 'symmetry' ? 'the extreme value — the slope is zero here' : 'the far face'}
              />
              <Stat
                label={`${u.sym} at the surface`}
                value={fmt(vSurf, '')}
                unit={u.unit}
                tone="accent"
                hint={outerKind === 'value' ? 'held, so this one is an input' : 'an output: the conditions decided it'}
              />
              <Stat
                label="Drop inside"
                value={fmt(vInner - vSurf, '')}
                unit={u.unit}
                hint="what conduction alone has to carry"
              />
              {outerKind === 'mixed' ? (
                <>
                  <Stat
                    label="Film drop"
                    value={fmt(vSurf - bulk, '')}
                    unit={u.unit}
                    tone="warm"
                    hint="the whole convective resistance, j / h"
                  />
                  <Stat
                    label="Bi"
                    value={fmt(Bi, '')}
                    hint={`${u.hSym}L/${u.kSym} — surface vs interior resistance`}
                  />
                  <Stat
                    label="Drop inside / total"
                    value={ok ? `${(insideDropFraction(params) * 100).toFixed(0)}%` : '—'}
                    tone="warm"
                    hint="small Bi puts it all in the film"
                  />
                </>
              ) : (
                <>
                  <Stat
                    label="Flux at the surface"
                    value={fmt(ok ? fluxAt(params, params.L, sol) : NaN, '')}
                    unit={u.fluxUnit}
                    tone="warm"
                    hint="what actually leaves"
                  />
                  <Stat
                    label="Generated per area"
                    value={fmt(generatedPerArea(params), '')}
                    unit={u.fluxUnit}
                    hint={`${u.genSym}L/(n+1) — what has to leave somewhere`}
                  />
                  <Stat
                    label="Closes?"
                    value={sol.closure === 'ok' ? 'yes' : sol.closure === 'floating' ? 'shape only' : 'no'}
                    tone={sol.closure === 'ok' ? 'default' : 'warm'}
                    hint="whether these two conditions pin a profile down"
                  />
                </>
              )}
            </div>
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="The body" subtitle="Geometry decides how much surface there is per unit of volume — and whether symmetry is yours to choose.">
            <div className="space-y-5">
              <Segmented<Geometry>
                label="Shape"
                value={geometry}
                options={[
                  { value: 'slab', label: 'Slab', title: 'Plane walls; a midplane if you want one' },
                  { value: 'cylinder', label: 'Cylinder', title: 'A rod: symmetry at the axis comes free' },
                  { value: 'sphere', label: 'Sphere', title: 'A bead: symmetry at the center comes free' },
                ]}
                onChange={setGeometry}
              />
              <Slider
                label={geometry === 'slab' ? 'Thickness L' : 'Radius R'}
                unit={u.lenUnit}
                value={v.L}
                min={u.lRange[0]}
                max={u.lRange[1]}
                log
                onChange={(x) => set({ L: x })}
                hint="Doubling it quadruples the interior drop, which goes as L²."
              />
              <Slider
                label={u.kSym}
                unit={u.kUnit}
                value={v.kD}
                min={u.kRange[0]}
                max={u.kRange[1]}
                log
                onChange={(x) => set({ kD: x })}
                hint="How easily the interior carries the load. Raise it and the inside flattens out."
              />
              <Slider
                label={`Generation ${u.genSym}`}
                unit={u.genUnit}
                value={v.gen}
                min={u.genRange[0]}
                max={u.genRange[1]}
                onChange={(x) => set({ gen: x })}
                hint="Negative is consumption — the same symbol with a minus sign, and the profile sags instead of bulging."
              />
            </div>
          </Panel>

          <Panel
            title="The two conditions"
            subtitle="One on each bounding surface. That is what a second-order equation costs."
          >
            <div className="space-y-5">
              {geometry === 'slab' ? (
                <Segmented<BCKind>
                  label="At x = 0 (the far face)"
                  value={innerKind}
                  options={INNER_KINDS}
                  onChange={setInnerKind}
                />
              ) : (
                <p className="rounded-md bg-slate-100 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <strong>At r = 0: symmetry, and you do not get a choice.</strong> The
                  other solution of the shell balance blows up at the center, so the
                  only finite profile is the one with zero slope there. Geometry hands
                  you the condition.
                </p>
              )}

              {geometry === 'slab' && innerKind === 'value' && (
                <Slider
                  label="Held value there"
                  unit={u.unit}
                  value={v.innerValue}
                  min={u.valRange[0]}
                  max={u.valRange[1]}
                  onChange={(x) => set({ innerValue: x })}
                />
              )}
              {geometry === 'slab' && innerKind === 'flux' && (
                <Slider
                  label="Pushed in there"
                  unit={u.fluxUnit}
                  value={v.innerFlux}
                  min={u.fluxRange[0]}
                  max={u.fluxRange[1]}
                  onChange={(x) => set({ innerFlux: x })}
                  hint="Zero is a sealed or insulated face — the case worth looking at first."
                />
              )}

              <Segmented<BCKind>
                label={geometry === 'slab' ? 'At x = L (the surface)' : 'At r = R (the surface)'}
                value={outerKind}
                options={OUTER_KINDS}
                onChange={setOuterKind}
              />

              {outerKind === 'value' && (
                <Slider
                  label="Held value"
                  unit={u.unit}
                  value={v.outerValue}
                  min={u.valRange[0]}
                  max={u.valRange[1]}
                  onChange={(x) => set({ outerValue: x })}
                  hint="A stirred bath: the surface is an input now, not an answer."
                />
              )}
              {outerKind === 'flux' && (
                <Slider
                  label="Leaving the surface"
                  unit={u.fluxUnit}
                  value={v.outerFlux}
                  min={u.fluxRange[0]}
                  max={u.fluxRange[1]}
                  onChange={(x) => set({ outerFlux: x })}
                  hint="Set it to zero and seal the body. With generation running, nothing steady can exist."
                />
              )}
              {outerKind === 'mixed' && (
                <>
                  <Slider
                    label={u.hSym}
                    unit={u.hUnit}
                    value={v.h}
                    min={u.hRange[0]}
                    max={u.hRange[1]}
                    log
                    onChange={(x) => set({ h: x })}
                    hint="A poor film lifts the whole body without changing its shape; a good one pins the surface to the bulk."
                  />
                  <Slider
                    label={`Bulk ${u.sym}∞`}
                    unit={u.unit}
                    value={v.inf}
                    min={u.valRange[0]}
                    max={u.valRange[1]}
                    onChange={(x) => set({ inf: x })}
                  />
                  {cargo === 'mass' && (
                    <Slider
                      label="Partition Φ"
                      value={v.phi}
                      min={0.2}
                      max={5}
                      log
                      onChange={(x) => set({ phi: x })}
                      hint="The surface equilibrates with Φ·C∞, not C∞. Heat has no such number — a temperature cannot jump."
                    />
                  )}
                  <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={compareH}
                      onChange={(e) => setCompareH(e.target.checked)}
                    />
                    <span>
                      Compare a worse film
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        Ghosts the same body at one sixth the film coefficient — a poor
                        film raises the whole profile rather than bending it.
                      </span>
                    </span>
                  </label>
                </>
              )}
            </div>
          </Panel>

          <Panel title="Setups" subtitle="Each one makes a single point.">
            <div className="flex flex-wrap gap-1.5">
              {BC_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.blurb}
                  onClick={() => applyPreset(p.id)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>


      {/* ------------------------------------------- the interface jump */}
      <Panel
        title="Two materials touching"
        subtitle="The one place the heat–mass analogy breaks. Flux is continuous either way; the value is not."
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <JumpCanvas params={jumpParams} dark={dark} />
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Both curves solve the same problem between the same two held faces. The
              dashed one is a temperature and passes straight through the contact; the
              solid one is a concentration and <em>steps</em>, because equilibrium at an
              interface means equal chemical potential rather than equal concentration,
              and a solute can simply be more soluble on one side. Henry's law,
              C<sub>water</sub> = H·p<sub>gas</sub>, is the same statement for a gas over a
              liquid. Set Φ = 1 and the two coincide — heat is the Φ = 1 case of the same
              algebra, not a different subject.
            </p>
          </div>
          <div className="space-y-5">
            <Slider
              label="Partition Φ"
              value={jumpPhi}
              min={0.2}
              max={5}
              log
              onChange={setJumpPhi}
              hint="C₁ = Φ C₂ at the contact. Above 1 the solute prefers material 1, so it piles up there."
            />
            <Slider
              label="D₂"
              unit="cm²/s"
              value={jumpD2}
              min={1e-7}
              max={1e-4}
              log
              onChange={setJumpD2}
              hint="Material 1 is fixed at 1e-6 cm²/s. The slower side takes the bigger share of the drop."
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Stat
                label="C at the contact, left"
                value={jump.interfaceLeft.toFixed(2)}
                unit="mM"
                tone="accent"
              />
              <Stat
                label="...and right"
                value={jump.interfaceRight.toFixed(2)}
                unit="mM"
                tone="accent"
              />
              <Stat
                label="Flux through"
                value={jump.flux.toExponential(2)}
                unit="mM·cm/s"
                hint="one number, both sides — it has nowhere else to go"
              />
              <Stat
                label="Step"
                value={`${(jump.interfaceLeft / Math.max(jump.interfaceRight, 1e-12)).toFixed(2)}×`}
                tone="warm"
                hint="exactly Φ, by construction"
              />
            </div>
          </div>
        </div>
      </Panel>
      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="The balance, with something happening inside"
            latex={String.raw`\frac{1}{s^{n}}\frac{d}{ds}\!\left(s^{n}\,k\,\frac{dT}{ds}\right) + S = 0`}
            note="One statement for all three shapes: n = 0 slab, 1 cylinder, 2 sphere. In flux form it reads even more plainly — the flux has to change along the way by exactly as much as is being made. The mass twin swaps k for D, S for ε̇ and T for C and is otherwise the same line, which is why anything learned here is learned twice."
          />
          <EquationCard
            title="Two integrations, two constants, two conditions"
            latex={String.raw`T(x_0)=T_0 \qquad -k\frac{dT}{dx}\Big|_{x_0}=q_s \qquad \alpha T + \beta\frac{dT}{dx}\Big|_{x_0}=\text{given}`}
            note="Value, flux, mixed — that is the whole catalogue. A value pins the curve; a flux pins its slope; a mixed condition pins neither and ties them to each other. You need exactly one per bounding surface, and the arithmetic will not finish without them."
          />
          <EquationCard
            title="Symmetry is a flux condition you get free"
            latex={String.raw`\frac{dT}{dr}\Big|_{r=0} = 0`}
            note="Nobody imposes this on a solid cylinder or sphere. The other branch of the solution carries ln r or 1/r, which is infinite at the center, so the only finite profile is the one that arrives flat. In a slab the same condition is a modeling choice — a midplane — rather than a gift."
            defaultOpen={false}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="The worked slab: generation in, one face open"
            latex={String.raw`T(x) = T_0 + \frac{S}{k}\left(Lx - \frac{x^{2}}{2}\right), \qquad T_{\text{core}} = T_0 + \frac{S L^{2}}{2k}`}
            note="Insulated at the core, held at the face. Integrate twice, use the flat slope to kill one constant and the held value to read off the other. Everything made inside leaves through the one open face, so k dT/dx at that face is exactly S·L — a line worth checking before trusting any of the rest."
          />
          <EquationCard
            title="Where the drop sits — the Biot number"
            latex={String.raw`\frac{T_{\text{core}}-T_s}{T_{\text{core}}-T_\infty} = \frac{\mathrm{Bi}/2}{1+\mathrm{Bi}/2}, \qquad \mathrm{Bi}=\frac{hL}{k}`}
            note="Swap the held face for a film and the surface stops being an input. All the heat still has to cross the film, so the surface sits S·L/h above the bulk whatever the inside is doing. Bi compares the two resistances: small Bi and the body is nearly uniform with the whole drop in the film; large Bi and the surface is practically at the bulk value with the drop inside."
          />
          <EquationCard
            title="A concentration can jump; a temperature cannot"
            latex={String.raw`C_1 = \Phi\,C_2, \qquad D_1\frac{dC_1}{dx} = D_2\frac{dC_2}{dx}`}
            note="At an interface the flux is always continuous — there is nowhere else for it to go. The value is where heat and mass part company: a solute can simply be more comfortable in one phase than the other, and the profile steps at the boundary to say so. Henry's law is the same statement for a gas over a liquid. Nothing like it exists for temperature."
            defaultOpen={false}
          />
        </div>
      </div>

      <Panel title="Things to try">
        <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          <li>Start on <strong>Warm slab, cooled by air</strong>. Drag the film coefficient down and watch the whole profile lift without changing shape. Now drag it up: where does the drop go?</li>
          <li>Switch the surface from <strong>Mixed</strong> to <strong>Value</strong>. One number stopped being an answer and became a given — which one?</li>
          <li>Seal both faces with generation running. The module refuses to draw a profile. Say out loud why there cannot be one.</li>
          <li>Now set the surface flux to exactly what the body makes. A shape appears but the level is arbitrary — what would you have to add to pin it down?</li>
          <li>Switch to a <strong>cylinder</strong>, then a <strong>sphere</strong>, holding everything else. The interior drop divides by 2, then by 3. Where does that come from?</li>
          <li>Flip generation negative. Consumption is the same symbol with a minus sign; the curve sags instead of bulging and nothing else about the method changes.</li>
          <li>Switch to <strong>Mass</strong> and move Φ. The surface equilibrates with Φ·C∞ rather than C∞. Try to do the same thing to a temperature.</li>
        </ul>
      </Panel>
    </div>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Flux laws
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          What closes the equation
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Boundary conditions
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        A second-order balance has a family of solutions, and the conditions at the
        surfaces pick one out. There are only three kinds to choose from — a value, a
        flux, or a relation between them — and each leaves its own fingerprint on the
        profile. Pick a pair, and watch which curve you get.
      </p>
    </header>
  );
}
