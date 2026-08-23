import { useCanvas } from '../../hooks/useCanvas';
import {
  deathOnset,
  minC,
  supplyC,
  tissueC,
  type PerfusionParams,
} from '../../lib/perfusion';
import { rampColor } from '../FicksLaw/FickCanvas';
import {
  FAINT,
  makePainter,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
} from '../shared/paint3d';

/**
 * The perfused channel as the device it actually is: a fluid channel
 * riding on a slab of tissue, every face painted from the analytic
 * solution, with the starved region rendered as a translucent red wedge
 * growing out of the far-bottom corner. Rotate underneath it — the corner
 * problem is even more obvious from below.
 */
export function Perfusion3DCanvas({
  params,
  dark,
  cam: camProp,
}: {
  params: PerfusionParams;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const internalCam = useOrbitCam(0.6, -0.35);
  const cam = camProp ?? internalCam;
  const redrawKey = `${JSON.stringify(params)}|${dark}|${cam.camTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = params;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);

    const u = fit / 0.96;
    const BW = 1.6 * u;
    const BD = 0.7 * u;
    const totalH = 0.7 * u;
    const frac = Math.min(0.75, Math.max(0.2, p.h1 / (p.h1 + p.h2)));
    const chanH = totalH * frac;
    const tisH = totalH - chanH;
    const half = BW / 2;
    const yMid = totalH / 2 - chanH; // channel top at totalH/2, interface at yMid
    const yTop = totalH / 2;
    const yBot = -totalH / 2;

    const norm = (C: number) => Math.min(1, Math.max(0, C / p.C0)) * 0.9;
    const xTo = (px: number) => -half + px * BW; // px in 0..1
    const toX = (x: number) => ((x + half) / BW) * p.L;

    // Channel: top + front + back faces striped by supply concentration.
    const NS = 30;
    for (let i = 0; i < NS; i++) {
      const xa = -half + (i / NS) * BW;
      const xb = xa + BW / NS;
      const col = rampColor(norm(supplyC(p, toX(xa + BW / NS / 2))), dark, 0.75);
      pt.quad([[xa, yTop, -BD / 2], [xb, yTop, -BD / 2], [xb, yTop, BD / 2], [xa, yTop, BD / 2]], col);
      pt.quad([[xa, yMid, -BD / 2], [xb, yMid, -BD / 2], [xb, yTop, -BD / 2], [xa, yTop, -BD / 2]], col);
      pt.quad([[xa, yMid, BD / 2], [xb, yMid, BD / 2], [xb, yTop, BD / 2], [xa, yTop, BD / 2]], col);
    }
    // Tissue: front + back + bottom faces from the full 2-D solution.
    const NY = 10;
    for (let i = 0; i < NS; i++) {
      const xa = -half + (i / NS) * BW;
      const xb = xa + BW / NS;
      const x = toX(xa + BW / NS / 2);
      for (let j = 0; j < NY; j++) {
        const yA = yMid - (j / NY) * tisH;
        const yB = yA - tisH / NY;
        const C = tissueC(p, x, ((j + 0.5) / NY) * p.h2);
        const col = rampColor(norm(C), dark, 0.8);
        pt.quad([[xa, yB, -BD / 2], [xb, yB, -BD / 2], [xb, yA, -BD / 2], [xa, yA, -BD / 2]], col);
        pt.quad([[xa, yB, BD / 2], [xb, yB, BD / 2], [xb, yA, BD / 2], [xa, yA, BD / 2]], col);
      }
      pt.quad(
        [[xa, yBot, -BD / 2], [xb, yBot, -BD / 2], [xb, yBot, BD / 2], [xa, yBot, BD / 2]],
        rampColor(norm(minC(p, x)), dark, 0.85),
      );
    }

    // The starved wedge: from the death-onset x to the outlet, filling the
    // tissue below the death-depth surface.
    const xs = deathOnset(p);
    if (xs < p.L) {
      const red = dark ? 'rgba(239,68,68,0.3)' : 'rgba(220,38,38,0.24)';
      const NXd = 16;
      const x0d = Math.max(0, xs);
      for (let i = 0; i < NXd; i++) {
        const xA = x0d + ((p.L - x0d) * i) / NXd;
        const xB = x0d + ((p.L - x0d) * (i + 1)) / NXd;
        const yd = (x: number) => {
          const k = ((supplyC(p, x) - p.Ccrit) * p.D) / p.R;
          const inner = p.h2 * p.h2 - 2 * k;
          const depth = inner <= 0 ? p.h2 : p.h2 - Math.sqrt(Math.max(0, inner));
          return yMid - Math.min(1, Math.max(0, depth / p.h2)) * tisH;
        };
        const sxA = xTo(xA / p.L);
        const sxB = xTo(xB / p.L);
        for (const z of [-BD / 2, BD / 2]) {
          pt.quad([[sxA, yBot, z], [sxB, yBot, z], [sxB, yd(xB), z], [sxA, yd(xA), z]], red);
        }
        pt.quad([[sxA, yd(xA), -BD / 2], [sxB, yd(xB), -BD / 2], [sxB, yd(xB), BD / 2], [sxA, yd(xA), BD / 2]], red);
      }
    }

    // Interface seam + wireframes.
    for (const z of [-BD / 2, BD / 2]) {
      pt.seg([-half, yMid, z], [half, yMid, z], faint);
    }
    wireBox(pt, -half, yBot, -BD / 2, half, yTop, BD / 2, faint);
    pt.flush();

    pt.chip([-half, yTop + 14, 0], 'flow in at C₀ →', dark);
    if (xs < p.L) {
      pt.chip([half - 20, yBot - 14, 0], 'the starved corner', dark);
    } else {
      pt.chip([half - 30, yBot - 14, 0], 'every cell fed', dark);
    }
    pt.hint(dark, 'red wedge: C below C_crit — look at it from underneath');
  }, { running: false, redrawKey });

  useOrbitControls(canvasRef, cam, false);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="The perfused channel as a rotatable 3D device, with the starved tissue region as a red wedge at the far-bottom corner"
    />
  );
}
