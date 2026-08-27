import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  aliveFraction,
  axialPeclet,
  deathOnset,
  extraction,
  flowQ,
  minC,
  tissueDrop,
  type PerfusionParams,
} from '../../lib/perfusion';
import { mMToMolPerCm3, molPerCm3TomM } from '../../lib/fick';
import { lengthCm, sci } from '../../lib/format';
import { PerfusionCanvas } from './PerfusionCanvas';
import { Perfusion3DCanvas } from './Perfusion3DCanvas';
import { PerfusionChart } from './PerfusionChart';
import { DEFAULT_PARAMS, PRESETS } from './presets';

export function PerfusionModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<PerfusionParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>(PRESETS[0].id);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = <K extends keyof PerfusionParams>(key: K, value: PerfusionParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(() => {
    const alive = aliveFraction(params);
    return {
      Q: flowQ(params),
      drop: tissueDrop(params),
      corner: minC(params, params.L),
      xStar: deathOnset(params),
      alive,
      Pe: axialPeclet(params),
      extraction: extraction(params),
    };
  }, [params]);
  const allAlive = derived.alive >= 1;

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The channel and its cell layer"
            subtitle="Rich on the left, drained on the right, parabolic into the depth — and one corner pays for everything."
            right={
              <div className="w-28 shrink-0">
                <Segmented<'2d' | '3d'>
                  ariaLabel="View dimension"
                  value={dim}
                  options={[
                    { value: '2d', label: '2D', title: 'The cross-section painted from the solution — drag to pan, scroll to zoom' },
                    { value: '3d', label: '3D', title: 'The device itself — drag to orbit, look underneath' },
                  ]}
                  onChange={setDim}
                />
              </div>
            }
          >
            {dim === '2d' ? (
              <PerfusionCanvas params={params} dark={dark} />
            ) : (
              <Perfusion3DCanvas params={params} dark={dark} />
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Every colour is the analytic solution; the hatched red region is where the
              concentration has fallen below C_crit. Two separate drains stack against
              the far-bottom corner: the flow arrives poorer (linear in x, eased by
              pumping harder) and the depth costs its parabolic toll (h₂²-scaled, and no
              pump can refund it). This is the whole game of feeding cells with flow.
            </p>
          </Panel>
        </div>

        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Slider
                label="Flow velocity, v"
                unit="cm/s"
                value={params.v}
                min={0.05}
                max={20}
                log
                format={sci}
                onChange={(v) => set('v', v)}
                hint="Fixes the axial drain — and only the axial drain."
              />
              <Slider
                label="Tissue thickness, h₂"
                value={params.h2}
                min={5e-4}
                max={0.01}
                log
                format={lengthCm}
                onChange={(v) => set('h2', v)}
                hint="The h₂² tax lives here."
              />
              <Slider
                label="Channel height, h₁"
                value={params.h1}
                min={5e-4}
                max={0.01}
                log
                format={lengthCm}
                onChange={(v) => set('h1', v)}
              />
              <Slider
                label="Channel length, L"
                value={params.L}
                min={0.2}
                max={10}
                log
                format={lengthCm}
                onChange={(v) => set('L', v)}
              />
              <Slider
                label="Inlet concentration, C₀"
                unit="mM"
                value={molPerCm3TomM(params.C0)}
                min={0.5}
                max={20}
                step={0.1}
                onChange={(v) => set('C0', mMToMolPerCm3(v))}
              />
              <Slider
                label="Consumption rate, R"
                unit="mM/s"
                value={molPerCm3TomM(params.R)}
                min={0.1}
                max={20}
                log
                format={sci}
                onChange={(v) => set('R', mMToMolPerCm3(v))}
              />
              <Slider
                label="Diffusion coefficient, D"
                unit="cm²/s"
                value={params.D}
                min={1e-6}
                max={1e-4}
                log
                format={sci}
                onChange={(v) => set('D', v)}
              />
              <Slider
                label="Survival threshold, C_crit"
                unit="mM"
                value={molPerCm3TomM(params.Ccrit)}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => set('Ccrit', mMToMolPerCm3(v))}
                hint="Zero is a mathematical courtesy. Cells disagree."
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

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label="Alive"
                value={`${Math.round(derived.alive * 100)}%`}
                unit="of the floor"
                tone={allAlive ? 'accent' : 'warm'}
                hint={allAlive ? 'every cell fed, with margin' : 'fraction of the tissue floor still fed'}
              />
              <Stat
                label={<InlineMath math="x^*" />}
                value={derived.xStar >= params.L ? '—' : lengthCm(Math.max(0, derived.xStar))}
                unit=""
                hint={derived.xStar >= params.L ? 'starvation never begins' : 'where starvation begins'}
              />
              <Stat
                label="Depth toll"
                value={sci(molPerCm3TomM(derived.drop))}
                unit="mM"
                hint="Rh₂²/2D — flow-proof, h₂²-scaled"
              />
              <Stat
                label="Corner C"
                value={sci(molPerCm3TomM(Math.max(0, derived.corner)))}
                unit="mM"
                hint={
                  derived.corner < 0
                    ? 'exhausted — the zero-order model would go negative here'
                    : 'the worst-fed cell on the page'
                }
              />
              <Stat
                label={<InlineMath math="Q" />}
                value={sci(derived.Q)}
                unit="cm³/s"
                hint="what the pump delivers"
              />
              <Stat
                label="Extraction"
                value={`${sci(Math.min(1, derived.extraction) * 100)}%`}
                unit="of the feed"
                hint={
                  derived.extraction > 1
                    ? 'capped at 100% — demand exceeds the feed, so downstream cells starve'
                    : `axial Pe = ${sci(derived.Pe)} — axial diffusion is irrelevant`
                }
              />
            </div>

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="Profiles">
            <PerfusionChart params={params} dark={dark} />
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="Into the tissue: diffusion vs consumption"
            latex={String.raw`D\frac{d^2C}{dy^2} = R \;\Rightarrow\; C(y) = C_s - \frac{R}{D}\!\left(h_2 y - \frac{y^2}{2}\right), \qquad C_{min} = C_s - \frac{R h_2^2}{2D}`}
            terms={[
              { symbol: 'R', meaning: 'zeroth-order consumption — cells take what they need', maps: 'R slider' },
              { symbol: 'h_2', meaning: 'tissue thickness — enters SQUARED', maps: 'h₂ slider' },
            ]}
            note="Poisson's equation from the steady-diffusion modules, wearing a biology costume. The no-flux floor makes the parabola flatten at the bottom, and the whole depth costs a fixed toll Rh₂²/2D that no amount of flow can refund."
          />
          <EquationCard
            title="Along the channel: convection vs total uptake"
            latex={String.raw`Q\,\frac{dC_s}{dx} = -R\,h_2\,W \;\Rightarrow\; C_s(x) = C_0 - \frac{R h_2 W}{Q}\,x`}
            note="A running balance: the flow arrives with Q·C₀ per second and the carpet of cells drains Rh₂W per centimetre. Linear decay — and the ONE term the pump controls, scaling as 1/Q. The axial Péclet number (~10⁵ here) is the licence for ignoring axial diffusion entirely. One more quiet assumption: the channel is taken as well mixed across its own depth, so C_s is both the bulk and the interface concentration — fine while the transverse mixing time h₁²/D stays small next to the residence time L/v."
            defaultOpen={false}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="The corner"
            latex={String.raw`C_{corner} = C_0 - \underbrace{\frac{R h_2^2}{2D}}_{\text{depth toll}} - \underbrace{\frac{R h_2 W L}{Q}}_{\text{axial drain}}`}
            note="Two independent drains, one victim. Diagnosing which term is starving the corner tells you the fix: axial term dominant — pump harder or shorten the channel; depth term dominant — thin the tissue or accept that this design has hit diffusion's wall. Confusing the two wastes either medium or cells."
            defaultOpen={true}
          />
          <EquationCard
            title="Why tissues are thin or vascularized"
            latex={String.raw`\frac{R h_2^2}{2D} > C_0 \;\Rightarrow\; \text{no flow rate can save the floor}`}
            note="Solve the depth toll for h₂ with typical oxygen numbers and the answer lands near 100 µm — the same distance the diffusion-clock module found, now derived from supply-and-demand instead of timing. It is why capillaries thread real tissue every ~100 µm, and the wall every thick engineered tissue must climb."
            defaultOpen={false}
          />
        </div>
      </div>

      {/* The Socratic question set (socratic.ts) is authored but not rendered. */}
    </div>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Module 4 · Convection + reaction
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Feeding cells with flow — and where that quietly fails
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Perfused Channel
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Flow carries nutrient along a channel; a layer of cells beneath drains it as it
        passes and diffusion hauls it down to the deepest of them. Both supply chains
        end at the same far-bottom corner — and whether that corner lives is the whole
        design problem of perfusion, from microfluidic cell culture to why your tissues
        are threaded with capillaries.
      </p>
    </header>
  );
}
