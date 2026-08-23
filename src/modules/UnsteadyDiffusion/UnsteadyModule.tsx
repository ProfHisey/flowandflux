import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  diffusionTime,
  peak,
  peakPoint,
  sigma,
  sigmaPoint,
  type UnsteadyParams,
} from '../../lib/unsteady';
import { molPerCm3TomM } from '../../lib/fick';
import { lengthCm, sci, timeS } from '../../lib/format';
import { D_LANDMARKS } from '../FicksLaw/presets';
import { Segmented } from '../../components/ui/Segmented';
import {
  UnsteadyCanvas,
  type BolusCargo,
  type PulseStats,
  type ReleaseMode,
} from './UnsteadyCanvas';
import { Bolus3DCanvas } from './Bolus3DCanvas';
import { UnsteadyChart } from './UnsteadyChart';
import { DEFAULT_PARAMS, PRESETS } from './presets';

export function UnsteadyModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<UnsteadyParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [releaseTick, setReleaseTick] = useState(0);
  const [release, setRelease] = useState<ReleaseMode>('plane');
  const [cargo, setCargo] = useState<BolusCargo>('mass');
  const [stats, setStats] = useState<PulseStats | null>(null);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof UnsteadyParams>(key: K, value: UnsteadyParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(
    () => ({
      sigma:
        release === 'plane' ? sigma(params.D, params.t) : sigmaPoint(params.D, params.t),
      peakmM: molPerCm3TomM(
        release === 'plane' ? peak(params) : peakPoint(params.M, params.D, params.t),
      ),
      tDiff: diffusionTime(params.Lint, params.D),
    }),
    [params, release],
  );

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------------------------------------------- canvas */}
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title={release === 'plane' ? 'The capsule burst' : 'The depot burst'}
            subtitle={
              release === 'plane'
                ? 'All the particles start in the middle. Everything after that is unbiased wandering.'
                : 'All the particles start at one point. The cloud is a sphere from the first instant.'
            }
            right={
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'The burst against its analytic prediction — drag to pan, scroll to zoom' },
                      { value: '3d', label: '3D', title: 'Point burst: σ = √(6Dt) — drag to orbit' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <IconButton
                  label="Burst it again"
                  onClick={() => setReleaseTick((t) => t + 1)}
                >
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
            <div>
              {dim === '2d' ? (
                <UnsteadyCanvas
                  mode={release}
                  cargo={cargo}
                  releaseTick={releaseTick}
                  running={running}
                  dark={dark}
                  onStats={setStats}
                />
              ) : (
                <Bolus3DCanvas
                  releaseTick={releaseTick}
                  running={running}
                  dark={dark}
                />
              )}
            </div>
            {dim === '3d' && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The point-release version: a burst spreads as a SPHERE, and the amber
                wireframe is the prediction σ = √(6Dt) — 2Dt per axis, three axes.
                The 2D tab's planar burst uses √(2Dt); geometry decides the factor.
              </p>
            )}
            {dim === '2d' && stats && <SpreadReadout stats={stats} mode={release} />}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          {/* ------------------------------------------------- readouts */}
          <Panel
            title="Readouts"
            subtitle="Physical numbers for the setup on the right — the canvas above runs on its own visual clock."
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math={release === 'plane' ? '\\sigma(t)' : '\\sigma_r(t)'} />}
                value={lengthCm(derived.sigma)}
                unit=""
                tone="accent"
                hint={
                  release === 'plane'
                    ? '√(2Dt) — how far the cloud has spread'
                    : '√(6Dt) — rms radius: 2Dt per axis, three axes'
                }
              />
              {cargo === 'mass' ? (
                <Stat
                  label={<InlineMath math="C(0,t)" />}
                  value={sci(derived.peakmM)}
                  unit="mM"
                  hint={
                    release === 'plane'
                      ? 'the peak — falls as 1/√t'
                      : 'the peak — falls as t^(−3/2), one √t per axis'
                  }
                />
              ) : (
                <Stat
                  label={<InlineMath math="\theta(0,t)" />}
                  value={release === 'plane' ? '∝ 1/√t' : '∝ t^{-3/2}'}
                  unit=""
                  hint="the hot spot dilutes as it spreads — same law, thermal cargo"
                />
              )}
              {cargo === 'mass' && (
                <Stat
                  label={<InlineMath math="M" />}
                  value={sci(params.M)}
                  unit="mol"
                  hint="the released amount — conserved forever"
                />
              )}
              <Stat
                label={<InlineMath math="t" />}
                value={timeS(params.t)}
                unit=""
                hint="time since release"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="t_{L}" /> for {lengthCm(params.Lint)}
                  </>
                }
                value={timeS(derived.tDiff)}
                unit=""
                tone="warm"
                hint="L²/2D — the diffusion clock"
              />
              <Stat
                label={<InlineMath math={release === 'plane' ? '2\\sigma' : '2\\sigma_r'} />}
                value={lengthCm(2 * derived.sigma)}
                unit=""
                hint={
                  release === 'plane'
                    ? '~95% of the released amount lies within ±2σ'
                    : 'the effective reach of the dose — the treated region'
                }
              />
            </div>

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="Profiles">
            <UnsteadyChart params={params} mode={release} cargo={cargo} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<BolusCargo>
                label="Cargo"
                value={cargo}
                options={[
                  { value: 'mass', label: 'Mass', title: 'A burst of molecules spreading with D' },
                  { value: 'heat', label: 'Heat', title: 'A pulse of thermal energy spreading with α = k/ρc — same Gaussian, different cargo' },
                ]}
                onChange={(c) => {
                  setCargo(c);
                  setPresetId('');
                  if (c === 'heat' && params.D < 1e-4) set('D', 0.12);
                  if (c === 'mass' && params.D > 1e-1) set('D', 1e-6);
                }}
              />
              <Segmented<ReleaseMode>
                label="Release geometry"
                value={release}
                options={[
                  { value: 'plane', label: 'Plane', title: 'A thin sheet released across a plane — spreads along one axis' },
                  { value: 'point', label: 'Point', title: 'Everything released at one point — a depot injection, a hot spot; spreads as a sphere' },
                ]}
                onChange={(m) => {
                  setRelease(m);
                  setPresetId('');
                }}
              />
              <Slider
                label={cargo === 'heat' ? 'Thermal diffusivity, α' : 'Diffusion coefficient, D'}
                unit="cm²/s"
                value={params.D}
                min={cargo === 'heat' ? 1e-4 : 1e-10}
                max={cargo === 'heat' ? 10 : 1e-1}
                log
                format={sci}
                onChange={(v) => set('D', v)}
                hint={
                  cargo === 'heat'
                    ? 'α = k/ρc. Shown in cm²/s so both cargos share one clock; divide by 10⁴ for m²/s.'
                    : undefined
                }
              />
              <DScale D={params.D} cargo={cargo} />

              {cargo === 'mass' && (
                <Slider
                  label="Amount released, M"
                  unit="mol"
                  value={params.M}
                  min={1e-16}
                  max={1e-3}
                  log
                  format={sci}
                  onChange={(v) => set('M', v)}
                />
              )}
              {release === 'plane' && cargo === 'mass' && (
                <Slider
                  label="Release area, A"
                  unit="cm²"
                  value={params.A}
                  min={1e-9}
                  max={100}
                  log
                  format={sci}
                  onChange={(v) => set('A', v)}
                />
              )}
              <Slider
                label="Time since release, t"
                value={params.t}
                min={1e-7}
                max={1e6}
                log
                format={timeS}
                onChange={(v) => set('t', v)}
              />
              <Slider
                label="Distance of interest, L"
                value={params.Lint}
                min={1e-6}
                max={300}
                log
                format={lengthCm}
                onChange={(v) => set('Lint', v)}
                hint="How far do the molecules need to get? The tL readout answers with L²/2D."
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
                      setRelease(pr.release ?? 'plane');
                      setCargo(pr.cargo ?? 'mass');
                      setPresetId(pr.id);
                    }}
                    className={
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                      (active
                        ? 'border-sky-400 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/40'
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
                  setRelease('plane');
                  setCargo('mass');
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
            title="The diffusion equation"
            latex={String.raw`\frac{\partial C}{\partial t} = D\,\frac{\partial^2 C}{\partial x^2}`}
            terms={[
              { symbol: '\\partial C/\\partial t', meaning: 'how fast concentration changes, right here, right now', maps: 'the movie' },
              { symbol: 'D', meaning: 'diffusion coefficient, cm²/s', maps: 'D slider' },
              { symbol: '\\partial^2 C/\\partial x^2', meaning: 'the curvature of the profile — bumps flatten, dips fill', maps: 'C(x,t) chart' },
            ]}
            note={
              <>
                Fick's law plus conservation, welded into one line. Read it as:{' '}
                <em>concentration grows where the profile is curved upward and shrinks
                where it bulges</em> — which is why every bump flattens. Steady state is
                the special case where the left side is zero. That case gets its own
                module; this one is about everything before it.
              </>
            }
          />

          <EquationCard
            title="The spreading Gaussian"
            latex={String.raw`C(x,t) = \frac{M/A}{\sqrt{4\pi D t}}\;e^{-x^{2}/4Dt}`}
            note="The solution for an instantaneous planar release in an open medium. The area under it is M/A at every instant — nothing appears or disappears — so as the width grows as √t, the peak must fall as 1/√t. Shape as bookkeeping."
            defaultOpen={false}
          />

          <EquationCard
            title="The point release — one Gaussian per axis"
            latex={String.raw`C(r,t) = \frac{M}{(4\pi D t)^{3/2}}\;e^{-r^{2}/4Dt}, \qquad \sqrt{\langle r^2\rangle} = \sqrt{6Dt}`}
            note="A depot injection, an ink drop: the same Gaussian, cubed — one factor of √(4πDt) per axis, so the peak falls as t^(−3/2) and dilution is brutally fast. The rms radius stacks 2Dt from each axis: √(6Dt). After an hour, a nanomole of drug with D = 2×10⁻⁶ cm²/s has reached about 2 mm — which is why a depot must sit next to its target, and why tissue beyond a millimetre or two of any source needs blood vessels to feed it."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="The diffusion clock"
            latex={String.raw`\sigma = \sqrt{2Dt} \qquad\Longleftrightarrow\qquad t_L = \frac{L^{2}}{2D}`}
            note="The most useful number in transport. Twice as far takes four times as long: 0.5 µs across a synapse, 50 s across 100 µm of tissue, 28 hours across a centimetre of unstirred tea, 5 days across a still room. Below ~100 µm diffusion is free and instant; beyond ~1 mm it is hopeless — which is why cells are small, tissues are threaded with capillaries, and everything else gets stirred or pumped."
            defaultOpen={true}
          />

          <EquationCard
            title="Einstein, 1905"
            latex={String.raw`\langle x^{2} \rangle = 2Dt`}
            note="The bridge between the dots on screen and the smooth curve: unbiased steps whose mean-square displacement grows linearly in time ARE diffusion, with D set by the step statistics. The σ readout under the canvas is this equation being checked live against 1200 walkers."
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

/**
 * Measured vs predicted spread — Einstein's relation checked live. The
 * measured figure comes straight from the 1200 walker positions (std dev of
 * x for a plane, rms radius for a point); the predicted figure is the
 * random-walk theory on the same visual D and clock.
 */
function SpreadReadout({ stats, mode }: { stats: PulseStats; mode: ReleaseMode }) {
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
        <span className="text-slate-600 dark:text-slate-400">
          measured {mode === 'plane' ? 'σ' : 'rms r'} = {stats.sigmaMeasured.toFixed(1)} px
        </span>
        <span className="text-amber-700 dark:text-amber-300">
          {mode === 'plane' ? '√(2Dt)' : '√(4Dt), two axes'} predicts {stats.sigmaPredicted.toFixed(1)} px
        </span>
        <span className="ml-auto text-[11px] font-normal text-slate-400 dark:text-slate-500">
          t = {stats.t.toFixed(1)} s · visual clock
        </span>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        {stats.touchingWalls ? (
          <>
            <strong className="font-semibold text-slate-700 dark:text-slate-300">
              The cloud is feeling the walls.
            </strong>{' '}
            The amber curve assumes an open medium, so from here on the two part ways —
            the walls reflect, the formula does not know that. Burst it again (⚡) to
            rewind. Knowing when a formula stops applying is half of owning it.
          </>
        ) : (
          <>
            The spread of the walkers, measured directly, against Einstein's{' '}
            ⟨x²⟩ = 2Dt on the same clock — two independent measurements of one number.
            The cloud runs on a visual D (real diffusion at this scale would take
            minutes to watch); the shape of everything it does is physical.
          </>
        )}
      </p>
    </div>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Module 1 · Diffusion — unsteady
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Before the steady state
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Bolus Dispersion
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        A capsule bursts and the molecules wander outward — concentration changing in
        time, which is what diffusion looks like before any boundary conditions pin it
        down. Watch the width grow as √t and the peak fall to match, then take the
        diffusion clock t = L²/2D out into the world: it explains why cells are small,
        why you stir your tea, and why perfume needs a draft.
      </p>
    </header>
  );
}

/** Thermal-diffusivity landmarks, cm²/s (α = k/ρc). */
const A_LANDMARKS: { label: string; D: number }[] = [
  { label: 'Water / tissue', D: 1.4e-3 },
  { label: 'Brick', D: 5e-3 },
  { label: 'Steel', D: 0.12 },
  { label: 'Air', D: 0.22 },
  { label: 'Copper', D: 1.16 },
];

function DScale({ D, cargo }: { D: number; cargo: BolusCargo }) {
  const heat = cargo === 'heat';
  const lo = Math.log10(heat ? 1e-4 : 1e-10);
  const hi = Math.log10(heat ? 10 : 1e-1);
  const marks = heat ? A_LANDMARKS : D_LANDMARKS;
  const pos = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;

  return (
    <div className="-mt-2 space-y-1">
      <div className="relative h-6">
        {marks.map((m) => (
          <span
            key={m.label}
            className="absolute top-0 h-2 w-px bg-slate-300 dark:bg-slate-600"
            style={{ left: `${pos(m.D)}%` }}
            title={`${m.label}: ${sci(m.D)} cm²/s`}
          />
        ))}
        <span
          className="absolute top-0 h-2 w-0.5 bg-sky-500"
          style={{ left: `${Math.min(100, Math.max(0, pos(D)))}%` }}
        />
        <span className="absolute top-2.5 text-[10px] text-slate-400 dark:text-slate-500">
          {heat ? 'water' : 'solids'}
        </span>
        <span className="absolute right-0 top-2.5 text-[10px] text-slate-400 dark:text-slate-500">
          {heat ? 'metals' : 'gases'}
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        {heat
          ? 'Ticks mark real α values — water to copper spans three decades, which is why metal "feels" fast.'
          : 'Ticks mark typical real-world values, from solids to gases — ten decades.'}
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
          ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
