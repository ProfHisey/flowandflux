import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  convectionTime,
  diffusionTime,
  peclet,
  totalFlux,
  type PecletParams,
} from '../../lib/peclet';
import { mMToMolPerCm3, molPerCm3TomM } from '../../lib/fick';
import { lengthCm, sci, timeS } from '../../lib/format';
import { D_LANDMARKS } from '../FicksLaw/presets';
import { PecletCanvas } from './PecletCanvas';
import { Peclet3DCanvas } from './Peclet3DCanvas';
import { PecletChart } from './PecletChart';
import { DEFAULT_PARAMS, PRESETS } from './presets';

export function PecletModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<PecletParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [running, setRunning] = useState(true);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof PecletParams>(key: K, value: PecletParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(() => {
    const Pe = peclet(params);
    return {
      Pe,
      N: totalFlux(params),
      tDiff: diffusionTime(params),
      tConv: convectionTime(params),
      verdict:
        Pe < 0.1
          ? 'diffusion rules — pretend the flow is not there'
          : Pe > 10
            ? 'convection rules — the upstream value simply arrives'
            : 'contested — neither mechanism can be dropped',
    };
  }, [params]);

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="Wander plus drift"
            subtitle="The same unbiased walkers as the diffusion modules — now riding a flow."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'Walkers vs the analytic profile — drag to pan, scroll to zoom' },
                      { value: '3d', label: '3D', title: 'The same contest as a volume — drag to orbit' },
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
                <PecletCanvas Pe={derived.Pe} running={running} dark={dark} />
              ) : (
                <Peclet3DCanvas Pe={derived.Pe} running={running} dark={dark} />
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              One honest trick: the on-screen drift is chosen so the VISUAL Péclet
              number equals the physical one (clamped at 60 so extreme presets stay
              watchable). Speeds are cosmetic, but the ratio — which is this module's
              entire subject — is real. The amber curve is the analytic solution;
              the walkers, who have never seen it, keep landing on it.
            </p>
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="\mathrm{Pe} = vL/D" />}
                value={sci(derived.Pe)}
                unit=""
                tone="accent"
                hint={derived.verdict}
              />
              <Stat
                label={<InlineMath math="N" />}
                value={sci(derived.N)}
                unit="mol/cm²·s"
                hint="total flux, convective + diffusive — same at every station"
              />
              <Stat
                label={<InlineMath math="t_{diff} = L^2/2D" />}
                value={timeS(derived.tDiff)}
                unit=""
                hint="diffusion's clock for the distance"
              />
              <Stat
                label={<InlineMath math="t_{conv} = L/v" />}
                value={timeS(derived.tConv)}
                unit=""
                hint="the flow's clock — Pe is twice the ratio of these two"
              />
              <Stat
                label="Exit layer"
                value={derived.Pe > 1 ? lengthCm(params.L / derived.Pe) : '—'}
                unit=""
                hint={
                  derived.Pe > 1
                    ? '~L/Pe: where diffusion makes its last stand'
                    : 'Pe < 1: diffusion owns the whole channel'
                }
              />
              <Stat
                label={<InlineMath math="C_0 \to C_L" />}
                value={`${sci(molPerCm3TomM(params.C0))} → ${sci(molPerCm3TomM(params.CL))}`}
                unit="mM"
                hint="the two baths"
              />
            </div>

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="Profiles and regimes">
            <PecletChart params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
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
                label="Flow velocity, v"
                unit="cm/s"
                value={params.v}
                min={1e-7}
                max={100}
                log
                format={sci}
                onChange={(v) => set('v', v)}
              />
              <Slider
                label="Channel length, L"
                value={params.L}
                min={1e-4}
                max={300}
                log
                format={lengthCm}
                onChange={(v) => set('L', v)}
                hint="Pe grows with L: distance is convection's home advantage."
              />
              <Slider
                label="C₀ — upstream bath"
                unit="mM"
                value={molPerCm3TomM(params.C0)}
                min={0}
                max={20}
                step={0.05}
                onChange={(v) => set('C0', mMToMolPerCm3(v))}
              />
              <Slider
                label="C_L — downstream bath"
                unit="mM"
                value={molPerCm3TomM(params.CL)}
                min={0}
                max={20}
                step={0.05}
                onChange={(v) => set('CL', mMToMolPerCm3(v))}
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
                        ? 'border-sky-400 bg-sky-50 dark:border-sky-600 dark:bg-sky-950/40'
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
            title="Steady convection–diffusion, 1-D"
            latex={String.raw`v\,\frac{dC}{dx} = D\,\frac{d^2C}{dx^2} \;\;\Rightarrow\;\; \frac{C - C_0}{C_L - C_0} = \frac{e^{\mathrm{Pe}\,x/L} - 1}{e^{\mathrm{Pe}} - 1}`}
            terms={[
              { symbol: 'v\\,dC/dx', meaning: 'what the flow carries through', maps: 'the drift' },
              { symbol: 'D\\,d^2C/dx^2', meaning: 'what the wandering smooths out', maps: 'the jitter' },
            ]}
            note="One dimensionless number decides the shape: Pe small, the exponential flattens into the familiar straight diffusion line; Pe large, it sharpens into a plug with an exit boundary layer of thickness ~L/Pe. Every convective-transport profile you will ever meet is a cousin of this exponential."
          />

          <EquationCard
            title="One ratio, three costumes"
            latex={String.raw`\mathrm{Pe}_{mass} = \frac{vL}{D} \qquad \mathrm{Pe}_{heat} = \frac{vL}{\alpha} \qquad \mathrm{Re} = \frac{vL}{\nu}`}
            note="The same question asked of mass, heat, and momentum: can molecular transport keep up with the flow? Re is literally the Péclet number of momentum. Their ratios — Sc = ν/D, Pr = ν/α, Le = α/D — compare the three diffusivities to each other, and will organise every boundary-layer correlation in the convection unit."
            defaultOpen={true}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Pe as a race between clocks"
            latex={String.raw`\mathrm{Pe} = \frac{vL}{D} = 2\,\frac{t_{diff}}{t_{conv}}, \qquad t_{diff} = \frac{L^2}{2D}, \quad t_{conv} = \frac{L}{v}`}
            note="The factor of 2 is bookkeeping, not physics: it is there because t_diff is defined as L²/2D, the same diffusion clock the bolus-dispersion module uses. What matters is the scaling — diffusion's clock grows as L², the flow's clock grows only as L. So distance always eventually hands the race to convection — which is why organisms are diffusion-powered below ~100 µm and plumbing-powered above it, and why 'what is L?' is the first question. L is the scale over which the quantity changes, and it depends on what you are asking."
            defaultOpen={false}
          />

          <EquationCard
            title="What survives at Pe → ∞"
            latex={String.raw`N \to v\,C_0, \qquad \delta_{exit} \sim \frac{L}{\mathrm{Pe}}`}
            note="Convection never abolishes diffusion; it corners it into boundary layers — thin films at walls and outlets where the flow cannot finish the job. All of convective transfer theory (h, h_m, Nu, Sh, and the correlation tables) is the accounting of those layers. This module is where they are born."
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
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Module 4 · Convection meets diffusion
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          The Péclet number — a race between two clocks
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Péclet Number
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Give the random walkers a current to ride and a single number decides the
        outcome: Pe = vL/D, the ratio of diffusion's clock to the flow's clock. One
        slider walks the channel from the familiar straight diffusion profile to a
        convective plug — and the thin layer that survives at the far end is the seed
        of everything the convection unit will build.
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
        <span className="absolute top-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          solids
        </span>
        <span className="absolute right-0 top-2.5 text-[10px] text-slate-500 dark:text-slate-400">
          gases
        </span>
      </div>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
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
      aria-pressed={active}
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
