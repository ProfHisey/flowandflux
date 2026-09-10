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
import type { RttFace } from '../../lib/rtt';
import { steadyOutlet } from '../../lib/rtt';
import { CP_WATER, DUCT_AREA, RHO_WATER, type RttParams } from './presets';
import type { RttStats } from './RttCanvas';

/**
 * Left: the ledger over time. The source is drawn as a solid line and the
 * sum storage + net flux as a dashed one on top of it; that they coincide is
 * the theorem, measured. The two pieces are drawn faint underneath so you
 * can watch them trade off when the box is dragged.
 *
 * Right, per face: the steady prediction against the measured outlet, or on
 * the wealth face the two returns and the gap between them.
 */
export function RttChart({
  history,
  params,
  dark,
}: {
  history: RttStats[];
  params: RttParams;
  dark: boolean;
}) {
  const face = params.face;
  const scale = face === 'energy' ? CP_WATER : 1;
  const unit = ledgerUnit(face);
  const tUnit = face === 'wealth' ? 'yr' : 's';

  const ledger = useMemo(
    () =>
      history.map((s) => ({
        t: s.tPhys,
        source: s.source * scale,
        sum: (s.storage + s.outflux - s.influx) * scale,
        storage: s.storage * scale,
        net: (s.outflux - s.influx) * scale,
      })),
    [history, scale],
  );

  const right = useMemo((): Record<string, number>[] => {
    if (face === 'wealth') {
      return history.map((s) => ({ t: s.tPhys, twr: s.twr * 100, dwr: s.dwr * 100 }));
    }
    if (face === 'mass') {
      return history.map((s) => ({ t: s.tPhys, mIn: s.mIn, mOut: s.mOut }));
    }
    return history.map((s) => ({ t: s.tPhys, bOut: s.bOutAvg, bIn: s.bInAvg }));
  }, [history, face]);

  const predicted = useMemo(() => {
    if (face === 'energy') return steadyOutlet(params.bIn, params.mdot, params.source / CP_WATER);
    if (face === 'momentum') {
      return steadyOutlet(params.mdot / (RHO_WATER * DUCT_AREA), params.mdot, params.source);
    }
    return undefined;
  }, [face, params]);

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const inCol = dark ? '#818cf8' : '#4f46e5';
  const outCol = dark ? '#fbbf24' : '#d97706';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChartFrame title="The ledger, live" formula={`source vs storage + net flux · ${unit}`}>
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={ledger} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => v.toFixed(0)}
              stroke={axis}
              tick={{ fontSize: 11 }}
              label={{ value: `t (${tUnit})`, position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
            />
            <YAxis
              tickFormatter={fmtTick}
              stroke={axis}
              tick={{ fontSize: 11 }}
              width={52}
              label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }}
            />
            <Tooltip
              contentStyle={tooltipStyle(dark)}
              formatter={((v: unknown, name: unknown) => [
                `${fmtTick(Number(v))} ${unit}`,
                name === 'source' ? 'source' : name === 'sum' ? 'storage + net flux' : name === 'storage' ? 'storage' : 'net flux (out − in)',
              ]) as never}
              labelFormatter={((v: unknown) => `t = ${Number(v).toFixed(2)} ${tUnit}`) as never}
            />
            <ReferenceLine y={0} stroke={axis} />
            <Line type="monotone" dataKey="storage" stroke={dark ? '#475569' : '#94a3b8'} strokeWidth={1.25} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="net" stroke={outCol} strokeWidth={1.25} strokeOpacity={0.55} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="source" stroke={dark ? '#f87171' : '#dc2626'} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="sum" stroke={dark ? '#f8fafc' : '#0f172a'} strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          Red: what the device adds. Dashed: storage plus net flux, measured independently.
          They lie on top of each other — that is the theorem. Faint: the two pieces, which
          trade off as you drag the box.
        </p>
      </ChartFrame>

      {face === 'wealth' ? (
        <ChartFrame title="Two returns, one account" formula="time-weighted vs dollar-weighted · %/yr">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={right} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(0)} stroke={axis} tick={{ fontSize: 11 }} label={{ value: 't (yr)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }} />
              <YAxis tickFormatter={(v: number) => v.toFixed(0)} stroke={axis} tick={{ fontSize: 11 }} width={40} label={{ value: '%/yr', angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }} />
              <Tooltip contentStyle={tooltipStyle(dark)} formatter={((v: unknown, name: unknown) => [`${Number(v).toFixed(2)} %/yr`, name === 'twr' ? 'time-weighted (the fund)' : 'dollar-weighted (your account)']) as never} labelFormatter={((v: unknown) => `t = ${Number(v).toFixed(2)} yr`) as never} />
              <ReferenceLine y={params.source * 100} stroke={axis} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="twr" stroke={inCol} strokeWidth={2.25} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="dwr" stroke={outCol} strokeWidth={2.25} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Indigo: what a share that stayed the whole time earned — the fund. Amber: what your
            dollars earned, flows and all. The vertical distance is the behavior gap; the
            dashed line is the trend return.
          </p>
        </ChartFrame>
      ) : face === 'mass' ? (
        <ChartFrame title="Through the two faces" formula="ṁ in vs out · kg/s">
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={right} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(0)} stroke={axis} tick={{ fontSize: 11 }} label={{ value: 't (s)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }} />
              <YAxis tickFormatter={fmtTick} stroke={axis} tick={{ fontSize: 11 }} width={48} label={{ value: 'kg/s', angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }} />
              <Tooltip contentStyle={tooltipStyle(dark)} formatter={((v: unknown, name: unknown) => [`${fmtTick(Number(v))} kg/s`, name === 'mIn' ? 'in' : 'out']) as never} labelFormatter={((v: unknown) => `t = ${Number(v).toFixed(2)} s`) as never} />
              <ReferenceLine y={params.mdot} stroke={axis} strokeDasharray="4 3" />
              <Line type="monotone" dataKey="mIn" stroke={inCol} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="mOut" stroke={outCol} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            The outlet is the inlet, delayed by a transit time. When they differ, the box is
            storing — and the storage term is the gap between these two curves.
          </p>
        </ChartFrame>
      ) : (
        <ChartFrame
          title="Measured outlet vs the steady balance"
          formula={face === 'energy' ? 'T_out = T_in + Q/(ṁ c_p)' : 'u_out = u_in + F/ṁ'}
        >
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={right} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" />
              <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(0)} stroke={axis} tick={{ fontSize: 11 }} label={{ value: 't (s)', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }} />
              <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(face === 'energy' ? 1 : 2)} stroke={axis} tick={{ fontSize: 11 }} width={48} label={{ value: face === 'energy' ? '°C' : 'm/s', angle: -90, position: 'insideLeft', fontSize: 10, fill: axis }} />
              <Tooltip contentStyle={tooltipStyle(dark)} formatter={((v: unknown, name: unknown) => [`${Number(v).toFixed(3)} ${face === 'energy' ? '°C' : 'm/s'}`, name === 'bOut' ? 'outlet, measured' : 'inlet, measured']) as never} labelFormatter={((v: unknown) => `t = ${Number(v).toFixed(2)} s`) as never} />
              {predicted !== undefined && <ReferenceLine y={predicted} stroke={dark ? '#f87171' : '#dc2626'} strokeDasharray="4 3" />}
              <Line type="monotone" dataKey="bIn" stroke={inCol} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="bOut" stroke={outCol} strokeWidth={2.25} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            Amber is what actually crosses the downstream face; the red dashed line is the
            steady balance solved by hand. They meet once the storage term has averaged out
            — about one transit time after any change.
          </p>
        </ChartFrame>
      )}
    </div>
  );
}

function ledgerUnit(face: RttFace): string {
  switch (face) {
    case 'mass': return 'kg/s';
    case 'momentum': return 'N';
    case 'energy': return 'W';
    case 'wealth': return '$/yr';
  }
}

function fmtTick(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e4 || a < 1e-2) return v.toExponential(0);
  return Number(v.toPrecision(3)).toString();
}

function ChartFrame({ title, formula, children }: { title: string; formula: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
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
