import { useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { Panel, Stat } from '../../components/ui/Panel';
import { Slider } from '../../components/ui/Slider';
import { Segmented } from '../../components/ui/Segmented';
import { EquationCard } from '../../components/ui/EquationCard';

import {
  N2, collisionRate, dragCoefficient, einsteinD, flightInDiameters, gasDiffusivity,
  meanSpeed, stepRegime, type StepRegime,
} from '../../lib/kinetics';
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
// The same liquid D by the two-step route the continuum view draws: first a
// drag coefficient, then the Einstein relation. verify.ts pins them equal.
const ZETA_EX = dragCoefficient(2e-8, 0.0089); // g/s
const D_LIQ_EINSTEIN = einsteinD(ZETA_EX, 298); // cm^2/s

/** One word per regime, shown beside lambda/d. The boundary that matters is
 *  lambda/d = 1: above it a flight exists and kinetic theory can count it,
 *  below it nothing is left to count and drag is the honest description. */
const REGIME_WORD: Record<StepRegime, string> = {
  dilute: 'dilute',
  dense: 'dense',
  continuum: 'continuum',
};

export function GasLiquidModule({ dark }: { dark: boolean }) {
  const [running, setRunning] = useState(true);
  const [resetTick, setResetTick] = useState(0);
  const [temp, setTemp] = useState(1);
  const [nGas, setNGas] = useState(30);
  const [phi, setPhi] = useState(0.7);
  const [stats, setStats] = useState<WanderStats | null>(null);
  const [dim, setDim] = useState<'2d' | '3d'>('2d');
  const [liquidView, setLiquidView] = useState<'molecular' | 'continuum'>('molecular');
  const [muRel, setMuRel] = useState(1);
  const continuum = liquidView === 'continuum';

  return (
    <div className="space-y-5">
      <ModuleHeader />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-1 space-y-5 lg:col-start-1 lg:row-start-1">
          <Panel
            title="Two ways to wander"
            subtitle={
              continuum && dim === '2d'
                ? 'Two models of the same liquid, next to the gas. On the right there are no molecules left — only viscosity, and one sphere being kicked and dragged.'
                : 'Same kind of molecule, same temperature. Only the crowding differs — watch the orange one.'
            }
            right={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {dim === '2d' && (
                  <div className="w-[172px]">
                    <Segmented<'molecular' | 'continuum'>
                      ariaLabel="How to model the liquid"
                      value={liquidView}
                      options={[
                        {
                          value: 'molecular',
                          label: 'Molecules',
                          title: 'The liquid as hard disks — crowding and cages',
                        },
                        {
                          value: 'continuum',
                          label: 'Continuum',
                          title: 'The liquid as a structureless viscous medium — one sphere, and drag',
                        },
                      ]}
                      onChange={setLiquidView}
                    />
                  </div>
                )}
                <div className="w-28">
                  <Segmented<'2d' | '3d'>
                    ariaLabel="View dimension"
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
                  muRel={muRel}
                  liquidView={liquidView}
                  onStats={setStats}
                />
              )}
            </div>
            {continuum && dim === '2d' ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The right-hand box has changed <em>model</em>, not temperature. Its
                molecules are gone, replaced by a single number — the viscosity μ —
                and the tagged sphere now feels only two things: a thermal kick, and
                a drag force <strong>6πμa·v</strong> opposing whichever way it is
                going. Nobody imposes a diffusivity on it; it walks, and the walk
                turns out to have D = k_BT/ζ. That is the leap Stokes–Einstein asks
                you to make, and it is a bold one: the sphere here is 0.2 nm, about
                the size of a water molecule, so "a sphere in a structureless fluid"
                is on its face absurd — and still lands within a factor of two. It is
                the same 6πμa that sets a settling cell's terminal velocity in{' '}
                <a className="underline hover:no-underline" href="#stokes">Stokes drag &amp; settling</a>:
                one drag law, doing two jobs. Watch the <em>track</em> rather than
                the sphere: it is all a particle-tracking instrument ever sees.
                Nanoparticle tracking analysis records exactly this trace, fits
                ⟨r²⟩ = 4Dt to it, and inverts Stokes–Einstein to report a size — the
                same arithmetic the readouts below run on the same trajectory. Drag
                never appears as a force you can point at; it shows up as how far
                the track gets.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Nothing here is scripted — every molecule just flies straight until it
                hits another one, and the two pictures fall out of the crowding alone.
                The gas molecule's path is long straight flights, redirected now and
                then. The liquid molecule moves <em>just as fast</em>, but it cannot
                finish a single body length before a neighbor turns it around: it
                rattles in a cage, and only escapes when the cage happens to open. That
                one difference is why a smell diffuses across a centimeter of still air
                in seconds while sugar takes a day to cross an unstirred teacup — same
                distance-squared clock, four decades apart in D. (Crossing a whole room
                is a different story: that is air currents, as the Péclet module shows.)
              </p>
            )}
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
                hint={stats && stats.gasFlightN < 30
                  ? `λ — measured path between collisions. Averaged over only  flights so far; it needs ~30 to settle, so expect it to climb.`
                  : 'λ — measured path between collisions, averaged over the last 60'}
              />
              <Stat
                label={<>Gas: λ predicted</>}
                value={stats ? stats.gasFlightPred.toFixed(1) : '—'}
                unit="diameters"
                hint="1/(2√2 n d) from this box's own density — the dilute law"
              />
              <Stat
                label="Gas: λ/d"
                value={stats ? stats.gasFlight.toFixed(1) : '—'}
                unit={stats ? REGIME_WORD[stepRegime(stats.gasFlight)] : ''}
                tone="accent"
                hint="above 1, flights exist and can be counted"
              />
              {continuum ? (
                <>
                  <Stat
                    label="Sphere: D measured"
                    value={stats && stats.contD ? stats.contD.toFixed(3) : '—'}
                    unit="dia²/s"
                    tone="warm"
                    hint="fitted live to this one track's ⟨r²⟩ = 4Dt — expect it to wander 10-20% around the prediction"
                  />
                  <Stat
                    label="Sphere: k_BT/ζ"
                    value={stats ? stats.contDPred.toFixed(3) : '—'}
                    unit="dia²/s"
                    hint="what the Einstein relation predicts"
                  />
                  <Stat
                    label="Sphere: net wander"
                    value={stats ? stats.contWander.toFixed(1) : '—'}
                    unit="diameters"
                    tone="warm"
                    hint="displacement over the last ~10 s"
                  />
                </>
              ) : (
                <>
                  <Stat
                    label="Liquid: free flight"
                    value={stats ? stats.liqFlight.toFixed(2) : '—'}
                    unit="diameters"
                    tone="warm"
                    hint={stats && stats.liqFlightN < 30
                      ? `under ONE diameter — the cage. Only  flights so far.`
                      : 'under ONE diameter — the cage'}
                  />
                  <Stat
                    label={<>Liquid: λ predicted</>}
                    value={stats ? stats.liqFlightPred.toFixed(2) : '—'}
                    unit="diameters"
                    hint="the dilute law, far outside its range here"
                  />
                  <Stat
                    label="Liquid: λ/d"
                    value={stats ? stats.liqFlight.toFixed(2) : '—'}
                    unit={stats ? REGIME_WORD[stepRegime(stats.liqFlight)] : ''}
                    tone="warm"
                    hint="below 1 — no flight left to count"
                  />
                </>
              )}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              <strong>λ/d is the number that decides which physics you are allowed
              to use.</strong>{' '}
              {continuum ? (
                <>
                  The liquid box is below 1, so there is no free flight to count and
                  kinetic theory has nothing to work with. What replaces it is on the
                  right: drag. The sphere's measured D and the k_BT/ζ prediction are
                  two independent numbers, and they agree — the Einstein relation
                  earning its keep rather than being asserted. They agree <em>loosely</em>,
                  though, drifting 10-20% apart and back: one particle is a small
                  sample, and its own excursions are the noise. That is not a defect
                  of the simulation, it is why a real tracking instrument follows
                  hundreds of particles and averages before it reports a size.
                </>
              ) : (
                <>
                  Above 1 a molecule clears its own body between collisions and the
                  flights can be counted; below 1 it never does. Watch the gas's
                  measured λ meet its prediction as you rarefy the box, and fall
                  below it as you crowd — the dilute law assumes a molecule is far
                  likelier to be flying than touching, and says so by failing. The
                  measured figure is a rolling mean over the tagged molecule's last
                  flights, so give it a minute to settle, especially when rarefied:
                  a long mean free path means few collisions to average.
                </>
              )}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
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
          <Panel
            title="Setup"
            subtitle={
              continuum
                ? "Two molecular sliders and one continuum slider — the model decides which parameters even exist."
                : "Crowding sliders restart the boxes; temperature acts live."
            }
          >
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
              {continuum ? (
                <Slider
                  label="Solvent viscosity μ"
                  value={muRel}
                  min={0.5}
                  max={4}
                  step={0.1}
                  format={(v) => `${v.toFixed(1)}× water`}
                  onChange={setMuRel}
                  hint="The continuum's only property — and watch what it does to the track. Thicken the solvent and the same thermal kicks buy less ground: the track pulls in, because D = k_BT/ζ falls as 1/μ. That shrinking is drag, seen through its consequence."
                />
              ) : (
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
              )}
            </div>
          </Panel>

          <Panel title="Things to try">
            <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <li>Follow the orange molecule in each box for ten seconds. Describe the two paths in one word each.</li>
              <li>Rarefy the gas to 8 molecules and watch measured λ climb to meet its prediction. Crowd it to 80 and watch it fall below — the dilute law failing, on cue.</li>
              <li>Read λ/d in both boxes. Which side of 1 is each on, and which description does that license?</li>
              <li>Switch the liquid to <strong>Continuum</strong>. The molecules vanish; does the sphere still diffuse? Compare its measured D against k_BT/ζ.</li>
              <li>In Continuum, push μ from 0.5× to 4×. The track pulls in — by what factor should its width shrink when μ quadruples?</li>
              <li>Watch the track, not the sphere. That track is the whole of what a particle-tracking instrument gets to see; everything it reports about size is inferred from its spread.</li>
              <li>Crank the temperature to 2×. Both boxes speed up — does the liquid molecule escape its cage more often?</li>
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
            note={`In a liquid there are no flights to speak of — the molecule is in permanent contact with its neighbors, so what limits it is drag (μ) and what drives it is thermal agitation (k_BT). A 0.2 nm solute in room-temperature water: D ≈ ${(D_LIQ * 1e5).toFixed(1)}×10⁻⁵ cm²/s. Note what appears here that kinetic theory lacks: viscosity — the cage itself. Heating a liquid loosens the cage (μ falls steeply), so liquid D climbs with temperature much faster than a gas's ~T^(3/2) at fixed pressure.`}
          />
          <EquationCard
            title="Drag is the whole mechanism — ζ, then Einstein"
            latex={String.raw`\zeta = 6 \pi \mu a, \qquad D = \frac{k_B T}{\zeta}`}
            note={`Stokes–Einstein is not one law but two, and splitting them shows where the liquid's physics actually enters. The SECOND is general: the Einstein relation says a particle's diffusivity is thermal drive over dissipation, whatever the dissipation happens to be. The FIRST is the specifically liquid part — Stokes' drag on a sphere, the same 6πμa that sets a settling cell's terminal velocity. Substitute one into the other and the familiar form falls out: ζ = ${ZETA_EX.toExponential(2)} g/s for a 0.2 nm solute in water, so D = ${(D_LIQ_EINSTEIN * 1e5).toFixed(1)}×10⁻⁵ cm²/s — the same number as the card beside this one, by construction. The continuum view above runs exactly this: the sphere's measured D is compared live against k_BT/ζ.`}
          />
          <EquationCard
            title="The four decades"
            latex={String.raw`\frac{D_{gas}}{D_{liquid}} \approx \frac{0.1\ \mathrm{cm^2/s}}{10^{-5}\ \mathrm{cm^2/s}} = 10^{4}`}
            note="Comparable speeds, so the entire gap is step length: ~180 diameters of free flight versus a fraction of one. This is why the mass-transfer tables split cleanly into a gas column and a liquid column with nothing in between — and why 'which phase am I in?' is the first question every diffusion estimate should ask."
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
