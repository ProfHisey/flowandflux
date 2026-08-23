import { useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import { N2, collisionRate, flightInDiameters, gasDiffusivity, meanSpeed } from '../../lib/kinetics';
import { stokesEinstein } from '../../lib/fick';
import { GasLiquidCanvas, type WanderStats } from './GasLiquidCanvas';
import { GasLiquid3DCanvas } from './GasLiquid3DCanvas';

/**
 * The statistical mechanics UNDER the diffusion coefficient: same molecules,
 * same temperature, two crowdings. Gas = long free flights between rare
 * collisions; liquid = caged rattling with rare escapes. The four decades
 * between D(gas) and D(liquid) live entirely in that difference.
 */

// The worked example the cards quote: N2 at 300 K and 1 atm, and a small
// solute in room-temperature water. Computed from the same lib the
// regression checks verify — not typed in by hand.
const T_EX = 300;
const P_EX = 101325;
const VBAR = meanSpeed(T_EX, N2.m); // m/s
const FLIGHT_DIAM = flightInDiameters(T_EX, P_EX, N2.d);
const COLL_RATE = collisionRate(T_EX, P_EX, N2.d, N2.m); // 1/s
const D_GAS = gasDiffusivity(T_EX, P_EX, N2.d, N2.m); // cm^2/s
const D_LIQ = stokesEinstein(2e-8, 0.0089, 298); // cm^2/s, a = 0.2 nm in water

export function GasLiquidModule({ dark }: { dark: boolean }) {
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [temp, setTemp] = useState(1);
  const [nGas, setNGas] = useState(30);
  const [phi, setPhi] = useState(0.7);
  const [stats, setStats] = useState<WanderStats | null>(null);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="Two ways to wander"
            subtitle="Same kind of molecule, same temperature. Only the crowding differs — watch the orange one."
            right={
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    value={dim}
                    options={[
                      { value: '2d', label: '2D', title: 'Face-on view — drag to pan, scroll to zoom' },
                      { value: '3d', label: '3D', title: 'Hard spheres in two 3D boxes — drag to orbit' },
                    ]}
                    onChange={setDim}
                  />
                </div>
                <IconButton label="Restart both boxes" onClick={() => setResetTick((t) => t + 1)}>
                  <RotateCcw size={15} />
                </IconButton>
                <IconButton
                  label={running ? 'Pause' : 'Play'}
                  onClick={() => setRunning((r) => !r)}
                >
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconButton>
              </div>
            }
          >
            <div>
              {dim === '3d' ? (
                <GasLiquid3DCanvas
                  nGas={nGas}
                  phi={phi}
                  temp={temp}
                  resetTick={resetTick}
                  running={running}
                  dark={dark}
                />
              ) : (
                <GasLiquidCanvas
                  nGas={nGas}
                  phi={phi}
                  temp={temp}
                  resetTick={resetTick}
                  running={running}
                  dark={dark}
                  onStats={setStats}
                />
              )}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Nothing here is scripted — every molecule just flies straight until it
              hits another one, and the two pictures fall out of the crowding alone.
              The gas molecule's path is long straight flights, redirected now and
              then. The liquid molecule moves <em>just as fast</em>, but it cannot
              finish a single body length before a neighbour turns it around: it
              rattles in a cage, and only escapes when the cage happens to open. That
              one difference is why a smell diffuses across a centimetre of still air
              in seconds while sugar takes a day to cross an unstirred teacup — same
              distance-squared clock, four decades apart in D. (Crossing a whole room
              is a different story: that is air currents, as the Péclet module shows.)
            </p>
          </Panel>
        </div>

        <div className="order-3 space-y-5 lg:col-start-1 lg:row-start-2">
          <Panel
            title="Measured from the tagged molecule"
            subtitle="Live from the simulation — screen units, so compare the two boxes, not the absolute numbers."
          >
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat
                label="Gas: free flight"
                value={stats ? stats.gasFlight.toFixed(1) : '—'}
                unit="diameters"
                tone="accent"
                hint="mean path between molecular collisions"
              />
              <Stat
                label="Gas: collisions"
                value={stats ? stats.gasColRate.toFixed(1) : '—'}
                unit="/s"
                hint="how often the walk is redirected"
              />
              <Stat
                label="Gas: net wander"
                value={stats ? stats.gasWander.toFixed(1) : '—'}
                unit="diameters"
                tone="accent"
                hint="displacement over the last ~10 s"
              />
              <Stat
                label="Liquid: free flight"
                value={stats ? stats.liqFlight.toFixed(2) : '—'}
                unit="diameters"
                tone="warm"
                hint="under ONE diameter — the cage"
              />
              <Stat
                label="Liquid: collisions"
                value={stats ? stats.liqColRate.toFixed(0) : '—'}
                unit="/s"
                hint="constant contact with the neighbours"
              />
              <Stat
                label="Liquid: net wander"
                value={stats ? stats.liqWander.toFixed(1) : '—'}
                unit="diameters"
                tone="warm"
                hint="same speed, nowhere to go"
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              The honest caveat: even this on-screen "gas" is far denser than a real
              one — drawn to true scale the box would be nearly empty, with seconds
              between collisions. A real air molecule flies about{' '}
              <strong>{Math.round(FLIGHT_DIAM)} diameters</strong> between collisions
              and is redirected <strong>{(COLL_RATE / 1e9).toFixed(0)} billion times
              per second</strong>; the cards below carry those real numbers. The
              contrast between the boxes is the physics; the absolute pace is not.
            </p>
          </Panel>
        </div>

        {/* --------------------------------------------------- controls */}
        <div className="order-2 space-y-5 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <Panel title="Setup" subtitle="Crowding sliders restart the boxes; temperature acts live.">
            <div className="space-y-5">
              <Slider
                label="Temperature"
                value={temp}
                min={0.5}
                max={2}
                step={0.05}
                format={(v) => `${v.toFixed(2)}×`}
                onChange={setTemp}
                hint="Speeds every molecule in BOTH boxes — same T, same v̄. Watch which box's wandering benefits."
              />
              <Slider
                label="Gas crowding"
                value={nGas}
                min={8}
                max={80}
                step={2}
                format={(v) => `${v} molecules`}
                onChange={setNGas}
                hint="More molecules = shorter free flights. Rarefy it and the flights straighten out toward ballistic."
              />
              <Slider
                label="Liquid packing"
                value={phi}
                min={0.55}
                max={0.78}
                step={0.01}
                format={(v) => `${Math.round(v * 100)}% full`}
                onChange={setPhi}
                hint="At 78% the cage barely ever opens. Loosen it and watch cage-hops turn back into flights. (Two sizes of molecule on purpose — a one-size 2D liquid freezes into a crystal.)"
              />
            </div>
          </Panel>

          <Panel title="Things to try">
            <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <li>Follow the orange molecule in each box for ten seconds. Describe the two paths in one word each.</li>
              <li>Crank the temperature to 2×. Both boxes speed up — does the liquid molecule escape its cage more often?</li>
              <li>Rarefy the gas to 8 molecules, then crowd it to 80. Watch the free-flight readout track the crowding.</li>
              <li>Pack the liquid to 78%, then loosen to 55% — find the packing where "caged" starts to look like "gas".</li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* ---------------------------------------------------- equations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <EquationCard
            title="Where gas D comes from — kinetic theory"
            latex={String.raw`D = \tfrac{1}{3}\,\lambda\,\bar v, \qquad \lambda = \frac{k_B T}{\sqrt{2}\,\pi d^2 P}, \qquad \bar v = \sqrt{\frac{8 k_B T}{\pi m}}`}
            note={`Long flights, occasionally redirected — a random walk with step λ taken at speed v̄. For N₂ at room conditions: v̄ ≈ ${Math.round(VBAR)} m/s, λ ≈ ${Math.round(FLIGHT_DIAM)} molecular diameters, giving D ≈ ${D_GAS.toFixed(2)} cm²/s — the 0.1-to-1 cm²/s range every gas-phase D in the tables sits in. (Elementary kinetic theory lands within a factor of ~2 of measured values; the full Chapman–Enskog treatment closes the gap.)`}
          />
          <EquationCard
            title="From collisions to the random walk"
            latex={String.raw`\langle x^2 \rangle = 2Dt`}
            note="Every diffusion result on this site — Fick profiles, spreading boluses, the diffusion clock — starts from a random walk, and THIS page is where the walk comes from: each collision erases the molecule's memory of direction, so many flights add like random steps. No collisions, no walk: a collisionless molecule doesn't diffuse at all, it just flies."
            defaultOpen={false}
          />
        </div>
        <div className="space-y-4">
          <EquationCard
            title="Where liquid D comes from — Stokes–Einstein"
            latex={String.raw`D = \frac{k_B T}{6 \pi \mu a}`}
            note={`In a liquid there are no flights to speak of — the molecule is in permanent contact with its neighbours, so what limits it is drag (μ) and what drives it is thermal agitation (k_BT). A 0.2 nm solute in room-temperature water: D ≈ ${(D_LIQ * 1e5).toFixed(1)}×10⁻⁵ cm²/s. Note what appears here that kinetic theory lacks: viscosity — the cage itself. Heating a liquid loosens the cage (μ falls steeply), so liquid D climbs with temperature much faster than a gas's ~T^{3/2} at fixed pressure.`}
          />
          <EquationCard
            title="The four decades"
            latex={String.raw`\frac{D_{gas}}{D_{liquid}} \approx \frac{0.1\ \mathrm{cm^2/s}}{10^{-5}\ \mathrm{cm^2/s}} = 10^{4}`}
            note="Comparable speeds, so the entire gap is step length: ~200 diameters of free flight versus a fraction of one. This is why the mass-transfer tables you will use all course split cleanly into a gas column and a liquid column with nothing in between — and why 'which phase am I in?' is the first question every diffusion estimate should ask."
            defaultOpen={false}
          />
        </div>
      </div>

      {/* The Socratic question set (socratic.ts) is authored but not rendered:
          guided-discussion delivery is on hold pending the NU walkthrough
          tool decision. */}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function ModuleHeader() {
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          Start here
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Why D is what it is
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
        Gases &amp; Liquids
      </h1>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        Diffusion coefficients span four decades between air and water, and the whole
        difference fits in one picture: how far a molecule gets before something is in
        the way. Two boxes, identical except for crowding — the diffusion coefficient
        every later module takes as a given is born here.
      </p>
    </header>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {children}
    </button>
  );
}
