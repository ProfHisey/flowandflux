import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  areaAt,
  concentration,
  domain,
  flux,
  gradient,
  holdup,
  mMToMolPerCm3,
  molPerCm3TomM,
  resistance,
  transferRate,
  volume,
  type FickParams,
  type Geometry,
} from '../../lib/fick';
import { lengthCm, sci } from '../../lib/format';
import { FickCanvas, type CrossingStats } from './FickCanvas';
import { Fick3DCanvas } from './Fick3DCanvas';
import { FickChart } from './FickChart';
import { DEFAULT_PARAMS, D_LANDMARKS, PRESETS } from './presets';

export function FicksLawModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<FickParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [view, setView] = useState<'2d' | '3d'>('2d');
  const [stats, setStats] = useState<CrossingStats | null>(null);

  const set = <K extends keyof FickParams>(key: K, value: FickParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(() => {
    const [s0, s1] = domain(params);
    return {
      J: transferRate(params),
      R: resistance(params),
      jIn: flux(params, s0),
      jOut: flux(params, s1),
      gradIn: gradient(params, s0),
      M: holdup(params),
      V: volume(params),
      areaIn: areaAt(params, s0),
      areaOut: areaAt(params, s1),
      midC: molPerCm3TomM(concentration(params, (s0 + s1) / 2)),
      s0,
      s1,
    };
  }, [params]);

  const isSlab = params.geometry === 'slab';

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------------------------------------------- canvas */}
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="Steady-state concentration field"
            subtitle="Particles take unbiased random steps. The net drift you see is emergent."
            right={
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    value={view}
                    options={[
                      { value: '2d', label: '2D' },
                      { value: '3d', label: '3D', title: 'Rotatable 3D view — drag to orbit' },
                    ]}
                    onChange={setView}
                  />
                </div>
                <IconButton
                  label={running ? 'Pause' : 'Play'}
                  onClick={() => setRunning((r) => !r)}
                >
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
                <IconButton
                  label={showParticles ? 'Hide particles' : 'Show particles'}
                  active={showParticles}
                  onClick={() => setShowParticles((s) => !s)}
                >
                  <Sparkles size={15} />
                </IconButton>
              </div>
            }
          >
            {view === '2d' ? (
              <FickCanvas
                params={params}
                showParticles={showParticles}
                running={running}
                dark={dark}
                onStats={setStats}
              />
            ) : (
              <>
                <Fick3DCanvas
                  params={params}
                  showParticles={showParticles}
                  running={running}
                  dark={dark}
                />
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  The same unbiased random walk, in three dimensions — drag to rotate,
                  double-click to reset. The rotation is only a camera move; the walk
                  itself never changes. The crossing counter and all measurements live
                  on the 2D tab.
                </p>
              </>
            )}

            {view === '2d' && isSlab && showParticles && stats && (
              <TrafficReadout stats={stats} />
            )}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          {/* ------------------------------------------------- readouts */}
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="J" />}
                value={sci(derived.J)}
                unit="mol/s"
                tone="accent"
                hint="total transfer rate — constant through the wall"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="j" /> at {isSlab ? 'x = 0' : 'r₁'}
                  </>
                }
                value={sci(derived.jIn)}
                unit="mol/cm²·s"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="j" /> at {isSlab ? 'x = L' : 'r₂'}
                  </>
                }
                value={sci(derived.jOut)}
                unit="mol/cm²·s"
                hint={isSlab ? 'same as inlet — area is constant' : 'smaller — area has grown'}
              />
              <Stat
                label={<InlineMath math="R_D" />}
                value={sci(derived.R)}
                unit="s/cm³"
                hint="ΔC / J"
              />
              <Stat
                label="Holdup"
                value={sci(derived.M)}
                unit="mol"
                hint="species inside the wall"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="dC/dx" /> at {isSlab ? 'x = 0' : 'r₁'}
                  </>
                }
                value={sci(derived.gradIn)}
                unit="mol/cm⁴"
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
            <FickChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<Geometry>
                label="Geometry"
                value={params.geometry}
                options={[
                  { value: 'slab', label: 'Slab', title: 'Cartesian, constant area' },
                  { value: 'cylinder', label: 'Cylinder', title: 'Area grows as 2πrL' },
                  { value: 'sphere', label: 'Sphere', title: 'Area grows as 4πr²' },
                ]}
                onChange={(g) => set('geometry', g)}
              />

              <Slider
                label="Diffusion coefficient, D"
                unit="cm²/s"
                value={params.D}
                min={1e-10}
                max={1e-1}
                log
                format={sci}
                onChange={(v) => set('D', v)}
              />
              <DScale D={params.D} />

              <Slider
                label="C₁ — boundary 1"
                unit="mM"
                value={molPerCm3TomM(params.C1)}
                min={0}
                max={20}
                step={0.05}
                onChange={(v) => set('C1', mMToMolPerCm3(v))}
              />
              <Slider
                label="C₂ — boundary 2"
                unit="mM"
                value={molPerCm3TomM(params.C2)}
                min={0}
                max={20}
                step={0.05}
                onChange={(v) => set('C2', mMToMolPerCm3(v))}
                hint={
                  params.C1 === params.C2
                    ? 'Equal concentrations: the walking continues, the net flux is zero.'
                    : undefined
                }
              />

              {isSlab ? (
                <>
                  <Slider
                    label="Thickness, L"
                    value={params.L}
                    min={1e-4}
                    max={1}
                    log
                    format={lengthCm}
                    onChange={(v) => set('L', v)}
                  />
                  <Slider
                    label="Face area, A"
                    unit="cm²"
                    value={params.A}
                    min={0.01}
                    max={100}
                    log
                    format={sci}
                    onChange={(v) => set('A', v)}
                  />
                </>
              ) : (
                <>
                  <Slider
                    label="Inner radius, r₁"
                    value={params.r1}
                    min={1e-4}
                    max={Math.max(1e-4, params.r2 * 0.95)}
                    log
                    format={lengthCm}
                    onChange={(v) => set('r1', Math.min(v, params.r2 * 0.95))}
                  />
                  <Slider
                    label="Outer radius, r₂"
                    value={params.r2}
                    min={Math.min(2, params.r1 * 1.05)}
                    max={10}
                    log
                    format={lengthCm}
                    onChange={(v) => set('r2', Math.max(v, params.r1 * 1.05))}
                  />
                  {params.geometry === 'cylinder' && (
                    <Slider
                      label="Axial length, L"
                      value={params.L}
                      min={0.01}
                      max={100}
                      log
                      format={lengthCm}
                      onChange={(v) => set('L', v)}
                    />
                  )}
                </>
              )}
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
            title="Fick's first law"
            latex={String.raw`\vec{j} = -D\,\nabla C \qquad\Longrightarrow\qquad J = -D\,\vec{A}\cdot\nabla C`}
            terms={[
              { symbol: 'j', meaning: 'flux — mass of species per unit area per time', maps: 'flux chart' },
              { symbol: 'J', meaning: 'total transfer rate through the whole area', maps: 'J readout' },
              { symbol: 'D', meaning: 'diffusion coefficient, cm²/s', maps: 'D slider' },
              { symbol: 'C', meaning: 'concentration, mass or moles per volume', maps: 'C₁, C₂ sliders' },
            ]}
            note={
              <>
                A <em>phenomenological</em> law — Fick, 1855. It describes what happens, not why.
                The why comes from the random walk: D = v̄λ/3, and for a sphere in a liquid,
                Stokes–Einstein gives D = k<sub>B</sub>T/6πμa.
              </>
            }
          />

          <EquationCard
            title="The three geometries"
            latex={String.raw`
\begin{aligned}
\text{Cartesian:}&\quad J = -D\,A_x\,\frac{\partial C}{\partial x} \\[4pt]
\text{Cylindrical:}&\quad J = -D\,(2\pi r L)\,\frac{\partial C}{\partial r} \\[4pt]
\text{Spherical:}&\quad J = -D\,(4\pi r^{2})\,\frac{\partial C}{\partial r}
\end{aligned}`}
            note="Same law each time. Only the area facing the flux changes — and that alone is what bends the concentration profile from a line into a logarithm into a hyperbola."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Species conservation at steady state"
            latex={String.raw`\underbrace{\text{Input}}_{} + \underbrace{\text{Generation}}_{=\,0} = \underbrace{\text{Output}}_{} + \underbrace{\text{Accumulation}}_{=\,0}`}
            note="With no reaction and nothing accumulating, whatever crosses one station must cross every other. That single statement is why J is constant across the wall — and it is the step the course wants drawn on the figure, not assumed."
            defaultOpen={false}
          />

          <EquationCard
            title="Diffusive resistance"
            latex={String.raw`
R_D \equiv \frac{\Delta C}{J} =
\begin{cases}
\dfrac{L}{A D} & \text{slab} \\[10pt]
\dfrac{\ln(r_2/r_1)}{2\pi L D} & \text{cylinder} \\[10pt]
\dfrac{1/r_1 - 1/r_2}{4\pi D} & \text{sphere}
\end{cases}`}
            note="Ohm's law for mass transfer. Resistances in series add; in parallel their reciprocals add. Valid only at steady state with no generation — add a reaction and the shortcut dissolves."
            defaultOpen={false}
          />
        </div>
      </div>

      {/* The Socratic question set (socratic.ts) is authored but not rendered:
          guided-discussion delivery is on hold pending a decision between the
          walkthrough tool being built at NU and other candidates. */}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

/**
 * The two-way traffic counter.
 *
 * Showing only the net rate hides the reason diffusion works the way it does.
 * Thousands of walkers cross the midplane every second in each direction; the
 * transport we call "flux" is the small imbalance left over. Putting the two
 * one-way figures next to the difference makes that visible, and makes the
 * slowness of diffusion feel inevitable rather than arbitrary.
 */
function TrafficReadout({ stats }: { stats: CrossingStats }) {
  const settled = stats.elapsed > 12;
  const gross = stats.right + stats.left;
  const share = gross > 0 ? (Math.abs(stats.net) / gross) * 100 : 0;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
        <span className="text-slate-600 dark:text-slate-400">
          → {Math.round(stats.right).toLocaleString()}/s
        </span>
        <span className="text-slate-600 dark:text-slate-400">
          ← {Math.round(stats.left).toLocaleString()}/s
        </span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          net {stats.net >= 0 ? '+' : ''}
          {stats.net.toFixed(1)}/s
        </span>
        <span className="text-sky-700 dark:text-sky-300">
          Fick predicts {stats.predicted >= 0 ? '+' : ''}
          {stats.predicted.toFixed(1)}/s
        </span>
        <span className="ml-auto text-[11px] font-normal text-slate-400 dark:text-slate-500">
          {settled ? 'averaged over' : 'settling ·'} {stats.elapsed.toFixed(0)}s
        </span>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        Walkers crossing the dashed midplane, counted in each direction. Transport is the{' '}
        <strong className="font-semibold text-slate-700 dark:text-slate-300">
          {share < 10 ? share.toFixed(1) : share.toFixed(0)}%
        </strong>{' '}
        imbalance between two enormous one-way flows — nothing is being pushed. The blue figure
        is j = −D ∂C/∂x evaluated on the density gradient these same walkers carry, so the two
        numbers are independent measurements of one quantity.
      </p>
    </div>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Module 1 · Diffusion
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Steady-state mass transfer
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Fick's Law of Diffusion
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Steady-state, one-dimensional diffusion through a wall. Set the two boundary
        concentrations, pick a geometry, and watch what the random walkers do — then check
        whether the numbers the walkers produce match the law that is supposed to describe them.
      </p>
    </header>
  );
}

function DScale({ D }: { D: number }) {
  const lo = Math.log10(1e-10);
  const hi = Math.log10(1e-1);
  const pos = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;

  return (
    <div className="-mt-2 space-y-1">
      <div className="relative h-6">
        {D_LANDMARKS.map((m) => (
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
          solids
        </span>
        <span className="absolute right-0 top-2.5 text-[10px] text-slate-400 dark:text-slate-500">
          gases
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        Ticks mark typical real-world values, from solids to gases — ten decades.
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
