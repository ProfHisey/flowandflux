import { useEffect, useRef, type MutableRefObject } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { rampWarm } from '../FourierLaw/FourierCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';
import { TAU_VIS } from './CoolingCanvas';

/**
 * The Flow view as a volume: the same lumped object, now a sphere, sitting
 * in a box of stream. Tracers ride the potential flow around a SPHERE (the
 * 2D tab's field is the cylinder one — each is the honest field for its own
 * dimension), creep through the film at the surface, and leave carrying the
 * object's current warmth, so the wake is a plume trailing downstream that
 * starves on the same visual clock as the 2D tab.
 *
 * The sphere is one uniform color — the lumped assumption, drawn — with a
 * faint graticule so the rotation still reads on a body with no shading.
 * Cosmetic values match the 2D tab and are labeled the same way: the
 * on-screen time constant, and a film whose drawn thickness is a cue for h.
 */

const COUNT = 320;
const FLOW = 62; // px/s on screen — cosmetic, like the 2D view

export function Cooling3DCanvas({
  h,
  lc,
  heating,
  resetTick,
  running,
  dark,
  clock,
  cam: camProp,
}: {
  /** Physical h, W/m^2 K — only used to size the drawn film (labeled cue). */
  h: number;
  /** Characteristic length V/A, m — sizes the drawn object (log-mapped). */
  lc: number;
  /** True when Tinf > T0 (a thermometer warming up): the wake runs cold. */
  heating: boolean;
  resetTick: number;
  running: boolean;
  dark: boolean;
  /** The visual clock, owned by the module so 2D and 3D share one cooling. */
  clock: MutableRefObject<number>;
  cam?: OrbitCam;
}) {
  const tracersRef = useRef<{ p: Vec3; carry: number }[]>([]);
  const internalCam = useOrbitCam(0.5, -0.28);
  const cam = camProp ?? internalCam;

  const redrawKey = `${dark}|${resetTick}|${h}|${heating}|${lc}|${cam.camTick}`;

  useEffect(() => {
    tracersRef.current = [];
  }, [resetTick]);

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    if (fit <= 0) return;

    // The stream volume: long along the flow (x), square in cross-section.
    const BX = Math.min(1.9 * fit, W / 2 - 40);
    const BY = 0.72 * fit;
    const BZ = 0.72 * fit;
    const ox = -0.42 * BX; // the object sits upstream, leaving room for the wake

    // Same log map as the 2D tab: a thermometer bulb draws small, a roast big.
    const tLc = Math.min(1, Math.max(0, (Math.log10(Math.max(1e-6, lc)) + 4) / 3.5));
    const R = Math.max(9, fit * (0.14 + 0.24 * tLc));
    // Film thickness: a cue tied to h — bigger h, thinner film. Cosmetic.
    const film = Math.max(4, Math.min(0.2 * fit, 26 - 5 * Math.log10(Math.max(1, h))));

    const dt = running ? frame.dt : 0;
    clock.current += dt;
    const theta = Math.exp(-clock.current / TAU_VIS);

    const list = tracersRef.current;
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push({
          p: [
            (Math.random() * 2 - 1) * BX,
            (Math.random() * 2 - 1) * BY,
            (Math.random() * 2 - 1) * BZ,
          ],
          carry: 0,
        });
      }
    }

    const warm = heating ? '56,189,248' : dark ? '251,146,60' : '220,38,38';
    const cold = dark ? '148,163,184' : '100,116,139';
    const R3 = R * R * R;

    for (const q of list) {
      const p = q.p;
      if (dt > 0) {
        let dx = p[0] - ox;
        let dy = p[1];
        let dz = p[2];
        let r = Math.hypot(dx, dy, dz);
        if (r < R + 1) {
          // Never inside the solid: project back onto the surface.
          if (r === 0) {
            dx = -(R + 1.5);
          } else {
            const s = (R + 1.5) / r;
            dx *= s;
            dy *= s;
            dz *= s;
          }
          p[0] = ox + dx;
          p[1] = dy;
          p[2] = dz;
          r = R + 1.5;
        }
        // Potential flow past a sphere: v = U[x̂ + (R³/2)(x̂/r³ − 3x·r/r⁵)].
        // Zero at both stagnation points, 1.5 U over the equator.
        const r3 = r * r * r;
        const k = (3 * R3 * dx) / (2 * r3 * r * r);
        let ux = FLOW * (1 + R3 / (2 * r3) - k * dx);
        let uy = FLOW * (-k * dy);
        let uz = FLOW * (-k * dz);
        // Viscous film: speed dies toward the wall (no-slip, in spirit).
        const gap = Math.max(0, r - R);
        const slow = gap > film * 2 ? 1 : Math.max(0.07, 1 - Math.exp(-(gap / film) * 1.4));
        ux *= slow;
        uy *= slow;
        uz *= slow;
        p[0] += ux * dt;
        p[1] += uy * dt + (Math.random() - 0.5) * 3 * dt;
        p[2] += uz * dt + (Math.random() - 0.5) * 3 * dt;
        // Brushing the film transfers the object's CURRENT warmth.
        if (gap < film) q.carry = Math.max(q.carry, theta * (1 - gap / film));
        if (p[0] > BX) {
          p[0] = -BX;
          p[1] = (Math.random() * 2 - 1) * BY;
          p[2] = (Math.random() * 2 - 1) * BZ;
          q.carry = 0;
        }
        if (p[1] < -BY) p[1] = -2 * BY - p[1];
        if (p[1] > BY) p[1] = 2 * BY - p[1];
        if (p[2] < -BZ) p[2] = -2 * BZ - p[2];
        if (p[2] > BZ) p[2] = 2 * BZ - p[2];
      }
      if (q.carry > 0.02) pt.dot(p, fit, warm, 1.45, 0.3 + 0.9 * q.carry);
      else pt.dot(p, fit, cold, 1, 0.75);
    }

    // The object: ONE color throughout — that uniformity IS the lumped
    // assumption, drawn.
    const u = heating ? 1 - theta : theta;
    const body = rampWarm(0.08 + 0.92 * u, dark);
    const NT = 16;
    const S = (rad: number, th: number, ph: number): Vec3 => [
      ox + rad * Math.cos(th),
      rad * Math.sin(th) * Math.cos(ph),
      rad * Math.sin(th) * Math.sin(ph),
    ];
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < NT; i++) {
        const th0 = (j / NT) * Math.PI;
        const th1 = ((j + 1) / NT) * Math.PI;
        const ph0 = (i / NT) * Math.PI * 2;
        const ph1 = ((i + 1) / NT) * Math.PI * 2;
        pt.quad([S(R, th0, ph0), S(R, th1, ph0), S(R, th1, ph1), S(R, th0, ph1)], body);
      }
    }

    const RING = 40;
    const ring = (
      rad: number,
      f: (a: number) => Vec3,
      stroke: string,
      w: number,
      dashed: boolean,
    ) => {
      for (let i = 0; i < RING; i++) {
        if (dashed && i % 2) continue;
        const A = f((i / RING) * Math.PI * 2);
        const B = f(((i + 1) / RING) * Math.PI * 2);
        pt.seg(
          [ox + rad * A[0], rad * A[1], rad * A[2]],
          [ox + rad * B[0], rad * B[1], rad * B[2]],
          stroke,
          w,
        );
      }
    };
    const XY = (a: number): Vec3 => [Math.cos(a), Math.sin(a), 0];
    const XZ = (a: number): Vec3 => [Math.cos(a), 0, Math.sin(a)];
    const YZ = (a: number): Vec3 => [0, Math.cos(a), Math.sin(a)];

    // Graticule: a body with no shading needs lines for its rotation to read.
    const grat = dark ? 'rgba(226,232,240,0.34)' : 'rgba(51,65,85,0.32)';
    for (const f of [XY, XZ, YZ]) ring(R * 1.012, f, grat, 1, false);

    // The film h lives in: a dashed shell, three great circles of it.
    const amber = dark ? 'rgba(251,191,36,0.62)' : 'rgba(217,119,6,0.6)';
    for (const f of [XY, XZ, YZ]) ring(R + film, f, amber, 1.5, true);

    wireBox(pt, -BX, -BY, -BZ, BX, BY, BZ, FAINT(dark));
    pt.flush();

    pt.chip([ox, R + film + 15, 0], 'the film h lives in', dark);
    pt.chip(
      [ox, -(R + film + 15), 0],
      `lumped: one temperature — ${Math.round(u * 100)}% of the gap left`,
      dark,
    );
    pt.chip([-BX, BY + 13, 0], 'flow →  fluid at T∞', dark);

    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`visual clock: τ ≈ ${TAU_VIS} s on screen — real τ in the readouts`, W - 10, 18);
    pt.hint(dark);
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A lumped sphere cooling in a 3D stream: tracers wrap around it, brush the surface film, and trail its heat downstream as a fading plume"
    />
  );
}
