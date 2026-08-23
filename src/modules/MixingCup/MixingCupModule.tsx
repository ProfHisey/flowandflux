import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import { areaAvgT, mixingCupT, type MixingCupParams } from '../../lib/mixingcup';
import { MixingCanvas, type CupStats } from './MixingCanvas';
import { Mixing3DCanvas } from './Mixing3DCanvas';
import { MixingChart } from './MixingChart';

/**
 * L21-style mixing cup: what "the" temperature of a flowing stream means.
 * The cup at the outlet does the velocity-weighted integral by simply
 * existing; the module's job is to make the gap between that number and
 * the naive area average impossible to un-see.
 */
export function MixingCupModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<MixingCupParams>({ Tw: 80, Tc: 20, n: 2 });
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [stats, setStats] = useState<CupStats | null>(null);

  const set = <K extends keyof MixingCupParams>(key: K, value: MixingCupParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const derived = useMemo(
    () => ({
      Tmc: mixingCupT(params),
      Tavg: areaAvgT(params),
    }),
    [params],
  );

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The cup does the integral"
            subtitle="Fast lanes deliver more tracers per second — the weighting happens, it isn't programmed."
            right={
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'Side view with the collecting cup and all measurements' },
                      { value: '3d', label: '3D', title: 'The tube in space — rotate end-on for the cross-section' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <IconButton label="Empty the cup & restart" onClick={() => setResetTick((t) => t + 1)}>
                  <RotateCcw size={15} />
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
            {dim === '2d' ? (
              <MixingCanvas
                params={params}
                speed={speed}
                resetTick={resetTick}
                running={running}
                dark={dark}
                onStats={setStats}
              />
            ) : (
              <Mixing3DCanvas
                params={params}
                speed={speed}
                resetTick={resetTick}
                running={running}
                dark={dark}
              />
            )}

            {dim === '2d' && stats && stats.samples > 0 && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
                  <span className="text-slate-600 dark:text-slate-400">
                    cup so far: {stats.cupT.toFixed(1)} °C ({stats.samples} samples)
                  </span>
                  <span className="text-amber-700 dark:text-amber-300">
                    T_mc predicts {derived.Tmc.toFixed(1)} °C
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    plain area average: {derived.Tavg.toFixed(1)} °C
                  </span>
                </div>
                <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                  The cup is converging to the velocity-weighted mean, not the area
                  average — nobody told it to. Fast lanes simply deliver more fluid
                  per second, which is the definition doing its own arithmetic.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="v̄ and R cancel in both averages — only the profile shapes matter.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="T_{mc}" />}
                value={derived.Tmc.toFixed(1)}
                unit="°C"
                tone="accent"
                hint="the mixing cup — what the pipe delivers"
              />
              <Stat
                label={<InlineMath math="\bar T_{area}" />}
                value={derived.Tavg.toFixed(1)}
                unit="°C"
                hint="the section's area-weighted mean — a different number"
              />
              <Stat
                label={<InlineMath math="\bar T_{area} - T_{mc}" />}
                value={(derived.Tavg - derived.Tmc).toFixed(1)}
                unit="°C"
                tone="warm"
                hint="the slow rim's over-representation"
              />
            </div>
          </Panel>

          <Panel title="Profiles & the gap">
            <MixingChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup" subtitle="Changing a temperature or the shape empties the cup.">
            <div className="space-y-5">
              <Slider
                label="Wall temperature, T𝓌"
                unit="°C"
                value={params.Tw}
                min={0}
                max={100}
                step={1}
                onChange={(v) => set('Tw', v)}
              />
              <Slider
                label="Centreline temperature, T𝒸"
                unit="°C"
                value={params.Tc}
                min={0}
                max={100}
                step={1}
                onChange={(v) => set('Tc', v)}
                hint="Try both signs: hot wall / cool core, then cool wall / hot core. Watch which way the cup misses the area average."
              />
              <Slider
                label="Temperature-profile fullness, n"
                value={params.n}
                min={0.5}
                max={8}
                step={0.1}
                format={(v) => v.toFixed(1)}
                onChange={(v) => set('n', v)}
                hint="T(r) = T𝓌 + (T𝒸 − T𝓌)(1 − (r/R)ⁿ). n = 2 is parabolic; large n is a flat core with a thin wall layer — the turbulent look."
              />
              <Slider
                label="Tracer pace (visual)"
                value={speed}
                min={0.3}
                max={2.5}
                step={0.05}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={setSpeed}
                hint="Cancels out of every physical number — the cup cares about shape, not speed."
              />
            </div>
          </Panel>

          <Panel title="Things to try">
            <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <li>Watch a wall tracer for ten seconds. How many times has the cup sampled the core meanwhile?</li>
              <li>80 °C wall, 20 °C core, n = 2 — predict both averages before looking. (They are round numbers.)</li>
              <li>Swap the temperatures. Which side of the area average does the cup land on now?</li>
              <li>Slide n from 2 to 8 and watch the gap readout. Both averages drift toward T𝒸 — but the gap between them barely closes (it even peaks near n ≈ 2.8). Why does flattening the temperature alone not kill it — and what ELSE has to flatten before it dies?</li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="The mixing-cup (bulk) temperature"
            latex={String.raw`T_{mc} = \frac{\int \rho c_p\, v\, T\; dA}{\int \rho c_p\, v\; dA}`}
            terms={[
              { symbol: 'v\\,dA', meaning: 'fluid delivered per second by each ring of the cross-section', maps: 'tracer arrivals' },
              { symbol: 'T', meaning: 'what that ring’s fluid carries', maps: 'tracer colour' },
              { symbol: 'T_{mc}', meaning: 'the temperature of the collected outflow', maps: 'the cup' },
            ]}
            note="Energy flow divided by heat-capacity flow: the temperature the stream would have if you caught it in a cup and stirred. Slow fluid is real fluid, but it arrives slowly, so it barely moves the answer — the cup leans toward whatever the fast core is doing."
          />
          <EquationCard
            title="Two averages, one honest"
            latex={String.raw`\text{parabolic } T,\; T_w = 80,\; T_c = 20: \qquad \bar T_{area} = 50\ ^\circ\mathrm{C}, \qquad T_{mc} = 40\ ^\circ\mathrm{C}`}
            note="Ten degrees apart on the same cross-section, both computed correctly — they answer different questions. An area-weighted survey of the section (each annulus counted by its 2πr dr of area) gives the 50; an energy balance needs the cup's 40. Mistaking one for the other is a 25% error in the driving ΔT here, and nothing about the pipe changed."
            defaultOpen={false}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="Why h is defined against the cup"
            latex={String.raw`q'' = h\,(T_w - T_{mc}), \qquad \dot m\, c_p\, \frac{dT_{mc}}{dx} = q''\, P`}
            note="Internal-flow convection coefficients — every Nu correlation for tubes on the correlations page — are defined against the mixing-cup temperature, because T_mc is the number the axial energy balance conserves. Use the area average in q″ = hΔT and the tabulated h no longer means anything."
            defaultOpen={false}
          />
          <EquationCard
            title="When the distinction dies"
            latex={String.raw`n \to \infty:\ \ \bar T_{area} \to T_c, \quad T_{mc} \to T_c`}
            note="Flatten the profile and every average of it is the same number — which is roughly what turbulence does to both velocity and temperature. Note the sliders here flatten only T while v stays parabolic, so the gap dies slowly (~2ΔT/n); the real collapse needs the velocity plug too — with uniform v, the two averages are identical for ANY temperature profile. The mixing-cup correction is a laminar, round-profile phenomenon: exactly the flows of the Poiseuille page, which is why the two modules are neighbours."
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
          Internal flow — what "the" stream temperature means
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Mixing Cup
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        A pipe carries fluid whose temperature varies across the section — so which
        single number is "the" temperature of the stream? The one a cup at the outlet
        collects. It is a velocity-weighted average, it is the temperature every pipe
        energy balance and every internal-flow h is written against, and it is not
        the number a probe traversed across the pipe would report.
      </p>
    </header>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {children}
    </button>
  );
}
