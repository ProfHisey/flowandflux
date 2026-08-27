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
import { peclet, profile, totalFlux, type PecletParams } from '../../lib/peclet';
import { molPerCm3TomM } from '../../lib/fick';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * Left: the profile against the pure-diffusion straight line — the bend IS
 * Pe. Right: total flux across six decades of Pe, with the two asymptotes
 * this whole module exists to separate: the diffusion floor (flat) and the
 * convection line (slope 1). The knee sits near Pe ~ 1, where the two
 * mechanisms tie.
 */
export function PecletChart({ params, dark }: { params: PecletParams; dark: boolean }) {
  const data = useMemo(
    () =>
      profile(params, 140).map((d) => ({
        x: d.x,
        C: molPerCm3TomM(d.C),
        Cdiff: molPerCm3TomM(d.Cdiff),
      })),
    [params],
  );

  const fluxSweep = useMemo(() => {
    const out: { Pe: number; N: number }[] = [];
    for (let i = 0; i <= 72; i++) {
      const Pe = 10 ** (-2 + (6 * i) / 72); // 0.01 .. 10^4
      const v = (Pe * params.D) / params.L;
      out.push({ Pe, N: totalFlux({ ...params, v }) });
    }
    return out;
  }, [params]);

  const cAxis = useMemo(
    () => niceAxis(Math.max(1e-12, ...data.map((d) => Math.max(d.C, d.Cdiff)))),
    [data],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const Pe = peclet(params);
  const Ndiff = (params.D * (params.C0 - params.CL)) / params.L;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Profile vs the diffusion line" formula={`C(x) at Pe = ${fmt(Pe)}`}>
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
              label={{ value: 'x (cm)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
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
              formatter={((v: unknown, name: unknown) => [
                `${sci(Number(v))} mM`,
                name === 'C' ? 'with flow' : 'pure diffusion (Pe = 0)',
              ]) as never}
              labelFormatter={((v: unknown) => `x = ${sci(Number(v))} cm`) as never}
            />
            <Line
              type="monotone"
              dataKey="Cdiff"
              stroke={dark ? '#475569' : '#94a3b8'}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
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

      <ChartFrame title="Flux across the regimes" formula="N(Pe), log–log">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={fluxSweep} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="Pe"
              type="number"
              scale="log"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'Pe = vL/D', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              type="number"
              scale="log"
              domain={['auto', 'auto']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={54}
              label={{ value: 'mol/cm²·s', angle: -90, position: 'insideLeft', fontSize: 9, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown) => [`${sci(Number(v))} mol/cm²·s`, 'N']) as never}
              labelFormatter={((v: unknown) => `Pe = ${sci(Number(v))}`) as never}
            />
            <ReferenceLine y={Ndiff} stroke={dark ? '#64748b' : '#94a3b8'} strokeDasharray="4 3" />
            <ReferenceLine
              x={Math.min(1e4, Math.max(0.01, Pe))}
              stroke={dark ? '#38bdf8' : '#0284c7'}
              strokeDasharray="4 3"
            />
            <Line
              type="monotone"
              dataKey="N"
              stroke="#f59e0b"
              strokeWidth={2.25}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          Flat floor at small Pe: diffusion sets the rate, flow is decoration. Slope-1
          climb at large Pe: N = vC₀, diffusion is decoration. The knee is Pe ≈ 1.
        </p>
      </ChartFrame>
    </div>
  );
}

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e4) return v.toExponential(1);
  return String(Number(v.toPrecision(3)));
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
