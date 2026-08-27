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
import { profile, type FourierParams } from '../../lib/fourier';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * T(s) and q''(s) side by side — the exact counterpart of the Fick chart,
 * and the same lesson: in curved geometries the profile bends because the
 * local flux must fall as the area grows, while the TOTAL rate stays pinned.
 */
export function FourierChart({ params, dark }: { params: FourierParams; dark: boolean }) {
  const data = useMemo(() => profile(params, 100), [params]);

  const tAxis = useMemo(
    () => niceAxis(Math.max(...data.map((d) => Math.abs(d.T)))),
    [data],
  );
  const qAxis = useMemo(
    () => niceAxis(Math.max(...data.map((d) => Math.abs(d.q)))),
    [data],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const isSlab = params.geometry === 'slab';
  const xLabel = isSlab ? 'x (m)' : 'r (m)';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Temperature profile" formula={isSlab ? 'T(x)' : 'T(r)'}>
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
              width={46}
              label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} °C`, 'T']) as never}
              labelFormatter={((v: unknown) => `${xLabel.slice(0, 1)} = ${sci(Number(v))} m`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="T"
              stroke="#ef4444"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Local heat flux" formula={isSlab ? 'q″(x)' : 'q″(r)'}>
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
              domain={[0, qAxis.max]}
              ticks={qAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'W/m²', angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} W/m²`, 'q″']) as never}
              labelFormatter={((v: unknown) => `${xLabel.slice(0, 1)} = ${sci(Number(v))} m`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="q"
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
