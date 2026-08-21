import { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';

export interface SocraticQuestion {
  q: string;
  /** What to try in the simulation before reasoning it out. */
  probe?: string;
  /** Not "the answer" so much as where the reasoning lands. */
  resolution: string;
}

/**
 * The Socratic Intuition Lab: qualitative questions meant for oral exams and
 * live discussion, not for grading. Each one is answerable by manipulating
 * the simulation above and then explaining what you saw.
 */
export function SocraticPanel({ questions }: { questions: SocraticQuestion[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-3 dark:border-amber-900/50">
        <Lightbulb size={16} className="text-amber-600 dark:text-amber-400" />
        <h2 className="text-sm font-semibold tracking-tight text-amber-900 dark:text-amber-200">
          Socratic Intuition Lab
        </h2>
        <span className="ml-auto text-xs text-amber-700/70 dark:text-amber-400/70">
          {questions.length} questions
        </span>
      </div>

      <ol className="divide-y divide-amber-200 dark:divide-amber-900/50">
        {questions.map((item, i) => {
          const isOpen = open === i;
          return (
            <li key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[11px] font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {item.q}
                </span>
                <ChevronDown
                  size={16}
                  className={
                    'mt-0.5 shrink-0 text-amber-600 transition-transform dark:text-amber-400 ' +
                    (isOpen ? 'rotate-180' : '')
                  }
                />
              </button>

              {isOpen && (
                <div className="space-y-2 px-4 pb-4 pl-12">
                  {item.probe && (
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      <span className="font-medium">Try it: </span>
                      {item.probe}
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.resolution}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
