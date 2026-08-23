import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Moon, Sun, Waves } from 'lucide-react';
import { DividerModule } from './modules/Divider/DividerModule';
import { GasLiquidModule } from './modules/GasLiquid/GasLiquidModule';
import { UnsteadyModule } from './modules/UnsteadyDiffusion/UnsteadyModule';
import { FicksLawModule } from './modules/FicksLaw/FicksLawModule';
import { FourierLawModule } from './modules/FourierLaw/FourierLawModule';
import { NewtonModule } from './modules/NewtonViscosity/NewtonModule';
import { StokesModule } from './modules/Stokes/StokesModule';
import { PoiseuilleModule } from './modules/Poiseuille/PoiseuilleModule';
import { PecletModule } from './modules/Peclet/PecletModule';
import { CoolingModule } from './modules/Cooling/CoolingModule';
import { WallModule } from './modules/Wall/WallModule';
import { TransientModule } from './modules/Transient/TransientModule';
import { HeislerModule } from './modules/Transient/HeislerModule';
import { CorrelationsModule } from './modules/Correlations/CorrelationsModule';
import { MixingCupModule } from './modules/MixingCup/MixingCupModule';
import { PerfusionModule } from './modules/Perfusion/PerfusionModule';

/**
 * Modules are grouped by the PHYSICS, not by any one course's lesson plan —
 * the menu is meant to make sense to a student at any university. Within a
 * group, easier things come first. The URL hash stays a shareable deep link.
 */
interface ModuleEntry {
  id: string;
  name: string;
  tag: string;
}
interface ModuleGroup {
  title: string;
  /** Short label for the header button. */
  short: string;
  items: ModuleEntry[];
}

const GROUPS: ModuleGroup[] = [
  {
    title: 'Start here',
    short: 'Start',
    items: [
      { id: 'divider', name: 'The divider', tag: 'no equations — pull the wall, watch' },
      { id: 'gasliquid', name: 'Gases & liquids', tag: 'why D is what it is — flights vs rattling' },
    ],
  },
  {
    title: 'The phenomenological flux laws',
    short: 'Flux laws',
    items: [
      { id: 'fick', name: "Fick's law", tag: 'mass down a gradient' },
      { id: 'fourier', name: "Fourier's law", tag: 'heat down a gradient' },
      { id: 'newton', name: "Newton's viscosity", tag: 'momentum down a gradient' },
      { id: 'wall', name: 'The wall', tag: 'resistances as circuits' },
    ],
  },
  {
    title: 'Unsteady transport',
    short: 'Unsteady',
    items: [
      { id: 'bolus', name: 'Bolus dispersion', tag: 'a burst spreading as √t' },
      { id: 'touch', name: 'Sudden contact', tag: 'erf fronts and the 44 °C line' },
      { id: 'heisler', name: 'Heisler charts', tag: 'the finite body — Bi and Fo decide' },
    ],
  },
  {
    title: 'Momentum & flow',
    short: 'Momentum',
    items: [
      { id: 'stokes', name: 'Stokes drag', tag: 'settling & centrifuges' },
      { id: 'poiseuille', name: 'Poiseuille & friends', tag: 'tube · parallel plates · falling film' },
    ],
  },
  {
    title: 'Convection',
    short: 'Convection',
    items: [
      { id: 'peclet', name: 'The Péclet number', tag: 'diffusion races the flow' },
      { id: 'cooling', name: 'Law of cooling', tag: 'h, τ = ρVc/hA, Biot — and the fin' },
      { id: 'mixingcup', name: 'The mixing cup', tag: 'what "the" stream temperature means' },
      { id: 'correlations', name: 'Nu & Sh correlations', tag: 'the lookup chart, computed live' },
      // Hidden from the nav for now (module code intact — restore by
      // uncommenting): { id: 'perfusion', name: 'The perfused channel', tag: 'can the flow feed every cell?' },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.items);
type ModuleId = string;

function initialModule(): ModuleId {
  const h = window.location.hash.replace('#', '');
  if (h === 'about') return 'about';
  return ALL.find((m) => m.id === h)?.id ?? 'divider';
}

function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          About
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          FlowAndFlux is a collection of interactive simulations for learning
          transport phenomena — diffusion, heat conduction, viscous flow, and
          convection. Each module lets you drive the physics with your own
          numbers and watch what the equations actually describe.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Disclaimer
        </h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          This site is for <strong>visualization and educational purposes
          only</strong>. The simulations are built to make transport concepts
          visible and intuitive — not to produce authoritative numbers. They
          are not intended for research, engineering design work, solving
          homework problems, or any application where the results matter
          beyond building your own understanding. Some visual choices (such as
          animation speeds) are deliberately not to physical scale; where that
          is the case, the page says so.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Contact
        </h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          For tool requests, bug reports, or any other feedback, contact
          Prof. Colin Hisey at{' '}
          <a
            href="mailto:colin.hisey@northwestern.edu"
            className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:decoration-sky-700 dark:hover:text-sky-300"
          >
            colin.hisey@northwestern.edu
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [moduleId, setModuleId] = useState<ModuleId>(initialModule);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const onHash = () => setModuleId(initialModule());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = (id: ModuleId) => {
    setModuleId(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => select('divider')}
            aria-label="FlowAndFlux home"
            className="flex min-w-0 shrink-0 items-center gap-3 rounded-lg px-1 py-0.5 text-left transition-opacity hover:opacity-75"
          >
            <Waves size={20} className="shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="min-w-0">
              <span className="block text-sm font-bold tracking-tight">FlowAndFlux</span>
              <span className="hidden text-[11px] leading-tight text-slate-500 dark:text-slate-400 sm:block">
                Transport phenomena, made visible
              </span>
            </span>
          </button>

          <ModulePicker current={moduleId} onSelect={select} />

          <button
            type="button"
            onClick={() => select('about')}
            className={
              'ml-auto shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ' +
              (moduleId === 'about'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100')
            }
          >
            About
          </button>

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
        {moduleId === 'divider' && <DividerModule dark={dark} />}
        {moduleId === 'gasliquid' && <GasLiquidModule dark={dark} />}
        {moduleId === 'fick' && <FicksLawModule dark={dark} />}
        {moduleId === 'fourier' && <FourierLawModule dark={dark} />}
        {moduleId === 'wall' && <WallModule dark={dark} />}
        {moduleId === 'bolus' && <UnsteadyModule dark={dark} />}
        {moduleId === 'touch' && <TransientModule dark={dark} />}
        {moduleId === 'heisler' && <HeislerModule dark={dark} />}
        {moduleId === 'newton' && <NewtonModule dark={dark} />}
        {moduleId === 'stokes' && <StokesModule dark={dark} />}
        {moduleId === 'poiseuille' && <PoiseuilleModule dark={dark} />}
        {moduleId === 'peclet' && <PecletModule dark={dark} />}
        {moduleId === 'cooling' && <CoolingModule dark={dark} />}
        {moduleId === 'mixingcup' && <MixingCupModule dark={dark} />}
        {moduleId === 'correlations' && <CorrelationsModule dark={dark} />}
        {moduleId === 'perfusion' && <PerfusionModule dark={dark} />}
        {moduleId === 'about' && <AboutPage />}
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

/**
 * The module menu: one header button per physics group (five in all), each
 * opening its own small dropdown. Single-module groups act as plain
 * buttons. The active group is highlighted so you always know roughly
 * where you are, and the page's own header says exactly.
 */
function ModulePicker({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (id: string) => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (openIdx === null) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenIdx(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIdx(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openIdx]);

  return (
    <nav
      ref={rootRef}
      aria-label="Modules"
      // No overflow container here: the dropdown panels are absolutely
      // positioned, and an overflow-x-auto ancestor CLIPS them (they open
      // invisibly and only a stray scrollbar shows). On narrow screens the
      // buttons wrap to a second row instead.
      className="ml-2 flex min-w-0 flex-wrap items-center gap-1"
    >
      {GROUPS.map((g, i) => {
        const inGroup = g.items.some((m) => m.id === current);
        const single = g.items.length === 1;
        const open = openIdx === i;
        const btnClass =
          'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ' +
          (inGroup
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100');
        if (single) {
          return (
            <button
              key={g.title}
              type="button"
              onClick={() => {
                onSelect(g.items[0].id);
                setOpenIdx(null);
              }}
              className={btnClass}
            >
              {g.short}
            </button>
          );
        }
        return (
          <div key={g.title} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              aria-expanded={open}
              aria-haspopup="menu"
              className={btnClass}
            >
              {g.short}
              <ChevronDown
                size={13}
                className={'transition-transform ' + (open ? 'rotate-180' : '')}
              />
            </button>
            {open && (
              <div
                role="menu"
                className="absolute left-0 top-full z-30 mt-2 w-[290px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {g.title}
                </p>
                {g.items.map((m) => {
                  const isActive = m.id === current;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSelect(m.id);
                        setOpenIdx(null);
                      }}
                      className={
                        'block w-full rounded-lg px-2 py-1.5 text-left transition-colors ' +
                        (isActive
                          ? 'bg-sky-50 dark:bg-sky-950/50'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800')
                      }
                    >
                      <span
                        className={
                          'block text-sm font-medium ' +
                          (isActive
                            ? 'text-sky-800 dark:text-sky-300'
                            : 'text-slate-800 dark:text-slate-100')
                        }
                      >
                        {m.name}
                      </span>
                      <span className="block text-[11px] leading-snug text-slate-400 dark:text-slate-500">
                        {m.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
