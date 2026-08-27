import { useCanvas } from '../../hooks/useCanvas';
import { elements, nodeTemps, type WallParams } from '../../lib/network';
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
 * The composite wall as a physical stack: each layer a translucent 3D
 * slab shaded by its own temperature span, films as thin hatched slivers,
 * seams marked. Rotate it and the wall stops being a diagram and becomes
 * a thing someone would have to build. (The circuit stays on the 2D tab —
 * circuits are 2D creatures.)
 */
export function Wall3DCanvas({
  params,
  dark,
  cam: camProp,
}: {
  params: WallParams;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const internalCam = useOrbitCam(0.55, -0.3);
  const cam = camProp ?? internalCam;
  const redrawKey = `${JSON.stringify(params)}|${dark}|${cam.camTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = params;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);

    const els = elements(p);
    if (els.length === 0) return;
    const temps = nodeTemps(p);
    const tLo = Math.min(p.Tin, p.Tout);
    const span = Math.max(p.Tin, p.Tout) - tLo || 1;
    const norm = (T: number) => Math.min(1, Math.max(0, (T - tLo) / span));

    const u = fit / 0.96;
    const BW = 1.55 * u;
    const tA = Math.min(1, Math.max(0, (Math.log10(p.A) + 1) / 3));
    const BH = 0.85 * u * (0.55 + 0.45 * tA);
    const BD = 0.55 * u;
    const half = BW / 2;

    // Same width logic as 2D: films get slivers, layers share by thickness.
    const filmW = BW * 0.05;
    const nFilms = els.filter((e) => e.kind === 'film').length;
    const layerSpace = BW - nFilms * filmW;
    const totalL = els.reduce((s, e) => s + e.L, 0) || 1;
    const widths = els.map((e) =>
      e.kind === 'film' ? filmW : Math.max(0.07 * layerSpace, (e.L / totalL) * layerSpace),
    );
    const wSum = widths.reduce((s, w) => s + w, 0);
    for (let i = 0; i < widths.length; i++) widths[i] *= BW / wSum;

    let x = -half;
    const seams: number[] = [-half];
    for (let i = 0; i < els.length; i++) {
      const w = widths[i];
      const Ta = temps[i];
      const Tb = temps[i + 1];
      const NS = Math.max(2, Math.round(w / 14));
      const sw = w / NS;
      const alpha = els[i].kind === 'film' ? 0.3 : 0.55;
      for (let s2 = 0; s2 < NS; s2++) {
        const xa = x + s2 * sw;
        const xb = xa + sw;
        const T = Ta + ((Tb - Ta) * (s2 + 0.5)) / NS;
        const col = rampWarm(norm(T), dark, alpha);
        pt.quad([[xa, -BH / 2, -BD / 2], [xb, -BH / 2, -BD / 2], [xb, -BH / 2, BD / 2], [xa, -BH / 2, BD / 2]], col);
        pt.quad([[xa, BH / 2, -BD / 2], [xb, BH / 2, -BD / 2], [xb, BH / 2, BD / 2], [xa, BH / 2, BD / 2]], col);
        pt.quad([[xa, -BH / 2, -BD / 2], [xb, -BH / 2, -BD / 2], [xb, BH / 2, -BD / 2], [xa, BH / 2, -BD / 2]], col);
        pt.quad([[xa, -BH / 2, BD / 2], [xb, -BH / 2, BD / 2], [xb, BH / 2, BD / 2], [xa, BH / 2, BD / 2]], col);
      }
      x += w;
      seams.push(x);
      // Seam lines between elements.
      if (i < els.length - 1) {
        pt.seg([x, -BH / 2, -BD / 2], [x, BH / 2, -BD / 2], faint);
        pt.seg([x, -BH / 2, BD / 2], [x, BH / 2, BD / 2], faint);
        pt.seg([x, BH / 2, -BD / 2], [x, BH / 2, BD / 2], faint);
        pt.seg([x, -BH / 2, -BD / 2], [x, -BH / 2, BD / 2], faint);
      }
    }
    // End faces at fluid temperatures.
    pt.quad(
      [[-half, -BH / 2, -BD / 2], [-half, BH / 2, -BD / 2], [-half, BH / 2, BD / 2], [-half, -BH / 2, BD / 2]],
      rampWarm(norm(p.Tin), dark, 0.55),
    );
    pt.quad(
      [[half, -BH / 2, -BD / 2], [half, BH / 2, -BD / 2], [half, BH / 2, BD / 2], [half, -BH / 2, BD / 2]],
      rampWarm(norm(p.Tout), dark, 0.55),
    );
    wireBox(pt, -half, -BH / 2, -BD / 2, half, BH / 2, BD / 2, faint);
    pt.flush();

    // Layer labels along the top.
    for (let i = 0; i < els.length; i++) {
      const cxE = (seams[i] + seams[i + 1]) / 2;
      if (widths[i] > BW * 0.09) {
        pt.chip([cxE, BH / 2 + 14, 0] as Vec3, els[i].label, dark);
      }
    }
    pt.chip([-half, -BH / 2 - 16, 0], `${fmt(p.Tin)} °C fluid`, dark);
    pt.chip([half, -BH / 2 - 16, 0], `${fmt(p.Tout)} °C fluid`, dark);
    pt.hint(dark, 'every band colored by its own node-to-node temperature drop');
  }, { running: false, redrawKey });

  useOrbitControls(canvasRef, cam, false);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="The composite wall as a rotatable 3D stack of layers, each shaded by its temperature drop"
    />
  );
}

function fmt(v: number): string {
  return String(Number(v.toPrecision(3)));
}
