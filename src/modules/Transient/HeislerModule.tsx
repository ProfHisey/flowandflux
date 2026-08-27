import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  biotOf,
  centerTemp,
  coefC1,
  fourierOf,
  tempAt,
  transientRegime,
  zeta1,
  type HeislerParams,
  type TransientGeometry,
} from '../../lib/transient';
import { lengthM, sci, timeS } from '../../lib/format';
import { BiFoMapCanvas } from './BiFoMapCanvas';
import { HeislerCanvas } from './HeislerCanvas';
import { Heisler3DCanvas } from './Heisler3DCanvas';
import { HeislerChart } from './TransientChart';
import { DEFAULT_HEISLER, HEISLER_PRESETS } from './presets';

export function HeislerModule({ dark }: { dark: boolean }) {
  const [hp, setHp] = useState<HeislerParams>(DEFAULT_HEISLER);
  const [hPresetId, setHPresetId] = useState('pea');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const setH = <K extends keyof HeislerParams>(key: K, value: HeislerParams[K]) => {
    setHp((p) => ({ ...p, [key]: value }));
    setHPresetId('');
  };
  const derived = useMemo(() => {
    const Bi = biotOf(hp);
    return {
      Bi,
      Fo: fourierOf(hp),
      z1: zeta1(hp.geometry, Bi),
      C1: coefC1(hp.geometry, Bi),
      T0: centerTemp(hp),
      Tsurf: tempAt(hp, 1),
    };
  }, [hp]);

  const hPreset = HEISLER_PRESETS.find((p) => p.id === hPresetId);

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="A finite body, meeting its fluid"
            subtitle="Two numbers, Bi and Fo, decide everything — the chart's whole secret."
            right={
              <div className="w-28 shrink-0">
                <Segmented<'2d' | '3d'>
                  ariaLabel="View dimension"
                  value={dim}
                  options={[
                    { value: '2d', label: '2D', title: 'Face-on view — drag to pan, scroll to zoom' },
                    { value: '3d', label: '3D', title: 'Rotatable 3D view — drag to orbit' },
                  ]}
                  onChange={setDim}
                />
              </div>
            }
          >
            {dim === '2d' ? (
              <HeislerCanvas params={hp} dark={dark} />
            ) : (
              <Heisler3DCanvas params={hp} dark={dark} />
            )}
            {derived.Fo < 0.2 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">Fo = {sci(derived.Fo)} &lt; 0.2: </span>
                the one-term solution is an approximation this early — the faster
                decay modes have not died yet, and the true profile still remembers
                its initial shape. Same fine print as the printed charts.
              </p>
            )}
          </Panel>
        </div>

        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<TransientGeometry>
                label="Geometry"
                value={hp.geometry}
                options={[
                  { value: 'wall', label: 'Plane wall', title: 'Thickness 2L, cooled from both faces' },
                  { value: 'sphere', label: 'Sphere', title: 'Radius L' },
                ]}
                onChange={(g) => setH('geometry', g)}
              />
              <Slider
                label={hp.geometry === 'wall' ? 'Half-thickness, L' : 'Radius, L'}
                value={hp.L}
                min={1e-3}
                max={0.3}
                log
                format={lengthM}
                onChange={(v) => setH('L', v)}
              />
              <Slider
                label="Conductivity, k"
                unit="W/m·K"
                value={hp.k}
                min={0.05}
                max={500}
                log
                format={sci}
                onChange={(v) => setH('k', v)}
              />
              <Slider
                label="Density, ρ"
                unit="kg/m³"
                value={hp.rho}
                min={100}
                max={10000}
                log
                format={sci}
                onChange={(v) => setH('rho', v)}
              />
              <Slider
                label="Specific heat, cₚ"
                unit="J/kg·K"
                value={hp.c}
                min={100}
                max={5000}
                log
                format={sci}
                onChange={(v) => setH('c', v)}
              />
              <Slider
                label="Convection, h"
                unit="W/m²·K"
                value={hp.h}
                min={1}
                max={20000}
                log
                format={sci}
                onChange={(v) => setH('h', v)}
              />
              <Slider
                label="Initial temperature, Tᵢ"
                unit="°C"
                value={hp.Ti}
                min={-20}
                max={150}
                step={0.5}
                onChange={(v) => setH('Ti', v)}
              />
              <Slider
                label="Fluid temperature, T∞"
                unit="°C"
                value={hp.Tinf}
                min={-20}
                max={200}
                step={0.5}
                onChange={(v) => setH('Tinf', v)}
              />
              <Slider
                label="Time, t"
                value={hp.t}
                min={1}
                max={1e5}
                log
                format={timeS}
                onChange={(v) => setH('t', v)}
              />
            </div>
          </Panel>

          <Panel
            title="Example problems"
            subtitle="Load a setup, then check the numbers by hand."
          >
            <div className="space-y-2">
              {HEISLER_PRESETS.map((pr) => {
                const active = pr.id === hPresetId;
                return (
                  <button
                    key={pr.id}
                    aria-pressed={active}
                    type="button"
                    onClick={() => {
                      setHp(pr.params);
                      setHPresetId(pr.id);
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
                  setHp(DEFAULT_HEISLER);
                  setHPresetId('pea');
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="\mathrm{Bi} = hL/k" />}
                value={sci(derived.Bi)}
                unit=""
                tone="accent"
                hint="where does the resistance live?"
              />
              <Stat
                label={<InlineMath math="\mathrm{Fo} = \alpha t / L^2" />}
                value={sci(derived.Fo)}
                unit=""
                tone="accent"
                hint="what time is it, in body units?"
              />
              <Stat
                label={<InlineMath math="T_{center}" />}
                value={sci(derived.T0)}
                unit="°C"
                tone="warm"
                hint="the number the chart existed for"
              />
              <Stat
                label={<InlineMath math="T_{surface}" />}
                value={sci(derived.Tsurf)}
                unit="°C"
                hint="always closer to the fluid than the center"
              />
              <Stat
                label={<InlineMath math="\zeta_1" />}
                value={sci(derived.z1)}
                unit=""
                hint="first eigenvalue — from Bi, by transcendental equation"
              />
              <Stat
                label={<InlineMath math="C_1" />}
                value={sci(derived.C1)}
                unit=""
                hint="one-term coefficient — the table column, computed live"
              />
            </div>

            {hPreset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                {hPreset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel
            title="Which tool applies?"
            subtitle="The triage, as a map — the dot is the setup on the right, live."
          >
            <BiFoMapCanvas params={hp} dark={dark} />
            <RegimeLine Bi={derived.Bi} Fo={derived.Fo} />
          </Panel>

          <Panel title="History">
            <HeislerChart params={hp} dark={dark} />
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="The one-term (Heisler) solution"
            latex={String.raw`\frac{\theta_0}{\theta_i} = C_1\,e^{-\zeta_1^2\,\mathrm{Fo}}, \qquad \mathrm{Fo} = \frac{\alpha t}{L^2}, \qquad \mathrm{Bi} = \frac{hL}{k}`}
            note="The full solution is an infinite series of decaying modes; after Fo ≈ 0.2 only the slowest survives, and this line is that survivor. ζ₁ and C₁ come from Bi alone (wall: ζtanζ = Bi; sphere: 1 − ζcotζ = Bi) — the columns of the printed tables, computed live here. Every transient conduction problem ever solved with a chart is these three symbols."
          />
          <EquationCard
            title="The triage: which unsteady tool?"
            latex={String.raw`\mathrm{Bi} \ll 1:\ \text{lumped} \qquad \mathrm{Fo} \ll 1:\ \text{semi-infinite} \qquad \text{otherwise: this page}`}
            note="Small Bi — the inside keeps up, the law-of-cooling module's single exponential is enough. Small Fo — the far side has not felt anything yet, so treat the body as semi-infinite (the sudden-contact module's fixed-surface erf when Bi is large enough to pin the surface; the convective-surface variant otherwise). Only the middle ground needs the full mode machinery, and this page IS that middle ground. (Bi here uses L = half-thickness or radius, matching the charts; the lumped rule of thumb's V/A makes the sphere threshold 3× looser, so this triage errs on the safe side.)"
            defaultOpen={false}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="The limits, and the bridge"
            latex={String.raw`\mathrm{Bi} \to 0:\ \ \zeta_1^2 \to \mathrm{Bi}\ \text{(wall)},\ \ 3\,\mathrm{Bi}\ \text{(sphere)} \ \Rightarrow\ \theta_0/\theta_i \to e^{-t/\tau_{lumped}}`}
            note="Let Bi shrink and the one-term solution collapses into the lumped exponential from the law-of-cooling module — for the wall, ζ₁² → Bi and τ = ρVc/hA falls out exactly (the sphere does the same through ζ₁² → 3Bi, which is precisely its V/A = R/3). Large Bi is the opposite regime: the surface takes the fluid temperature at once and pure internal conduction sets the pace. One family of solutions, with lumped cooling and the semi-infinite solid as its two ends."
            defaultOpen={false}
          />
          <EquationCard
            title="Why one chart used to serve every material"
            latex={String.raw`\theta^* = f(\mathrm{Bi}, \mathrm{Fo}, x^*)\ \ \text{— and nothing else}`}
            note="Non-dimensionalization at full power: every wall of every material at every size collapses onto the same three-variable family. Two bodies with matching Bi and Fo are the same problem wearing different dimensions. The printed charts were a pre-computer lookup of this fact; the sliders here are the same fact, with the lookup done for you."
            defaultOpen={false}
          />
        </div>
      </div>
    </div>
  );
}

function RegimeLine({ Bi, Fo }: { Bi: number; Fo: number }) {
  const regime = transientRegime(Bi, Fo);
  const text =
    regime === 'lumped' ? (
      <>
        <strong>Bi &lt; 0.1: the inside keeps up.</strong> The lumped single
        exponential from the law-of-cooling module is all this setup needs — the
        one-term machinery here agrees with it, at more effort.
      </>
    ) : regime === 'semi' ? (
      <>
        <strong>Fo &lt; 0.2: the far side has not felt anything yet.</strong> The
        body might as well be infinite — use a semi-infinite treatment (the
        sudden-contact module's erf when Bi is large enough to pin the surface;
        the convective-surface variant otherwise). The one-term line here is
        still shaky this early.
      </>
    ) : regime === 'either' ? (
      <>
        <strong>Small Bi and small Fo.</strong> The inside keeps up, so the
        lumped exponential is the tool — barely anything has happened yet, and
        it captures what has. (A fixed-surface erf would badly overstate the
        surface response at this Bi.)
      </>
    ) : (
      <>
        <strong>The middle ground — this page's reason to exist.</strong> Too much
        internal resistance to lump, too far along to be semi-infinite: the
        one-term solution is the tool.
      </>
    );
  return (
    <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Module 2 · Unsteady conduction
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          The finite body — Heisler charts, interactive
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Heisler Charts
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        A finite body dropped into a fluid, solved the way generations solved it with
        printed charts — except the chart is alive. Two dimensionless numbers, Bi and
        Fo, decide everything; the eigenvalues the tables used to list are computed
        under your fingers, and the body itself is drawn from the solution.
      </p>
    </header>
  );
}
