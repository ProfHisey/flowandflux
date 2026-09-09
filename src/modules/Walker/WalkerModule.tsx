import { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw, Shuffle } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  crossoverTime,
  driftToSpread,
  meanPosition,
  priceToWalk,
  probabilityAhead,
  spread,
} from '../../lib/walker';
import { lengthCm, sci, timeS } from '../../lib/format';
import { WalkerCanvas, type WalkerFace, type WalkerView } from './WalkerCanvas';
import {
  DEFAULT_PRICE,
  DEFAULT_TRANSPORT,
  PRICE_PRESETS,
  TRANSPORT_PRESETS,
  type PriceParams,
  type TransportParams,
} from './presets';

/**
 * Special topic: the same drift-plus-wander step as the Péclet module,
 * followed for ONE walker instead of averaged into a field — and then the
 * same picture with the axes relabeled for the equation's other famous
 * home, a price chart. The transport face is the default; the price face is
 * a costume change, not a new module.
 */
export function WalkerModule({ dark }: { dark: boolean }) {
  const [face, setFace] = useState<WalkerFace>('transport');
  const [tp, setTp] = useState<TransportParams>(DEFAULT_TRANSPORT);
  const [pp, setPp] = useState<PriceParams>(DEFAULT_PRICE);
  const [tPreset, setTPreset] = useState<string>(TRANSPORT_PRESETS[1].id);
  const [pPreset, setPPreset] = useState<string>(PRICE_PRESETS[1].id);
  const [view, setView] = useState<WalkerView>('both');
  const [running, setRunning] = useState(true);
  const [replay, setReplay] = useState(0);

  const setT = <K extends keyof TransportParams>(key: K, value: TransportParams[K]) => {
    setTp((p) => ({ ...p, [key]: value }));
    setTPreset('');
  };
  const setP = <K extends keyof PriceParams>(key: K, value: PriceParams[K]) => {
    setPp((p) => ({ ...p, [key]: value }));
    setPPreset('');
  };

  // Whichever face is showing, the canvas sees a walker: v, D, T.
  const walk = useMemo(() => {
    if (face === 'transport') return { v: tp.v, D: tp.D, T: tp.T };
    const { v, D } = priceToWalk(pp.mu, pp.sigma);
    return { v, D, T: pp.T };
  }, [face, tp, pp]);

  const derived = useMemo(() => {
    const { v, D, T } = walk;
    const Pe = driftToSpread(v, D, T);
    return {
      Pe,
      Tstar: crossoverTime(v, D),
      drift: meanPosition(v, T),
      spread: spread(D, T),
      pAhead: probabilityAhead(v, D, T),
      verdict:
        !Number.isFinite(Pe) || Math.abs(Pe) > 3
          ? 'drift is destiny — the wandering is a detail on a line'
          : Math.abs(Pe) < 0.3
            ? 'noise rules — where it ends up means nothing'
            : 'contested — the drift is real, and so is the chance of being behind',
    };
  }, [walk]);

  const preset =
    face === 'transport'
      ? TRANSPORT_PRESETS.find((p) => p.id === tPreset)
      : PRICE_PRESETS.find((p) => p.id === pPreset);

  const fmtLen = face === 'prices' ? multiple : lengthCm;
  const fmtTime = face === 'prices' ? years : timeS;

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title={face === 'prices' ? 'One price, one life' : 'One walker, one life'}
            subtitle="The Péclet module's walker step, followed for a single particle instead of averaged into a pile."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-52">
                  <Segmented<WalkerView>
                    ariaLabel="What to draw"
                    value={view}
                    options={[
                      { value: 'one', label: 'One', title: 'A single walker — the path you would actually live' },
                      { value: 'cloud', label: 'Cloud', title: 'Many walkers with the same v and D — the field' },
                      { value: 'both', label: 'Both', title: 'One life against the ensemble it was drawn from' },
                    ]}
                    onChange={setView}
                  />
                </div>
                <IconButton label="Replay with new draws" onClick={() => setReplay((r) => r + 1)}>
                  <Shuffle size={15} />
                </IconButton>
                <IconButton label={running ? 'Pause' : 'Play'} onClick={() => setRunning((r) => !r)}>
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
              </div>
            }
          >
            <WalkerCanvas
              v={walk.v}
              D={walk.D}
              T={walk.T}
              face={face}
              view={view}
              running={running}
              dark={dark}
              replay={replay}
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              The amber band is the analytic answer — a mean sliding at v and a spread
              growing as √(2Dt). The walkers have never seen it and keep landing inside
              it anyway; the blue one is the only path anyone gets to live. One honest
              trick: the playback clock runs the whole horizon in a few seconds whether
              T is twenty seconds or twenty years. Speed is cosmetic; the drift-to-spread
              ratio on screen is real.
            </p>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label={<InlineMath math="\mathrm{Pe}(T) = vT/\sqrt{2DT}" />}
                value={fmtPe(derived.Pe)}
                unit=""
                tone="accent"
                hint={derived.verdict}
              />
              <Stat
                label={<InlineMath math="T^* = 2D/v^2" />}
                value={Number.isFinite(derived.Tstar) ? fmtTime(derived.Tstar) : '∞'}
                unit=""
                hint="the crossover — when drift first equals spread"
              />
              <Stat
                label={<InlineMath math="vT" />}
                value={fmtLen(derived.drift)}
                unit=""
                hint={face === 'prices' ? 'the median outcome (the mean is higher)' : 'where the mean ends up'}
              />
              <Stat
                label={<InlineMath math="\sqrt{2DT}" />}
                value={face === 'prices' ? `×${Math.exp(derived.spread).toFixed(2)} either way` : lengthCm(derived.spread)}
                unit=""
                hint="one spread — the bell's half-width at the horizon"
              />
              <Stat
                label={<InlineMath math="P(x > 0)" />}
                value={`${(derived.pAhead * 100).toFixed(derived.pAhead > 0.999 ? 2 : 0)}%`}
                unit=""
                hint={face === 'prices' ? 'chance of ending ahead of the start' : 'chance the walker ends ahead of where it began'}
              />
              <Stat
                label={face === 'prices' ? 'v, D' : 'horizon / T*'}
                value={
                  face === 'prices'
                    ? `${sci(walk.v)}, ${sci(walk.D)}`
                    : Number.isFinite(derived.Tstar)
                      ? sci(walk.T / derived.Tstar)
                      : '0'
                }
                unit={face === 'prices' ? 'per yr' : ''}
                hint={face === 'prices' ? 'the walker behind the price: v = μ − σ²/2, D = σ²/2' : 'Pe(T)² — how many crossovers you watched'}
              />
            </div>

            {preset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                {preset.check} — try it on paper.
              </p>
            )}
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup">
            <div className="space-y-5">
              <Segmented<WalkerFace>
                label="Which face of the equation"
                value={face}
                options={[
                  { value: 'transport', label: 'Transport', title: 'A particle: drift v, diffusivity D, in cm and seconds' },
                  { value: 'prices', label: 'Prices', title: 'The same walker in log-price: expected return, volatility, years' },
                ]}
                onChange={(f) => {
                  setFace(f);
                  setReplay((r) => r + 1);
                }}
              />

              {face === 'transport' ? (
                <>
                  <Slider
                    label="Drift velocity, v"
                    unit="cm/s"
                    value={tp.v}
                    min={0}
                    max={20}
                    step={1e-4}
                    format={(x) => (x === 0 ? '0' : sci(x))}
                    onChange={(x) => setT('v', x)}
                    hint="The current. Zero is the diffusion modules' unbiased walker."
                  />
                  <Slider
                    label="Diffusion coefficient, D"
                    unit="cm²/s"
                    value={tp.D}
                    min={1e-7}
                    max={1e-1}
                    log
                    format={sci}
                    onChange={(x) => setT('D', x)}
                  />
                  <Slider
                    label="Horizon, T"
                    value={tp.T}
                    min={1}
                    max={1e4}
                    log
                    format={timeS}
                    onChange={(x) => setT('T', x)}
                    hint="Drift grows as T, spread as √T. Watch longer and the current always wins."
                  />
                </>
              ) : (
                <>
                  <Slider
                    label="Expected return, μ"
                    unit="%/yr"
                    value={pp.mu * 100}
                    min={-10}
                    max={30}
                    step={0.5}
                    format={(x) => x.toFixed(1)}
                    onChange={(x) => setP('mu', x / 100)}
                    hint="The mean of the yearly return — not the drift of the log price, which is μ − σ²/2."
                  />
                  <Slider
                    label="Volatility, σ"
                    unit="%/yr"
                    value={pp.sigma * 100}
                    min={1}
                    max={80}
                    step={1}
                    format={(x) => x.toFixed(0)}
                    onChange={(x) => setP('sigma', x / 100)}
                    hint="A diffusivity in disguise: D = σ²/2."
                  />
                  <Slider
                    label="Horizon, T"
                    unit="years"
                    value={pp.T}
                    min={0.25}
                    max={50}
                    log
                    format={(x) => Number(x.toPrecision(3)).toString()}
                    onChange={(x) => setP('T', x)}
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel
            title="Example problems"
            subtitle="Load a setup, then check the numbers by hand."
          >
            <div className="space-y-2">
              {(face === 'transport' ? TRANSPORT_PRESETS : PRICE_PRESETS).map((pr) => {
                const active = pr.id === (face === 'transport' ? tPreset : pPreset);
                return (
                  <button
                    key={pr.id}
                    aria-pressed={active}
                    type="button"
                    onClick={() => {
                      if (face === 'transport') {
                        setTp((pr as (typeof TRANSPORT_PRESETS)[number]).params);
                        setTPreset(pr.id);
                      } else {
                        setPp((pr as (typeof PRICE_PRESETS)[number]).params);
                        setPPreset(pr.id);
                      }
                      setReplay((r) => r + 1);
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
                  setTp(DEFAULT_TRANSPORT);
                  setPp(DEFAULT_PRICE);
                  setTPreset(TRANSPORT_PRESETS[1].id);
                  setPPreset(PRICE_PRESETS[1].id);
                  setReplay((r) => r + 1);
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
            title="One step, then the equation the steps obey"
            latex={String.raw`x_{n+1} = x_n + v\,\Delta t + \sqrt{2D\,\Delta t}\;Z_n \quad\Longrightarrow\quad \frac{\partial C}{\partial t} + v\,\frac{\partial C}{\partial x} = D\,\frac{\partial^2 C}{\partial x^2}`}
            terms={[
              { symbol: 'v\\,\\Delta t', meaning: 'the current carries every walker the same way', maps: 'the drift' },
              { symbol: '\\sqrt{2D\\Delta t}\\,Z', meaning: 'a fresh coin flip each step, scaled by the diffusivity', maps: 'the wander' },
              { symbol: 'C(x,t)', meaning: 'how many walkers per unit length — the cloud, smoothed', maps: 'the bell' },
            ]}
            note="The left side is what one walker does; the right side is what a crowd of them looks like. For a point release the crowd is a Gaussian, C = exp(−(x − vt)²/4Dt)/√(4πDt): its center slides at v, its width grows as √(2Dt). Every walker follows the left equation and has never heard of the right one — which is why the cloud landing on the amber curve is worth watching."
          />

          <EquationCard
            title="Drift is destiny, eventually"
            latex={String.raw`\mathrm{Pe}(T) = \frac{vT}{\sqrt{2DT}} = \sqrt{\frac{T}{T^*}}, \qquad T^* = \frac{2D}{v^2}, \qquad P(x>0) = \Phi\!\big(\mathrm{Pe}(T)\big)`}
            note="The Péclet number once more, with the diffusion length √(2DT) standing in for L. Drift grows as T, spread only as √T, so the ratio grows without bound and T* marks the crossover. Before T* a walker's fate is mostly noise; long after it, the wandering is a detail on a straight line. The last formula says how often a walker is ahead of its start: at T* itself, 84% — one in six is still behind."
            defaultOpen={true}
          />
        </div>

        <div className="space-y-4">
          <EquationCard
            title="Bachelier's dictionary (1900)"
            latex={String.raw`d(\ln S) = \underbrace{\Big(\mu - \tfrac{\sigma^2}{2}\Big)}_{v}\,dt + \underbrace{\sigma}_{\sqrt{2D}}\,dW \qquad\Longrightarrow\qquad \mathrm{Pe}(T) = \frac{\mu - \sigma^2/2}{\sigma}\,\sqrt{T}`}
            terms={[
              { symbol: '\\mu', meaning: 'expected return per year', maps: 'μ slider' },
              { symbol: '\\sigma', meaning: 'volatility per year — a diffusivity in disguise, D = σ²/2', maps: 'σ slider' },
              { symbol: '\\sigma^2/2', meaning: 'the Itô correction: wobble lowers the drift of the log price', maps: 'why "one company" has v < 0' },
            ]}
            note="Louis Bachelier derived the diffusion equation for prices in his 1900 thesis, five years before Einstein derived it for pollen; the Black–Scholes equation is the heat equation after a change of variables. In log-price coordinates the mapping to this module is exact. Finance calls Pe(T) at one year the Sharpe ratio, and this picture is why a one-year and a thirty-year horizon feel like different physics: same v, same D, different Pe."
            defaultOpen={true}
          />

          <EquationCard
            title="What the textbook walker leaves out"
            latex={String.raw`D = D(t), \qquad Z \not\sim \mathcal{N}(0,1), \qquad \text{walkers share a current}`}
            note="Three honest caveats before anyone takes the price face too literally. Real return diffusivity is not constant — it clusters and storms, more turbulence than molecular wander. The steps have fatter tails than a Gaussian. And real price walkers are not independent: they ride a common current, so a crowd of them does not average out the way a crowd of molecules does. This module shows the textbook model, and says so."
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
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          Special topic · The equation's other life
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          One walker, followed — and Bachelier's stock chart
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Lone Walker
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Every diffusion module here averages thousands of walkers into a field. This
        one follows a single walker with a drift, so you can see the path instead of
        the pile — and then relabels the axes, because the identical equation was
        written down for stock prices five years before it was written down for
        pollen. Same step, same bell, same Péclet number. Different costume.
      </p>
    </header>
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

function fmtPe(v: number): string {
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  return sci(v);
}

/** A log-price displacement, shown as the price multiple it means. */
function multiple(lnx: number): string {
  return `×${Math.exp(lnx).toFixed(2)}`;
}

function years(t: number): string {
  if (!Number.isFinite(t)) return '∞';
  if (t < 1 / 12) return `${sci(t * 365)} days`;
  if (t < 1) return `${sci(t * 12)} months`;
  return `${sci(t)} yr`;
}
