import { useCanvas } from '../../hooks/useCanvas';
import { centerTemp, tempAt, type HeislerParams } from '../../lib/transient';
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

/**
 * The finite body in 3D at time t, painted from the one-term solution: a
 * wall as a translucent slab banded by T(x*), a sphere as a quarter-cut
 * shell stack. Static in time (the t slider drives it), rotatable in space.
 */
export function Heisler3DCanvas({
  params,
  dark,
  cam: camProp,
}: {
  params: HeislerParams;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const internalCam = useOrbitCam(0.6, -0.32);
  const cam = camProp ?? internalCam;

  const redrawKey = `${JSON.stringify(params)}|${dark}|${cam.camTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = params;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);

    const tLo = Math.min(p.Ti, p.Tinf);
    const span = Math.abs(p.Ti - p.Tinf) || 1;
    const norm = (T: number) => Math.min(1, Math.max(0, (T - tLo) / span));
    const tL = Math.min(1, Math.max(0, (Math.log10(p.L) + 3) / 2.48));

    if (p.geometry === 'wall') {
      const u = fit / 0.96;
      const BW = (0.8 + 0.8 * tL) * u;
      const BH = 0.75 * u;
      const BD = 0.75 * u;
      const ctr = (v: Vec3): Vec3 => [v[0] - BW / 2, v[1] - BH / 2, v[2] - BD / 2];
      const NS = 22;
      const sw = BW / NS;
      for (let i = 0; i < NS; i++) {
        const xa = i * sw;
        const xb = xa + sw;
        const xStar = Math.abs((xa + sw / 2 - BW / 2) / (BW / 2));
        const col = rampWarm(norm(tempAt(p, xStar)), dark, 0.55);
        pt.quad([ctr([xa, 0, 0]), ctr([xb, 0, 0]), ctr([xb, 0, BD]), ctr([xa, 0, BD])], col);
        pt.quad([ctr([xa, BH, 0]), ctr([xb, BH, 0]), ctr([xb, BH, BD]), ctr([xa, BH, BD])], col);
        pt.quad([ctr([xa, 0, 0]), ctr([xb, 0, 0]), ctr([xb, BH, 0]), ctr([xa, BH, 0])], col);
        pt.quad([ctr([xa, 0, BD]), ctr([xb, 0, BD]), ctr([xb, BH, BD]), ctr([xa, BH, BD])], col);
      }
      const endCol = rampWarm(norm(tempAt(p, 1)), dark, 0.55);
      pt.quad([ctr([0, 0, 0]), ctr([0, BH, 0]), ctr([0, BH, BD]), ctr([0, 0, BD])], endCol);
      pt.quad([ctr([BW, 0, 0]), ctr([BW, BH, 0]), ctr([BW, BH, BD]), ctr([BW, 0, BD])], endCol);
      wireBox(pt, -BW / 2, -BH / 2, -BD / 2, BW / 2, BH / 2, BD / 2, faint);
      pt.flush();
      pt.chip([0, 0, 0], `center: ${fmt(centerTemp(p))} °C`, dark);
      pt.chip([BW / 2, BH / 2 + 14, 0], `surface: ${fmt(tempAt(p, 1))} °C · fluid at ${fmt(p.Tinf)} °C`, dark);
    } else {
      // Sphere: quarter-wedge cutaway, shells shaded by their own theta.
      const rOut = fit * (0.55 + 0.45 * tL);
      const NR = 12;
      const NA = 16;
      const dr = rOut / NR;
      const da = Math.PI / NA;
      for (let i = 0; i < NR; i++) {
        const rA = i * dr;
        const rB = rA + dr;
        const col = rampWarm(norm(tempAt(p, (rA + dr / 2) / rOut)), dark);
        for (let j = 0; j < NA; j++) {
          const a0 = -Math.PI / 2 + j * da;
          const a1 = a0 + da;
          pt.quad(
            [
              [0, rA * Math.sin(a0), rA * Math.cos(a0)],
              [0, rB * Math.sin(a0), rB * Math.cos(a0)],
              [0, rB * Math.sin(a1), rB * Math.cos(a1)],
              [0, rA * Math.sin(a1), rA * Math.cos(a1)],
            ],
            col,
          );
          pt.quad(
            [
              [rA * Math.cos(a0), rA * Math.sin(a0), 0],
              [rB * Math.cos(a0), rB * Math.sin(a0), 0],
              [rB * Math.cos(a1), rB * Math.sin(a1), 0],
              [rA * Math.cos(a1), rA * Math.sin(a1), 0],
            ],
            col,
          );
        }
      }
      // Surface shell (the part that faces the fluid), translucent.
      const NT = 20;
      for (let j = 0; j < NT; j++) {
        for (let k = 0; k < NT; k++) {
          const th0 = (j / NT) * Math.PI;
          const th1 = ((j + 1) / NT) * Math.PI;
          const ph0 = (k / NT) * Math.PI * 2;
          const ph1 = ((k + 1) / NT) * Math.PI * 2;
          const P = (th: number, ph: number): Vec3 => [
            rOut * Math.sin(th) * Math.cos(ph),
            rOut * Math.cos(th),
            rOut * Math.sin(th) * Math.sin(ph),
          ];
          const c0 = P((th0 + th1) / 2, (ph0 + ph1) / 2);
          if (c0[0] > 0 && c0[2] > 0) continue; // the cutaway wedge
          pt.quad(
            [P(th0, ph0), P(th1, ph0), P(th1, ph1), P(th0, ph1)],
            rampWarm(norm(tempAt(p, 1)), dark, 0.35),
          );
        }
      }
      pt.flush();
      // Silhouette.
      ctx.strokeStyle = dark ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, rOut * cam.zoomRef.current, 0, Math.PI * 2);
      ctx.stroke();
      pt.chip([0, 0, 0], `center: ${fmt(centerTemp(p))} °C`, dark);
      pt.chip([0, rOut + 16, 0], `surface: ${fmt(tempAt(p, 1))} °C · fluid at ${fmt(p.Tinf)} °C`, dark);
    }

    pt.hint(dark, 'painted from θ = C₁·exp(−ζ₁²Fo) — the chart, made solid');
  }, { running: false, redrawKey });

  useOrbitControls(canvasRef, cam, false);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label={`A ${params.geometry} in 3D, shaded by the one-term transient temperature solution`}
    />
  );
}

function fmt(v: number): string {
  return String(Number(v.toPrecision(3)));
}
