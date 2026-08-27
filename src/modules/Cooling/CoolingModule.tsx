import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  biot,
  halfLife,
  heatRate,
  tau,
  temperature,
  totalEnergy,
  type CoolingParams,
} from '../../lib/cooling';
import { sci, timeS } from '../../lib/format';
import { Segmented } from '../../components/ui/Segmented';
import { CoolingCanvas } from './CoolingCanvas';
import { FinCanvas } from './FinCanvas';
import { Fin3DCanvas } from './Fin3DCanvas';
import { CoolingChart } from './CoolingChart';
import { DEFAULT_PARAMS, H_LANDMARKS, PRESETS } from './presets';

export function CoolingModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<CoolingParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [view, setView] = useState<'flow' | 'fin'>('flow');
  const [finShape, setFinShape] = useState<'pin' | 'rect'>('pin');
  // The 2D/3D pair lives INSIDE the fin view; the Flow view is 2D-only
  // (its 3D counterpart is the fin itself, a different subject).
  const [finDim, setFinDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof CoolingParams>(key: K, value: CoolingParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(
    () => ({
      tau: tau(params),
      T: temperature(params),
      Q: heatRate(params),
      Bi: biot(params),
      tHalf: halfLife(params),
      E: totalEnergy(params),
    }),
    [params],
  );
  const lumpedOk = derived.Bi < 0.1;

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="An object in a stream"
            subtitle="The flow keeps replacing the fluid at the surface. That replacement is what h measures."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-32">
                  <Segmented<'flow' | 'fin'>
                    ariaLabel="Scene"
                    value={view}
                    options={[
                      { value: 'flow', label: 'Flow', title: 'A lumped object in a stream' },
                      { value: 'fin', label: 'Fin', title: 'A fin shaded by its own solution — 2D profile view or 3D' },
                    ]}
                    onChange={setView}
                  />
                </div>
                {view === 'fin' && (
                  <>
                    <div className="w-28">
                      <Segmented<'pin' | 'rect'>
                        ariaLabel="Fin cross-section"
                        value={finShape}
                        options={[
                          { value: 'pin', label: 'Pin', title: 'A cylindrical rod: P = 2πR, A = πR²' },
                          { value: 'rect', label: 'Plate', title: 'A rectangular blade: P = 2(w+t), A = wt — the heat-sink shape' },
                        ]}
                        onChange={setFinShape}
                      />
                    </div>
                    <div className="w-28">
                      <Segmented<'2d' | '3d'>
                        ariaLabel="View dimension"
                        value={finDim}
                        options={[
                          { value: '2d', label: '2D', title: 'Side-on with the T(x) profile — drag to pan, scroll to zoom' },
                          { value: '3d', label: '3D', title: 'The fin in the stream — drag to orbit' },
                        ]}
                        onChange={setFinDim}
                      />
                    </div>
                  </>
                )}
                <IconButton label="Reheat and restart" onClick={() => setResetTick((t) => t + 1)}>
                  <Zap size={15} />
                </IconButton>
                <IconButton
                  label={running ? 'Pause' : 'Play'}
                  onClick={() => setRunning((r) => !r)}
                >
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
              </div>
            }
          >
            {view === 'flow' ? (
              <>
                <CoolingCanvas
                  h={params.h}
                  lc={params.V / params.A}
                  heating={params.Tinf > params.T0}
                  resetTick={resetTick}
                  running={running}
                  dark={dark}
                />
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  Tracers bend around the object on real streamlines, creep through the
                  film at its surface, and carry its warmth off as a wake — which starves
                  as the object spends its temperature gap. That is the exponential,
                  watched. The object is drawn in one uniform color on purpose: a single
                  temperature everywhere is the lumped assumption, and the Biot readout
                  below says when it is earned.
                </p>
              </>
            ) : (
              <>
                <div>
                  {finDim === '2d' ? (
                    <FinCanvas
                      params={{
                        h: params.h, k: params.k, R: 0.004, L: 0.08,
                        T0: params.T0, Tinf: params.Tinf,
                        shape: finShape, w: 0.04, t: 0.002,
                      }}
                      dark={dark}
                    />
                  ) : (
                    <Fin3DCanvas
                      params={{
                        h: params.h, k: params.k, R: 0.004, L: 0.08,
                        T0: params.T0, Tinf: params.Tinf,
                        shape: finShape, w: 0.04, t: 0.002,
                      }}
                      running={running}
                      dark={dark}
                    />
                  )}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {finShape === 'pin' ? (
                    <>
                      A pin fin (4 mm radius, 8 cm long — fixed for this view) grown from a
                      base at T₀, shaded by its own solution θ = cosh(m(L−x))/cosh(mL) with
                      m = √(hP/kA) = √(2h/kR) (the insulated-tip solution — a convecting
                      tip is absorbed by adding R/2 to L). Every color is physical and answers to the
                      sliders: raise h and the color dies faster along the rod — the fluid
                      drains the fin before heat gets far; raise k (copper) and the whole rod
                      holds the base color. When the far end reaches the fluid temperature,
                      extra length adds nothing: the frying-pan-handle regime, and why you
                      can grab one.
                    </>
                  ) : (
                    <>
                      A rectangular plate fin (4 cm wide, 2 mm thick, 8 cm long — fixed for
                      this view): the same solution θ = cosh(m(L−x))/cosh(mL), because the
                      shape enters ONLY through m = √(hP/kA). Thin and wide means P/A ≈ 2/t,
                      so m ≈ √(2h/kt) — the thinner the blade, the faster it fades. Plates
                      pack far more surface per gram of metal than pins, which is why every
                      CPU heat sink you have ever seen is a row of these, faces along the
                      flow.
                    </>
                  )}
                </p>
              </>
            )}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="\tau = \rho V c_p / hA" />}
                value={timeS(derived.tau)}
                unit=""
                tone="accent"
                hint="the time constant — 63% of the job per τ"
              />
              <Stat
                label={<InlineMath math="T(t)" />}
                value={sci(derived.T)}
                unit="°C"
                tone="warm"
                hint={`at t = ${timeS(params.t)}`}
              />
              <Stat
                label={<InlineMath math="Q(t)" />}
                value={sci(derived.Q)}
                unit="W"
                hint={derived.Q >= 0 ? 'heat leaving the object now' : 'heat entering (it is warming up)'}
              />
              <Stat
                label={<InlineMath math="\mathrm{Bi} = hL_c/k" />}
                value={sci(derived.Bi)}
                unit=""
                hint={
                  lumpedOk
                    ? 'below 0.1 — the inside keeps up; lumped model earned'
                    : 'above 0.1 — the inside lags; this curve is only a sketch'
                }
              />
              <Stat
                label={<InlineMath math="t_{1/2}" />}
                value={timeS(derived.tHalf)}
                unit=""
                hint="τ·ln 2 — half the remaining gap, every time"
              />
              <Stat
                label="Energy to shed"
                value={sci(derived.E)}
                unit="J"
                hint="ρVc·(T₀ − T∞) — the area under Q(t)"
              />
            </div>

            {!lumpedOk && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">Biot warning: </span>
                Bi = {sci(derived.Bi)} exceeds 0.1, so the object's interior cannot keep
                up with its surface — the real center lags the curve shown here. The
                spatial story (Heisler charts, semi-infinite solids) belongs to the
                unsteady conduction module.
              </p>
            )}

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="History">
            <CoolingChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Slider
                label="Convection coefficient, h"
                unit="W/m²·K"
                value={params.h}
                min={1}
                max={20000}
                log
                format={sci}
                onChange={(v) => set('h', v)}
              />
              <HScale h={params.h} />

              <Slider
                label="Ambient temperature, T∞"
                unit="°C"
                value={params.Tinf}
                min={0}
                max={100}
                step={0.5}
                onChange={(v) => set('Tinf', v)}
              />
              <Slider
                label="Initial temperature, T₀"
                unit="°C"
                value={params.T0}
                min={0}
                max={150}
                step={0.5}
                onChange={(v) => set('T0', v)}
                hint={params.T0 < params.Tinf ? 'T₀ < T∞: the object warms up — same law, sign flipped.' : undefined}
              />
              <Slider
                label="Time, t"
                value={params.t}
                min={0.1}
                max={1e5}
                log
                format={timeS}
                onChange={(v) => set('t', v)}
              />
              <Slider
                label="Volume, V"
                unit="m³"
                value={params.V}
                min={1e-8}
                max={1e-2}
                log
                format={sci}
                onChange={(v) => set('V', v)}
              />
              <Slider
                label="Surface area, A"
                unit="m²"
                value={params.A}
                min={1e-5}
                max={1}
                log
                format={sci}
                onChange={(v) => set('A', v)}
                hint="τ scales as V/A: big things coast, small things track their surroundings."
              />
              <Slider
                label="Density, ρ"
                unit="kg/m³"
                value={params.rho}
                min={100}
                max={10000}
                log
                format={sci}
                onChange={(v) => set('rho', v)}
              />
              <Slider
                label="Specific heat, cₚ"
                unit="J/kg·K"
                value={params.cp}
                min={100}
                max={5000}
                log
                format={sci}
                onChange={(v) => set('cp', v)}
              />
              <Slider
                label="Object conductivity, k"
                unit="W/m·K"
                value={params.k}
                min={0.1}
                max={500}
                log
                format={sci}
                onChange={(v) => set('k', v)}
                hint="Only the Biot check cares about k — it referees conduction inside vs convection outside."
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
                    aria-pressed={active}
                    type="button"
                    onClick={() => {
                      setParams(pr.params);
                      setPresetId(pr.id);
                    }}
                    className={
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                      (active
                        ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/40'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50')
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {pr.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
            title="Newton's law of cooling"
            latex={String.raw`q'' = h\,(T_s - T_\infty) \qquad Q = h\,A\,(T_s - T_\infty)`}
            terms={[
              { symbol: 'h', meaning: 'convection coefficient, W/m²·K — NOT a material property', maps: 'h slider' },
              { symbol: 'T_s', meaning: "the object's surface temperature", maps: 'T(t) readout' },
              { symbol: 'T_\\infty', meaning: 'the fluid far from the surface', maps: 'T∞ slider' },
            ]}
            note={
              <>
                h bundles fluid, flow, and geometry into one number — which is why it
                spans five decades while k(air) never changes: still air ~5–25, forced
                air ~25–250, water ~50–20,000, boiling up to ~100,000 W/m²·K. Under the
                hood h ≈ k_fluid/δ: conduction across a thin film of thickness δ that
                the flow keeps shaving down. Blowing on soup is film-thinning.
              </>
            }
          />

          <EquationCard
            title="The lumped energy balance"
            latex={String.raw`\rho V c_p \frac{dT}{dt} = -hA\,(T - T_\infty)\;\;\Longrightarrow\;\; \frac{T - T_\infty}{T_0 - T_\infty} = e^{-t/\tau},\quad \tau = \frac{\rho V c_p}{hA}`}
            note="Rate of loss proportional to what remains ⇒ exponential. τ is capacity over conductance — the same structure as an RC circuit, drug elimination, or radioactive decay. One τ does 63% of the job; four τ ends it. And τ scales as V/A: the mouse-vs-elephant term."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="The Biot number — when is one temperature honest?"
            latex={String.raw`\mathrm{Bi} = \frac{h\,L_c}{k}, \qquad L_c = \frac{V}{A}, \qquad \mathrm{Bi} \lesssim 0.1\ \text{lumped OK}`}
            note="A race: convection stripping heat from the surface vs conduction resupplying it from inside. Bi small — the inside keeps up, the object really is one temperature (quenched steel: 0.03). Bi large — the center lags the surface (the roast: 0.8) and you need the spatial solutions. Every lumped answer should arrive with its Bi attached. (Convention alert: this Bi uses L_c = V/A; the Heisler charts use the half-thickness or radius — for a sphere those differ by 3×, so compare Bi values across the two pages with care.)"
            defaultOpen={false}
          />

          <EquationCard
            title="The mass-transfer twin"
            latex={String.raw`j = h_m\,(C_s - C_\infty)`}
            note="Identical law, new cargo: a dissolving mint holds a saturated film (C_s = solubility) that your saliva flow thins and sweeps away. Every convection concept arrives in this matched pair — h with h_m, and later the dimensionless versions Nu = hL/k with Sh = h_m L/D, looked up from the same correlation tables. That table becomes an interactive tool in the convection module."
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

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Module 4 · Convection
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Newton's law of cooling · h and h_m
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Newton's Law of Cooling
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        A warm object in a moving fluid loses heat through a thin film the flow keeps
        replacing — the whole of convection hides inside the coefficient h. With one
        energy balance the temperature history falls out as an exponential with time
        constant τ = ρVc/hA, and the Biot number referees when that simple story is
        allowed.
      </p>
    </header>
  );
}

function HScale({ h }: { h: number }) {
  const lo = Math.log10(1);
  const hi = Math.log10(20000);
  const pos = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;

  return (
    <div className="-mt-2 space-y-1">
      <div className="relative h-6">
        {H_LANDMARKS.map((m) => (
          <span
            key={m.label}
            className="absolute top-0 h-2 w-px bg-slate-300 dark:bg-slate-600"
            style={{ left: `${pos(m.h)}%` }}
            title={`${m.label}: ${sci(m.h)} W/m²·K`}
          />
        ))}
        <span
          className="absolute top-0 h-2 w-0.5 bg-amber-500"
          style={{ left: `${Math.min(100, Math.max(0, pos(h)))}%` }}
        />
        <span className="absolute top-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          still air
        </span>
        <span className="absolute right-0 top-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          boiling
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Ticks mark typical regimes — four decades on this slider, none of them a material property.
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
      aria-pressed={active}
      className={
        'rounded-lg border p-1.5 transition-colors ' +
        (active
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
