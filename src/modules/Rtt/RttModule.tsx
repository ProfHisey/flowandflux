import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Zap } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import { steadyOutlet, type RttFace } from '../../lib/rtt';
import { sci } from '../../lib/format';
import { RttCanvas, type RttStats } from './RttCanvas';
import { Rtt3DCanvas } from './Rtt3DCanvas';
import { RttChart } from './RttChart';
import {
  CP_WATER,
  DEFAULT_PARAMS,
  DEFAULT_PRESET,
  DUCT_AREA,
  FACE_DEFAULTS,
  PRESETS,
  presetParams,
  RHO_WATER,
  type RttParams,
} from './presets';

/**
 * The Reynolds transport theorem, run as one machine with four costumes.
 * b = 1 is continuity, b = u is the momentum balance, b = T is the first law
 * for an open system, and b = price is a brokerage statement — whose two
 * returns differ by exactly the control-surface term. The box is draggable
 * because the theorem is a statement about where you draw it.
 */
export function RttModule({ dark }: { dark: boolean }) {
  const [params, setParams] = useState<RttParams>(DEFAULT_PARAMS);
  const [presetId, setPresetId] = useState<string>('heater');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [stats, setStats] = useState<RttStats | null>(null);
  const [history, setHistory] = useState<RttStats[]>([]);

  const face = params.face;

  const set = <K extends keyof RttParams>(key: K, value: RttParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
    setPresetId('');
  };
  // Each face opens on its named preset, so the highlighted example and the
  // sliders always agree — the face defaults alone had the surges on while
  // the chip promised a steady stream.
  const switchFace = (f: RttFace) => {
    setParams(presetParams(DEFAULT_PRESET[f]));
    setPresetId(DEFAULT_PRESET[f]);
    setResetTick((t) => t + 1);
  };
  const onBox = useCallback((box0: number, box1: number) => {
    setParams((p) => ({ ...p, box0, box1 }));
  }, []);
  const onStats = useCallback((s: RttStats) => {
    setStats(s);
    setHistory((h) => (h.length > 220 ? [...h.slice(-180), s] : [...h, s]));
  }, []);
  // A reseed clears the trace: the history is the current experiment's.
  useEffect(() => {
    setHistory([]);
    setStats(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTick, face, params.mdot, params.bIn, params.bFluct, params.flowFluct, params.rho, params.source, params.L, params.tauC, params.V0, params.parabolic]);

  const derived = useMemo(() => {
    const uIn = face === 'wealth' ? 1 : params.mdot / (RHO_WATER * DUCT_AREA);
    const predicted =
      face === 'energy' ? steadyOutlet(params.bIn, params.mdot, params.source / CP_WATER)
        : face === 'momentum' ? steadyOutlet(uIn, params.mdot, params.source)
          : undefined;
    const transit = params.L / uIn;
    return { uIn, predicted, transit };
  }, [face, params]);

  const preset = PRESETS.find((pr) => pr.id === presetId);
  const f = faceText(face);
  const scale = face === 'energy' ? CP_WATER : 1;
  const rate = (v: number | undefined) => (v === undefined ? '—' : fmtRate(v * scale));

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title={f.title}
            subtitle={f.subtitle}
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'The duct, the box, and the ledger — drag a face of the box to move it; drag elsewhere to pan, scroll to zoom' },
                      { value: '3d', label: '3D', title: 'The box as a closed surface: six faces, two active — drag to orbit' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <div className="w-36">
                  <Segmented<'plug' | 'parabolic'>
                    ariaLabel="Velocity profile"
                    value={params.parabolic ? 'parabolic' : 'plug'}
                    options={[
                      { value: 'plug', label: 'Plug', title: 'Every parcel at the mean speed' },
                      { value: 'parabolic', label: 'Parabolic', title: 'The 2D-channel profile: the dye shears, the core arrives first' },
                    ]}
                    onChange={(v) => set('parabolic', v === 'parabolic')}
                  />
                </div>
                <IconButton label="Restart: refill the duct, re-tag the system, reset the account" onClick={() => setResetTick((t) => t + 1)}>
                  <Zap size={15} />
                </IconButton>
                <IconButton label={running ? 'Pause' : 'Play'} onClick={() => setRunning((r) => !r)}>
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
              </div>
            }
          >
            {dim === '2d' ? (
              <RttCanvas params={params} running={running} dark={dark} resetTick={resetTick} onStats={onStats} onBoxChange={onBox} />
            ) : (
              <Rtt3DCanvas params={params} running={running} dark={dark} resetTick={resetTick} />
            )}
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {dim === '2d'
                ? 'Drag either colored face of the dashed box. The source does not move; storage and flux trade off. The ringed parcels are the system — whatever was inside when it was tagged — and the chips are counts, not formulas: the device\'s output, the contents differenced, and the parcels crossing each face with the b they carry. That they add up is the theorem.'
                : 'The surface integral is over all six faces. Four of them have v·n = 0 — nothing crosses a side wall — which is why every textbook quietly collapses the integral to inlet plus outlet. Rotate until the side walls convince you.'}
            </p>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="The ledger" subtitle="Four terms, three independent measurements, one identity. Every value carries its units.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label={<span>source · <InlineMath math="dB_{sys}/dt" /></span>} value={rate(stats?.source)} unit={f.rateUnit} tone="warm" hint={f.sourceHint} />
              <Stat label={<span>storage · <InlineMath math="\tfrac{d}{dt}\!\int_{CV}\rho b\,dV" /></span>} value={rate(stats?.storage)} unit={f.rateUnit} hint="the contents, differenced frame to frame" />
              <Stat label={<span>in · <InlineMath math="-\oint_{in}\rho b\,(v\cdot n)\,dA" /></span>} value={rate(stats?.influx)} unit={f.rateUnit} tone="accent" hint="counted through the upstream face" />
              <Stat label={<span>out · <InlineMath math="\oint_{out}\rho b\,(v\cdot n)\,dA" /></span>} value={rate(stats?.outflux)} unit={f.rateUnit} hint="counted through the downstream face" />
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs tabular-nums dark:bg-slate-800/60">
              <span className="text-slate-600 dark:text-slate-400">
                source − (storage + out − in) = {stats ? fmtRate(stats.residual * scale) : '—'} {f.rateUnit}
              </span>
              <span className="ml-auto text-[11px] font-normal text-slate-500 dark:text-slate-400">
                zero to floating point, every frame — the bookkeeping, not a fit
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {face === 'mass' && (
                <>
                  <Stat label="ṁ in" value={fmtRate(stats?.mIn ?? params.mdot)} unit="kg/s" hint="through the upstream face" />
                  <Stat label="ṁ out" value={fmtRate(stats?.mOut ?? params.mdot)} unit="kg/s" hint="through the downstream face — the same, delayed" />
                  <Stat label="mass in the box" value={fmtRate(stats?.massInBox ?? 0)} unit="kg" hint="rises when in > out, falls when out > in" />
                </>
              )}
              {face === 'momentum' && (
                <>
                  <Stat label={<InlineMath math="u_{out}\ \text{measured}" />} value={(stats?.bOutAvg ?? derived.uIn).toFixed(3)} unit="m/s" hint="mass-weighted, at the downstream face" />
                  <Stat
                    label={<InlineMath math="u_{in} + F/\dot m" />}
                    value={derived.predicted!.toFixed(3)}
                    unit="m/s"
                    tone="accent"
                    hint={
                      stats && stats.meanN > 0 && Math.abs(stats.cov / stats.meanN) > 1e-3
                        ? `for a steady inlet. The gusts shift the mass-weighted inlet by ⟨ṁ′u′⟩/ṁ = ${(stats.cov / stats.meanN).toFixed(3)} m/s — expect ≈ ${(derived.predicted! + stats.cov / stats.meanN).toFixed(3)}`
                        : 'the steady momentum balance, by hand'
                    }
                  />
                  <Stat label="momentum flux jump" value={fmtRate(((stats?.outflux ?? 0) - (stats?.influx ?? 0)))} unit="N" hint="out − in: equals the push once storage averages out" />
                </>
              )}
              {face === 'energy' && (
                <>
                  <Stat label={<InlineMath math="T_{out}\ \text{measured}" />} value={(stats?.bOutAvg ?? params.bIn).toFixed(2)} unit="°C" hint="mass-weighted, at the downstream face" />
                  <Stat
                    label={<InlineMath math="T_{in} + Q/\dot m c_p" />}
                    value={derived.predicted!.toFixed(2)}
                    unit="°C"
                    tone="accent"
                    hint={
                      stats && stats.meanN > 0 && Math.abs(stats.cov / stats.meanN) > 0.05
                        ? `for a steady inlet. The surges carry the hot pulses: mass-weighted T_in runs ⟨ṁ′T′⟩/ṁ = ${(stats.cov / stats.meanN).toFixed(2)} K above the mean — expect ≈ ${(derived.predicted! + stats.cov / stats.meanN).toFixed(2)} °C`
                        : 'the first law for an open system, by hand'
                    }
                  />
                  <Stat label="enthalpy flux jump" value={fmtRate(((stats?.outflux ?? 0) - (stats?.influx ?? 0)) * CP_WATER)} unit="W" hint="out − in: equals the heater once storage averages out" />
                </>
              )}
              {face === 'wealth' && (
                <>
                  <Stat label="account value" value={`$${fmtMoney(stats?.V ?? params.V0)}`} unit="" hint={`${stats ? fmtMoney(stats.deposits) : '0'} in · ${stats ? fmtMoney(stats.withdrawals) : '0'} out since restart`} />
                  <Stat label="time-weighted" value={stats && stats.tPhys > 0.05 ? `${(stats.twr * 100).toFixed(2)}` : '—'} unit="%/yr" tone="accent" hint="what a share that stayed earned — the fund" />
                  <Stat label="dollar-weighted" value={stats && stats.tPhys > 0.05 ? `${(stats.dwr * 100).toFixed(2)}` : '—'} unit="%/yr" tone="warm" hint="what your dollars earned, flows and all" />
                  <Stat
                    label="the gap"
                    value={stats && stats.tPhys > 0.05 ? `${((stats.twr - stats.dwr) * 100).toFixed(2)}` : '—'}
                    unit="%/yr"
                    hint={
                      !stats || stats.tPhys < 0.05 ? 'settles over a holding period or two'
                        : Math.abs(stats.twr - stats.dwr) < 0.002 ? 'no daylight: the account is the fund'
                          : stats.twr > stats.dwr ? 'the account earned less than the fund it holds'
                            : 'the account beat the fund it holds'
                    }
                  />
                  <Stat label="price now" value={`$${(stats?.P ?? params.bIn).toFixed(2)}`} unit="" hint={`trend $${(stats?.Ptrend ?? params.bIn).toFixed(2)} — the swing is what the buying tracks`} />
                  <Stat label="holding period" value={params.L.toFixed(1)} unit="yr" hint="every share is sold this long after it was bought" />
                </>
              )}
            </div>

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                {preset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel
            title="The correlation term"
            subtitle="⟨n b⟩ = ⟨n⟩⟨b⟩ + ⟨n′b′⟩ at the inlet. Mean × mean is what a steady-state calculation assumes; the difference is what surges carry."
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat label="mean × mean" value={fmtRate((stats ? stats.meanN * stats.meanB : 0) * scale)} unit={f.rateUnit} hint={f.meanMeanHint} />
              <Stat label="measured ⟨n b⟩" value={fmtRate((stats?.meanNB ?? 0) * scale)} unit={f.rateUnit} hint="what actually crossed, averaged over the window" />
              <Stat
                label="⟨n′b′⟩"
                value={fmtRate((stats?.cov ?? 0) * scale)}
                unit={f.rateUnit}
                tone={Math.abs(stats?.cov ?? 0) * scale > 1e-9 ? 'warm' : 'default'}
                hint={f.covHint}
              />
            </div>
            {face === 'wealth' && stats && stats.meanN > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Average price you paid: <span className="font-mono">${(stats.meanNB / stats.meanN).toFixed(2)}</span> against an average
                price of <span className="font-mono">${stats.meanB.toFixed(2)}</span> over the same window
                — {((stats.meanNB / stats.meanN / stats.meanB - 1) * 100).toFixed(1)}% {stats.meanNB / stats.meanN > stats.meanB ? 'above' : 'below'} it,
                in today&apos;s dollars. That premium, times the flow, is the correlation term.
              </p>
            )}
          </Panel>

          <Panel title="Over time" subtitle="The ledger and the steady balance, since the last restart.">
            <RttChart history={history} params={params} dark={dark} />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<RttFace>
                label="What is b? — the extensive property"
                value={face}
                options={[
                  { value: 'mass', label: 'Mass', title: 'b = 1: continuity' },
                  { value: 'momentum', label: 'Momentum', title: 'b = u: the momentum balance' },
                  { value: 'energy', label: 'Energy', title: 'b = T: the first law, open system' },
                  { value: 'wealth', label: 'Wealth', title: 'b = price: the brokerage statement' },
                ]}
                onChange={switchFace}
              />

              {face !== 'wealth' ? (
                <Slider
                  label="Mass flow, ṁ"
                  unit="kg/s"
                  value={params.mdot}
                  min={0.02}
                  max={1}
                  log
                  format={(v) => sci(v)}
                  onChange={(v) => set('mdot', v)}
                  hint={`Water through a 10 cm² duct: u = ṁ/ρA = ${derived.uIn.toFixed(2)} m/s, ${derived.transit.toFixed(1)} s down the duct.`}
                />
              ) : (
                <>
                  <Slider
                    label="Opening balance, V₀"
                    unit="$"
                    value={params.V0}
                    min={1000}
                    max={100000}
                    log
                    format={(v) => fmtMoney(v)}
                    onChange={(v) => set('V0', v)}
                  />
                  <Slider
                    label="Buying rate, n̄"
                    unit="shares/yr"
                    value={params.mdot}
                    min={0}
                    max={1000}
                    step={5}
                    format={(v) => v.toFixed(0)}
                    onChange={(v) => set('mdot', v)}
                    hint="Zero means no flows at all — and then no control-surface term exists."
                  />
                </>
              )}

              {face === 'energy' && (
                <Slider label="Inlet temperature, T_in" unit="°C" value={params.bIn} min={0} max={80} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set('bIn', v)} />
              )}
              {face === 'wealth' && (
                <Slider label="Starting price, P₀" unit="$/share" value={params.bIn} min={10} max={1000} log format={(v) => v.toFixed(0)} onChange={(v) => set('bIn', v)} />
              )}

              {face === 'momentum' && (
                <Slider label="Push on the contents, F" unit="N" value={params.source} min={0} max={0.5} step={0.005} format={(v) => v.toFixed(3)} onChange={(v) => set('source', v)} hint="A force on whatever is inside the box — a pump section, a fan, gravity down a slope. Momentum's source." />
              )}
              {face === 'energy' && (
                <Slider label="Heater, Q" unit="W" value={params.source} min={0} max={5000} step={10} format={(v) => v.toFixed(0)} onChange={(v) => set('source', v)} hint={`Shared among whatever is inside. Steady ΔT = Q/(ṁ c_p) = ${(params.source / (params.mdot * CP_WATER)).toFixed(2)} K.`} />
              )}
              {face === 'wealth' && (
                <Slider label="Trend return, μ" unit="%/yr" value={params.source * 100} min={-10} max={20} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set('source', v / 100)} hint="The market's gain on every share, in the box or not. Wealth's source — and nothing conserves it." />
              )}

              <Slider
                label={face === 'wealth' ? 'Holding period, τ' : 'Duct length, L'}
                unit={face === 'wealth' ? 'yr' : 'm'}
                value={params.L}
                min={face === 'wealth' ? 0.25 : 0.4}
                max={face === 'wealth' ? 30 : 3}
                log
                format={(v) => Number(v.toPrecision(3)).toString()}
                onChange={(v) => set('L', v)}
                hint={face === 'wealth' ? 'Every share is sold this long after it is bought. On screen, the holding period always takes five seconds.' : undefined}
              />

              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">The fluctuations</p>
                <div className="space-y-5">
                  <Slider
                    label="Inflow surges"
                    unit="± %"
                    value={params.flowFluct * 100}
                    min={0}
                    max={90}
                    step={5}
                    format={(v) => v.toFixed(0)}
                    onChange={(v) => set('flowFluct', v / 100)}
                    hint={face === 'wealth' ? 'How much the buying rate swings.' : 'How much the mass flow swings about its mean.'}
                  />
                  {face === 'energy' && (
                    <Slider label="Inlet temperature swings" unit="± K" value={params.bFluct} min={0} max={15} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set('bFluct', v)} />
                  )}
                  {face === 'wealth' && (
                    <Slider label="Price swing around trend" unit="± %" value={params.bFluct * 100} min={0} max={50} step={1} format={(v) => v.toFixed(0)} onChange={(v) => set('bFluct', v / 100)} hint="One standard deviation of the log price about its trend. It mean-reverts — that is a modeling choice, and the honest one for a 'buy high' story." />
                  )}
                  {(face === 'energy' || face === 'wealth') && (
                    <Slider
                      label="Correlation, ρ"
                      value={params.rho}
                      min={-1}
                      max={1}
                      step={0.05}
                      format={(v) => v.toFixed(2)}
                      onChange={(v) => set('rho', v)}
                      hint={
                        face === 'energy'
                          ? 'Between the surges and the hot pulses. Positive: the surges carry the heat. This is the whole of turbulent transport in one slider.'
                          : 'Between the buying and the price. Positive: you buy when it is dear. Negative: you buy the dips. Zero: the market and your schedule ignore each other.'
                      }
                    />
                  )}
                  {face === 'momentum' && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                      <span className="font-semibold">ρ = 1, locked.</span> Momentum is carried by the very velocity that fluctuates:
                      the flux is ρAu·u, and ⟨u²⟩ = ū² + ⟨u′²⟩ no matter what. A Reynolds stress cannot be switched off.
                    </p>
                  )}
                  {face === 'mass' && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                      <span className="font-semibold">No correlation term.</span> Every parcel carries b = 1, so b′ = 0 and ⟨n′b′⟩ vanishes identically. Mass flux is the one case where mean × mean is the whole story.
                    </p>
                  )}
                  <Slider
                    label="How long a surge lasts"
                    unit={face === 'wealth' ? 'yr' : 's'}
                    value={params.tauC}
                    min={face === 'wealth' ? 0.1 : 0.2}
                    max={face === 'wealth' ? 5 : 5}
                    log
                    format={(v) => Number(v.toPrecision(2)).toString()}
                    onChange={(v) => set('tauC', v)}
                    hint="The correlation time of the fluctuations — how long a gust, a pulse, or a price swing persists."
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">The box</p>
                <div className="space-y-5">
                  <Slider label="Upstream face" unit={face === 'wealth' ? '× τ' : '× L'} value={params.box0} min={0.05} max={0.87} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set('box0', Math.min(v, params.box1 - 0.08))} hint="Or drag the indigo grip on the canvas." />
                  <Slider label="Downstream face" unit={face === 'wealth' ? '× τ' : '× L'} value={params.box1} min={0.13} max={0.95} step={0.01} format={(v) => v.toFixed(2)} onChange={(v) => set('box1', Math.max(v, params.box0 + 0.08))} hint="Or drag the amber grip. On the wealth face this is where a share is sold." />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Example problems" subtitle="Load a setup, then check the numbers by hand.">
            <div className="space-y-2">
              {PRESETS.filter((pr) => pr.face === face).map((pr) => {
                const active = pr.id === presetId;
                return (
                  <button
                    key={pr.id}
                    aria-pressed={active}
                    type="button"
                    onClick={() => {
                      setParams({ ...FACE_DEFAULTS[pr.face], ...pr.params });
                      setPresetId(pr.id);
                      setResetTick((t) => t + 1);
                    }}
                    className={
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors ' +
                      (active
                        ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/40'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800/50')
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{pr.name}</span>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{pr.source}</span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">{pr.blurb}</p>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => switchFace(face)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <RotateCcw size={13} /> Reset this face
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="The theorem"
            latex={String.raw`\frac{dB_{sys}}{dt} = \frac{d}{dt}\int_{CV}\rho\,b\,dV \;+\; \oint_{CS}\rho\,b\,(\mathbf v\cdot\mathbf n)\,dA`}
            terms={[
              { symbol: 'B_{sys}', meaning: 'the extensive property of a fixed set of material — the dye, followed wherever it goes', maps: 'ringed parcels' },
              { symbol: '\\int_{CV}', meaning: 'the same property inside a fixed region — the box, whoever is in it', maps: 'storage chip' },
              { symbol: '\\oint_{CS}', meaning: 'what crosses the boundary, carrying its b with it; v·n picks out the faces that matter', maps: 'in / out chips' },
              { symbol: 'b', meaning: 'the property per unit mass. Choosing it is the whole job', maps: 'the What-is-b control' },
            ]}
            note="An identity about bookkeeping, not a law of physics: it holds for any b whatever the material does. Physics enters when you say what dB_sys/dt is — zero for mass, the net force for momentum, the heat added for energy — and then the identity becomes a balance: source = storage + out − in. Drag the box and watch the split between storage and flux move while the source stays put. That is the entire content of the theorem, and the reason every integral balance begins with the words 'choose a control volume.'"
          />
          <EquationCard
            title="One theorem, four costumes"
            latex={String.raw`\begin{aligned} b = 1:&\quad 0 = \tfrac{dM_{CV}}{dt} + \dot m_{out} - \dot m_{in} \\ b = \mathbf u:&\quad \sum\mathbf F = \tfrac{d\mathbf P_{CV}}{dt} + \dot m\,\mathbf u_{out} - \dot m\,\mathbf u_{in} \\ b = c_p T:&\quad \dot Q = \tfrac{dE_{CV}}{dt} + \dot m c_p T_{out} - \dot m c_p T_{in} \\ b = \$:&\quad \text{gain} = \Delta V + \text{withdrawals} - \text{deposits} \end{aligned}`}
            note="Continuity, the momentum balance, the first law for an open system, and a brokerage statement — the same four words each time, with a different device in the box. Students meet the first three as separate chapters. They are one chapter. The fourth is not a joke: an account is a control volume, deposits and withdrawals are its control-surface term, and the market's gain on every share is its source, which nothing conserves."
            defaultOpen={true}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="What the surges carry"
            latex={String.raw`\langle n\,b\rangle = \langle n\rangle\langle b\rangle + \langle n'\,b'\rangle`}
            terms={[
              { symbol: '\\langle n\\rangle\\langle b\\rangle', meaning: 'the flux a steady-state calculation assumes: mean flow times mean property', maps: 'mean × mean' },
              { symbol: "\\langle n'b'\\rangle", meaning: 'the covariance of the surges with the property they carry — an eddy, a hot pulse in a gust, a purchase at a high price', maps: 'ρ slider' },
            ]}
            note="Reynolds' decomposition, and the reason turbulent flow transports so much more than laminar flow at the same mean: the fluctuations do not average away, they correlate. On the momentum face they cannot help it — the flux of u is u·u, and the correlation is a Reynolds stress. On the energy face you control it with ρ. On the wealth face ⟨n′P′⟩ is what buying high costs you, and reducing it to an annualized rate is what the behavior-gap literature calls the gap. Same term."
            defaultOpen={true}
          />
          <EquationCard
            title="Whose return is it?"
            latex={String.raw`r_{TW} = \frac{1}{T}\ln\frac{P_T}{P_0}, \qquad V_0 e^{r_{DW}T} + \sum_i f_i\,e^{r_{DW}(T-t_i)} = V_T, \qquad \text{gap} = r_{TW} - r_{DW}`}
            terms={[
              { symbol: 'r_{TW}', meaning: 'time-weighted: what one share that stayed the whole time earned. Follows the material — the system', maps: 'the fund' },
              { symbol: 'r_{DW}', meaning: 'dollar-weighted: the single rate that grows the opening balance and every flow into the closing balance. Follows the account — the control volume', maps: 'your dollars' },
              { symbol: 'f_i', meaning: 'the flows, signed, at the times they actually happened', maps: 'the control-surface term' },
            ]}
            note="Two honest returns for one account, and they differ whenever there are flows whose timing correlates with the price. No flows: no surface term, and they agree exactly. Uncorrelated flows: they wander about each other and agree on average. Correlated flows: the gap has a sign, and it is the sign of ρ. One sharpening worth keeping: the gap is not the flux term itself but what you get by reducing that term to a single rate — and, as the box shows, how big it is depends on where the account's boundary is drawn."
            defaultOpen={true}
          />
          <EquationCard
            title="What the duct leaves out"
            latex={String.raw`\text{money is not conserved}, \qquad D(t) \ne \text{const}, \qquad \text{the boundary is a choice}`}
            note="Three caveats before the wealth face is taken too literally. Credit creates money, so the source term is never zero and choosing b — shares, which are conserved, or dollars, which are not — is the real work. Real price fluctuations cluster rather than mean-revert on a fixed clock; this page uses a mean-reverting swing because it is the honest model for a buy-high story, and the Lone Walker shows the other one. And the gap is measured across a boundary somebody drew: include the cash on the sidelines in the box and a deposit becomes an internal transfer. The theorem does not resolve that argument. It is what the argument is about."
            defaultOpen={false}
          />
        </div>
      </div>

      {/* The Socratic question set (socratic.ts) is authored but not rendered:
          guided-discussion delivery is on hold pending the walkthrough tool. */}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function faceText(face: RttFace) {
  switch (face) {
    case 'mass':
      return {
        title: 'Continuity — b = 1',
        subtitle: 'Nothing is made and nothing is lost. What crosses in, crosses out — or piles up for a while.',
        rateUnit: 'kg/s',
        sourceHint: 'zero by law: mass has no source',
        meanMeanHint: 'ṁ, since b = 1 for every parcel',
        covHint: 'identically zero: b′ = 0',
      };
    case 'momentum':
      return {
        title: 'The momentum balance — b = u',
        subtitle: 'A push on whatever is inside the box shows up as a jump in momentum flux across it.',
        rateUnit: 'N',
        sourceHint: 'the push, F: momentum\'s source is force',
        meanMeanHint: 'ρAū² — the laminar guess',
        covHint: 'ρA⟨u′²⟩: a Reynolds stress, always ≥ 0',
      };
    case 'energy':
      return {
        title: 'The first law, open system — b = c_p T',
        subtitle: 'A heater in the box shows up as a jump in enthalpy flux across it — once the storage term has averaged out.',
        rateUnit: 'W',
        sourceHint: 'the heater, Q: energy\'s source',
        meanMeanHint: 'ṁ c_p ⟨T⟩ — what a steady calculation uses',
        covHint: '⟨ṁ′T′⟩ c_p: the heat the surges carry',
      };
    case 'wealth':
      return {
        title: 'The brokerage statement — b = price',
        subtitle: 'Market gain = Δbalance + withdrawals − deposits. The account is the box; the fund is the dye.',
        rateUnit: '$/yr',
        sourceHint: 'the market\'s gain on every share held — wealth\'s source',
        meanMeanHint: 'buying rate × average price',
        covHint: 'the premium your timing paid — or earned',
      };
  }
}

function fmtRate(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a < 1e-9) return '0.000';
  if (a >= 1e5 || a < 1e-2) return v.toExponential(2);
  return Number(v.toPrecision(3)).toString();
}

function fmtMoney(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('en-US');
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Momentum & flow · The Reynolds transport theorem
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          System vs control volume — and whose return is it
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Where You Draw the Box
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Every balance in this subject — mass, momentum, energy — is one theorem wearing a
        different b. It says how following a fixed lump of material differs from watching a
        fixed region of space: by exactly what crosses the boundary. Drag the boundary and the
        bookkeeping moves; the physics does not. Then relabel b as a share price and the same
        identity is a brokerage statement, with two returns that disagree by the flux term.
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
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
