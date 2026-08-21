interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="space-y-1.5">
      {label && (
        <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={opt.title}
              onClick={() => onChange(opt.value)}
              className={
                'flex-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200')
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
