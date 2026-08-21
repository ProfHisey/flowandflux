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
import { profile, type PoiseuilleParams } from '../../lib/poiseuille';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * v(s) and tau(s) side by side: the parabola and the straight line that
 * always come as a pair. Shear is zero exactly where the velocity peaks
 * and largest at the wall — which is where flowing blood actually touches
 * biology, and why tau_wall is the number physiologists care about.
 */
export function PoiseuilleChart({ params, dark }: { params: PoiseuilleParams; dark: boolean }) {
  const data = useMemo(
    () => profile(params, 100).map((d) => ({ s: d.s * 1000, v: d.v, tau: d.tau })),
    [params],
  );

  const vAxis = useMemo(
    () => niceAxis(Math.max(1e-12, ...data.map((d) => d.v))),
    [data],
  );
  const tAxis = useMemo(
    () => niceAxis(Math.max(1e-12, ...data.map((d) => d.tau))),
    [data],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const xLabel =
    params.geometry === 'tube' ? 'r (mm, 0 = axis)' : params.geometry === 'plates'
      ? 'y (mm, from one plate)'
      : 'x (mm, from the wall)';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Velocity profile" formula={params.geometry === 'tube' ? 'v(r)' : 'v(s)'}>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="s"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, vAxis.max]}
              ticks={vAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={50}
              label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} m/s`, 'v']) as never}
              labelFormatter={((v: unknown) => `${sci(Number(v))} mm`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            {params.geometry === 'tube' && <ReferenceLine x={0} stroke={axis} strokeDasharray="2 2" />}
            <Line
              type="monotone"
              dataKey="v"
              stroke="#10b981"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Shear stress" formula="τ(s) — linear, max at the wall">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="s"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: xLabel, position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, tAxis.max]}
              ticks={tAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'Pa', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} Pa`, 'τ']) as never}
              labelFormatter={((v: unknown) => `${sci(Number(v))} mm`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="tau"
              stroke="#f59e0b"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
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
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{formula}</span>
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
