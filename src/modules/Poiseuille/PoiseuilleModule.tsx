import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  flowRate,
  hydraulicResistance,
  reynolds,
  vAvg,
  vMax,
  wallShear,
  type FlowGeometry,
  type PoiseuilleParams,
} from '../../lib/poiseuille';
import { lengthM, sci } from '../../lib/format';
import { MU_LANDMARKS } from '../NewtonViscosity/presets';
import { PoiseuilleCanvas } from './PoiseuilleCanvas';
import { Poiseuille3DCanvas } from './Poiseuille3DCanvas';
import { PoiseuilleChart } from './PoiseuilleChart';
import { DEFAULT_PARAMS, PRESETS } from './presets';

export function PoiseuilleModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<PoiseuilleParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof PoiseuilleParams>(key: K, value: PoiseuilleParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);
  const isFilm = params.geometry === 'film';
  const isTube = params.geometry === 'tube';

  const derived = useMemo(
    () => ({
      Q: flowRate(params),
      vbar: vAvg(params),
      vpk: vMax(params),
      tauW: wallShear(params),
      Re: reynolds(params),
      Rhyd: hydraulicResistance(params),
    }),
    [params],
  );
  const turbulent = derived.Re > 2000;

  return (
    <div className="space-y-5">
      <ModuleHeader />

      {/* The derivation comes first, as it does on the board: disarm
          Navier-Stokes, THEN meet the flow that falls out of it. */}
      <NSAnatomy />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title={isFilm ? 'A film falling down a wall' : 'Pressure-driven flow in a conduit'}
            subtitle={
              isFilm
                ? 'No pump anywhere. Gravity is the pressure gradient.'
                : 'Pushed from one end, held back by the walls — the profile is the truce.'
            }
            right={
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    value={dim}
                    options={[
                      { value: '2d', label: '2D' },
                      { value: '3d', label: '3D', title: 'Rotatable 3D view — drag to orbit' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <IconButton
                  label={running ? 'Pause' : 'Play'}
                  onClick={() => setRunning((r) => !r)}
                >
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
                <IconButton
                  label={showParticles ? 'Hide tracers' : 'Show tracers'}
                  active={showParticles}
                  onClick={() => setShowParticles((s) => !s)}
                >
                  <Sparkles size={15} />
                </IconButton>
              </div>
            }
          >
            {dim === '3d' ? (
              <>
                <Poiseuille3DCanvas
                  params={params}
                  showParticles={showParticles}
                  running={running}
                  dark={dark}
                />
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  The classic dye-front demo: a flat sheet of dye is released and the
                  flow itself sculpts it — a bullet in the tube, a parabolic curtain
                  between the plates, a sagging half-parabola down the film. The
                  velocity profile is not drawn here; it is what the dye BECOMES.
                </p>
              </>
            ) : (
              <>
                <PoiseuilleCanvas
                  params={params}
                  showParticles={showParticles}
                  running={running}
                  dark={dark}
                />
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Tracers ride the profile without diffusing, and the on-screen peak speed
                  is fixed for legibility — the shape and every readout are physical. Watch
                  a tracer near the wall against one on the centreline: same fluid, same
                  driving force, and the wall one barely moves. That spread IS the profile.
                </p>
              </>
            )}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="Q" />}
                value={sci(derived.Q)}
                unit="m³/s"
                tone="accent"
                hint={`${sci(derived.Q * 1e6)} mL/s`}
              />
              <Stat
                label={<InlineMath math="\bar{v}" />}
                value={sci(derived.vbar)}
                unit="m/s"
                hint="Q / A"
              />
              <Stat
                label={<InlineMath math="v_{max}" />}
                value={sci(derived.vpk)}
                unit="m/s"
                hint={isTube ? '2·v̄ on the axis' : '1.5·v̄ at the peak'}
              />
              <Stat
                label={<InlineMath math="\tau_{wall}" />}
                value={sci(derived.tauW)}
                unit="Pa"
                tone="warm"
                hint="max shear — where the flow touches biology"
              />
              <Stat
                label={<InlineMath math="\mathrm{Re}" />}
                value={sci(derived.Re)}
                unit=""
                hint={turbulent ? 'above ~2000 — see the warning' : 'laminar — this solution applies'}
              />
              <Stat
                label={<InlineMath math="R_{hyd} = \Delta P / Q" />}
                value={isFilm ? '—' : sci(derived.Rhyd)}
                unit={isFilm ? '' : 'Pa·s/m³'}
                hint={isFilm ? 'gravity-driven: no ΔP to divide' : isTube ? '8μL/πR⁴ — a resistor, again' : '12μL/Wh³'}
              />
            </div>

            {turbulent && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">Re = {sci(derived.Re)} &gt; ~2000: </span>
                past the laminar–turbulent transition, the smooth layered flow breaks
                up and every formula on this page stops applying. The parabola is a
                laminar creature. (In the body that mostly only happens in the aorta.)
              </p>
            )}

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="Profiles">
            <PoiseuilleChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<FlowGeometry>
                label="Geometry"
                value={params.geometry}
                options={[
                  { value: 'tube', label: 'Tube', title: 'Poiseuille: Q ~ R⁴' },
                  { value: 'plates', label: 'Plates', title: 'Slot flow: Q ~ h³' },
                  { value: 'film', label: 'Film', title: 'Gravity-driven falling film' },
                ]}
                onChange={(g) => set('geometry', g)}
              />

              <Slider
                label="Dynamic viscosity, μ"
                unit="Pa·s"
                value={params.mu}
                min={1e-5}
                max={100}
                log
                format={sci}
                onChange={(v) => set('mu', v)}
              />
              <MuScale mu={params.mu} />

              {!isFilm && (
                <>
                  <Slider
                    label="Driving pressure, ΔP"
                    unit="Pa"
                    value={params.dP}
                    min={1}
                    max={1e5}
                    log
                    format={sci}
                    onChange={(v) => set('dP', v)}
                  />
                  <Slider
                    label="Length, L"
                    value={params.L}
                    min={0.01}
                    max={1}
                    log
                    format={lengthM}
                    onChange={(v) => set('L', v)}
                  />
                </>
              )}

              {isTube ? (
                <Slider
                  label="Radius, R"
                  value={params.R}
                  min={5e-5}
                  max={5e-3}
                  log
                  format={lengthM}
                  onChange={(v) => set('R', v)}
                  hint="The R⁴ knob. Every nudge here is worth four nudges anywhere else."
                />
              ) : (
                <>
                  <Slider
                    label={isFilm ? 'Film thickness, h' : 'Gap, h'}
                    value={params.h}
                    min={5e-5}
                    max={5e-3}
                    log
                    format={lengthM}
                    onChange={(v) => set('h', v)}
                  />
                  <Slider
                    label="Width, W"
                    unit="m"
                    value={params.W}
                    min={0.005}
                    max={1}
                    log
                    format={sci}
                    onChange={(v) => set('W', v)}
                  />
                </>
              )}

              <Slider
                label="Density, ρ"
                unit="kg/m³"
                value={params.rho}
                min={0.5}
                max={2000}
                log
                format={sci}
                onChange={(v) => set('rho', v)}
                hint={isFilm ? 'For the film, ρg IS the driving force.' : 'Only Re cares about ρ here — until it does.'}
              />
            </div>
          </Panel>

          <Panel
            title="Example problems"
            subtitle="Load a setup, then check the numbers by hand."
          >
            <div className="space-y-2">
              {PRESETS.map((pr) => {
                const active = pr.id === presetId;
                return (
                  <button
                    key={pr.id}
                    type="button"
                    onClick={() => {
                      setParams(pr.params);
                      setPresetId(pr.id);
                    }}
                    className={
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                      (active
                        ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50')
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {pr.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {pr.source}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
                      {pr.blurb}
                    </p>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setParams(DEFAULT_PARAMS);
                  setPresetId(PRESETS[0].id);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="Poiseuille's law"
            latex={String.raw`v_z(r) = \frac{\Delta P}{4\mu L}\left(R^2 - r^2\right) \qquad Q = \frac{\pi\,\Delta P\,R^4}{8\,\mu\,L}`}
            terms={[
              { symbol: 'Q', meaning: 'volumetric flow rate, m³/s', maps: 'Q readout' },
              { symbol: 'R^4', meaning: 'the headline: area (R²) × faster centreline (R²)', maps: 'R slider' },
            ]}
            note="Established experimentally by Poiseuille (1840s) — a physician chasing blood flow, though blood clotted in his glass capillaries and he had to use water — decades before anyone could derive it from first principles. The fourth power is the punchline: 20% narrower means 41% of the flow, which is why vessel radius — not the heart — is the body's flow-control knob, and why a stenosis is worse than it looks."
          />

          <EquationCard
            title="The three-flow family"
            latex={String.raw`
\begin{aligned}
\text{tube:}&\quad Q = \frac{\pi \Delta P R^4}{8\mu L}, & v_{max} &= 2\bar v\\[4pt]
\text{plates:}&\quad Q = \frac{W h^3 \Delta P}{12\mu L}, & v_{max} &= \tfrac{3}{2}\bar v\\[4pt]
\text{film:}&\quad Q = \frac{\rho g W h^3}{3\mu}, & v_{max} &= \tfrac{3}{2}\bar v
\end{aligned}`}
            note="One derivation, three costumes: swap ΔP/L for ρg and the plates become the film. The gap dimension always enters at the third or fourth power — thin passages are catastrophically hard to push fluid through, which is the operating principle of microfluidics and the tragedy of clogged anything."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Hydraulic resistance — the third circuit"
            latex={String.raw`\Delta P = Q\,R_{hyd}, \qquad R_{hyd} = \frac{8\mu L}{\pi R^4}\ \text{(tube)}`}
            note="ΔC = J·R_D, ΔT = Q·R_th, and now ΔP = Q·R_hyd: the same Ohm's law a third time. Series tubes add resistance; parallel tubes add conductance. A single capillary is ferociously resistive (R⁻⁴!), but billions in parallel make the capillary bed cheap — the muscular arterioles upstream are where the pressure actually drops, which is exactly what makes them the control valves."
            defaultOpen={false}
          />

          <EquationCard
            title="When the parabola dies"
            latex={String.raw`\mathrm{Re} = \frac{\rho\,\bar{v}\,D}{\mu} \gtrsim 2000 \;\Rightarrow\; \text{turbulence}`}
            note="Everything on this page assumes laminar flow. Push Re past ~2000 in a tube and the neat layers shred into eddies: pressure drop rises, profiles flatten, and Q ~ R⁴ fails. Blood flow is laminar almost everywhere (Re ~ 10⁻³ in capillaries, ~1 in arterioles, ~1000s only in the aorta) — one of nature's many quiet endorsements of the laminar regime."
            defaultOpen={false}
          />
        </div>
      </div>

      {/* The Socratic question set (socratic.ts) is authored but not rendered:
          guided-discussion delivery is on hold pending the NU walkthrough
          tool decision. */}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

const NS_ASSUMPTIONS = [
  { id: 'steady', label: 'Steady', why: 'nothing changes in time' },
  { id: 'developed', label: 'Fully developed', why: '∂v_z/∂z = 0 past the entrance' },
  { id: 'noradial', label: 'No radial flow', why: 'v_r = 0: fluid moves only axially' },
  { id: 'axisym', label: 'No swirl, axisymmetric', why: 'v_θ = 0 and ∂/∂θ = 0' },
  { id: 'horizontal', label: 'Horizontal', why: 'gravity has no axial component' },
] as const;

type AssumptionId = (typeof NS_ASSUMPTIONS)[number]['id'];

/**
 * The Navier–Stokes term killer. The z-momentum equation in cylindrical
 * coordinates, with each assumption crossing out the terms it is
 * responsible for. Nine terms in; two walk out; the survivors are the
 * Poiseuille ODE. This is what "solving Navier–Stokes" means at this
 * level: not solving it — disarming it.
 */
function NSAnatomy() {
  const [on, setOn] = useState<Record<AssumptionId, boolean>>({
    steady: false, developed: false, noradial: false, axisym: false, horizontal: false,
  });
  const toggle = (id: AssumptionId) => setOn((o) => ({ ...o, [id]: !o[id] }));
  const allOn = NS_ASSUMPTIONS.every((a) => on[a.id]);

  const c = (killed: boolean, s: string) => (killed ? String.raw`\cancel{${s}}` : s);
  const latex = String.raw`\rho\!\left(${c(on.steady, String.raw`\frac{\partial v_z}{\partial t}`)} + ${c(on.noradial, String.raw`v_r\frac{\partial v_z}{\partial r}`)} + ${c(on.axisym, String.raw`\frac{v_\theta}{r}\frac{\partial v_z}{\partial \theta}`)} + ${c(on.developed, String.raw`v_z\frac{\partial v_z}{\partial z}`)}\right) = -\frac{\partial P}{\partial z} + \mu\!\left[\frac{1}{r}\frac{\partial}{\partial r}\!\left(r\frac{\partial v_z}{\partial r}\right) + ${c(on.axisym, String.raw`\frac{1}{r^2}\frac{\partial^2 v_z}{\partial \theta^2}`)} + ${c(on.developed, String.raw`\frac{\partial^2 v_z}{\partial z^2}`)}\right] + ${c(on.horizontal, String.raw`\rho g_z`)}`;

  const killedCount = Object.values(on).filter(Boolean).length;

  return (
    <Panel
      title="Navier–Stokes, disarmed term by term"
      subtitle="Nine terms walk in. Check the assumptions of pipe flow and watch which two are left standing."
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {NS_ASSUMPTIONS.map((a) => (
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
              checked={on[a.id]}
              onChange={() => toggle(a.id)}
              className="h-3.5 w-3.5 accent-emerald-600"
            />
            {a.label}
            <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">
              — {a.why}
            </span>
          </label>
        ))}
        <span className="ml-auto self-center font-mono text-xs text-slate-400 dark:text-slate-500">
          {9 - (on.steady ? 1 : 0) - (on.noradial ? 1 : 0) - (on.developed ? 2 : 0) - (on.axisym ? 2 : 0) - (on.horizontal ? 1 : 0)} of 9 terms standing
        </span>
      </div>

      <div className="overflow-x-auto py-1 text-slate-900 dark:text-slate-100">
        <BlockMath math={latex} />
      </div>

      {allOn ? (
        <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
            The survivors, and their surrender
          </p>
          <div className="overflow-x-auto">
            <BlockMath
              math={String.raw`0 = -\frac{dP}{dz} + \frac{\mu}{r}\frac{d}{dr}\!\left(r\frac{dv_z}{dr}\right)\;\;\xrightarrow[\;v_z(R)=0,\ v_z(0)\ \text{finite}\;]{\;dP/dz = -\Delta P/L\;}\;\;\boxed{v_z = \frac{\Delta P}{4\mu L}\left(R^2 - r^2\right)}`}
            />
          </div>
          <p className="mt-1 text-xs leading-relaxed">
            Pressure pushing, viscosity resisting, nothing else left. Two boundary
            conditions — no slip at the wall, and "finite at the axis" (which quietly
            executes a ln(r) term) — and out falls the parabola. Integrate it over the
            cross-section and Q = πΔPR⁴/8μL appears. That is the whole game with
            Navier–Stokes at this level: it is rarely solved, it is <em>disarmed</em>.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {killedCount === 0
            ? 'This is the full z-momentum equation in cylindrical coordinates — every fluid flow in this geometry, all at once. Nobody solves this directly. Start checking assumptions.'
            : 'Keep going — every checked assumption is a physical claim about pipe flow, and each one takes its terms with it.'}
        </p>
      )}
    </Panel>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Module 3 · Pressure-driven flow
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Poiseuille · the three-flow family · Navier–Stokes disarmed
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Poiseuille Flow
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        First, the full Navier–Stokes equation gets disarmed one assumption at a time,
        until only the pipe-flow ODE is left standing. Then meet what falls out of it:
        the parabolic truce between the pressure pushing a viscous fluid and the walls
        holding it back — and the most consequential scaling law in biomedical fluids,
        flow as the FOURTH power of radius.
      </p>
    </header>
  );
}

function MuScale({ mu }: { mu: number }) {
  const lo = Math.log10(1e-5);
  const hi = Math.log10(100);
  const pos = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;

  return (
    <div className="-mt-2 space-y-1">
      <div className="relative h-6">
        {MU_LANDMARKS.map((m) => (
          <span
            key={m.label}
            className="absolute top-0 h-2 w-px bg-slate-300 dark:bg-slate-600"
            style={{ left: `${pos(m.mu)}%` }}
            title={`${m.label}: ${sci(m.mu)} Pa·s`}
          />
        ))}
        <span
          className="absolute top-0 h-2 w-0.5 bg-emerald-500"
          style={{ left: `${Math.min(100, Math.max(0, pos(mu)))}%` }}
        />
        <span className="absolute top-2.5 text-[10px] text-slate-400 dark:text-slate-500">
          gases
        </span>
        <span className="absolute right-0 top-2.5 text-[10px] text-slate-400 dark:text-slate-500">
          syrups
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        Ticks mark typical real-world values — air to honey spans nearly six decades.
      </p>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        'rounded-lg border p-1.5 transition-colors ' +
        (active
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
