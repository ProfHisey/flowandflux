import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  dragForce,
  kinematicViscosity,
  paSToPoise,
  shearRate,
  shearStress,
  type NewtonParams,
} from '../../lib/newton';
import { lengthM, sci } from '../../lib/format';
import { NewtonCanvas, type NewtonView } from './NewtonCanvas';
import { Newton3DCanvas } from './Newton3DCanvas';
import { NewtonChart } from './NewtonChart';
import { DEFAULT_PARAMS, MU_LANDMARKS, PRESETS } from './presets';

export function NewtonModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<NewtonParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [view, setView] = useState<NewtonView>('links');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof NewtonParams>(key: K, value: NewtonParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(
    () => ({
      tau: shearStress(params),
      F: dragForce(params),
      rate: shearRate(params),
      nu: kinematicViscosity(params),
      muPoise: paSToPoise(params.mu),
      Re: (params.rho * params.U * params.H) / params.mu,
    }),
    [params],
  );

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ---------------------------------------------------- canvas */}
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="Couette flow between plates"
            subtitle="Layers of fluid slide over one another; each layer drags the next."
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
                <div className="w-36">
                  <Segmented<NewtonView>
                    value={view}
                    options={[
                      { value: 'links', label: 'Grip', title: 'Sliding layers with grip links — the force picture' },
                      { value: 'dye', label: 'Dye', title: 'Dye tracers deforming with the flow — the kinematics picture' },
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
                  label={showParticles ? 'Hide molecules' : 'Show molecules'}
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
                <Newton3DCanvas
                  params={params}
                  view={view}
                  showParticles={showParticles}
                  running={running}
                  dark={dark}
                />
                <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {view === 'links' ? (
                    <>
                      Drag to rotate, double-click to reset. The 2D lanes become what
                      they always secretly were: sheets. Note the two boundary sheets —
                      the top one is glued to the marching plate and the bottom one to
                      the still plate. That is the no-slip condition, and it is what
                      drives the whole system: the plate never pushes the fluid, it
                      simply refuses to let go of the layer touching it.
                    </>
                  ) : (
                    <>
                      Drag to rotate, double-click to reset. A vertical curtain of dye
                      tilts into the velocity profile — every height carries its dye at
                      its own speed — and the marked cube shears into a parallelepiped
                      beside its resting ghost, at the rate dγ/dt = du/dy.
                    </>
                  )}
                </p>
              </>
            ) : (
              <NewtonCanvas
                params={params}
                view={view}
                showParticles={showParticles}
                running={running}
                dark={dark}
              />
            )}
            {dim === '2d' && (view === 'links' ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The particles ride their layers without diffusing — a deliberate
                simplification so the sliding itself stays legible. Watch the links
                between layers: each one tilts as the faster layer pulls ahead,
                stretches, lets go, and catches the next partner. That repeated tug is
                the viscous grip — the shear stress τ — transmitted layer by layer down
                to the fixed plate, which is why the bottom plate feels a drag force
                F = τ·A even though nothing ever touches it but the slowest fluid.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The classic flow-visualization view: a vertical stripe of dye is painted
                into the fluid and left alone. Each bit of dye rides its own layer, so
                after a time t it has moved u(y)·t — the straight stripe tilts into the
                velocity profile itself. The marked square shears into a parallelogram
                (drawn alongside its own ghost, translation removed) at the rate
                dγ/dt = du/dy: the same gradient the dye stripes trace out, seen as the
                deformation of a single fluid element.
              </p>
            ))}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          {/* ------------------------------------------------- readouts */}
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="\tau" />}
                value={sci(derived.tau)}
                unit="Pa"
                tone="accent"
                hint="shear stress — same at every height"
              />
              <Stat
                label={<InlineMath math="F" />}
                value={sci(derived.F)}
                unit="N"
                hint="drag on either plate, τ·A"
              />
              <Stat
                label={<InlineMath math="du/dy" />}
                value={sci(derived.rate)}
                unit="s⁻¹"
                hint="shear rate — constant across the gap"
              />
              <Stat
                label={<InlineMath math="\nu = \mu/\rho" />}
                value={sci(derived.nu)}
                unit="m²/s"
                hint="momentum diffusivity — the analog of D and α"
              />
              <Stat
                label={<InlineMath math="\mu" />}
                value={sci(derived.muPoise)}
                unit="poise"
                hint="same viscosity in CGS — 1 Pa·s = 10 P"
              />
              <Stat
                label={<InlineMath math="\mathrm{Re}" />}
                value={sci(derived.Re)}
                unit=""
                hint="ρUH/μ — a preview: laminar in a plane gap below ~1500"
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
            <NewtonChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
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

              <Slider
                label="Top plate speed, U"
                unit="m/s"
                value={params.U}
                min={0}
                max={10}
                step={0.005}
                format={sci}
                onChange={(v) => set('U', v)}
                hint={
                  params.U === 0
                    ? 'Nothing moves, nothing shears: τ = 0. The wandering continues regardless.'
                    : undefined
                }
              />
              <Slider
                label="Gap, H"
                value={params.H}
                min={1e-5}
                max={1e-2}
                log
                format={lengthM}
                onChange={(v) => set('H', v)}
              />
              <Slider
                label="Wetted area, A"
                unit="m²"
                value={params.A}
                min={1e-4}
                max={1}
                log
                format={sci}
                onChange={(v) => set('A', v)}
              />
              <Slider
                label="Density, ρ"
                unit="kg/m³"
                value={params.rho}
                min={0.5}
                max={2000}
                log
                format={sci}
                onChange={(v) => set('rho', v)}
                hint="Only ν = μ/ρ and Re care about ρ; the stress itself does not."
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
            title="Newton's law of viscosity"
            latex={String.raw`\tau = \mu\,\frac{du}{dy}`}
            terms={[
              { symbol: '\\tau', meaning: 'shear stress — a FLUX of x-momentum in the y direction, Pa', maps: 'τ readout' },
              { symbol: '\\mu', meaning: 'dynamic viscosity, Pa·s (10 poise)', maps: 'μ slider' },
              { symbol: 'du/dy', meaning: 'velocity gradient — the driving force', maps: 'U and H sliders' },
            ]}
            note={
              <>
                Read τ as a flux and the analogy clicks into place: momentum flows down the
                velocity gradient exactly as mass flows down ∇C and heat flows down ∇T. The
                fluid touching each plate moves <em>with</em> the plate — the no-slip
                condition — which is how the plate's motion gets into the fluid at all.
              </>
            }
          />

          <EquationCard
            title="Momentum conservation at steady state"
            latex={String.raw`\underbrace{\text{Momentum in}}_{\text{from above}} = \underbrace{\text{Momentum out}}_{\text{to below}} \;\;\Longrightarrow\;\; \tau(y) = \text{const}`}
            note="No layer is accelerating, so no layer may keep momentum: τ is identical at every height, exactly as J and Q were constant through the wall. And with τ = μ du/dy constant, the profile must be a straight line — the linearity is a conservation statement, not an assumption."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="The three-flux dictionary"
            latex={String.raw`
\begin{aligned}
j &= -D\,\frac{dC}{dx} &\quad&\text{mass} \\[4pt]
q'' &= -k\,\frac{dT}{dx} &\quad&\text{heat} \\[4pt]
\tau &= \mu\,\frac{du}{dy} &\quad&\text{momentum}
\end{aligned}`}
            note="One idea wearing three costumes: a flux, proportional to a gradient, through a material constant. The diffusivities D, α = k/ρc_p, and ν = μ/ρ all carry m²/s, and their ratios (Sc = ν/D, Pr = ν/α, Le = α/D) will organise every convection correlation later. This card is the spine of the whole subject."
            defaultOpen={true}
          />

          <EquationCard
            title="μ versus ν"
            latex={String.raw`\nu \equiv \frac{\mu}{\rho}\ \ [\mathrm{m^2/s}] \qquad \text{water: } \nu \approx 10^{-6},\ \ \text{air: } \nu \approx 1.5\times10^{-5}`}
            note="μ says how strongly layers grip; ν says how fast momentum spreads. Air is 50x less viscous than water by μ but diffuses momentum 15x faster by ν, because there is so little mass to accelerate. Whenever a time or a distance is being asked about, ν is the one doing the work."
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
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Module 3 · Viscous shear
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Momentum transfer
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Newton's Law of Viscosity
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        A plate slides over a fluid film and the fluid shears. The third flux of the
        trio: each layer of fluid grips the layer beneath it and drags it along, so
        the plate's momentum is handed down, layer by layer, to the fixed wall. The
        drag you feel is that grip — τ = μ du/dy, the same at every height.
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
