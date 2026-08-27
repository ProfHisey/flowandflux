import { useMemo, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  budget,
  dominant,
  elements,
  heatRate,
  totalResistance,
  uValue,
  type WallLayer,
  type WallParams,
} from '../../lib/network';
import { lengthM, sci } from '../../lib/format';
import { WallCanvas } from './WallCanvas';
import { Wall3DCanvas } from './Wall3DCanvas';
import { DEFAULT_PARAMS, MATERIALS, PRESETS } from './presets';

export function WallModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<WallParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>('double');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const set = (patch: Partial<WallParams>) => {
    setParams((p) => ({ ...p, ...patch }));
    setPresetId('');
  };
  const setLayer = (i: number, patch: Partial<WallLayer>) => {
    setParams((p) => ({
      ...p,
      layers: p.layers.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    }));
    setPresetId('');
  };
  const removeLayer = (i: number) => {
    setParams((p) => ({ ...p, layers: p.layers.filter((_, j) => j !== i) }));
    setPresetId('');
  };
  const addLayer = () => {
    setParams((p) => ({
      ...p,
      layers: [...p.layers, { name: 'Foam', k: 0.03, L: 0.02 }],
    }));
    setPresetId('');
  };

  const preset = PRESETS.find((p) => p.id === presetId);

  const derived = useMemo(() => {
    const els = elements(params);
    const dom = els.length ? dominant(params) : null;
    return {
      els,
      R: totalResistance(params),
      Q: heatRate(params),
      U: uValue(params),
      qpp: heatRate(params) / params.A,
      dom,
      shares: budget(params),
    };
  }, [params]);

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The wall and its circuit"
            subtitle="Drawn from the same numbers, so they cannot disagree."
            right={
              <div className="w-28 shrink-0">
                <Segmented<'2d' | '3d'>
                  ariaLabel="View dimension"
                  value={dim}
                  options={[
                    { value: '2d', label: '2D', title: 'The wall with its circuit diagram — drag to pan, scroll to zoom' },
                    { value: '3d', label: '3D', title: 'The layered slab in space — drag to orbit' },
                  ]}
                  onChange={setDim}
                />
              </div>
            }
          >
            {derived.els.length > 0 ? (
              dim === '2d' ? (
                <WallCanvas params={params} dark={dark} />
              ) : (
                <Wall3DCanvas params={params} dark={dark} />
              )
            ) : (
              <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                The stack is empty — add a layer or enable a film on the right.
              </p>
            )}

            {/* The ΔT budget: the punchline as a bar. */}
            {derived.els.length > 0 && derived.dom && (
              <div className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Where the ΔT goes
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    ΔT<sub>i</sub> = Q·R<sub>i</sub> — resistance is a claim on the budget
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={
                    'Temperature-drop budget: ' +
                    derived.els
                      .map((e, i) => `${e.label} ${(derived.shares[i] * 100).toFixed(0)} percent`)
                      .join(', ')
                  }
                  className="flex h-7 w-full overflow-hidden rounded-md"
                >
                  {derived.els.map((e, i) => {
                    const isDom = i === derived.dom!.index;
                    const pct = derived.shares[i] * 100;
                    return (
                      <div
                        key={i}
                        title={`${e.label}: ${pct.toFixed(1)}% of ΔT (R = ${sci(e.R)} K/W)`}
                        style={{ width: `${pct}%` }}
                        className={
                          'flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold ' +
                          (isDom
                            ? 'bg-amber-400 text-amber-950 dark:bg-amber-500'
                            : e.kind === 'film'
                              ? 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-200'
                              : 'bg-sky-300 text-sky-950 dark:bg-sky-800 dark:text-sky-100')
                        }
                      >
                        {pct > 9 ? `${e.label} ${pct.toFixed(0)}%` : ''}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">
                  The amber segment is the dominant resistor —{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-300">
                    {derived.els[derived.dom.index].label}
                  </strong>{' '}
                  claims {(derived.dom.share * 100).toFixed(0)}% of the whole temperature
                  drop. In a series circuit, improving anything else barely matters.
                </p>
              </div>
            )}
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="Q" />}
                value={sci(derived.Q)}
                unit="W"
                tone="warm"
                hint="one heat rate through every element"
              />
              <Stat
                label={<InlineMath math="R_{tot}" />}
                value={sci(derived.R)}
                unit="K/W"
                tone="accent"
                hint="series resistances simply add"
              />
              <Stat
                label={<InlineMath math="U = 1/R_{tot}A" />}
                value={sci(derived.U)}
                unit="W/m²·K"
                hint="the number window catalogs quote"
              />
              <Stat
                label={<InlineMath math="q''" />}
                value={sci(derived.qpp)}
                unit="W/m²"
                hint="Q / A"
              />
              <Stat
                label={<InlineMath math="\Delta T" />}
                value={sci(params.Tin - params.Tout)}
                unit="°C"
                hint="the whole budget being divided"
              />
              <Stat
                label="Dominant ΔT"
                value={
                  derived.dom
                    ? sci((params.Tin - params.Tout) * derived.dom.share)
                    : '—'
                }
                unit="°C"
                hint={derived.dom ? `across ${derived.els[derived.dom.index].label}` : ''}
              />
            </div>

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                this setup works out to {preset.check} — try it on paper.
              </p>
            )}
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="The stack" subtitle="Hot side on the left, cold side on the right.">
            <div className="space-y-4">
              {params.layers.map((l, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-slate-200 p-2.5 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Layer ${i + 1} material`}
                      value={l.name}
                      onChange={(e) => {
                        const m = MATERIALS.find((mm) => mm.name === e.target.value);
                        if (m) setLayer(i, { name: m.name, k: m.k });
                      }}
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {MATERIALS.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} — k = {m.k}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeLayer(i)}
                      aria-label={`Remove ${l.name} layer`}
                      className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:text-red-600 dark:border-slate-700 dark:hover:text-red-400"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <Slider
                    label="Thickness"
                    value={l.L}
                    min={1e-3}
                    max={0.3}
                    log
                    format={lengthM}
                    onChange={(v) => setLayer(i, { L: v })}
                  />
                </div>
              ))}
              {params.layers.length < 6 && (
                <button
                  type="button"
                  onClick={addLayer}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
                >
                  <Plus size={13} /> Add a layer
                </button>
              )}

              <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={params.useFilmIn}
                    onChange={(e) => set({ useFilmIn: e.target.checked })}
                    className="h-4 w-4 accent-sky-600"
                  />
                  Hot-side film (R = 1/h·A)
                </label>
                {params.useFilmIn && (
                  <Slider
                    label="h, hot side"
                    unit="W/m²·K"
                    value={params.hIn}
                    min={1}
                    max={20000}
                    log
                    format={sci}
                    onChange={(v) => set({ hIn: v })}
                  />
                )}
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={params.useFilmOut}
                    onChange={(e) => set({ useFilmOut: e.target.checked })}
                    className="h-4 w-4 accent-sky-600"
                  />
                  Cold-side film
                </label>
                {params.useFilmOut && (
                  <Slider
                    label="h, cold side"
                    unit="W/m²·K"
                    value={params.hOut}
                    min={1}
                    max={20000}
                    log
                    format={sci}
                    onChange={(v) => set({ hOut: v })}
                  />
                )}
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-3 dark:border-slate-800">
                <Slider
                  label="Hot-side fluid, T-in"
                  unit="°C"
                  value={params.Tin}
                  min={-20}
                  max={150}
                  step={0.5}
                  onChange={(v) => set({ Tin: v })}
                />
                <Slider
                  label="Cold-side fluid, T-out"
                  unit="°C"
                  value={params.Tout}
                  min={-20}
                  max={100}
                  step={0.5}
                  onChange={(v) => set({ Tout: v })}
                />
                <Slider
                  label="Area, A"
                  unit="m²"
                  value={params.A}
                  min={0.1}
                  max={100}
                  log
                  format={sci}
                  onChange={(v) => set({ A: v })}
                />
              </div>
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
                  setPresetId('double');
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
            title="Series thermal circuit"
            latex={String.raw`Q = \frac{T_{in} - T_{out}}{\sum_i R_i}, \qquad R_{layer} = \frac{L}{kA}, \qquad R_{film} = \frac{1}{hA}`}
            terms={[
              { symbol: 'Q', meaning: 'the one heat rate through every element in the chain', maps: 'circuit arrow' },
              { symbol: 'R_i', meaning: 'each layer or film, as a resistor', maps: 'the zigzags' },
            ]}
            note="Valid at steady state, one-dimensional, no generation — the same three conditions that made Q constant through the wall in the Fourier module. Films and solid layers are interchangeable citizens of the circuit: the h from the law-of-cooling module is just a resistor here."
          />

          <EquationCard
            title="The ΔT budget"
            latex={String.raw`\Delta T_i = Q\,R_i \qquad\Longrightarrow\qquad \frac{\Delta T_i}{\Delta T_{total}} = \frac{R_i}{R_{tot}}`}
            note="The reason to draw the circuit at all: the temperature drop distributes in proportion to resistance, so the dominant resistor is visible as the biggest drop — and improving anything else is wasted effort. Engineering a composite wall is finding the budget hog. (The same logic, with R_D = ΔC/J, prices layered membranes in mass transfer.)"
            defaultOpen={false}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Parallel paths"
            latex={String.raw`\frac{1}{R_{parallel}} = \sum_i \frac{1}{R_i}`}
            note="A window in a wall, a stud through the insulation, a capillary through tissue: side-by-side paths add conductances, and the LEAKIEST path dominates — the mirror image of the series rule. A thermal short through good insulation can undo most of it, which is why builders lose sleep over studs. An interactive parallel builder is a natural extension of this page."
            defaultOpen={false}
          />

          <EquationCard
            title="The U-value"
            latex={String.raw`U \equiv \frac{1}{R_{tot}\,A} \qquad [\mathrm{W/m^2K}] \qquad Q = U\,A\,\Delta T`}
            note="Industry's way of quoting 1/R per square meter: single glazing ≈ 5.9, double ≈ 1.6–2.8, a code-compliant insulated wall ≈ 0.3 W/m²K. This page's circuit is conduction-only, so its double-glazing number lands at the optimistic end: in a real unit, radiation between the panes acts in parallel with conduction across the gap and eats roughly half the gap's benefit (air-filled units measure nearer 2.8; the 1.6-and-below club is low-e coatings and argon, which exist precisely to suppress that radiation). When a datasheet quotes U, it is quoting this circuit plus that radiation path."
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
          Module 2 · Resistance networks
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Composite walls as circuits
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Wall
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Stack layers, add the convection films, and the equivalent circuit draws itself:
        every layer a resistor, one Q through them all, and the temperature drop divided
        in proportion to resistance. The game is finding the resistor that eats the
        budget — then noticing that nothing else matters.
      </p>
    </header>
  );
}
