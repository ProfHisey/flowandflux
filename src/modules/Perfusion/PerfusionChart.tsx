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
import { minC, supplyC, tissueC, type PerfusionParams } from '../../lib/perfusion';
import { molPerCm3TomM } from '../../lib/fick';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * Left: the two lines that decide everyone's fate — the supply C_s(x)
 * draining linearly, and the tissue floor C_min(x) running a constant
 * offset below it. Where the floor crosses C_crit, the corner begins.
 * Right: the parabolic dip into the tissue at inlet and outlet.
 */
export function PerfusionChart({ params, dark }: { params: PerfusionParams; dark: boolean }) {
  const axialData = useMemo(() => {
    const out: { x: number; Cs: number; Cmin: number }[] = [];
    for (let i = 0; i <= 100; i++) {
      const x = (params.L * i) / 100;
      out.push({
        x,
        Cs: molPerCm3TomM(supplyC(params, x)),
        Cmin: molPerCm3TomM(minC(params, x)),
      });
    }
    return out;
  }, [params]);

  const depthData = useMemo(() => {
    const out: { y: number; Cin: number; Cout: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const y = (params.h2 * i) / 60;
      out.push({
        y: y * 1e4, // µm
        Cin: molPerCm3TomM(tissueC(params, 0, y)),
        Cout: molPerCm3TomM(tissueC(params, params.L, y)),
      });
    }
    return out;
  }, [params]);

  const cAxis = useMemo(
    () => niceAxis(Math.max(1e-9, molPerCm3TomM(params.C0))),
    [params],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const critmM = molPerCm3TomM(params.Ccrit);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Along the channel" formula="C_s(x) and the tissue floor">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={axialData} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
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
              domain={[Math.min(0, ...axialData.map((d) => d.Cmin)), cAxis.max]}
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
                name === 'Cs' ? 'supply (interface)' : 'tissue floor',
              ]) as never}
              labelFormatter={((v: unknown) => `x = ${sci(Number(v))} cm`) as never}
            />
            <ReferenceLine y={critmM} stroke={dark ? '#f87171' : '#dc2626'} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="Cs" stroke="#0ea5e9" strokeWidth={2.25} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Cmin" stroke={dark ? '#818cf8' : '#4f46e5'} strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          Red dashes: C_crit. The floor line crossing it is the moment the corner
          starts to starve.
        </p>
      </ChartFrame>

      <ChartFrame title="Into the tissue" formula="C(y) at inlet vs outlet">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={depthData} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="y"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 'depth into tissue (µm)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              domain={[Math.min(0, ...depthData.map((d) => d.Cout)), cAxis.max]}
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
                name === 'Cin' ? 'at the inlet' : 'at the outlet',
              ]) as never}
              labelFormatter={((v: unknown) => `y = ${sci(Number(v))} µm`) as never}
            />
            <ReferenceLine y={critmM} stroke={dark ? '#f87171' : '#dc2626'} strokeDasharray="4 3" />
            <Line type="monotone" dataKey="Cin" stroke="#0ea5e9" strokeWidth={2.25} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="Cout" stroke={dark ? '#818cf8' : '#4f46e5'} strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          Same parabolic sag at both stations — the outlet just starts from a poorer
          supply. The corner is where both effects stack.
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
