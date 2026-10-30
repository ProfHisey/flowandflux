import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';
import { sci } from '../../lib/format';

import {
  eta, filmFluxPerUnit, filmLength, heldAmountPerUnit, heldFluxPerUnit,
  heldHeatEnergy, heldHeatFlux, penetration, surfaceFilm,
} from '../../lib/semiinf';
import { SemiCanvas, fmtTime, thetaAt, type Cargo, type SemiView, type Surface } from './SemiCanvas';
import { CollapseCanvas } from './CollapseCanvas';
import { Semi3DCanvas } from './Semi3DCanvas';
import { SemiChart, type FluxPoint } from './SemiChart';
import {
  HEAT_DEFAULT, MASS_DEFAULT, SEMI_PRESETS, type HeatVals, type MassVals,
} from './presets';

/**
 * The semi-infinite medium: a surface condition switched on at t = 0, and a
 * front that marches into an untouched body as sqrt(t).
 *
 * Three views of one solution. The body itself, so the front can be watched
 * decelerating. The collapse, so the similarity variable stops being a
 * substitution and becomes the reason there is one curve. And the face, so
 * the 1/sqrt(t) flux and the sqrt(t) amount read as the same fact.
 *
 * Two surface conditions, matching the course sheet's two semi-infinite
 * entries: held (the face jumps to Cs) and film (the face is fed through h
 * and fills on its own clock). The film exists here mostly to BREAK the
 * collapse, which is the most convincing way to show what the collapse was.
 */

const PLAY_MS = 8000;

function fmt(v: number, unit = ''): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return `${sci(v)}${unit ? ' ' + unit : ''}`;
  const dp = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3;
  return `${v.toFixed(dp)}${unit ? ' ' + unit : ''}`;
}

function fmtMm(mm: number): string {
  if (!Number.isFinite(mm)) return '—';
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  if (mm >= 100) return `${mm.toFixed(0)} mm`;
  if (mm >= 10) return `${mm.toFixed(1)} mm`;
  return `${mm.toFixed(2)} mm`;
}

export function SemiInfiniteModule({ dark }: { dark: boolean }) {
  const [cargo, setCargo] = useState<Cargo>('mass');
  const [surface, setSurface] = useState<Surface>('held');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [axis, setAxis] = useState<'x' | 'eta'>('x');
  const [mass, setMass] = useState<MassVals>({ ...MASS_DEFAULT });
  const [heat, setHeat] = useState<HeatVals>({ ...HEAT_DEFAULT });
  const [frac, setFrac] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [showL, setShowL] = useState(false);
  const [probe, setProbe] = useState(0.3);

  // Play: time runs LINEARLY, so the front's sqrt(t) deceleration is visible
  // rather than flattened by a log clock. Time-based, so a throttled frame
  // rate lands on the right moment instead of slowing the clock.
  const playRef = useRef({ start: 0, from: 0 });
  useEffect(() => {
    if (!playing) return;
    playRef.current = { start: performance.now(), from: frac >= 0.999 ? 0 : frac };
    let raf = 0;
    const tick = () => {
      const { start, from } = playRef.current;
      const f = from + (performance.now() - start) / PLAY_MS;
      if (f >= 1) { setFrac(1); setPlaying(false); return; }
      setFrac(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // frac is read once, as the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // ---- one set of numbers, in the cargo's own units
  const isMass = cargo === 'mass';
  const D = isMass ? mass.D : heat.k / (heat.rho * heat.cp);   // cm^2/s or m^2/s
  const kappa = isMass ? mass.D : heat.k;
  const h = isMass ? mass.h : heat.h;
  const v0 = isMass ? mass.v0 : heat.v0;
  const vS = isMass ? mass.vS : heat.vS;
  const dV = vS - v0;
  const tMax = isMass ? mass.tMax : heat.tMax;
  const L = isMass ? mass.L : heat.L;
  const toMm = isMass ? 10 : 1000;
  const unit = isMass ? 'mM' : '°C';
  const t = frac * tMax;
  const depthMax = 1.25 * penetration(D, tMax);

  const view: SemiView = {
    cargo, surface, D, h, kappa, t, tMax, v0, vS, unit, depthMax, toMm,
    L: showL ? L : null,
  };

  // ---- what crosses the face. Heat needs k and rho cp, not D -> alpha alone.
  const fluxNow = (tt: number): number => {
    if (tt <= 0) return Number.NaN;
    if (surface === 'held') {
      return isMass ? dV * heldFluxPerUnit(D, tt) : heldHeatFlux(heat.k, D, dV, tt);
    }
    return dV * filmFluxPerUnit(D, h, kappa, tt);
  };

  const series: FluxPoint[] = useMemo(() => {
    const out: FluxPoint[] = [];
    const N = 160;
    let acc = 0;
    let prevT = 0;
    let prevF = surface === 'film' ? dV * filmFluxPerUnit(D, h, kappa, 0) : 0;
    for (let i = 1; i <= N; i++) {
      const tt = (i / N) * tMax;
      const f = fluxNow(tt);
      let amount: number;
      if (surface === 'held') {
        amount = isMass ? dV * heldAmountPerUnit(D, tt) : heldHeatEnergy(heat.rho * heat.cp, D, dV, tt);
      } else {
        // No closed form wired for the film's cumulative amount: integrate the
        // flux, which is finite at t = 0 (it starts at h dV).
        acc += 0.5 * (f + prevF) * (tt - prevT);
        amount = acc;
      }
      prevT = tt;
      prevF = f;
      out.push({ t: tt, flux: Math.abs(f), amount: Math.abs(isMass ? amount : amount / 1000) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargo, surface, D, h, kappa, dV, tMax, heat.k, heat.rho, heat.cp]);

  const deltaNow = penetration(D, t);
  const thetaS = surface === 'held' ? 1 : surfaceFilm(D, h, kappa, t);
  const xProbe = probe * depthMax;
  const thProbe = t > 0 ? thetaAt(view, xProbe, t) : 0;
  const fNow = fluxNow(t);
  const amtNow = (() => {
    if (t <= 0) return 0;
    if (surface === 'held') {
      const a = isMass
        ? dV * heldAmountPerUnit(D, t)
        : heldHeatEnergy(heat.rho * heat.cp, D, dV, t) / 1000;
      return Math.abs(a);
    }
    // Film: interpolate the integrated series (sample k sits at (k+1)/N tMax).
    const pos = frac * series.length;
    const i = Math.floor(pos);
    if (i <= 0) return series.length ? series[0].amount * pos : 0;
    if (i >= series.length) return series[series.length - 1].amount;
    const w = pos - i;
    return series[i - 1].amount * (1 - w) + series[i].amount * w;
  })();
  const into = dV >= 0;

  const applyPreset = (id: string) => {
    const p = SEMI_PRESETS.find((q) => q.id === id);
    if (!p) return;
    setPlaying(false);
    setCargo(p.cargo);
    setSurface(p.surface);
    if (p.mass) setMass({ ...MASS_DEFAULT, ...p.mass });
    if (p.heat) setHeat({ ...HEAT_DEFAULT, ...p.heat });
    setFrac(1);
  };

  const fluxUnit = isMass ? 'μmol/cm²·s' : 'W/m²';
  const amountUnit = isMass ? 'μmol/cm²' : 'kJ/m²';

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="A face switched on, a front marching in"
            subtitle={
              surface === 'held'
                ? 'The face jumps to its new value at t = 0 and stays there. Press play and watch the front slow down.'
                : 'The face is fed through a film, so it starts at the old value and creeps toward the bulk on its own clock.'
            }
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'The body and its profile — this view carries the numbers' },
                      { value: '3d', label: '3D', title: 'The same front in a block you can turn over' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <div className="w-40">
                  <Segmented<Cargo>
                    ariaLabel="Mass or heat"
                    value={cargo}
                    options={[
                      { value: 'mass', label: 'Mass', title: 'Concentration, D — cm-based units' },
                      { value: 'heat', label: 'Heat', title: 'Temperature, α = k/ρcₚ — SI units' },
                    ]}
                    onChange={(c) => { setPlaying(false); setCargo(c); }}
                  />
                </div>
                <IconButton label="Back to t = 0" onClick={() => { setPlaying(false); setFrac(0); }}>
                  <RotateCcw size={15} />
                </IconButton>
                <IconButton label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
              </div>
            }
          >
            {dim === '3d'
              ? <Semi3DCanvas view={view} dark={dark} />
              : <SemiCanvas view={view} dark={dark} />}
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Play runs time <em>linearly</em>, so watch the dashed front: it covers
              its first stretch fast and every further one more slowly, because it
              goes as √t. To push it twice as deep takes four times as long. That one
              fact — depth goes as the square root of time — is most of what there is
              to know about unsteady diffusion, and it is the same √t that spreads a
              bolus. The shading and the curve are θ = (value − initial)/(surface −
              initial), rising from 0 in the untouched body to 1 at a held face.
              Playback speed is cosmetic; the clock in the corner is real.
            </p>
          </Panel>

          <Panel
            title="One curve, every time"
            subtitle="Four profiles at t, 4t, 9t and 16t — fronts equally spaced, because depth goes as √t."
            right={
              <div className="w-56">
                <Segmented<'x' | 'eta'>
                  ariaLabel="Plot against"
                  value={axis}
                  options={[
                    { value: 'x', label: 'Depth x', title: 'Each profile against physical depth' },
                    { value: 'eta', label: 'η = x/2√(Dt)', title: 'The same profiles against the similarity variable' },
                  ]}
                  onChange={setAxis}
                />
              </div>
            }
          >
            <CollapseCanvas view={view} mode={axis} dark={dark} />
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {surface === 'held' ? (
                <>
                  Switch the axis to η and watch the four curves slide onto one. The
                  problem has no length of its own — no thickness, no film — so the only
                  length it can use is √(Dt), and the only thing the profile can depend
                  on is depth measured in units of it. That is the whole content of the
                  similarity variable: θ = erfc(η), for every time at once. It is also
                  why the PDE collapses to an ODE, θ″ + 2ηθ′ = 0.
                </>
              ) : (
                <>
                  Now switch to η: the curves <strong>refuse</strong> to collapse. The
                  film has brought a length of its own, {isMass ? 'D/hₘ' : 'k/h'} ={' '}
                  {fmtMm(filmLength(h, kappa) * toMm)}, so θ depends on two groups rather
                  than one — which is exactly why the semi-infinite-wall charts need a
                  Bi curve as a second parameter. Late enough that the front is far past
                  that length, the film stops mattering and the curves start to agree.
                </>
              )}
            </p>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Read off the solution" subtitle={`At t = ${fmtTime(t)}. Computed from the closed forms, not measured off the picture.`}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label="Front, δ = 3.65√(Dt)"
                value={fmtMm(deltaNow * toMm)}
                tone="accent"
                hint="where θ has fallen to 1 % — double it by waiting 4×"
              />
              <Stat
                label="Value at the face"
                value={fmt(v0 + dV * thetaS)}
                unit={unit}
                tone="accent"
                hint={surface === 'held' ? 'held: an input, from the first instant' : `θ = ${fmt(thetaS)} and rising`}
              />
              <Stat
                label={`Value at ${fmtMm(xProbe * toMm)}`}
                value={fmt(v0 + dV * thProbe)}
                unit={unit}
                hint={`θ = ${fmt(thProbe)}, η = ${fmt(eta(xProbe, D, Math.max(t, 1e-30)))}`}
              />
              <Stat
                label="Flux through the face"
                value={fmt(Math.abs(fNow))}
                unit={fluxUnit}
                tone="warm"
                hint={surface === 'held' ? `${into ? 'in' : 'out'} — falls as 1/√t` : `${into ? 'in' : 'out'} — finite at t = 0: h·Δ`}
              />
              <Stat
                label="Crossed the face so far"
                value={fmt(amtNow)}
                unit={amountUnit}
                tone="warm"
                hint={`${into ? 'in' : 'out'} — ${surface === 'held' ? 'grows as √t' : 'the flux, integrated'}`}
              />
              {showL ? (
                <Stat
                  label="δ / L"
                  value={fmt(deltaNow / L)}
                  tone={deltaNow / L > 0.5 ? 'warm' : 'default'}
                  hint={deltaNow / L > 0.5 ? 'the far side is being felt — semi-infinite is failing' : 'far side not yet felt: semi-infinite holds'}
                />
              ) : surface === 'film' ? (
                <Stat
                  label={isMass ? 'Film length D/hₘ' : 'Film length k/h'}
                  value={fmtMm(filmLength(h, kappa) * toMm)}
                  hint="the length the film brings; δ must pass it before the film stops mattering"
                />
              ) : (
                <Stat
                  label="To double the depth"
                  value={fmtTime(4 * t)}
                  hint="4× the time, because δ ∝ √t"
                />
              )}
            </div>
            {isMass && (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Units check: 1 mM·cm/s = 1 μmol/(cm²·s), because 1 mM = 10⁻⁶ mol/cm³.
              </p>
            )}
          </Panel>

          <Panel title="What crosses the face" subtitle="The flux falls as 1/√t; the amount delivered grows as √t. The same fact, integrated.">
            <SemiChart
              data={series}
              t={t}
              fluxUnit={fluxUnit}
              amountUnit={amountUnit}
              fluxFormula={surface === 'held' ? (isMass ? 'j = ΔC√(D/πt)' : 'q = kΔT/√(παt)') : 'j = hΔ·erfcx(b)'}
              amountFormula={surface === 'held' ? (isMass ? 'M/A = 2ΔC√(Dt/π)' : 'E/A = 2ρcₚΔT√(αt/π)') : '∫ j dt'}
              dark={dark}
            />
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="The face" subtitle="What happens at x = 0 when the clock starts.">
            <div className="space-y-5">
              <Segmented<Surface>
                label="Surface condition"
                value={surface}
                options={[
                  { value: 'held', label: 'Held', title: 'A stirred bath: the face jumps to the new value at once' },
                  { value: 'film', label: 'Film', title: 'Fed through a transfer coefficient: the face fills gradually' },
                ]}
                onChange={setSurface}
              />
              <Slider
                label="Initial value"
                unit={unit}
                value={v0}
                min={isMass ? 0 : -40}
                max={isMass ? 12 : 250}
                onChange={(x) => (isMass ? setMass({ ...mass, v0: x }) : setHeat({ ...heat, v0: x }))}
              />
              <Slider
                label={surface === 'held' ? 'Held at the face' : 'Bulk, beyond the film'}
                unit={unit}
                value={vS}
                min={isMass ? 0 : -40}
                max={isMass ? 12 : 250}
                onChange={(x) => (isMass ? setMass({ ...mass, vS: x }) : setHeat({ ...heat, vS: x }))}
              />
              {surface === 'film' && (
                <Slider
                  label={isMass ? 'Film coefficient hₘ' : 'Film coefficient h'}
                  unit={isMass ? 'cm/s' : 'W/m²·K'}
                  value={h}
                  min={isMass ? 1e-6 : 1}
                  max={isMass ? 1e-2 : 2000}
                  log
                  format={sci}
                  onChange={(x) => (isMass ? setMass({ ...mass, h: x }) : setHeat({ ...heat, h: x }))}
                  hint="Raise it and the film disappears: the face is pinned to the bulk and you are back to a held surface."
                />
              )}
            </div>
          </Panel>

          <Panel title="The body" subtitle={isMass ? 'One number carries it: D.' : 'α = k/ρcₚ sets the front; k and ρcₚ set the flux and the energy.'}>
            <div className="space-y-5">
              {isMass ? (
                <Slider
                  label="Diffusivity D"
                  unit="cm²/s"
                  value={mass.D}
                  min={1e-8}
                  max={1e-4}
                  log
                  format={sci}
                  onChange={(x) => setMass({ ...mass, D: x })}
                  hint="The front depth goes as √D: a hundred times the diffusivity, ten times as far."
                />
              ) : (
                <>
                  <Slider label="Conductivity k" unit="W/m·K" value={heat.k} min={0.03} max={400} log
                    onChange={(x) => setHeat({ ...heat, k: x })} />
                  <Slider label="Density ρ" unit="kg/m³" value={heat.rho} min={50} max={9000} log
                    onChange={(x) => setHeat({ ...heat, rho: x })} />
                  <Slider label="Specific heat cₚ" unit="J/kg·K" value={heat.cp} min={300} max={4500}
                    onChange={(x) => setHeat({ ...heat, cp: x })}
                    hint={`α = k/ρcₚ = ${sci(heat.k / (heat.rho * heat.cp))} m²/s`} />
                </>
              )}
              <Slider
                label="Time window"
                value={tMax}
                min={1}
                max={60 * 86400}
                log
                format={fmtTime}
                onChange={(x) => (isMass ? setMass({ ...mass, tMax: x }) : setHeat({ ...heat, tMax: x }))}
              />
              <Slider
                label="Time now"
                value={frac}
                min={0}
                max={1}
                step={0.001}
                format={() => fmtTime(t)}
                onChange={(x) => { setPlaying(false); setFrac(x); }}
                hint="Scrub, or press play. Time is linear here on purpose."
              />
              <Slider
                label="Probe depth"
                value={probe}
                min={0}
                max={1}
                step={0.005}
                format={() => fmtMm(xProbe * toMm)}
                onChange={setProbe}
                hint="Read the value at any depth — slide until it crosses the number you care about."
              />
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" className="mt-0.5" checked={showL} onChange={(e) => setShowL(e.target.checked)} />
                <span>
                  Give the body a finite thickness
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Semi-infinite only means the far side has not been felt yet. Mark where a
                    real slab would end, and watch for δ reaching it.
                  </span>
                </span>
              </label>
              {showL && (
                <Slider
                  label="Thickness L"
                  unit={isMass ? 'cm' : 'm'}
                  value={L}
                  min={isMass ? 0.01 : 0.001}
                  max={isMass ? 5 : 10}
                  log
                  onChange={(x) => (isMass ? setMass({ ...mass, L: x }) : setHeat({ ...heat, L: x }))}
                />
              )}
            </div>
          </Panel>

          <Panel title="Setups" subtitle="Each one makes a single point.">
            <div className="flex flex-wrap gap-1.5">
              {SEMI_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.blurb}
                  onClick={() => applyPreset(p.id)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="No length of its own, so one variable"
            latex={String.raw`\eta = \frac{x}{2\sqrt{Dt}}, \qquad \theta = \frac{C - C_0}{C_s - C_0}, \qquad \frac{d^2\theta}{d\eta^2} + 2\eta\,\frac{d\theta}{d\eta} = 0`}
            note="A semi-infinite body with its face held has no thickness and no film — nothing to measure depth against except √(Dt) itself. So the profile can only be a function of x/√(Dt), and substituting η turns the PDE in x and t into an ODE in η alone. That is why there is one curve for every time."
          />
          <EquationCard
            title="The held face: erfc"
            latex={String.raw`\frac{C(x,t) - C_0}{C_s - C_0} = 1 - \mathrm{erf}\!\left(\frac{x}{2\sqrt{Dt}}\right) = \mathrm{erfc}(\eta)`}
            note="C₀ is the uniform initial value and Cₛ the value the face is held at for t > 0. θ rises from 0 deep inside to 1 at the face. For heat, read T for C and α = k/ρcₚ for D; the profile carries over unchanged."
          />
          <EquationCard
            title="The front, and when the idea expires"
            latex={String.raw`\delta \sim \sqrt{Dt}, \qquad \delta_{1\%} = 3.65\sqrt{Dt}`}
            note="δ₁% is where θ has fallen to 0.01. The same √t makes the front decelerate and lets you trade depth for time: twice as deep takes four times as long. A real slab of thickness L behaves as semi-infinite only while δ ≪ L, that is while Fo = Dt/L² ≪ 1 — past that the far side is felt, and the finite-body charts take over."
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="What crosses the face"
            latex={String.raw`j(0,t) = (C_s - C_0)\sqrt{\frac{D}{\pi t}}, \qquad \frac{M}{A} = 2\,(C_s - C_0)\sqrt{\frac{Dt}{\pi}}`}
            note="The flux falls as 1/√t because the same difference, Cₛ − C₀, is spread over an ever-deeper front, so the gradient at the face keeps falling; the amount delivered is that flux integrated, so it grows as √t. For heat, q(0,t) = k(Tₛ − T₀)/√(παt) and E/A = 2ρcₚ(Tₛ − T₀)√(αt/π) — a flux or an amount needs k or ρcₚ, not just D → α, or the units come out in K·m rather than J/m²."
          />
          <EquationCard
            title="A face fed through a film"
            latex={String.raw`\theta = \mathrm{erfc}\!\left(\tfrac{1}{2\sqrt{\mathrm{Fo}}}\right) - e^{\,\mathrm{Bi} + \mathrm{Bi}^2\mathrm{Fo}}\,\mathrm{erfc}\!\left(\tfrac{1}{2\sqrt{\mathrm{Fo}}} + \mathrm{Bi}\sqrt{\mathrm{Fo}}\right)`}
            note="With −D ∂C/∂x|₀ = hₘ(C∞ − C(0,t)), θ is referred to the bulk, and the groups are LOCAL: Bi = hₘx/D, Fo = Dt/x², with x the position, not a body length. Two groups instead of one — which is why these profiles do not collapse in η. As hₘ → ∞ it reduces to erfc(η). (Evaluated here with the two exponents combined: written literally, the exponential overflows long before the erfc underflows.)"
            defaultOpen={false}
          />
        </div>
      </div>

      <Panel title="Things to try">
        <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          <li>Load <strong>A dye soaking into a gel</strong> and press play. Note where the front is at the half-way time. Is it half-way across?</li>
          <li>Switch the collapse chart from depth to η and watch the four curves land on one. Then switch the face to <strong>Film</strong> and try again.</li>
          <li>On a film, drag hₘ up by a couple of decades. When do the curves start to agree again, and what has happened to the face?</li>
          <li>Load <strong>Frost creeping into soil</strong> and slide the probe until the value reads 0 °C. That depth is the answer to "how deep is safe".</li>
          <li>Turn on a finite thickness and shrink L until δ/L goes amber. That is the moment the semi-infinite answer stops being the right one.</li>
          <li>Compare the held face's flux at t → 0 with the film's. One is infinite; one starts at h·Δ. Which is physical, and what is the other idealizing?</li>
        </ul>
      </Panel>
    </div>
  );
}

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
          Unsteady
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          A face held, a front marching in as √t
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Semi-infinite Media
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Change the value at a surface and the news travels into the body as a front.
        It goes as the square root of time, so it slows as it goes — and because the
        body has no length of its own to measure that front against, every profile at
        every time turns out to be the same curve.
      </p>
    </header>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded-md border border-slate-300 p-1.5 text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
    >
      {children}
    </button>
  );
}
