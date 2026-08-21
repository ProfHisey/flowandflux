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
  nusseltOf,
  prandtl,
  reynolds,
  schmidt,
  type CorrParams,
} from '../../lib/correlations';
import { sci, tick } from '../../lib/format';

/**
 * The correlation chart the textbooks print, drawn live: Nu and Sh against
 * Re on log-log axes for the chosen geometry and fluid, with "you are
 * here" marked. The vertical gap between the two lines is (Sc/Pr)^{1/3} —
 * in water, about a factor of five, everywhere.
 */
export function CorrChart({ params, dark }: { params: CorrParams; dark: boolean }) {
  const data = useMemo(() => {
    const Pr = prandtl(params.fluid);
    const Sc = schmidt(params);
    const out: { Re: number; Nu: number; Sh: number }[] = [];
    for (let i = 0; i <= 80; i++) {
      const Re = 10 ** (0 + (6 * i) / 80); // 1 .. 1e6
      const Nu = nusseltOf(params.geometry, Re, Pr);
      const Sh = nusseltOf(params.geometry, Re, Sc);
      if (Nu > 0 && Sh > 0) out.push({ Re, Nu, Sh });
    }
    return out;
  }, [params]);

  const grid = dark ? '#1e293b' : '#e2e8f0';
  const axis = dark ? '#64748b' : '#94a3b8';
  const ReNow = Math.min(1e6, Math.max(1, reynolds(params)));

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          The correlation, drawn live
        </h3>
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
          Nu(Re, Pr) and Sh(Re, Sc), log–log
        </span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 20, left: 4 }}>
          <CartesianGrid stroke={grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="Re"
            type="number"
            scale="log"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tick}
            stroke={axis}
            tick={{ fontSize: 11 }}
            label={{ value: 'Re', position: 'insideBottom', offset: -12, fontSize: 11, fill: axis }}
          />
          <YAxis
            type="number"
            scale="log"
            domain={['auto', 'auto']}
            tickFormatter={tick}
            stroke={axis}
            tick={{ fontSize: 11 }}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: dark ? '#0f172a' : '#ffffff',
              border: `1px solid ${dark ? '#1e293b' : '#e2e8f0'}`,
              borderRadius: 8,
              fontSize: 12,
              color: dark ? '#e2e8f0' : '#0f172a',
            }}
            formatter={((v: unknown, name: unknown) => [sci(Number(v)), name === 'Nu' ? 'Nu (heat)' : 'Sh (mass)']) as never}
            labelFormatter={((v: unknown) => `Re = ${sci(Number(v))}`) as never}
          />
          <ReferenceLine x={ReNow} stroke={dark ? '#38bdf8' : '#0284c7'} strokeDasharray="4 3" />
          <Line type="monotone" dataKey="Nu" stroke="#f59e0b" strokeWidth={2.25} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="Sh" stroke="#22d3ee" strokeWidth={2.25} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
        Amber: Nu (heat). Cyan: Sh (mass). The vertical gap between them is
        (Sc/Pr)<sup>1/3</sup> — a constant factor at every Re for the ⅓-power family.
      </p>
    </div>
  );
}
