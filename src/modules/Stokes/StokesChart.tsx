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
import { terminalVelocity, timeConstant, velocityAt, type StokesParams } from '../../lib/stokes';
import { niceAxis, sci, tick, timeS } from '../../lib/format';

/**
 * Left: the approach to terminal velocity — an exponential that is over in
 * a few tau, where tau is typically MICROseconds. The x-axis unit gives the
 * game away. Right: v-inf against radius on log-log axes — a dead-straight
 * line of slope 2, which is the a-squared law that makes small things
 * effectively unsinkable without a centrifuge.
 */
export function StokesChart({ params, dark }: { params: StokesParams; dark: boolean }) {
  const tau = timeConstant(params);
  const vinf = Math.abs(terminalVelocity(params));

  const approach = useMemo(() => {
    const out: { t: number; v: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const t = (5 * tau * i) / 100;
      out.push({ t: t * 1e6, v: Math.abs(velocityAt(params, t)) });
    }
    return out;
  }, [params, tau]);

  const scaling = useMemo(() => {
    const out: { a: number; v: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const a = 10 ** (-8 + (5 * i) / 60); // 10 nm .. 1 mm
      out.push({
        a: a * 1e6,
        v: Math.abs(terminalVelocity({ ...params, a })),
      });
    }
    return out;
  }, [params]);

  const vAxis = useMemo(() => niceAxis(Math.max(1e-15, vinf)), [vinf]);
  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Approach to terminal velocity" formula="v(t) = v∞(1 − e^(−t/τ))">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={approach} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 't (µs) — note the unit', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[0, vAxis.max]}
              ticks={vAxis.ticks}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} m/s`, 'v']) as never}
              labelFormatter={((v: unknown) => `t = ${sci(Number(v))} µs`) as never}
            />
            <ReferenceLine x={tau * 1e6} stroke={dark ? '#fbbf24' : '#d97706'} strokeDasharray="4 3" />
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
        <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          τ = {timeS(tau)} for this particle. The entire drama is over before anything
          could be seen — which is why the canvas shows only the aftermath.
        </p>
      </ChartFrame>

      <ChartFrame title="Terminal velocity vs size" formula="v∞ ∝ a² (log–log slope 2)">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={scaling} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="a"
              type="number"
              scale="log"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'a (µm)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              type="number"
              scale="log"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'm/s', angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} m/s`, 'v∞']) as never}
              labelFormatter={((v: unknown) => `a = ${sci(Number(v))} µm`) as never}
            />
            <ReferenceLine x={params.a * 1e6} stroke={dark ? '#38bdf8' : '#0284c7'} strokeDasharray="4 3" />
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
        <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          Ten times smaller means a hundred times slower. Halving isn't the half of it.
        </p>
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
