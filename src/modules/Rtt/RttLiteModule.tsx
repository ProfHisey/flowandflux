import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Pause, Play, RotateCcw, Zap } from 'lucide-react';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import { sci } from '../../lib/format';
import { RttCanvas, type RttStats } from './RttCanvas';
import { Rtt3DCanvas } from './Rtt3DCanvas';
import { RttChart } from './RttChart';
import { DUCT_AREA, PRESETS, presetParams, RHO_WATER, type RttParams } from './presets';

/**
 * The first-day version of "Where you draw the box": water only, b = 1, no
 * device in the box, no correlation panel, no money. One idea — what goes
 * in either comes out or is still inside — and one equation, which is the
 * first one the course meets. The same canvas and the same ledger as the
 * full module; only the page around them is smaller. A link at the bottom
 * hands the reader on when they are ready for the other three faces.
 */
export function RttLiteModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<RttParams>(presetParams('surges'));
  const [presetId, setPresetId] = useState('surges');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [stats, setStats] = useState<RttStats | null>(null);
  const [history, setHistory] = useState<RttStats[]>([]);

  const set = <K extends keyof RttParams>(key: K, value: RttParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };
  const onBox = useCallback((box0: number, box1: number) => {
    setParams((p) => ({ ...p, box0, box1 }));
  }, []);
  const onStats = useCallback((s: RttStats) => {
    setStats(s);
    setHistory((h) => (h.length > 220 ? [...h.slice(-180), s] : [...h, s]));
  }, []);
  useEffect(() => {
    setHistory([]);
    setStats(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTick, params.mdot, params.flowFluct, params.L, params.tauC, params.parabolic]);

  const uIn = params.mdot / (RHO_WATER * DUCT_AREA);
  const preset = PRESETS.find((pr) => pr.id === presetId);
  const rate = (v: number | undefined) => (v === undefined ? '—' : fmt(v));

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="Water through a box"
            subtitle="Whatever comes in through the left face either goes out through the right face, or is still inside. That is the whole idea."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'The duct and the box — drag a face of the box to move it' },
                      { value: '3d', label: '3D', title: 'The box has six faces; water crosses two of them — drag to orbit' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <div className="w-36">
                  <Segmented<'plug' | 'parabolic'>
                    ariaLabel="Velocity profile"
                    value={params.parabolic ? 'parabolic' : 'plug'}
                    options={[
                      { value: 'plug', label: 'Plug', title: 'Everything moves at the same speed' },
                      { value: 'parabolic', label: 'Parabolic', title: 'Faster in the middle, slower at the walls — the dye stretches' },
                    ]}
                    onChange={(v) => set('parabolic', v === 'parabolic')}
                  />
                </div>
                <IconButton label="Restart: refill the duct and re-tag the dye" onClick={() => setResetTick((t) => t + 1)}>
                  <Zap size={15} />
                </IconButton>
                <IconButton label={running ? 'Pause' : 'Play'} onClick={() => setRunning((r) => !r)}>
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
              </div>
            }
          >
            {dim === '2d' ? (
              <RttCanvas params={params} running={running} dark={dark} resetTick={resetTick} onStats={onStats} onBoxChange={onBox} lite />
            ) : (
              <Rtt3DCanvas params={params} running={running} dark={dark} resetTick={resetTick} />
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {dim === '2d'
                ? 'The dashed box is the region we are keeping accounts for. Drag either colored face to change it. The ringed dots are the water that was inside when we started watching — follow them out. The chips above the box are counts: how much crossed in, how much crossed out, and how the amount inside is changing. Nothing is being calculated from a formula; the formula is what the counts obey.'
                : 'The box has six faces. Water crosses only two of them; nothing passes through the top, bottom, or sides. Rotate until you believe it — it is why the bookkeeping only ever needs an "in" and an "out".'}
            </p>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="The accounts" subtitle="Three counts, made independently. Watch them agree.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="made inside" value={rate(stats?.source)} unit="kg/s" tone="warm" hint="water is neither created nor destroyed: zero, always" />
              <Stat label="piling up inside" value={rate(stats?.storage)} unit="kg/s" hint="the amount in the box, differenced" />
              <Stat label="crossing in" value={rate(stats?.influx)} unit="kg/s" tone="accent" hint="counted at the left face" />
              <Stat label="crossing out" value={rate(stats?.outflux)} unit="kg/s" hint="counted at the right face" />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs tabular-nums dark:bg-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">
                piling up = in − out ⟹ {stats ? fmt(stats.storage) : '—'} = {stats ? fmt(stats.influx - stats.outflux) : '—'} kg/s
              </span>
              <span className="ml-auto text-[11px] font-normal text-slate-500 dark:text-slate-400">
                to every decimal, every frame
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat label="water in the box" value={fmt(stats?.massInBox ?? 0)} unit="kg" hint="rises when in > out, falls when out > in" />
              <Stat label="the dye" value={stats ? `${stats.tagInBox} in · ${stats.tagCount - stats.tagInBox} gone` : '—'} unit="" hint="the water that was inside when we started" />
              <Stat label="speed" value={uIn.toFixed(2)} unit="m/s" hint={`ṁ/ρA in a 10 cm² duct — ${(params.L / uIn).toFixed(1)} s end to end`} />
            </div>
            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Check: </span>
                {preset.check}.
              </p>
            )}
          </Panel>

          <Panel title="Over time" subtitle="In and out at the two faces. When they differ, water is piling up — or draining.">
            <RttChart history={history} params={params} dark={dark} />
          </Panel>
        </div>

        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Slider
                label="Water flow, ṁ"
                unit="kg/s"
                value={params.mdot}
                min={0.02}
                max={1}
                log
                format={(v) => sci(v)}
                onChange={(v) => set('mdot', v)}
                hint="How much water comes in per second, on average."
              />
              <Slider
                label="Gusts"
                unit="± %"
                value={params.flowFluct * 100}
                min={0}
                max={90}
                step={5}
                format={(v) => v.toFixed(0)}
                onChange={(v) => set('flowFluct', v / 100)}
                hint="How much the inflow swings. Zero is a perfectly steady tap."
              />
              <Slider
                label="How long a gust lasts"
                unit="s"
                value={params.tauC}
                min={0.2}
                max={5}
                log
                format={(v) => Number(v.toPrecision(2)).toString()}
                onChange={(v) => set('tauC', v)}
              />
              <Slider
                label="Duct length, L"
                unit="m"
                value={params.L}
                min={0.4}
                max={3}
                log
                format={(v) => Number(v.toPrecision(3)).toString()}
                onChange={(v) => set('L', v)}
              />
              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">The box</p>
                <div className="space-y-5">
                  <Slider label="Left face" unit="× L" value={params.box0} min={0.05} max={0.87} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set('box0', Math.min(v, params.box1 - 0.08))} hint="Or drag the indigo grip on the picture." />
                  <Slider label="Right face" unit="× L" value={params.box1} min={0.13} max={0.95} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set('box1', Math.max(v, params.box0 + 0.08))} hint="Or drag the amber grip." />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Try these" subtitle="Two settings, one lesson each.">
            <div className="space-y-2">
              {PRESETS.filter((pr) => pr.face === 'mass').map((pr) => {
                const active = pr.id === presetId;
                return (
                  <button
                    key={pr.id}
                    aria-pressed={active}
                    type="button"
                    onClick={() => {
                      setParams(presetParams(pr.id));
                      setPresetId(pr.id);
                      setResetTick((t) => t + 1);
                    }}
                    className={
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                      (active
                        ? 'border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/40'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50')
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{pr.name}</span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">{pr.blurb}</p>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setParams(presetParams('surges'));
                  setPresetId('surges');
                  setResetTick((t) => t + 1);
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EquationCard
          title="The first balance"
          latex={String.raw`\underbrace{0}_{\text{made inside}} \;=\; \underbrace{\frac{dM_{box}}{dt}}_{\text{piling up}} \;+\; \underbrace{\dot m_{out}}_{\text{crossing out}} \;-\; \underbrace{\dot m_{in}}_{\text{crossing in}}`}
          terms={[
            { symbol: 'M_{box}', meaning: 'the mass of water inside the box right now', maps: 'water in the box' },
            { symbol: '\\dot m_{in}', meaning: 'kilograms per second crossing the left face', maps: 'crossing in' },
            { symbol: '\\dot m_{out}', meaning: 'kilograms per second crossing the right face', maps: 'crossing out' },
          ]}
          note="Read it in words first: nothing is made inside, so whatever the box gains it must have taken in, and whatever it loses it must have let out. That is the entire content of conservation of mass, and every balance in this subject — for heat, for momentum, for a dissolved drug — is this sentence with a different noun. The dashed box is called a control volume; choosing where to draw it is always the first step."
        />
        <EquationCard
          title="When you are ready for the general version"
          latex={String.raw`\frac{dB_{sys}}{dt} = \frac{d}{dt}\int_{CV}\rho\,b\,dV + \oint_{CS}\rho\,b\,(\mathbf v\cdot\mathbf n)\,dA`}
          note={
            <>
              The same bookkeeping for any property b carried by the flow — momentum, energy, even
              money — is the Reynolds transport theorem. It is what the full module runs, with a
              heater, a push, and a market inside the box.{' '}
              <a href="#rtt" className="inline-flex items-center gap-1 font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:decoration-sky-700 dark:hover:text-sky-300">
                Where you draw the box <ArrowRight size={13} />
              </a>
            </>
          }
          defaultOpen={false}
        />
      </div>
    </div>
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a < 1e-9) return '0.000';
  if (a >= 1e5 || a < 1e-2) return v.toExponential(2);
  return Number(v.toPrecision(3)).toString();
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          Start here · The first balance
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          In, out, and what is left
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Box
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Draw a box around part of a flow and keep accounts. Water crosses in, water crosses
        out, and the difference is what piles up inside — that is the first equation in the
        subject, and the last one, because every balance you will write is this one with a
        different noun in it. Drag the box and watch the accounts move while the water does
        not care.
      </p>
    </header>
  );
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
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
          ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
