import { useState } from 'react';
import { ArrowRight, Pause, Play } from 'lucide-react';

import { Panel } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';

import { DividerCanvas, type MixStats } from './DividerCanvas';
import { DividerHeatCanvas, type HeatMixStats } from './DividerHeatCanvas';
import { Divider3DCanvas } from './Divider3DCanvas';

/**
 * The site's front door: a PhET-style mixing box. No equations anywhere on
 * this page — by design. Set up an imbalance, pull the divider, watch what
 * nature does. The law modules then give names and numbers to what was
 * already seen here.
 */
export function DividerModule({ dark }: { dark: boolean }) {
  const [mode, setMode] = useState<'mass' | 'heat'>('mass');
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [running, setRunning] = useState(true);
  const [dividerIn, setDividerIn] = useState(true);
  const [resetTick, setResetTick] = useState(0);

  const [nLeft, setNLeft] = useState(140);
  const [nRight, setNRight] = useState(10);
  const [dCyan, setDCyan] = useState(1);
  const [dOrange, setDOrange] = useState(1);
  const [temp, setTemp] = useState(1);
  const [TLeft, setTLeft] = useState(90);
  const [TRight, setTRight] = useState(15);
  const [kScale, setKScale] = useState(1);

  const [mixStats, setMixStats] = useState<MixStats | null>(null);
  const [heatStats, setHeatStats] = useState<HeatMixStats | null>(null);

  const resetExperiment = () => {
    setDividerIn(true);
    setResetTick((t) => t + 1);
  };
  const switchMode = (m: 'mass' | 'heat') => {
    setMode(m);
    resetExperiment();
  };

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The box"
            subtitle={
              mode === 'mass'
                ? 'Two gases, one wall. Nothing pushes anything.'
                : 'A hot half, a cold half, one insulating wall. The molecules never move — watch what does.'
            }
            right={
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="w-32">
                  <Segmented<'mass' | 'heat'>
                    value={mode}
                    options={[
                      { value: 'mass', label: 'Mass', title: 'Two particle species mixing' },
                      { value: 'heat', label: 'Heat', title: 'Hot and cold halves equalizing' },
                    ]}
                    onChange={switchMode}
                  />
                </div>
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    value={dim}
                    options={[
                      { value: '2d', label: '2D' },
                      { value: '3d', label: '3D', title: 'Rotatable 3D view — drag to orbit' },
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
            {dim === '3d' ? (
              <Divider3DCanvas
                mode={mode}
                nLeft={nLeft}
                nRight={nRight}
                dCyan={dCyan}
                dOrange={dOrange}
                temp={temp}
                TLeft={TLeft}
                TRight={TRight}
                kScale={kScale}
                dividerIn={dividerIn}
                resetTick={resetTick}
                running={running}
                dark={dark}
              />
            ) : mode === 'mass' ? (
              <DividerCanvas
                nLeft={nLeft}
                nRight={nRight}
                dCyan={dCyan}
                dOrange={dOrange}
                temp={temp}
                dividerIn={dividerIn}
                resetTick={resetTick}
                running={running}
                dark={dark}
                onStats={setMixStats}
              />
            ) : (
              <DividerHeatCanvas
                TLeft={TLeft}
                TRight={TRight}
                kScale={kScale}
                dividerIn={dividerIn}
                resetTick={resetTick}
                running={running}
                dark={dark}
                onStats={setHeatStats}
              />
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {dividerIn ? (
                <button
                  type="button"
                  onClick={() => setDividerIn(false)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950"
                >
                  Remove the divider <ArrowRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetExperiment}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Put it back &amp; reset
                </button>
              )}

              {mode === 'mass' && mixStats && (
                <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                  <span className="text-cyan-700 dark:text-cyan-300">
                    ● {mixStats.cyanLeft} | {mixStats.cyanRight}
                  </span>
                  <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-orange-700 dark:text-orange-300">
                    ● {mixStats.orangeLeft} | {mixStats.orangeRight}
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400 dark:text-slate-500">
                    left | right of the line
                  </span>
                </span>
              )}
              {mode === 'heat' && heatStats && (
                <span className="font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                  <span className="text-red-700 dark:text-red-300">
                    left {heatStats.TLeft.toFixed(1)} °C
                  </span>
                  <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-sky-700 dark:text-sky-300">
                    right {heatStats.TRight.toFixed(1)} °C
                  </span>
                  <span className="ml-2 text-[11px] text-slate-400 dark:text-slate-500">
                    mean of each half
                  </span>
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {mode === 'mass' ? (
                <>
                  Every particle wanders the same way whether the divider is in or out —
                  nothing pulls them across. The crowded side empties only because more
                  random crossings start there. Try 100 vs 100 with the two colours:
                  each species spreads into the other's territory as if it were empty,
                  because each one only counts its own kind.
                </>
              ) : (
                <>
                  Watch the boundary between the halves after you pull the divider: the
                  jiggling evens out, but <em>no molecule ever crosses the middle</em>.
                  Energy is handed from neighbour to neighbour while the matter stays
                  put — that is the whole difference between this box and the mass one.
                </>
              )}
            </p>
          </Panel>

        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="No equations yet — on purpose">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Everything on this page runs on one idea: <em>things jiggle at random, and
              imbalances even out by headcount, not by force</em>. When you can predict
              what this box will do before pressing the button, you already understand
              diffusion — what remains is naming the rate. That is what the law modules
              do: <strong>Fick</strong> puts a number on the mass version of this box,{' '}
              <strong>Fourier</strong> on the heat version, and <strong>Newton</strong>{' '}
              on the same story for momentum. The <strong>bolus dispersion</strong> module returns
              to this unsteady world with the mathematics to match, later in the course.
            </p>
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup" subtitle="Changing the setup puts the divider back.">
            <div className="space-y-5">
              {mode === 'mass' ? (
                <>
                  <Slider
                    label="Cyan particles (left)"
                    value={nLeft}
                    min={0}
                    max={250}
                    step={5}
                    onChange={(v) => {
                      setNLeft(v);
                      resetExperiment();
                    }}
                  />
                  <Slider
                    label="Orange particles (right)"
                    value={nRight}
                    min={0}
                    max={250}
                    step={5}
                    onChange={(v) => {
                      setNRight(v);
                      resetExperiment();
                    }}
                    hint="Try 140 vs 10. Then try 100 vs 100 and watch the colours pass through each other."
                  />
                  <Slider
                    label="How fast cyan wanders (its D)"
                    value={dCyan}
                    min={0.2}
                    max={3}
                    step={0.05}
                    format={(v) => `${v.toFixed(2)}×`}
                    onChange={setDCyan}
                  />
                  <Slider
                    label="How fast orange wanders (its D)"
                    value={dOrange}
                    min={0.2}
                    max={3}
                    step={0.05}
                    format={(v) => `${v.toFixed(2)}×`}
                    onChange={setDOrange}
                    hint="D is each species' own character — a small molecule vs a lumbering protein. Give them different values and watch one colour win the race."
                  />
                  <Slider
                    label="Temperature"
                    value={temp}
                    min={0.5}
                    max={2}
                    step={0.05}
                    format={(v) => `${v.toFixed(2)}×`}
                    onChange={setTemp}
                    hint="Heat speeds every wanderer at once — no exceptions, no favourites. These take effect live: no reset needed."
                  />
                </>
              ) : (
                <>
                  <Slider
                    label="Left half temperature"
                    unit="°C"
                    value={TLeft}
                    min={0}
                    max={150}
                    step={1}
                    onChange={(v) => {
                      setTLeft(v);
                      resetExperiment();
                    }}
                  />
                  <Slider
                    label="Right half temperature"
                    unit="°C"
                    value={TRight}
                    min={0}
                    max={150}
                    step={1}
                    onChange={(v) => {
                      setTRight(v);
                      resetExperiment();
                    }}
                    hint="The box is insulated, so the two halves must meet at the average."
                  />
                  <Slider
                    label="How readily energy passes (its k)"
                    value={kScale}
                    min={0.2}
                    max={3}
                    step={0.05}
                    format={(v) => `${v.toFixed(2)}×`}
                    onChange={setKScale}
                    hint="Copper-ish at 3×, styrofoam-ish at 0.2×. Takes effect live — pull the divider, then slide this and watch the meeting speed change."
                  />
                </>
              )}
            </div>
          </Panel>

          <Panel title="Things to try">
            <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {mode === 'mass' ? (
                <>
                  <li>140 vs 10 — the classic. Guess the final split before you pull.</li>
                  <li>100 vs 100 — does anything happen at all? Look per colour.</li>
                  <li>250 vs 0 — how long until the right side looks like the left?</li>
                  <li>Pause mid-mixing and ask: could you un-mix it by waiting?</li>
                </>
              ) : (
                <>
                  <li>90 °C vs 15 °C — where do the halves meet? Predict, then pull.</li>
                  <li>Equal temperatures — pull the divider. Why does nothing change?</li>
                  <li>Watch one molecule near the middle: does it ever change sides?</li>
                </>
              )}
            </ul>
          </Panel>
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
          Start here
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Intuition before equations
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        The Divider
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Set up the two sides however you like, then remove the divider and watch. That
        is the entire experiment — and it already contains most of what this site
        teaches. Everything that follows is a way of putting numbers on what you are
        about to see.
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
