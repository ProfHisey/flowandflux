import { useState, type ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import { ChevronDown } from 'lucide-react';

export interface TermGloss {
  /** LaTeX for the symbol itself, e.g. "D". */
  symbol: string;
  /** What it is, in words. */
  meaning: string;
  /** Which on-screen control or readout it maps to. */
  maps?: string;
}

/**
 * A governing equation with its terms glossed and mapped back to the
 * simulation, following the course's habit of annotating every symbol on the
 * slide rather than leaving students to infer it.
 */
export function EquationCard({
  title,
  latex,
  terms,
  note,
  defaultOpen = true,
}: {
  title: string;
  latex: string;
  terms?: TermGloss[];
  note?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </span>
        <ChevronDown
          size={16}
          className={
            'shrink-0 text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')
          }
        />
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 px-4 py-4 dark:border-slate-800">
          <div className="overflow-x-auto py-1 text-slate-900 dark:text-slate-100">
            <BlockMath math={latex} />
          </div>

          {terms && terms.length > 0 && (
            <dl className="space-y-1.5">
              {terms.map((t) => (
                <div key={t.symbol} className="flex gap-3 text-sm">
                  <dt className="w-10 shrink-0 pt-0.5 text-slate-900 dark:text-slate-100">
                    <InlineMath math={t.symbol} />
                  </dt>
                  <dd className="text-slate-600 dark:text-slate-400">
                    {t.meaning}
                    {t.maps && (
                      <span className="ml-1.5 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                        {t.maps}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {note && (
            <p className="border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
              {note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
