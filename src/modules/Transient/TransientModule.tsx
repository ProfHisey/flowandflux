import { useMemo, useState } from 'react';
import { Pause, Play, Zap } from 'lucide-react';
import { InlineMath } from 'react-katex';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  contactTemp,
  effusivity,
  penetrationDepth,
  semiInfFlux,
  type ContactBody,
} from '../../lib/transient';
import { lengthM, sci, timeS } from '../../lib/format';
import { TouchCanvas } from './TouchCanvas';
import { Touch3DCanvas } from './Touch3DCanvas';
import { TouchChart } from './TransientChart';
import { TOUCH_MATERIALS, TOUCH_PRESETS } from './presets';

const SKIN: Omit<ContactBody, 'T'> = TOUCH_MATERIALS[0];

export function TransientModule({ dark }: { dark: boolean }) {
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  const [skinT, setSkinT] = useState(37);
  const [matName, setMatName] = useState('Steel');
  const [matT, setMatT] = useState(60);
  const [touchTime, setTouchTime] = useState(1);
  const [touchPresetId, setTouchPresetId] = useState('steel60');

  const mat = TOUCH_MATERIALS.find((m) => m.name === matName) ?? TOUCH_MATERIALS[1];
  const left: ContactBody = { ...SKIN, T: skinT };
  const right: ContactBody = { ...mat, T: matT };

  const touchDerived = useMemo(() => {
    const Tc = contactTemp(left, right);
    return {
      Tc,
      eSkin: effusivity(left.k, left.rho, left.c),
      eMat: effusivity(right.k, right.rho, right.c),
      deltaSkin: penetrationDepth(left.k, left.rho, left.c, touchTime),
      deltaMat: penetrationDepth(right.k, right.rho, right.c, touchTime),
      q: Math.abs(semiInfFlux({ ...left, Ti: left.T, Ts: Tc }, touchTime)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skinT, matName, matT, touchTime]);

  const touchPreset = TOUCH_PRESETS.find((p) => p.id === touchPresetId);

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="The moment of touch"
            subtitle="The interface jumps to the contact temperature instantly — and stays there."
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <div className="w-28">
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
                <IconButton label="Touch again" onClick={() => setResetTick((t) => t + 1)}>
                  <Zap size={15} />
                </IconButton>
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
                <TouchCanvas
                  left={left}
                  right={right}
                  resetTick={resetTick}
                  running={running}
                  dark={dark}
                />
              ) : (
                <Touch3DCanvas
                  left={left}
                  right={right}
                  resetTick={resetTick}
                  running={running}
                  dark={dark}
                />
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Each side responds as erf(x/2√αt), at its own pace — the marked fronts
              are the two thermal penetration depths. Your nerves live at the
              interface, so what you feel is the contact temperature: a contest of
              effusivities e = √(kρc), not of temperatures. That is the entire mystery
              of why 20 °C tile is "cold" and 20 °C carpet is not.
            </p>
          </Panel>
        </div>

        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup" subtitle="Left body is always skin.">
            <div className="space-y-5">
              <Slider
                label="Skin temperature"
                unit="°C"
                value={skinT}
                min={20}
                max={40}
                step={0.5}
                onChange={(v) => {
                  setSkinT(v);
                  setTouchPresetId('');
                }}
                hint="The presets use 37 °C (core-blood). Resting skin SURFACE runs nearer 32–34 °C — slide it there and watch the touchable/burning verdicts shift. The formula does not care which convention you pick; the 44 °C line does."
              />
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Touched material
                </span>
                <select
                  aria-label="Touched material"
                  value={matName}
                  onChange={(e) => {
                    setMatName(e.target.value);
                    setTouchPresetId('');
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {TOUCH_MATERIALS.filter((m) => m.name !== 'Skin').map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name} — e = {Math.round(effusivity(m.k, m.rho, m.c))}
                    </option>
                  ))}
                </select>
              </div>
              <Slider
                label="Material temperature"
                unit="°C"
                value={matT}
                min={-20}
                max={150}
                step={0.5}
                onChange={(v) => {
                  setMatT(v);
                  setTouchPresetId('');
                }}
              />
              <Slider
                label="Contact time (for readouts/charts)"
                value={touchTime}
                min={0.01}
                max={600}
                log
                format={timeS}
                onChange={setTouchTime}
              />
            </div>
          </Panel>

          <Panel
            title="Example problems"
            subtitle="Load a setup, then check the numbers by hand."
          >
            <div className="space-y-2">
              {TOUCH_PRESETS.map((pr) => {
                const active = pr.id === touchPresetId;
                return (
                  <button
                    key={pr.id}
                    aria-pressed={active}
                    type="button"
                    onClick={() => {
                      setMatName(pr.material);
                      setMatT(pr.T);
                      setSkinT(37);
                      setTouchPresetId(pr.id);
                      setResetTick((t) => t + 1);
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
            </div>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel title="Readouts" subtitle="Every value carries its units. Check them.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label="Contact T"
                value={sci(touchDerived.Tc)}
                unit="°C"
                tone={touchDerived.Tc > 44 ? 'warm' : 'accent'}
                hint={
                  touchDerived.Tc > 44
                    ? 'above the 44 °C pain threshold — it hurts'
                    : 'below the 44 °C pain threshold'
                }
              />
              <Stat
                label={<InlineMath math="e_{skin}" />}
                value={sci(touchDerived.eSkin)}
                unit="W·s½/m²K"
                hint="√(kρc) of skin"
              />
              <Stat
                label={<InlineMath math={`e_{${mat.name.toLowerCase().replace(/[^a-z]/g, '')}}`} />}
                value={sci(touchDerived.eMat)}
                unit="W·s½/m²K"
                hint={`√(kρc) of ${mat.name.toLowerCase()}`}
              />
              <Stat
                label="Front in skin"
                value={lengthM(touchDerived.deltaSkin)}
                unit=""
                hint={`after ${timeS(touchTime)} — real α`}
              />
              <Stat
                label={`Front in ${mat.name.toLowerCase()}`}
                value={lengthM(touchDerived.deltaMat)}
                unit=""
                hint={`after ${timeS(touchTime)} — real α`}
              />
              <Stat
                label={<InlineMath math="q''(t)" />}
                value={sci(touchDerived.q)}
                unit="W/m²"
                hint="decaying as 1/√t — the first instant does the damage"
              />
            </div>

            {touchPreset?.check && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <span className="font-semibold">Hand-check: </span>
                {touchPreset.check} — try it on paper.
              </p>
            )}
          </Panel>

          <Panel title="Profiles — physical time and α">
            <TouchChart left={left} right={right} t={touchTime} dark={dark} />
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <EquationCard
          title="The semi-infinite solid"
          latex={String.raw`\frac{T - T_s}{T_i - T_s} = \operatorname{erf}\!\left(\frac{x}{2\sqrt{\alpha t}}\right) \qquad q''_s = \frac{k\,(T_s - T_i)}{\sqrt{\pi \alpha t}}`}
          terms={[
            { symbol: '\\alpha', meaning: 'thermal diffusivity k/ρc, m²/s — the pace-setter', maps: 'material pickers' },
            { symbol: '\\operatorname{erf}', meaning: 'the error function — the shape every sudden change relaxes into' },
          ]}
          note="Any body is semi-infinite until the thermal front reaches its far side — a brick wall is semi-infinite for an hour or two, a pea for a few seconds. The front sits at x ≈ 3.6√(αt): the diffusion clock again, wearing thermal units. When the body runs out of thickness, the story continues in the Heisler-charts module."
        />
        <EquationCard
          title="The contact temperature"
          latex={String.raw`T_{contact} = \frac{e_1 T_1 + e_2 T_2}{e_1 + e_2}, \qquad e = \sqrt{k \rho c}`}
          note="Two semi-infinite bodies touch and the interface jumps — instantly and permanently — to the effusivity-weighted average. This one line is what your nerves report: it is why 60 °C steel burns while 60 °C wood is warm, and why tile and carpet at identical temperatures get opposite verdicts from a bare foot. Thermometers measure T; touch measures e."
        />
      </div>

      {/* The Socratic question set (socratic.ts) is authored but not rendered. */}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Module 2 · Unsteady conduction
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Semi-infinite solids · the contact temperature
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Sudden Contact
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Touch something and two thermal fronts start marching, one into each body,
        while the interface locks instantly onto the effusivity-weighted contact
        temperature — the number your nerves actually report. When a body runs out of
        thickness and stops looking infinite, the Heisler-charts module takes over.
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
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
          : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
    >
      {children}
    </button>
  );
}
