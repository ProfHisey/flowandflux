import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { D_VIS, gauss } from '../FicksLaw/FickCanvas';
import { rampMolecule } from '../FourierLaw/FourierCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';

/**
 * The mixing box in 3D — same experiment, full volume. Mass mode: two
 * species wander in a glass box with a translucent green divider plane.
 * Heat mode: molecules stay anchored on a lattice and only their jiggle
 * crosses... or rather doesn't cross, until the divider goes.
 */

interface P3 {
  x: number;
  y: number;
  z: number;
  sp: 0 | 1;
}
interface M3 {
  x: number;
  y: number;
  z: number;
  ox: number;
  oy: number;
  oz: number;
  col: number; // lattice column index
  /** Drawn position this frame (rattle + orbit); the bonds use it too. */
  dx: number;
  dy: number;
  dz: number;
  /** Orbit phase and direction, for under-coordinated molecules. */
  ph: number;
  spin: number;
}

const NXE = 20; // heat-mode energy columns
const NY = 6; // lattice rows (heat mode)
const NZ = 6; // lattice depth (heat mode)
/** Fraction of lattice bonds that exist — see DividerHeatCanvas. */
const BOND_KEEP = 0.66;

export function Divider3DCanvas({
  mode,
  nLeft,
  nRight,
  dCyan,
  dOrange,
  temp,
  TLeft,
  TRight,
  kScale,
  dividerIn,
  resetTick,
  running,
  dark,
  cam: camProp,
}: {
  mode: 'mass' | 'heat';
  nLeft: number;
  nRight: number;
  dCyan: number;
  dOrange: number;
  temp: number;
  TLeft: number;
  TRight: number;
  kScale: number;
  dividerIn: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
  /** Optional shared camera, so a parent can hand off a drag that began
   *  on the 2D view (the seamless 2D-to-3D prototype). */
  cam?: OrbitCam;
}) {
  const massRef = useRef<P3[]>([]);
  const molsRef = useRef<M3[]>([]);
  const energyRef = useRef<Float64Array | null>(null);
  const bondsRef = useRef<{
    keep: Float32Array;
    coord: Uint8Array;
    /** Fraction of x-bonds that survive between column i and i+1. */
    xFrac: Float32Array;
  } | null>(null);
  const boundsRef = useRef({ lo: 0, hi: 1, span0: 1 });
  const liveRef = useRef({ dividerIn, dCyan, dOrange, temp, kScale });
  liveRef.current = { dividerIn, dCyan, dOrange, temp, kScale };
  const internalCam = useOrbitCam(0.55, -0.32);
  const cam = camProp ?? internalCam;

  const redrawKey = `${mode}|${nLeft}|${nRight}|${TLeft}|${TRight}|${dividerIn}|${resetTick}|${dark}|${cam.camTick}`;

  useEffect(() => {
    massRef.current = [];
    molsRef.current = [];
    energyRef.current = null;
  }, [mode, nLeft, nRight, TLeft, TRight, resetTick]);

  // Structure, not temperature — only a reset reshuffles the network.
  useEffect(() => {
    bondsRef.current = null;
  }, [resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const dt = running ? frame.dt : 0;
    const live = liveRef.current;

    const u = fit / 0.96;
    const BW = 1.55 * u;
    const BH = 0.8 * u;
    const BD = 0.8 * u;
    const half = BW / 2;

    if (mode === 'mass') {
      const list = massRef.current;
      if (list.length === 0) {
        for (let i = 0; i < nLeft; i++) {
          list.push({ x: -half + Math.random() * (half - 3), y: rnd(BH), z: rnd(BD), sp: 0 });
        }
        for (let i = 0; i < nRight; i++) {
          list.push({ x: 3 + Math.random() * (half - 3), y: rnd(BH), z: rnd(BD), sp: 1 });
        }
      }
      const sC = Math.sqrt(2 * D_VIS * live.dCyan * live.temp * dt);
      const sO = Math.sqrt(2 * D_VIS * live.dOrange * live.temp * dt);
      for (const q of list) {
        if (dt > 0) {
          const s = q.sp === 0 ? sC : sO;
          const xPrev = q.x;
          q.x += s * gauss();
          q.y += s * gauss();
          q.z += s * gauss();
          // The divider is a wall at x = 0 while it is in.
          if (live.dividerIn && xPrev < 0 !== q.x < 0) q.x = -q.x;
          if (q.x < -half) q.x = -2 * half - q.x;
          if (q.x > half) q.x = 2 * half - q.x;
          if (q.y < -BH / 2) q.y = -BH - q.y;
          if (q.y > BH / 2) q.y = BH - q.y;
          if (q.z < -BD / 2) q.z = -BD - q.z;
          if (q.z > BD / 2) q.z = BD - q.z;
        }
        pt.dot([q.x, q.y, q.z], fit, q.sp === 0 ? '34,211,238' : '251,146,60', 1.4, 1.1);
      }
    } else {
      // Heat: a 1-D column energy field, exchanged along x, rendered as a
      // 3-D lattice of anchored jigglers.
      let E = energyRef.current;
      if (!E) {
        E = new Float64Array(NXE);
        for (let i = 0; i < NXE; i++) E[i] = (i < NXE / 2 ? TLeft : TRight) + 273.15;
        energyRef.current = E;
        const bLo = Math.min(TLeft, TRight) + 273.15;
        const bHi = Math.max(TLeft, TRight) + 273.15;
        boundsRef.current = { lo: bLo, hi: bHi, span0: Math.max(1, bHi - bLo) };
      }
      // Which bonds exist: fixed at seed, so the network keeps its shape
      // while energy moves through it. Broken bonds leave terminal atoms
      // free to swing, which is the point — a molecular solid, not a
      // crystal lattice. coord counts each molecule's surviving bonds.
      let bonds = bondsRef.current;
      if (!bonds) {
        const nMol = NXE * NY * NZ;
        const keep = new Float32Array(nMol * 3); // +z, +y, +x per molecule
        for (let i = 0; i < keep.length; i++) keep[i] = Math.random();
        const coord = new Uint8Array(nMol);
        const bump = (a: number, c: number) => {
          coord[a]++;
          coord[c]++;
        };
        for (let i = 0; i < NXE; i++) {
          for (let j = 0; j < NY; j++) {
            for (let k = 0; k < NZ; k++) {
              const n = (i * NY + j) * NZ + k;
              if (k < NZ - 1 && keep[n * 3] < BOND_KEEP) bump(n, n + 1);
              if (j < NY - 1 && keep[n * 3 + 1] < BOND_KEEP) bump(n, n + NZ);
              if (i < NXE - 1 && keep[n * 3 + 2] < BOND_KEEP) bump(n, n + NY * NZ);
            }
          }
        }
        // Every molecule keeps at least one spring — see DividerHeatCanvas for
        // why a fully isolated site is both wrong to draw and, once the
        // exchange runs on this network, wrong physically.
        for (let i = 0; i < NXE; i++) {
          for (let j = 0; j < NY; j++) {
            for (let k = 0; k < NZ; k++) {
              const n = (i * NY + j) * NZ + k;
              if (coord[n] > 0) continue;
              const opts: (() => void)[] = [];
              if (k > 0) opts.push(() => { keep[(n - 1) * 3] = 0; bump(n, n - 1); });
              if (k < NZ - 1) opts.push(() => { keep[n * 3] = 0; bump(n, n + 1); });
              if (j > 0) opts.push(() => { keep[(n - NZ) * 3 + 1] = 0; bump(n, n - NZ); });
              if (j < NY - 1) opts.push(() => { keep[n * 3 + 1] = 0; bump(n, n + NZ); });
              opts[Math.floor(Math.random() * opts.length)]();
            }
          }
        }

        // The energy field is one value per COLUMN, but the springs the eye
        // follows are per molecule. Record how many x-bonds actually survive
        // between each pair of columns, and conduct in that proportion — so
        // the coarse model carries the same insulation the picture draws.
        const xFrac = new Float32Array(Math.max(1, NXE - 1));
        for (let i = 0; i < NXE - 1; i++) {
          let live = 0;
          for (let j = 0; j < NY; j++) {
            for (let k = 0; k < NZ; k++) {
              if (keep[(((i * NY + j) * NZ + k) * 3) + 2] < BOND_KEEP) live++;
            }
          }
          xFrac[i] = live / (NY * NZ);
        }
        bonds = { keep, coord, xFrac };
        bondsRef.current = bonds;
      }

      if (dt > 0) {
        const total = Math.min(0.5, 7 * live.kScale * dt);
        const nSub = Math.max(1, Math.ceil(total / 0.1));
        const eps = total / nSub;
        for (let s = 0; s < nSub; s++) {
          const dE = new Float64Array(NXE);
          for (let i = 0; i < NXE - 1; i++) {
            if (live.dividerIn && i === NXE / 2 - 1) continue;
            // ONE random rate, shared by both directions and weighted by the
            // springs that actually exist. Independent give/take draws left a
            // net random transfer even between sites at identical energy —
            // enough noise to bury the hot/cold split entirely. See the note
            // in DividerHeatCanvas.
            const w = eps * bonds.xFrac[i] * (0.5 + Math.random());
            const give = w * E[i];
            const take = w * E[i + 1];
            dE[i] += take - give;
            dE[i + 1] += give - take;
          }
          for (let i = 0; i < NXE; i++) E[i] += dE[i];
        }
      }
      // The colour range FOLLOWS the field, exactly as in the 2D view: a
      // scale pinned to the starting temperatures collapses every molecule
      // onto one mid-orange the moment the halves start meeting. Eased, with
      // a floor so a uniform box does not amplify noise.
      const bnd = boundsRef.current;
      let fLo = Infinity;
      let fHi = -Infinity;
      for (let i = 0; i < NXE; i++) {
        if (E[i] < fLo) fLo = E[i];
        if (E[i] > fHi) fHi = E[i];
      }
      const floorSpan = Math.max(0.1 * bnd.span0, 1.5);
      let tLo = fLo;
      let tHi = fHi;
      if (tHi - tLo < floorSpan) {
        const mid = (tLo + tHi) / 2;
        tLo = mid - floorSpan / 2;
        tHi = mid + floorSpan / 2;
      }
      if (dt > 0) {
        const kEase = 1 - Math.exp(-dt / 0.45);
        bnd.lo += (tLo - bnd.lo) * kEase;
        bnd.hi += (tHi - bnd.hi) * kEase;
      }
      const lo = bnd.lo;
      const span = bnd.hi - bnd.lo || 1;
      const norm = (e: number) => Math.min(1, Math.max(0, (e - lo) / span));

      let mols = molsRef.current;
      if (mols.length === 0) {
        mols = [];
        for (let i = 0; i < NXE; i++) {
          for (let j = 0; j < NY; j++) {
            for (let k = 0; k < NZ; k++) {
              mols.push({
                x: -half + ((i + 0.5) / NXE) * BW,
                y: -BH / 2 + ((j + 0.5) / NY) * BH,
                z: -BD / 2 + ((k + 0.5) / NZ) * BD,
                ox: 0, oy: 0, oz: 0, col: i,
                dx: 0, dy: 0, dz: 0,
                ph: Math.random() * Math.PI * 2,
                spin: Math.random() < 0.5 ? -1 : 1,
              });
            }
          }
        }
        molsRef.current = mols;
      }
      // Rattle plus, for under-coordinated molecules, a swing whose radius
      // and rate both grow with the site's energy: kinetic energy stays
      // legible as MOTION even where colour has run out of range.
      for (let n = 0; n < mols.length; n++) {
        const q = mols[n];
        const u = norm(E[q.col]);
        const free = Math.max(0, 4 - bonds.coord[n]) / 4;
        const amp = (0.7 + 4.6 * u) * (1 - 0.4 * free);
        if (dt > 0) {
          q.ox = 0.55 * q.ox + 0.45 * amp * gauss() * 0.8;
          q.oy = 0.55 * q.oy + 0.45 * amp * gauss() * 0.8;
          q.oz = 0.55 * q.oz + 0.45 * amp * gauss() * 0.8;
          q.ph += dt * q.spin * (0.9 + 6 * u) * (0.4 + 1.6 * free);
        }
        const orbit = free * (0.6 + 2.8 * u);
        q.dx = q.x + q.ox + orbit * Math.cos(q.ph);
        q.dy = q.y + q.oy + orbit * Math.sin(q.ph);
        q.dz = q.z + q.oz;
        // No molecule ever crosses the middle — that is the claim the heat tab
        // is built on. The rattle amplitude is comparable to the half-cell gap
        // to the divider plane, so boundary molecules were drifting visibly
        // through it. Clamp the DRAWN position; the anchor never moved.
        const keepOut = 1.6 + 1.4 * u;
        q.dx = q.x < 0 ? Math.min(q.dx, -keepOut) : Math.max(q.dx, keepOut);
      }
      const at = (n: number): Vec3 => {
        const q = mols[n];
        return [q.dx, q.dy, q.dz];
      };
      // Hot bonds draw faintest — the lattice loosens where it jiggles hardest.
      const bondAt = (n: number, m: number) => {
        const u = (norm(E[mols[n].col]) + norm(E[mols[m].col])) / 2;
        const a = (0.3 - 0.18 * u).toFixed(3);
        pt.seg(at(n), at(m), dark ? `rgba(203,213,225,${a})` : `rgba(71,85,105,${a})`);
      };
      for (let i = 0; i < NXE; i++) {
        for (let j = 0; j < NY; j++) {
          for (let k = 0; k < NZ; k++) {
            const n = (i * NY + j) * NZ + k;
            if (k < NZ - 1 && bonds.keep[n * 3] < BOND_KEEP) bondAt(n, n + 1);
            if (j < NY - 1 && bonds.keep[n * 3 + 1] < BOND_KEEP) bondAt(n, n + NZ);
            // The divider severs the middle bonds while it is in.
            if (
              i < NXE - 1 &&
              bonds.keep[n * 3 + 2] < BOND_KEEP &&
              !(live.dividerIn && i === NXE / 2 - 1)
            ) {
              bondAt(n, n + NY * NZ);
            }
          }
        }
      }
      // Colour AND size rise together, so a hot molecule stays obvious once
      // the temperature range itself has collapsed.
      for (const q of mols) {
        const u = norm(E[q.col]);
        const css = rampMolecule(u, dark);
        const m = css.match(/(\d+),(\d+),(\d+)/);
        const rgb = m ? `${m[1]},${m[2]},${m[3]}` : '226,232,240';
        pt.dot([q.dx, q.dy, q.dz], fit, rgb, 1.1 + 1.1 * u, 0.85 + 0.5 * u);
      }
    }

    // The divider plane.
    const planePts: [Vec3, Vec3, Vec3, Vec3] = [
      [0, -BH / 2, -BD / 2], [0, BH / 2, -BD / 2], [0, BH / 2, BD / 2], [0, -BH / 2, BD / 2],
    ];
    if (dividerIn) {
      pt.quad(planePts, dark ? 'rgba(34,197,94,0.28)' : 'rgba(34,197,94,0.22)');
    } else {
      pt.seg([0, -BH / 2, -BD / 2], [0, BH / 2, -BD / 2], faint);
      pt.seg([0, -BH / 2, BD / 2], [0, BH / 2, BD / 2], faint);
    }
    wireBox(pt, -half, -BH / 2, -BD / 2, half, BH / 2, BD / 2, faint);
    pt.flush();

    pt.chip(
      [0, BH / 2 + 14, 0],
      dividerIn ? 'the divider is in — two worlds' : 'divider removed — one world now',
      dark,
    );
    pt.hint(dark);
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={
        mode === 'mass'
          ? 'A 3D box of two particle species separated by a removable divider'
          : 'A 3D lattice with a hot half and a cold half, separated by a removable insulating divider'
      }
    />
  );
}

function rnd(span: number): number {
  return -span / 2 + 3 + Math.random() * (span - 6);
}
