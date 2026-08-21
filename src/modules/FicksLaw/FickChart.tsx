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
import { profile, type FickParams } from '../../lib/fick';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * C(s) and j(s) side by side.
 *
 * Plotting the local flux next to the profile is the point of this chart. In
 * a slab both are flat-and-linear and nothing looks surprising; switch to a
 * cylinder or a sphere and the profile bends while the TOTAL transfer rate
 * stays pinned — because j falls off exactly as fast as the area grows.
 */
export function FickChart({ params, dark }: { params: FickParams; dark: boolean }) {
  const data = useMemo(() => profile(params, 100), [params]);

  // Explicit, round axes. See niceAxis() for why this is not left to Recharts.
  const cAxis = useMemo(
    () => niceAxis(Math.max(...data.map((d) => Math.abs(d.C)))),
    [data],
  );
  const jAxis = useMemo(
    () => niceAxis(Math.max(...data.map((d) => Math.abs(d.j)))),
    [data],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const isSlab = params.geometry === 'slab';
  const xLabel = isSlab ? 'x (cm)' : 'r (cm)';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Concentration profile" formula={isSlab ? 'C(x)' : 'C(r)'}>
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
              domain={[0, cAxis.max]}
              ticks={cAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={46}
              label={{ value: 'mM', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} mM`, 'C']) as never}
              labelFormatter={((v: unknown) => `${xLabel.slice(0, 1)} = ${sci(Number(v))} cm`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="C"
              stroke="#0ea5e9"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Local flux" formula={isSlab ? 'j(x)' : 'j(r)'}>
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
              domain={[0, jAxis.max]}
              ticks={jAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{
                value: 'mol/cm²·s',
                angle: -90,
                position: 'insideLeft',
                fontSize: 10,
                fill: axis,
              }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} mol/cm²·s`, 'j']) as never}
              labelFormatter={((v: unknown) => `${xLabel.slice(0, 1)} = ${sci(Number(v))} cm`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="j"
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
