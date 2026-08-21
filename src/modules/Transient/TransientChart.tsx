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
import {
  alphaOf,
  centerTemp,
  contactTemp,
  erf,
  fourierOf,
  semiInfFlux,
  tempAt,
  type ContactBody,
  type HeislerParams,
} from '../../lib/transient';
import { niceAxis, sci, tick } from '../../lib/format';

/**
 * Touch tab: the REAL T(x) profile at a physical time (both bodies, real
 * alphas — note how far the front has crawled into carpet vs steel), and
 * the surface flux starving as 1/sqrt(t): the first instant of contact is
 * when the burn happens.
 */
export function TouchChart({
  left,
  right,
  t,
  dark,
}: {
  left: ContactBody;
  right: ContactBody;
  t: number;
  dark: boolean;
}) {
  const Tc = contactTemp(left, right);
  const aL = alphaOf(left.k, left.rho, left.c);
  const aR = alphaOf(right.k, right.rho, right.c);

  const data = useMemo(() => {
    // Window sized to the faster side's penetration.
    const spanHalf = Math.max(
      3.8 * Math.sqrt(aL * t),
      3.8 * Math.sqrt(aR * t),
      1e-5,
    );
    const out: { x: number; T: number }[] = [];
    for (let i = 0; i <= 160; i++) {
      const x = -spanHalf + (2 * spanHalf * i) / 160;
      const T =
        x < 0
          ? Tc + (left.T - Tc) * erf(-x / (2 * Math.sqrt(aL * t)))
          : Tc + (right.T - Tc) * erf(x / (2 * Math.sqrt(aR * t)));
      out.push({ x: x * 1000, T }); // mm for the axis
    }
    return out;
  }, [left, right, t, Tc, aL, aR]);

  const fluxData = useMemo(() => {
    const p = { k: right.k, rho: right.rho, c: right.c, Ti: right.T, Ts: Tc };
    const out: { tp: number; q: number }[] = [];
    for (let i = 1; i <= 80; i++) {
      const tp = (2 * t * i) / 80;
      out.push({ tp, q: Math.abs(semiInfFlux(p, tp)) });
    }
    return out;
  }, [right, Tc, t]);

  const tAxis = useMemo(
    () => niceAxis(Math.max(left.T, right.T, 1)),
    [left.T, right.T],
  );
  const qAxis = useMemo(
    () => niceAxis(Math.max(1e-9, ...fluxData.map((d) => d.q))),
    [fluxData],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="Real profile at time t" formula="T(x, t) — physical α">
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
              label={{ value: 'x (mm, 0 = interface)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
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
              labelFormatter={((v: unknown) => `x = ${sci(Number(v))} mm`) as never}
            />
            <ReferenceLine x={0} stroke={axis} strokeDasharray="2 2" />
            <ReferenceLine y={Tc} stroke={dark ? '#fbbf24' : '#d97706'} strokeDasharray="4 3" />
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

      <ChartFrame title="Flux at the interface" formula="q″(t) ∝ 1/√t">
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={fluxData} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="tp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: 't (s)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
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
              labelFormatter={((v: unknown) => `t = ${sci(Number(v))} s`) as never}
            />
            <ReferenceLine x={t} stroke={dark ? '#38bdf8' : '#0284c7'} strokeDasharray="4 3" />
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

/**
 * Heisler tab: the centre temperature's whole history, with "now" marked —
 * the curve a Heisler chart encodes, drawn directly.
 */
export function HeislerChart({ params, dark }: { params: HeislerParams; dark: boolean }) {
  const data = useMemo(() => {
    const span = Math.max(params.t * 1.6, 1);
    const out: { tp: number; T0: number; Ts: number }[] = [];
    for (let i = 1; i <= 120; i++) {
      const tp = (span * i) / 120;
      const p = { ...params, t: tp };
      out.push({ tp, T0: centerTemp(p), Ts: tempAt(p, 1) });
    }
    return out;
  }, [params]);

  const tAxis = useMemo(
    () => niceAxis(Math.max(params.Ti, params.Tinf, 1)),
    [params],
  );

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const foNow = fourierOf(params);

  return (
    <ChartFrame
      title="Centre and surface histories"
      formula={`θ₀/θᵢ = C₁·exp(−ζ₁²·Fo) · Fo now = ${String(Number(foNow.toPrecision(3)))}`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="tp"
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
            formatter={((v: unknown, name: unknown) => [
              `${sci(Number(v))} °C`,
              name === 'T0' ? 'centre' : 'surface',
            ]) as never}
            labelFormatter={((v: unknown) => `t = ${sci(Number(v))} s`) as never}
          />
          <ReferenceLine y={params.Tinf} stroke={axis} strokeDasharray="2 2" />
          <ReferenceLine x={params.t} stroke={dark ? '#38bdf8' : '#0284c7'} strokeDasharray="4 3" />
          <Line type="monotone" dataKey="Ts" stroke={dark ? '#64748b' : '#94a3b8'} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="T0" stroke="#ef4444" strokeWidth={2.25} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
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
