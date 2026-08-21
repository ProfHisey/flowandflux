import { useEffect, useState } from 'react';
import { Moon, Sun, Waves } from 'lucide-react';
import { FicksLawModule } from './modules/FicksLaw/FicksLawModule';

export default function App() {
  const [dark, setDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Waves size={20} className="text-sky-600 dark:text-sky-400" />
          <div className="min-w-0">
            <span className="block text-sm font-bold tracking-tight">FlowAndFlux</span>
            <span className="block text-[11px] leading-tight text-slate-500 dark:text-slate-400">
              Transport phenomena, made visible
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className="ml-auto rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <FicksLawModule dark={dark} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4">
        <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          FlowAndFlux · built for BME 378 at Northwestern, and for anyone else learning
          transport. Physics is real; animation speed is not.
        </p>
      </footer>
    </div>
  );
}
