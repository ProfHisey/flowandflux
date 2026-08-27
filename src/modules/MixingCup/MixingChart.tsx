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
import { areaAvgT, mixingCupT, tempAt, type MixingCupParams } from '../../lib/mixingcup';
import { niceAxis, tick } from '../../lib/format';

/**
 * Left: the temperature profile across the tube, with both averages drawn
 * as horizontal lines — the gap between them IS the module. Right: how
 * that gap depends on profile fullness n, with the current n marked.
 */
export function MixingChart({ params, dark }: { params: MixingCupParams; dark: boolean }) {
  const profileData = useMemo(() => {
    const out: { rho: number; T: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const rho = i / 100;
      out.push({ rho, T: tempAt(params, rho) });
    }
    return out;
  }, [params]);

  const nData = useMemo(() => {
    const out: { n: number; mc: number; avg: number }[] = [];
    for (let i = 0; i <= 80; i++) {
      const n = 0.5 + (i / 80) * 7.5;
      out.push({
        n,
        mc: mixingCupT({ ...params, n }),
        avg: areaAvgT({ ...params, n }),
      });
    }
    return out;
  }, [params]);

  const tLo = Math.min(params.Tw, params.Tc);
  const tHi = Math.max(params.Tw, params.Tc);
  const tAxis = useMemo(() => niceAxis(tHi || 1), [tHi]);
  const yDomain: [number, number] = [Math.min(0, Math.floor(tLo)), tAxis.max];

  const Tmc = mixingCupT(params);
  const Tavg = areaAvgT(params);

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const amber = dark ? '#fbbf24' : '#d97706';
  const sky = '#0ea5e9';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Across the tube" formula="T(r/R), with both averages">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={profileData} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="rho"
              type="number"
              domain={[0, 1]}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'r/R (center → wall)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={44}
              label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${Number(v).toFixed(1)} °C`, 'T']) as never}
              labelFormatter={((v: unknown) => `r/R = ${Number(v).toFixed(2)}`) as never}
            />
            <ReferenceLine
              y={Tmc}
              stroke={amber}
              strokeWidth={1.75}
              label={{ value: `cup ${Tmc.toFixed(1)}`, position: 'insideBottomLeft', fontSize: 10, fill: amber }}
            />
            <ReferenceLine
              y={Tavg}
              stroke={axis}
              strokeDasharray="4 3"
              label={{ value: `area avg ${Tavg.toFixed(1)}`, position: 'insideTopLeft', fontSize: 10, fill: axis }}
            />
            <Line type="monotone" dataKey="T" stroke={sky} strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame title="The gap vs profile fullness" formula="T_mc(n) and T_avg(n)">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={nData} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="n"
              type="number"
              domain={[0.5, 8]}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'profile fullness n', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={44}
              label={{ value: '°C', angle: -90, position: 'insideLeft', fontSize: 11, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown, name: unknown) => [
                `${Number(v).toFixed(1)} °C`,
                name === 'mc' ? 'mixing cup' : 'area average',
              ]) as never}
              labelFormatter={((v: unknown) => `n = ${Number(v).toFixed(1)}`) as never}
            />
            <ReferenceLine x={params.n} stroke={amber} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="avg" stroke={axis} strokeWidth={1.75} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="mc" stroke={amber} strokeWidth={2.25} dot={false} isAnimationActive={false} />
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
