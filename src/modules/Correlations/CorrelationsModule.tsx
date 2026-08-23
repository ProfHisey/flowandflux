import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  FLUIDS,
  hOf,
  hmOf,
  nusselt,
  prandtl,
  reynolds,
  schmidt,
  sherwood,
  validity,
  type CorrGeometry,
  type CorrParams,
} from '../../lib/correlations';
import { lengthM, sci } from '../../lib/format';
import { CorrCanvas } from './CorrCanvas';
import { Corr3DCanvas } from './Corr3DCanvas';
import { CorrChart } from './CorrChart';
import { DEFAULT_PRESET, PRESETS } from './presets';

export function CorrelationsModule({ dark }: { dark: boolean }) {
  const [geometry, setGeometry] = useState<CorrGeometry>(DEFAULT_PRESET.geometry);
  const [fluidName, setFluidName] = useState(DEFAULT_PRESET.fluid.name);
  const [v, setV] = useState(DEFAULT_PRESET.v);
  const [L, setL] = useState(DEFAULT_PRESET.L);
  const [D, setD] = useState(DEFAULT_PRESET.D);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET.id);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const fluid = FLUIDS.find((f) => f.name === fluidName) ?? FLUIDS[0];
  const params: CorrParams = useMemo(
    () => ({ geometry, fluid, v, L, D }),
    [geometry, fluid, v, L, D],
  );

  const derived = useMemo(
    () => ({
      Re: reynolds(params),
      Pr: prandtl(fluid),
      Sc: schmidt(params),
      Nu: nusselt(params),
      Sh: sherwood(params),
      h: hOf(params),
      hm: hmOf(params),
      note: validity(params),
    }),
    [params, fluid],
  );

  const preset = PRESETS.find((p) => p.id === presetId);
  const touch = <T,>(setter: (v: T) => void) => (val: T) => {
    setter(val);
    setPresetId('');
  };

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The two films"
            subtitle="Every correlation is a report on how thin the flow has shaved them."
            right={
              <div className="w-28 shrink-0">
                <Segmented<'2d' | '3d'>
                  value={dim}
                  options={[
                    { value: '2d', label: '2D', title: 'The films in cross-section' },
                    { value: '3d', label: '3D', title: 'The films as shells around the body — drag to orbit' },
                  ]}
                  onChange={setDim}
                />
              </div>
            }
          >
            {dim === '2d' ? (
              <CorrCanvas params={params} dark={dark} />
            ) : (
              <Corr3DCanvas params={params} dark={dark} />
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Amber: the thermal boundary layer, δ ≈ L/Nu. Cyan: the concentration
              boundary layer, δ ≈ L/Sh. In air they ride together (Pr ≈ Sc ≈ 1);
              switch the fluid to water and watch them split by (Sc/Pr)^⅓ ≈ 5 — the
              mass film is the thinnest thing in the flow, and h ≈ k/δ is why that
              matters.
            </p>
          </Panel>
        </div>

        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<CorrGeometry>
                label="Geometry"
                value={geometry}
                options={[
                  { value: 'plate', label: 'Plate' },
                  { value: 'cylinder', label: 'Cyl.' },
                  { value: 'sphere', label: 'Sphere' },
                  { value: 'tube', label: 'Tube' },
                ]}
                onChange={touch(setGeometry)}
              />
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fluid
                </span>
                <select
                  value={fluidName}
                  onChange={(e) => {
                    const f = FLUIDS.find((ff) => ff.name === e.target.value);
                    if (f) {
                      setFluidName(f.name);
                      setD(f.D);
                      setPresetId('');
                    }
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {FLUIDS.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} — Pr = {Number(prandtl(f).toPrecision(2))}
                    </option>
                  ))}
                </select>
              </div>
              <Slider
                label="Velocity, v"
                unit="m/s"
                value={v}
                min={1e-3}
                max={50}
                log
                format={sci}
                onChange={touch(setV)}
              />
              <Slider
                label={geometry === 'plate' ? 'Plate length, L' : geometry === 'tube' ? 'Tube diameter, L' : 'Diameter, L'}
                value={L}
                min={1e-4}
                max={1}
                log
                format={lengthM}
                onChange={touch(setL)}
              />
              <Slider
                label="Solute diffusivity, D"
                unit="m²/s"
                value={D}
                min={1e-11}
                max={1e-4}
                log
                format={sci}
                onChange={touch(setD)}
                hint="Sets Sc — and with it, how much thinner the mass film is than the thermal one."
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
                      setGeometry(pr.geometry);
                      setFluidName(pr.fluid.name);
                      setV(pr.v);
                      setL(pr.L);
                      setD(pr.D);
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
                  setGeometry(DEFAULT_PRESET.geometry);
                  setFluidName(DEFAULT_PRESET.fluid.name);
                  setV(DEFAULT_PRESET.v);
                  setL(DEFAULT_PRESET.L);
                  setD(DEFAULT_PRESET.D);
                  setPresetId(DEFAULT_PRESET.id);
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
                label={<InlineMath math="\mathrm{Re}" />}
                value={sci(derived.Re)}
                unit=""
                hint="the flow's vigour"
              />
              <Stat
                label={<InlineMath math="\mathrm{Pr} \;/\; \mathrm{Sc}" />}
                value={`${sci(derived.Pr)} / ${sci(derived.Sc)}`}
                unit=""
                hint="momentum vs heat / momentum vs mass"
              />
              <Stat
                label={<InlineMath math="\mathrm{Nu}" />}
                value={sci(derived.Nu)}
                unit=""
                tone="warm"
                hint="how many times better than stagnant, for heat"
              />
              <Stat
                label={<InlineMath math="\mathrm{Sh}" />}
                value={sci(derived.Sh)}
                unit=""
                tone="accent"
                hint="the same question, for mass"
              />
              <Stat
                label={<InlineMath math="h = \mathrm{Nu}\,k/L" />}
                value={sci(derived.h)}
                unit="W/m²·K"
                hint="feed this to the law-of-cooling module"
              />
              <Stat
                label={<InlineMath math="h_m = \mathrm{Sh}\,D/L" />}
                value={sci(derived.hm)}
                unit="m/s"
                hint="the mass twin, at last with a number"
              />
            </div>

            {derived.note && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">Validity: </span>
                {derived.note}
              </p>
            )}

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="The chart, alive">
            <CorrChart params={params} dark={dark} />
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="What Nu and Sh are"
            latex={String.raw`\mathrm{Nu} = \frac{hL}{k} \approx \frac{L}{\delta_T} \qquad \mathrm{Sh} = \frac{h_m L}{D} \approx \frac{L}{\delta_C}`}
            terms={[
              { symbol: '\\mathrm{Nu}', meaning: 'transfer relative to a stagnant film of size L', maps: 'amber film' },
              { symbol: '\\mathrm{Sh}', meaning: 'the identical question for mass', maps: 'cyan film' },
            ]}
            note="Nu = 1 is pure conduction; everything above 1 is the flow shaving the film. h ≈ k/δ, so the whole business of convection engineering is δ-management: fans, stirring, and turbulence are all film-thinning devices."
          />
          <EquationCard
            title="The stagnant-sphere theorem"
            latex={String.raw`\mathrm{Re} \to 0:\quad \mathrm{Nu} = 2 \quad\Longleftrightarrow\quad h = \frac{k}{R}`}
            note="Not a fit — the exact conduction solution for a sphere in an infinite medium (the verify suite derives it independently from the conduction library). Ranz–Marshall is this theorem plus a flow correction, and every droplet, bubble, and suspended cell lives near the 2."
            defaultOpen={false}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="One correlation, two coefficients"
            latex={String.raw`\mathrm{Nu} = f(\mathrm{Re}, \mathrm{Pr}) \;\;\xrightarrow{\;\mathrm{Pr}\,\to\,\mathrm{Sc}\;}\;\; \mathrm{Sh} = f(\mathrm{Re}, \mathrm{Sc}) \qquad \frac{\mathrm{Sh}}{\mathrm{Nu}} = \left(\frac{\mathrm{Sc}}{\mathrm{Pr}}\right)^{1/3}`}
            note="The heat–mass analogy's final form (Chilton–Colburn): measure one coefficient, transcribe the other. The ⅓-power ratio is exact for the Pr^⅓ correlations (the plate family here) and a good approximation whenever Nu is well above the additive constant — near the sphere's 2 or the cylinder's 0.3 it breaks down, and Dittus–Boelter's 0.4 exponent shifts it. In water Sc/Pr = α/D ≈ 144, so Sh ≈ 5 Nu — the mass film is always the thin one, and mass transfer at surfaces is usually the bottleneck."
            defaultOpen={true}
          />
          <EquationCard
            title="Reading a correlation responsibly"
            latex={String.raw`\mathrm{Nu} = C\,\mathrm{Re}^m \mathrm{Pr}^n \;\; \text{(within its range, for its geometry, with ITS length scale)}`}
            note="Three ways to get burned: using L when the correlation wants a diameter, using a correlation outside its Re range (the validity note above watches for this), and forgetting that h describes only the film — the inside of the object is a separate (Biot) conversation. Draw the picture first."
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
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Module 4 · Convection
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Nu &amp; Sh — the correlation table, computed live
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Nu &amp; Sh Correlations
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Convection coefficients are not looked up in nature — they are looked up in
        correlations. This page computes the classics live, draws the two boundary
        layers they secretly describe, and converts every heat answer into its mass
        twin with one substitution. The chart you used to squint at now moves when
        you do.
      </p>
    </header>
  );
}
