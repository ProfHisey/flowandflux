import type React from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * What crosses the face, and how much has crossed so far. The two halves of
 * one fact: the flux falls as 1/sqrt(t) because the gradient at the surface
 * is spread over a front that keeps deepening, and the amount delivered
 * grows as sqrt(t) because it is that flux, integrated.
 *
 * Plots precomputed series; every number comes from lib/semiinf.
 */

export interface FluxPoint {
  t: number;
  flux: number;
  amount: number;
}

export function SemiChart({
  data,
  t,
  fluxUnit,
  amountUnit,
  fluxFormula,
  amountFormula,
  dark,
}: {
  data: FluxPoint[];
  t: number;
  fluxUnit: string;
  amountUnit: string;
  fluxFormula: string;
  amountFormula: string;
  dark: boolean;
}) {
  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const now = dark ? '#38bdf8' : '#0284c7';
  const fMax = Math.max(...data.map((d) => d.flux).filter(Number.isFinite), 1e-30);
  const aMax = Math.max(...data.map((d) => d.amount).filter(Number.isFinite), 1e-30);
  const fAxis = niceAxis(fMax);
  const aAxis = niceAxis(aMax);

  const one = (
    key: 'flux' | 'amount',
    title: string,
    formula: string,
    unit: string,
    ax: { max: number; ticks: number[] },
    color: string,
  ) => (
    <ChartFrame title={title} formula={formula}>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tick}
            stroke={axis}
            tick={{ fontSize: 11 }}
            label={{ value: 't (s)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
          />
          <YAxis
            domain={[0, ax.max]}
            ticks={ax.ticks}
            tickFormatter={tick}
            stroke={axis}
            tick={{ fontSize: 11 }}
            width={58}
            label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }}
          />
          <Tooltip
            contentStyle={tooltipStyle(dark)}
            formatter={((v: unknown) => [`${sci(Number(v))} ${unit}`, title]) as never}
            labelFormatter={((v: unknown) => `t = ${sci(Number(v))} s`) as never}
          />
          <ReferenceLine x={t} stroke={now} strokeDasharray="4 3" />
          <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2.25} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {one('flux', 'Flux through the face', fluxFormula, fluxUnit, fAxis, '#f59e0b')}
      {one('amount', 'Crossed so far', amountFormula, amountUnit, aAxis, dark ? '#a78bfa' : '#7c3aed')}
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
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
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
