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
import { profile, shearStress, type NewtonParams } from '../../lib/newton';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * u(y) and tau(y) side by side. The velocity profile is a straight line and
 * the stress is FLAT — the momentum version of "the profile is linear and J
 * is constant in a slab". Position runs along the horizontal axis, matching
 * the other modules; the canvas shows the same profile in its conventional
 * sideways orientation.
 */
export function NewtonChart({ params, dark }: { params: NewtonParams; dark: boolean }) {
  const data = useMemo(() => profile(params, 60), [params]);

  const uAxis = useMemo(
    () => niceAxis(Math.max(1e-12, ...data.map((d) => Math.abs(d.u)))),
    [data],
  );
  const tauAxis = useMemo(
    () => niceAxis(Math.max(1e-12, Math.abs(shearStress(params)) * 1.5)),
    [params],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Velocity profile" formula="u(y)">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="y"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'y (m)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, uAxis.max]}
              ticks={uAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={50}
              label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} m/s`, 'u']) as never}
              labelFormatter={((v: unknown) => `y = ${sci(Number(v))} m`) as never}
            />
            <ReferenceLine y={0} stroke={axis} strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="u"
              stroke="#10b981"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="Shear stress" formula="τ(y)">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="y"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'y (m)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, tauAxis.max]}
              ticks={tauAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'Pa', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} Pa`, 'τ']) as never}
              labelFormatter={((v: unknown) => `y = ${sci(Number(v))} m`) as never}
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
