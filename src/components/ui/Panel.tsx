import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={
        'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ' +
        className
      }
    >
      {(title || right) && (
        // flex-wrap so a module with three toolbar controls (Cooling, Newton)
        // drops them onto their own line on a phone instead of widening the
        // panel past the viewport.
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
            )}
          </div>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  unit,
  tone = 'default',
  hint,
}: {
  label: ReactNode;
  value: string;
  unit?: string;
  tone?: 'default' | 'accent' | 'warm';
  hint?: string;
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-sky-700 dark:text-sky-300'
      : tone === 'warm'
        ? 'text-amber-700 dark:text-amber-300'
        : 'text-slate-900 dark:text-slate-100';

  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 font-mono text-[15px] leading-tight tabular-nums ${toneClass}`}>
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{hint}</div>}
    </div>
  );
}
