import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { profile, profilePoint, sigma, sigmaPoint, type UnsteadyParams } from '../../lib/unsteady';
import { molPerCm3TomM } from '../../lib/fick';
import { niceAxis, sci, tick } from '../../lib/format';
import type { BolusCargo, ReleaseMode } from './UnsteadyCanvas';

/**
 * C(x, t) — or C(r, t) for a point release — with its own past as ghosts,
 * and sigma(t) with the current moment marked. The first chart shows the
 * shape (peak falls, width grows, amount fixed); the second shows the law
 * (root-t: the curve bends over, which is why diffusion feels fast at
 * first and hopeless later).
 */
export function UnsteadyChart({
  params,
  mode,
  cargo = 'mass',
  dark,
}: {
  params: UnsteadyParams;
  mode: ReleaseMode;
  /** Heat cargo shows the same curves as a temperature excess θ in
   *  arbitrary units (the deposited energy is not a slider). */
  cargo?: BolusCargo;
  dark: boolean;
}) {
  const data = useMemo(
    () =>
      mode === 'plane'
        ? profile(params, 140).map((d) => ({
            x: d.x,
            C: molPerCm3TomM(d.C),
            Chalf: molPerCm3TomM(d.Chalf),
            Cquarter: molPerCm3TomM(d.Cquarter),
          }))
        : profilePoint(params.M, params.D, params.t, 140).map((d) => ({
            x: d.r,
            C: molPerCm3TomM(d.C),
            Chalf: molPerCm3TomM(d.Chalf),
            Cquarter: molPerCm3TomM(d.Cquarter),
          })),
    [params, mode],
  );

  const sigmaData = useMemo(() => {
    const out: { tp: number; s: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const tp = (2 * params.t * i) / 60;
      out.push({ tp, s: mode === 'plane' ? sigma(params.D, tp) : sigmaPoint(params.D, tp) });
    }
    return out;
  }, [params, mode]);

  const cAxis = useMemo(
    () => niceAxis(Math.max(1e-12, ...data.map((d) => d.Cquarter))),
    [data],
  );
  const sAxis = useMemo(
    () =>
      niceAxis(
        Math.max(
          1e-12,
          mode === 'plane' ? sigma(params.D, 2 * params.t) : sigmaPoint(params.D, 2 * params.t),
        ),
      ),
    [params, mode],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame
        title={cargo === 'heat' ? 'Temperature excess, with its past' : 'Concentration, with its past'}
        formula={
          cargo === 'heat'
            ? mode === 'plane' ? 'θ(x, t)' : 'θ(r, t)'
            : mode === 'plane' ? 'C(x, t)' : 'C(r, t)'
        }
      >
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: mode === 'plane' ? 'x (cm)' : 'r (cm)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, cAxis.max]}
              ticks={cAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={50}
              label={{ value: cargo === 'heat' ? 'θ (arb.)' : 'mM', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown, name: unknown) => [
                cargo === 'heat' ? `${sci(Number(v))} (arb.)` : `${sci(Number(v))} mM`,
                name === 'C' ? 'now' : name === 'Chalf' ? 'at t/2' : 'at t/4',
              ]) as never}
              labelFormatter={((v: unknown) => `${mode === 'plane' ? 'x' : 'r'} = ${sci(Number(v))} cm`) as never}
            />
            <ReferenceLine x={0} stroke={axis} strokeDasharray="2 2" />
            <Line type="monotone" dataKey="Cquarter" stroke={dark ? '#334155' : '#cbd5e1'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Chalf" stroke={dark ? '#475569' : '#94a3b8'} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="C" stroke="#0ea5e9" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title="Spread vs time"
        formula={mode === 'plane' ? 'σ(t) = √(2Dt)' : 'σᵣ(t) = √(6Dt)'}
      >
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={sigmaData} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="tp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 't (s)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, sAxis.max]}
              ticks={sAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={50}
              label={{ value: 'cm', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} cm`, 'σ']) as never}
              labelFormatter={((v: unknown) => `t = ${sci(Number(v))} s`) as never}
            />
            <ReferenceLine x={params.t} stroke={dark ? '#fbbf24' : '#d97706'} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="s" stroke="#0ea5e9" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function ChartFrame({
  title,
  formula,
  children,
}: {
  title: string;
  formula: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
        </h3>
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{formula}</span>
      </div>
      {children}
    </div>
  );
}

function tooltipStyle(dark: boolean): React.CSSProperties {
  return {
    background: dark ? '#0f172a' : '#ffffff',
    border: `1px solid ${dark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 8,
    fontSize: 12,
    color: dark ? '#e2e8f0' : '#0f172a',
  };
}
