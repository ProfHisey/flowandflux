import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  dragForce,
  netWeight,
  particleReynolds,
  settlingTime,
  terminalVelocity,
  timeConstant,
  type StokesParams,
} from '../../lib/stokes';
import { lengthM, sci, timeS } from '../../lib/format';
import { StokesCanvas } from './StokesCanvas';
import { Stokes3DCanvas } from './Stokes3DCanvas';
import { StokesChart } from './StokesChart';
import { DEFAULT_PARAMS, PRESETS } from './presets';

export function StokesModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<StokesParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof StokesParams>(key: K, value: StokesParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(
    () => ({
      vinf: terminalVelocity(params),
      tau: timeConstant(params),
      Re: particleReynolds(params),
      Fd: dragForce(params.mu, params.a, Math.abs(terminalVelocity(params))),
      Fnet: netWeight(params),
      tSettle: settlingTime(params),
    }),
    [params],
  );
  const outOfRegime = derived.Re > 1;

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The settling column"
            subtitle="Weight down, buoyancy and drag up — and the arrows balance, because τ expired microseconds ago."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'The free-body diagram with true-scale arrows — drag to pan, scroll to zoom' },
                      { value: '3d', label: '3D', title: 'The suspension as a volume — drag to orbit' },
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
              </div>
            }
          >
            <div>
              {dim === '2d' ? (
                <StokesCanvas params={params} running={running} dark={dark} />
              ) : (
                <Stokes3DCanvas params={params} running={running} dark={dark} />
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              The force arrows are drawn to their true relative magnitudes: drag grows
              with speed until the books balance, and the speed where that happens is
              v∞ = 2Δρ·g·a²/9μ. The a² is the story — halve the size, quarter the speed
              — and g is the only linear knob left, which is the entire business model
              of the centrifuge.
            </p>
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="v_\infty" />}
                value={sci(derived.vinf)}
                unit="m/s"
                tone="accent"
                hint={humanSpeed(derived.vinf)}
              />
              <Stat
                label={<InlineMath math="\tau" />}
                value={timeS(derived.tau)}
                unit=""
                hint="2ρₚa²/9μ — terminal velocity is instant"
              />
              <Stat
                label={<InlineMath math="\mathrm{Re}_p" />}
                value={sci(derived.Re)}
                unit=""
                hint={outOfRegime ? 'above 1 — see the warning' : 'below 1: Stokes law is honest here'}
              />
              <Stat
                label={<InlineMath math="F_D = 6\pi\mu a v_\infty" />}
                value={sci(derived.Fd)}
                unit="N"
                hint="equals weight − buoyancy, exactly"
              />
              <Stat
                label="Weight − buoyancy"
                value={sci(derived.Fnet)}
                unit="N"
                hint="what the drag must cancel"
              />
              <Stat
                label={`Time to settle ${lengthM(params.Lint)}`}
                value={timeS(derived.tSettle)}
                unit=""
                tone="warm"
                hint="L / v∞ — the number experiments plan around"
              />
            </div>

            {outOfRegime && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">Reₚ = {sci(derived.Re)} &gt; 1: </span>
                this particle has left the creeping-flow regime, and Stokes drag
                underestimates the real drag badly — every number on this page is now
                an overestimate of the speed. The formula did not break; its
                assumptions did. (For the raindrop preset: a real 2 mm drop falls ~6 m/s, not the 121 m/s Stokes predicts here.)
              </p>
            )}

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="Histories and scalings">
            <StokesChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Slider
                label="Particle radius, a"
                value={params.a}
                min={1e-8}
                max={2e-3}
                log
                format={lengthM}
                onChange={(v) => set('a', v)}
                hint="The a² knob. Two decades of size are four decades of speed."
              />
              <Slider
                label="Particle density, ρₚ"
                unit="kg/m³"
                value={params.rhoP}
                min={500}
                max={20000}
                log
                format={sci}
                onChange={(v) => set('rhoP', v)}
              />
              <Slider
                label="Fluid density, ρf"
                unit="kg/m³"
                value={params.rhoF}
                min={1}
                max={2000}
                log
                format={sci}
                onChange={(v) => set('rhoF', v)}
                hint={params.rhoF > params.rhoP ? 'ρf > ρₚ: it floats — v∞ went negative.' : undefined}
              />
              <Slider
                label="Fluid viscosity, μ"
                unit="Pa·s"
                value={params.mu}
                min={1e-5}
                max={10}
                log
                format={sci}
                onChange={(v) => set('mu', v)}
              />
              <Slider
                label="Centrifuge, × g"
                value={params.gFactor}
                min={1}
                max={1e6}
                log
                format={(v) => (v < 2 ? '1 (gravity)' : `${sci(v)} × g`)}
                onChange={(v) => set('gFactor', v)}
                hint="v∞ scales linearly with g — the one honest shortcut."
              />
              <Slider
                label="Distance to settle, L"
                value={params.Lint}
                min={1e-3}
                max={1}
                log
                format={lengthM}
                onChange={(v) => set('Lint', v)}
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
                        ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
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
            title="Stokes drag"
            latex={String.raw`F_D = 6\pi\,\mu\,a\,v \qquad \left(\mathrm{Re}_p = \frac{\rho_f v\,2a}{\mu} < 1,\ \ C_D = \frac{24}{\mathrm{Re}}\right)`}
            terms={[
              { symbol: 'F_D', meaning: 'drag on a sphere creeping through a viscous fluid, N', maps: 'the green arrow' },
              { symbol: 'a', meaning: 'particle radius — linear here, but squared in v∞', maps: 'a slider' },
            ]}
            note="Exact — not a correlation — but only in creeping flow (Re < 1), where the fluid oozes around the sphere with no wake. Past Re ~ 1 the wake separates, pressure drag takes over, and C_D leaves the 24/Re line. The raindrop preset demonstrates the crime scene."
          />

          <EquationCard
            title="The settling balance"
            latex={String.raw`m\frac{dv}{dt} = \underbrace{(\rho_p - \rho_f)\tfrac{4}{3}\pi a^3 g}_{\text{weight} - \text{buoyancy}} - \,6\pi\mu a v \;\;\Rightarrow\;\; v = v_\infty\!\left(1 - e^{-t/\tau}\right),\ \ \tau = \frac{2\rho_p a^2}{9\mu}`}
            note="The same capacity-over-conductance exponential as the cooling module — but here τ is measured in microseconds, so for every practical purpose F = 0 and the motion is pure force-bookkeeping. Microscale objects have no memory of their momentum."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Terminal velocity, and the two knobs"
            latex={String.raw`v_\infty = \frac{2\,(\rho_p - \rho_f)\,g\,a^2}{9\,\mu}`}
            note="a² is the tyranny: a cell does a centimetre per day, a particle a hundred times smaller would take a quarter-century. g is the liberation: it enters linearly and a centrifuge can supply a million of them. Every separation protocol — pellets, gradients, spins — is a negotiation between those two terms."
            defaultOpen={false}
          />

          <EquationCard
            title="The same friction, twice"
            latex={String.raw`F_D = \underline{6\pi\mu a}\,v \qquad\qquad D = \frac{k_B T}{\underline{6\pi\mu a}}`}
            note="The drag coefficient in Stokes law is the same 6πμa in the denominator of Stokes–Einstein, back in the diffusion module. Drag is friction resisting imposed motion; diffusion is thermal kicks working against that identical friction. Whether a particle settles or diffuses is their contest — and for anything much below a micron, thermal motion wins, which is why nanoparticles don't sediment and centrifuge tubes need six figures of g."
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

function humanSpeed(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return 'neutrally buoyant';
  const perDay = a * 86400;
  if (perDay < 1) return `${sci(perDay * 1000)} mm per day`;
  if (a < 1e-4) return `${sci(a * 1000 * 3600)} mm per hour`;
  if (a < 0.02) return `${sci(a * 1000)} mm/s`;
  return `${sci(a * 100)} cm/s`;
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Module 3 · Drag &amp; settling
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Stokes law · terminal velocity · why centrifuges exist
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Stokes Drag
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Drop a small sphere into a viscous fluid and three forces hold a meeting that
        lasts microseconds: weight down, buoyancy and drag up, settled at the terminal
        velocity v∞ = 2Δρ·g·a²/9μ. The a² makes small things effectively unsinkable —
        and the linear g is the loophole every centrifuge in every lab exploits.
      </p>
    </header>
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
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
