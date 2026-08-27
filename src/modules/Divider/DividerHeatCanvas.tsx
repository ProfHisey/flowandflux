import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, gauss, useWheelZoom } from '../FicksLaw/FickCanvas';
import { rampMolecule } from '../FourierLaw/FourierCanvas';

/**
 * The mixing box, heat edition: a hot half and a cold half of the same
 * solid, separated by an insulating divider. Pull the divider and the two
 * halves exchange energy until the jiggling evens out — the Fourier analog
 * of the two-species mixing box, with one crucial difference on display:
 * NO molecule ever crosses the middle. Only the energy does.
 *
 * Same energy-exchange lattice as the Fourier module (each bond hands
 * energy both ways, proportional to the giver's own energy), but insulated
 * on all sides: nothing is pinned, so the box relaxes to the average — it
 * does not sit in a steady state. Total energy is conserved to rounding.
 */

export interface HeatMixStats {
  /** Mean temperature of each half, degC. */
  TLeft: number;
  TRight: number;
}

interface Molecule {
  ax: number;
  ay: number;
  ox: number;
  oy: number;
  /** Drawn position this frame (rattle + orbit); the bonds use it too. */
  dx: number;
  dy: number;
  /** Orbit phase and direction, for under-coordinated molecules. */
  ph: number;
  spin: number;
}

const NX = 36;
const NY = 10;
const EX_RATE = 7;
const K0 = 273.15;
/** Fraction of lattice bonds that actually exist. Below 1 the grid stops
 *  reading as a crystal and starts reading as a molecular network: chains,
 *  rings, and terminal atoms dangling off the side with room to swing.
 *  Fixed at seed time — the breaks are structure, not temperature. */
const BOND_KEEP = 0.66;

export function DividerHeatCanvas({
  TLeft,
  TRight,
  kScale,
  dividerIn,
  resetTick,
  running,
  dark,
  onStats,
}: {
  TLeft: number;
  TRight: number;
  /** Relative conductivity (1 = baseline): how readily neighbors hand
   *  energy across. Copper-like at 3, styrofoam-like at 0.2. */
  kScale: number;
  dividerIn: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
  onStats?: (s: HeatMixStats) => void;
}) {
  const energyRef = useRef<Float64Array | null>(null);
  const moleculesRef = useRef<Molecule[]>([]);
  const emitRef = useRef(0);
  const dividerRef = useRef(dividerIn);
  dividerRef.current = dividerIn;
  const kRef = useRef(kScale);
  kRef.current = kScale;
  const bondsRef = useRef<{
    h: Float32Array;
    v: Float32Array;
    coord: Uint8Array;
  } | null>(null);
  const boundsRef = useRef({ lo: 0, hi: 1, span0: 1 });
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);

  const redrawKey = `${TLeft}|${TRight}|${dividerIn}|${resetTick}|${dark}|${zoomTick}`;

  useEffect(() => {
    energyRef.current = null;
    moleculesRef.current = [];
  }, [TLeft, TRight, resetTick]);

  // The bond network is structure, not temperature: only a reset reshuffles
  // it. Keyed on [TLeft, TRight, ...] it re-randomized on every slider nudge,
  // which is exactly the impression the "fixed at seed" comment exists to
  // prevent.
  useEffect(() => {
    bondsRef.current = null;
  }, [resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);
    const pad = 8;
    const x0 = pad + 10;
    const x1 = W - pad - 10;
    const y0 = pad + 14;
    const y1 = H - pad - 14;
    const boxW = x1 - x0;
    const boxH = y1 - y0;
    if (boxW <= 0 || boxH <= 0) return;
    const xc = (x0 + x1) / 2;

    let E = energyRef.current;
    if (!E) {
      E = new Float64Array(NX * NY);
      for (let i = 0; i < NX; i++) {
        const T = i < NX / 2 ? TLeft : TRight;
        for (let r = 0; r < NY; r++) E[r * NX + i] = T + K0;
      }
      energyRef.current = E;
      const bLo = Math.min(TLeft, TRight) + K0;
      const bHi = Math.max(TLeft, TRight) + K0;
      boundsRef.current = { lo: bLo, hi: bHi, span0: Math.max(1, bHi - bLo) };
    }

    // Which bonds exist at all — fixed at seed, so the network keeps its
    // shape while the energy moves through it. coord counts each molecule's
    // surviving bonds: the low-coordination ones are the terminal atoms.
    let bonds = bondsRef.current;
    if (!bonds) {
      const h = new Float32Array((NX - 1) * NY);
      const v = new Float32Array(NX * (NY - 1));
      for (let i = 0; i < h.length; i++) h[i] = Math.random();
      for (let i = 0; i < v.length; i++) v[i] = Math.random();
      const coord = new Uint8Array(NX * NY);
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX - 1; i++) {
          if (h[r * (NX - 1) + i] < BOND_KEEP) {
            coord[r * NX + i]++;
            coord[r * NX + i + 1]++;
          }
        }
      }
      for (let r = 0; r < NY - 1; r++) {
        for (let i = 0; i < NX; i++) {
          if (v[r * NX + i] < BOND_KEEP) {
            coord[r * NX + i]++;
            coord[(r + 1) * NX + i]++;
          }
        }
      }
      // The network must be CONNECTED. At BOND_KEEP = 0.66 the random draw
      // leaves isolated sites and small islands, and now that the energy
      // exchange runs on this same network (it used to ignore it and conduct
      // through every gap) an island NEVER equilibrates: a few molecules stay
      // frozen at their seeded 15 or 90 °C forever, which pins the adaptive
      // color range at its starting width and makes the printed "it narrows
      // as the halves meet" false. Sweep every lattice edge and open the ones
      // that would join two separate islands — exactly (islands − 1) extra
      // springs, a dozen or so out of ~800, invisible in the picture. It is
      // also the honest solid: no free-floating atoms.
      const parent = new Int32Array(NX * NY);
      for (let i = 0; i < parent.length; i++) parent[i] = i;
      const find = (x: number): number => {
        while (parent[x] !== x) {
          parent[x] = parent[parent[x]];
          x = parent[x];
        }
        return x;
      };
      const union = (p1: number, p2: number): boolean => {
        const ra = find(p1);
        const rb = find(p2);
        if (ra === rb) return false;
        parent[rb] = ra;
        return true;
      };
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX; i++) {
          const n = r * NX + i;
          if (i < NX - 1 && h[r * (NX - 1) + i] < BOND_KEEP) union(n, n + 1);
          if (r < NY - 1 && v[r * NX + i] < BOND_KEEP) union(n, n + NX);
        }
      }
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX; i++) {
          const n = r * NX + i;
          if (i < NX - 1 && union(n, n + 1)) {
            h[r * (NX - 1) + i] = 0;
            coord[n]++;
            coord[n + 1]++;
          }
          if (r < NY - 1 && union(n, n + NX)) {
            v[r * NX + i] = 0;
            coord[n]++;
            coord[n + NX]++;
          }
        }
      }
      bonds = { h, v, coord };
      bondsRef.current = bonds;
    }

    const dt = running ? frame.dt : 0;
    if (dt > 0) {
      // kScale raises the exchange rate; sub-stepping keeps the explicit
      // scheme stable when the total per-frame transfer would get large.
      const total = Math.min(0.5, EX_RATE * kRef.current * dt);
      const nSub = Math.max(1, Math.ceil(total / 0.1));
      const eps = total / nSub;
      const blocked = dividerRef.current;
      for (let sub = 0; sub < nSub; sub++) {
        const dE = new Float64Array(NX * NY);
        for (let r = 0; r < NY; r++) {
          for (let i = 0; i < NX; i++) {
            const idx = r * NX + i;
            // Energy only crosses where a spring is actually DRAWN. The
            // picture's grammar is "no spring, no path" — the divider bond is
            // severed and so are the ~34% of springs BOND_KEEP leaves out, and
            // it would teach the wrong thing to conduct through gaps the
            // caption calls insulation.
            //
            // ONE random rate per bond, shared by the two directions. Drawing
            // give and take independently leaves a net random transfer even
            // when the two sites hold identical energy: with the module
            // defaults that jitter is ~9 K per bond per substep, which
            // accumulated to a per-site spread LARGER than the hot/cold
            // difference the module exists to show (sites reached −90 °C in a
            // box set to 15 and 90). Sharing the rate keeps the two-way
            // hand-off — each side still gives in proportion to its OWN
            // energy — while making the exchange vanish at uniform E.
            if (i < NX - 1) {
              // The divider is an insulator while it is in: the bond between
              // the two middle columns simply does not exist.
              if (
                bonds.h[r * (NX - 1) + i] < BOND_KEEP &&
                !(blocked && i === NX / 2 - 1)
              ) {
                const w = eps * (0.5 + Math.random());
                const give = w * E[idx];
                const take = w * E[idx + 1];
                dE[idx] += take - give;
                dE[idx + 1] += give - take;
              }
            }
            if (r < NY - 1 && bonds.v[r * NX + i] < BOND_KEEP) {
              const w = eps * (0.5 + Math.random());
              const give = w * E[idx];
              const take = w * E[idx + NX];
              dE[idx] += take - give;
              dE[idx + NX] += give - take;
            }
          }
        }
        for (let i = 0; i < E.length; i++) E[i] += dE[i];
      }
      // No pinning anywhere: the box is insulated, so it relaxes to the
      // average instead of holding a gradient. That contrast with the
      // Fourier module's pinned baths is the lesson.
    }

    // ---- the color range FOLLOWS the field ---------------------------
    // With the scale pinned to the starting 15-90 degC, every molecule
    // converges on the same mid-orange within seconds of pulling the
    // divider: the picture goes flat exactly when conduction becomes the
    // story. Easing the displayed range onto the field's current min/max
    // keeps whatever gradient is left legible all the way down. A floor
    // stops it amplifying noise once the box really is uniform, and the
    // canvas prints the range it is using, so the collapse stays visible
    // instead of being hidden by the rescaling.
    const b = boundsRef.current;
    let fLo = Infinity;
    let fHi = -Infinity;
    for (let i = 0; i < E.length; i++) {
      if (E[i] < fLo) fLo = E[i];
      if (E[i] > fHi) fHi = E[i];
    }
    const floorSpan = Math.max(0.1 * b.span0, 1.5);
    let tLo = fLo;
    let tHi = fHi;
    if (tHi - tLo < floorSpan) {
      const mid = (tLo + tHi) / 2;
      tLo = mid - floorSpan / 2;
      tHi = mid + floorSpan / 2;
    }
    if (dt > 0) {
      const k = 1 - Math.exp(-dt / 0.45);
      b.lo += (tLo - b.lo) * k;
      b.hi += (tHi - b.hi) * k;
    }
    const lo = b.lo;
    const span = b.hi - b.lo || 1;
    const uAt = (n: number) => Math.min(1, Math.max(0, (E[n] - lo) / span));

    // Faint cell wash — the molecules carry the color; this only stops the
    // two halves reading as empty space.
    const cw = boxW / NX;
    const ch = boxH / NY;
    for (let r = 0; r < NY; r++) {
      for (let i = 0; i < NX; i++) {
        ctx.fillStyle = rampMolecule(uAt(r * NX + i), dark, 0.13);
        ctx.fillRect(x0 + i * cw, y0 + r * ch, cw + 0.5, ch + 0.5);
      }
    }

    let list = moleculesRef.current;
    if (list.length === 0) {
      list = [];
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX; i++) {
          list.push({
            ax: x0 + (i + 0.5) * cw,
            ay: y0 + (r + 0.5) * ch,
            ox: 0,
            oy: 0,
            dx: 0,
            dy: 0,
            ph: Math.random() * Math.PI * 2,
            spin: Math.random() < 0.5 ? -1 : 1,
          });
        }
      }
      moleculesRef.current = list;
    }
    // Advance the motion first, then draw everything from the same drawn
    // positions. A fully bonded molecule rattles in place; an
    // under-coordinated one also swings on a small orbit — and both the
    // rattle and the swing grow with that site's own energy, so kinetic
    // energy is legible as motion even where color has run out of range.
    for (let n = 0; n < list.length; n++) {
      const q = list[n];
      const u = uAt(n);
      const free = Math.max(0, 3 - bonds.coord[n]) / 3;
      const amp = (0.7 + 5.2 * u) * (1 - 0.4 * free);
      if (dt > 0) {
        q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
        q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
        q.ph += dt * q.spin * (0.9 + 6 * u) * (0.4 + 1.6 * free);
      }
      const orbit = free * (0.7 + 3.2 * u);
      q.dx = q.ax + q.ox + orbit * Math.cos(q.ph);
      q.dy = q.ay + q.oy + orbit * Math.sin(q.ph);
      // "No molecule ever crosses the middle" is the whole point of the heat
      // tab, and on a narrow canvas the rattle amplitude exceeds the half-cell
      // gap to the midline — boundary molecules were visibly hopping the
      // divider several times a second. Clamp the DRAWN position to the
      // molecule's own half. (Anchors never moved; only the excursion did.)
      const keepOut = 4.4 + 2.2 * u;
      q.dx =
        n % NX < NX / 2
          ? Math.min(q.dx, xc - keepOut)
          : Math.max(q.dx, xc + keepOut);
    }

    // Bonds, bucketed by temperature so each bucket strokes in one path.
    // The hottest springs draw faintest — the lattice reads as loosening
    // where the jiggling is hardest. (A cue for agitation; the breaks
    // themselves are fixed structure, not a melting front.)
    const NB = 4;
    const buckets: number[][] = [[], [], [], []];
    const addBond = (a: Molecule, c: Molecule, u: number) => {
      buckets[Math.min(NB - 1, Math.floor(u * NB))].push(a.dx, a.dy, c.dx, c.dy);
    };
    for (let r = 0; r < NY; r++) {
      for (let i = 0; i < NX; i++) {
        const n = r * NX + i;
        // The divider severs the middle bonds while it is in — the missing
        // springs ARE the insulation, drawn.
        if (
          i < NX - 1 &&
          bonds.h[r * (NX - 1) + i] < BOND_KEEP &&
          !(dividerRef.current && i === NX / 2 - 1)
        ) {
          addBond(list[n], list[n + 1], (uAt(n) + uAt(n + 1)) / 2);
        }
        if (r < NY - 1 && bonds.v[r * NX + i] < BOND_KEEP) {
          addBond(list[n], list[n + NX], (uAt(n) + uAt(n + NX)) / 2);
        }
      }
    }
    ctx.lineWidth = 1;
    for (let bi = 0; bi < NB; bi++) {
      const seg = buckets[bi];
      if (seg.length === 0) continue;
      const a = (0.42 - 0.26 * ((bi + 0.5) / NB)).toFixed(3);
      ctx.strokeStyle = dark ? `rgba(203,213,225,${a})` : `rgba(71,85,105,${a})`;
      ctx.beginPath();
      for (let s = 0; s < seg.length; s += 4) {
        ctx.moveTo(seg[s], seg[s + 1]);
        ctx.lineTo(seg[s + 2], seg[s + 3]);
      }
      ctx.stroke();
    }

    // The molecules: color, size AND a halo all rise together, so a hot
    // one stays obvious after the temperature range itself has collapsed.
    const edge = dark ? 'rgba(226,232,240,0.5)' : 'rgba(15,23,42,0.4)';
    for (let n = 0; n < list.length; n++) {
      const q = list[n];
      const u = uAt(n);
      const rad = 2.2 + 2.2 * u;
      if (u > 0.45) {
        ctx.fillStyle = rampMolecule(u, dark, 0.25 * (u - 0.45));
        ctx.beginPath();
        ctx.arc(q.dx, q.dy, rad * 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = rampMolecule(u, dark);
      ctx.beginPath();
      ctx.arc(q.dx, q.dy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // The divider.
    if (dividerRef.current) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xc, y0);
      ctx.lineTo(xc, y1);
      ctx.stroke();
    } else {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = dark ? 'rgba(148,163,184,0.4)' : 'rgba(148,163,184,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xc, y0);
      ctx.lineTo(xc, y1);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x0, y0, boxW, boxH);

    // The scale is following the field, so say what it currently spans —
    // watching this number close IS the equilibration.
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(
      `color scale ${(lo - K0).toFixed(0)}–${(b.hi - K0).toFixed(0)} °C · it narrows as the halves meet`,
      x1 - 2,
      y1 + 11,
    );

    emitRef.current += frame.dt;
    if (emitRef.current >= 0.4 && onStats) {
      let sl = 0;
      let sr = 0;
      for (let r = 0; r < NY; r++) {
        for (let i = 0; i < NX; i++) {
          if (i < NX / 2) sl += E[r * NX + i];
          else sr += E[r * NX + i];
        }
      }
      const half = (NX / 2) * NY;
      onStats({ TLeft: sl / half - K0, TRight: sr / half - K0 });
      emitRef.current = 0;
    }
  }, { running, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A hot half and a cold half of a solid separated by a removable insulating divider"
    />
  );
}
