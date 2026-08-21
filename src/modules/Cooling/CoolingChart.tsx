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
import { profile, tau, type CoolingParams } from '../../lib/cooling';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * T(t) relaxing to ambient and Q(t) starving alongside it. The dashed
 * verticals mark tau — after one tau, 63% of the job is done; after four,
 * it is effectively over. The heat rate chart makes the WHY visible: the
 * driving gap shrinks as it is spent, so the rate must decay with it.
 */
export function CoolingChart({ params, dark }: { params: CoolingParams; dark: boolean }) {
  const tc = tau(params);
  const span = Math.max(4 * tc, params.t * 1.15);
  const data = useMemo(() => profile(params, 140, span), [params, span]);

  const tAxis = useMemo(
    () => niceAxis(Math.max(params.T0, params.Tinf, 1)),
    [params],
  );
  const qAxis = useMemo(
    () => niceAxis(Math.max(1e-12, ...data.map((d) => Math.abs(d.Q)))),
    [data],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const marker = dark ? '#fbbf24' : '#d97706';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Object temperature" formula="T(t)">
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
              labelFormatter={((v: unknown) => `t = ${sci(Number(v))} s`) as never}
            />
            <ReferenceLine y={params.Tinf} stroke={axis} strokeDasharray="2 2" />
            <ReferenceLine x={tc} stroke={marker} strokeDasharray="4 3" />
            <ReferenceLine x={params.t} stroke={dark ? '#38bdf8' : '#0284c7'} strokeDasharray="4 3" />
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

      <ChartFrame title="Heat rate" formula="Q(t) = hA·(T − T∞)">
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
              domain={[Math.min(0, qAxis.max * -1), qAxis.max]}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'W', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} W`, 'Q']) as never}
              labelFormatter={((v: unknown) => `t = ${sci(Number(v))} s`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <ReferenceLine x={tc} stroke={marker} strokeDasharray="4 3" />
            <Line
              type="monotone"
              dataKey="Q"
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
