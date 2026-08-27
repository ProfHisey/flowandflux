import { useId } from 'react';

interface SliderProps {
  label: string;
  /** Rendered next to the label, e.g. "cm²/s". */
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Move in equal ratios rather than equal increments. Right for anything
   *  spanning decades, which in transport is most things. */
  log?: boolean;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

export function Slider({
  label,
  unit,
  value,
  min,
  max,
  step,
  log = false,
  format,
  onChange,
  hint,
}: SliderProps) {
  const id = useId();

  // For log sliders the input rides on log10 and we map back on the way out.
  const toSlider = (v: number) => (log ? Math.log10(v) : v);
  const fromSlider = (v: number) => (log ? 10 ** v : v);

  const sMin = toSlider(min);
  const sMax = toSlider(max);
  const sStep = log ? (sMax - sMin) / 240 : (step ?? (max - min) / 100);

  const display = format ? format(value) : String(Number(value.toPrecision(3)));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span className="font-mono text-sm tabular-nums text-slate-900 dark:text-slate-100">
          {display}
          {unit && <span className="ml-1 text-slate-500 dark:text-slate-400">{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={sMin}
        max={sMax}
        step={sStep}
        value={toSlider(value)}
        aria-valuetext={unit ? `${display} ${unit}` : display}
        onChange={(e) => onChange(fromSlider(Number(e.target.value)))}
        className="ff-range"
      />
      {hint && <p className="text-xs leading-snug text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
