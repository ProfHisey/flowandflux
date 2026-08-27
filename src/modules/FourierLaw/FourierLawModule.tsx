import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  areaAt,
  domain,
  gradient,
  heatFlux,
  heatRate,
  resistance,
  type FourierParams,
  type Geometry,
} from '../../lib/fourier';
import { lengthM, sci } from '../../lib/format';
import { FourierCanvas, type EnergyStats } from './FourierCanvas';
import { Fourier3DCanvas } from './Fourier3DCanvas';
import { FourierChart } from './FourierChart';
import { DEFAULT_PARAMS, K_LANDMARKS, PRESETS } from './presets';

export function FourierLawModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<FourierParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [showMolecules, setShowMolecules] = useState(true);
  const [stats, setStats] = useState<EnergyStats | null>(null);
  const [view, setView] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof FourierParams>(key: K, value: FourierParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(() => {
    const [s0, s1] = domain(params);
    return {
      Q: heatRate(params),
      R: resistance(params),
      qIn: heatFlux(params, s0),
      qOut: heatFlux(params, s1),
      gradIn: gradient(params, s0),
      dT: params.T1 - params.T2,
      areaIn: areaAt(params, s0),
      areaOut: areaAt(params, s1),
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
            title="Steady-state temperature field"
            subtitle="Molecules vibrate in place. Only the energy travels."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={view}
                    options={[
                      { value: '2d', label: '2D', title: 'Face-on view — drag to pan, scroll to zoom' },
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
                  label={showMolecules ? 'Hide molecules' : 'Show molecules'}
                  active={showMolecules}
                  onClick={() => setShowMolecules((s) => !s)}
                >
                  <Sparkles size={15} />
                </IconButton>
              </div>
            }
          >
            <div>
              {view === '2d' ? (
                <FourierCanvas
                  params={params}
                  showMolecules={showMolecules}
                  running={running}
                  dark={dark}
                  onStats={setStats}
                />
              ) : (
                <Fourier3DCanvas
                  params={params}
                  showMolecules={showMolecules}
                  running={running}
                  dark={dark}
                />
              )}
            </div>
            {view === '3d' && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Drag to rotate, double-click to reset the view. Note what is
                different from the diffusion module's 3D view: the molecule density is
                uniform everywhere, because in a conducting solid the matter never
                migrates — only the vigor of the vibration varies. All measurements
                live on the 2D tab.
              </p>
            )}

            {view === '2d' && isSlab && showMolecules && stats && (
              <EnergyTraffic stats={stats} />
            )}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          {/* ------------------------------------------------- readouts */}
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="Q" />}
                value={sci(derived.Q)}
                unit="W"
                tone="warm"
                hint="total heat rate — constant through the wall"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="q''" /> at {isSlab ? 'x = 0' : 'r₁'}
                  </>
                }
                value={sci(derived.qIn)}
                unit="W/m²"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="q''" /> at {isSlab ? 'x = L' : 'r₂'}
                  </>
                }
                value={sci(derived.qOut)}
                unit="W/m²"
                hint={isSlab ? 'same as inlet — area is constant' : 'smaller — area has grown'}
              />
              <Stat
                label={<InlineMath math="R_{th}" />}
                value={sci(derived.R)}
                unit="K/W"
                hint="ΔT / Q"
              />
              <Stat
                label={<InlineMath math="\Delta T" />}
                value={sci(derived.dT)}
                unit="°C"
                hint="T₁ − T₂ — the driving force"
              />
              <Stat
                label={
                  <>
                    <InlineMath math="dT/dx" /> at {isSlab ? 'x = 0' : 'r₁'}
                  </>
                }
                value={sci(derived.gradIn)}
                unit="K/m"
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
            <FourierChart params={params} dark={dark} />
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
                label="Thermal conductivity, k"
                unit="W/m·K"
                value={params.k}
                min={0.01}
                max={500}
                log
                format={sci}
                onChange={(v) => set('k', v)}
              />
              <KScale k={params.k} />

              <Slider
                label="T₁ — boundary 1"
                unit="°C"
                value={params.T1}
                min={0}
                max={150}
                step={0.5}
                onChange={(v) => set('T1', v)}
              />
              <Slider
                label="T₂ — boundary 2"
                unit="°C"
                value={params.T2}
                min={0}
                max={150}
                step={0.5}
                onChange={(v) => set('T2', v)}
                hint={
                  params.T1 === params.T2
                    ? 'Equal temperatures: the vibration continues, the net heat flow is zero.'
                    : undefined
                }
              />

              {isSlab ? (
                <>
                  <Slider
                    label="Thickness, L"
                    value={params.L}
                    min={1e-3}
                    max={1}
                    log
                    format={lengthM}
                    onChange={(v) => set('L', v)}
                  />
                  <Slider
                    label="Face area, A"
                    unit="m²"
                    value={params.A}
                    min={0.01}
                    max={10}
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
                    min={0.005}
                    max={Math.max(0.005, params.r2 * 0.95)}
                    log
                    format={lengthM}
                    onChange={(v) => set('r1', Math.min(v, params.r2 * 0.95))}
                  />
                  <Slider
                    label="Outer radius, r₂"
                    value={params.r2}
                    min={Math.min(0.5, params.r1 * 1.05)}
                    max={0.5}
                    log
                    format={lengthM}
                    onChange={(v) => set('r2', Math.max(v, params.r1 * 1.05))}
                  />
                  {params.geometry === 'cylinder' && (
                    <Slider
                      label="Axial length, L"
                      value={params.L}
                      min={0.1}
                      max={10}
                      log
                      format={lengthM}
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
            title="Fourier's law"
            latex={String.raw`\vec{q}'' = -k\,\nabla T \qquad\Longrightarrow\qquad Q = -k\,\vec{A}\cdot\nabla T`}
            terms={[
              { symbol: "q''", meaning: 'heat flux — energy per unit area per time, W/m²', maps: 'flux chart' },
              { symbol: 'Q', meaning: 'total heat rate through the whole area, W', maps: 'Q readout' },
              { symbol: 'k', meaning: 'thermal conductivity, W/m·K', maps: 'k slider' },
              { symbol: 'T', meaning: 'temperature — the driving potential', maps: 'T₁, T₂ sliders' },
            ]}
            note={
              <>
                Fourier, 1822 — three decades <em>before</em> Fick, who copied the form on
                purpose. Phenomenological, like Fick's law: it describes what happens. The why
                is molecular hand-off of kinetic energy, plus free electrons in metals — which
                is why copper sits four decades above air on the k scale.
              </>
            }
          />

          <EquationCard
            title="The three geometries"
            latex={String.raw`
\begin{aligned}
\text{Cartesian:}&\quad Q = -k\,A_x\,\frac{\partial T}{\partial x} \\[4pt]
\text{Cylindrical:}&\quad Q = -k\,(2\pi r L)\,\frac{\partial T}{\partial r} \\[4pt]
\text{Spherical:}&\quad Q = -k\,(4\pi r^{2})\,\frac{\partial T}{\partial r}
\end{aligned}`}
            note="Identical to the mass-transfer table with new letters. The area facing the flux is what bends the temperature profile from a line into a logarithm into a hyperbola."
            defaultOpen={false}
          />

          <EquationCard
            title="The mass ↔ heat dictionary"
            latex={String.raw`
\begin{aligned}
C &\leftrightarrow T \\
D &\leftrightarrow \alpha = k/\rho c_p \\
j &\leftrightarrow q'' \\
J &\leftrightarrow Q \\
R_D = \tfrac{\Delta C}{J} &\leftrightarrow R_{th} = \tfrac{\Delta T}{Q}
\end{aligned}`}
            note="One idea, two costumes. The dimensionless profiles are literally identical — the verify suite checks θ_C(s) = θ_T(s) point by point. Anything you can solve for mass you can solve for heat by transcription, and vice versa. This dictionary is the most valuable table in the subject."
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Energy conservation at steady state"
            latex={String.raw`\underbrace{\text{Input}}_{} + \underbrace{\text{Generation}}_{=\,0} = \underbrace{\text{Output}}_{} + \underbrace{\text{Accumulation}}_{=\,0}`}
            note="With nothing generating heat and nothing warming up, whatever energy crosses one station must cross every other. That is why Q is constant through the wall — the same sentence as species conservation, word for word."
            defaultOpen={false}
          />

          <EquationCard
            title="Thermal resistance"
            latex={String.raw`
R_{th} \equiv \frac{\Delta T}{Q} =
\begin{cases}
\dfrac{L}{A k} & \text{slab} \\[10pt]
\dfrac{\ln(r_2/r_1)}{2\pi L k} & \text{cylinder} \\[10pt]
\dfrac{1/r_1 - 1/r_2}{4\pi k} & \text{sphere}
\end{cases}`}
            note="Ohm's law for heat. Series resistances add — which is how a composite wall (glass + air gap + glass) is solved in one line, and why double glazing beats a thicker pane. Valid only at steady state with no generation."
            defaultOpen={false}
          />

          <EquationCard
            title="What k is made of"
            latex={String.raw`\alpha = \frac{k}{\rho\,c_p}\ \ [\mathrm{m^2/s}] \qquad \text{cf.}\ \ D\ \ [\mathrm{m^2/s}]`}
            note="Divide k by the volumetric heat capacity and a diffusivity appears, with the same units as D. For water: α ≈ 1.4 × 10⁻⁷ m²/s, against D ≈ 10⁻⁹ m²/s for a small solute — heat outruns mass in the same liquid by a factor of ~100. That ratio (the Lewis number) is why your coffee cools before it loses its sugar gradient."
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
 * The energy ledger at the midplane — the conduction counterpart of the
 * diffusion module's two-way traffic counter. Each collision hands energy
 * BOTH ways; conduction is the imbalance. Lattice units, and labeled so:
 * the exchange rate is visual, like D_VIS, but the measured and predicted
 * figures share it, so their agreement is real.
 */
function EnergyTraffic({ stats }: { stats: EnergyStats }) {
  const settled = stats.elapsed > 8;
  const gross = stats.right + stats.left;
  const share = gross > 0 ? (Math.abs(stats.net) / gross) * 100 : 0;

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
        <span className="text-slate-600 dark:text-slate-400">
          → {Math.round(stats.right).toLocaleString()} u/s
        </span>
        <span className="text-slate-600 dark:text-slate-400">
          ← {Math.round(stats.left).toLocaleString()} u/s
        </span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          net {stats.net >= 0 ? '+' : ''}
          {stats.net.toFixed(1)} u/s
        </span>
        <span className="text-amber-700 dark:text-amber-300">
          Fourier predicts {stats.predicted >= 0 ? '+' : ''}
          {stats.predicted.toFixed(1)} u/s
        </span>
        <span className="ml-auto text-[11px] font-normal text-slate-500 dark:text-slate-400">
          {settled ? 'averaged over' : 'settling ·'} {stats.elapsed.toFixed(0)}s
        </span>
      </div>
      <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
        Energy handed across the dashed midplane, tallied in each direction (lattice
        units — the exchange rate is cosmetic, the bookkeeping is not). Conduction is the{' '}
        <strong className="font-semibold text-slate-700 dark:text-slate-300">
          {share < 10 ? share.toFixed(2) : share.toFixed(0)}%
        </strong>{' '}
        imbalance between two enormous one-way flows: every collision moves energy both
        ways, and the hot side merely gives a little more than it gets back. The amber
        figure is Fourier's law evaluated on the energy gradient the lattice itself is
        carrying — two independent measurements of one quantity.
      </p>
    </div>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Module 2 · Conduction
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Steady-state heat transfer
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Fourier's Law of Heat Conduction
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Steady-state conduction through a wall. Same mathematics as diffusion, different
        cargo: here no molecule goes anywhere — energy is handed from neighbor to
        neighbor, and the counter at the midplane shows that hand-off happening in both
        directions at once.
      </p>
    </header>
  );
}

function KScale({ k }: { k: number }) {
  const lo = Math.log10(0.01);
  const hi = Math.log10(500);
  const pos = (v: number) => ((Math.log10(v) - lo) / (hi - lo)) * 100;

  return (
    <div className="-mt-2 space-y-1">
      <div className="relative h-6">
        {K_LANDMARKS.map((m) => (
          <span
            key={m.label}
            className="absolute top-0 h-2 w-px bg-slate-300 dark:bg-slate-600"
            style={{ left: `${pos(m.k)}%` }}
            title={`${m.label}: ${sci(m.k)} W/m·K`}
          />
        ))}
        <span
          className="absolute top-0 h-2 w-0.5 bg-amber-500"
          style={{ left: `${Math.min(100, Math.max(0, pos(k)))}%` }}
        />
        <span className="absolute top-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          insulators
        </span>
        <span className="absolute right-0 top-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          metals
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Ticks mark typical real-world values — air to copper spans more than four decades.
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
