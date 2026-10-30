import { useCanvas } from '../../hooks/useCanvas';
import { penetration } from '../../lib/semiinf';
import { FAINT, makePainter, useOrbitCam, useOrbitControls, wireBox } from '../shared/paint3d';
import { mix, paletteFor, thetaAt, type SemiView } from './SemiCanvas';

/**
 * The same front, in a body you can turn over: a long block whose face is
 * held (or filmed) at x = 0, shaded slice by slice by theta at the current
 * time, with the penetration depth drawn as a plane through it. The 2D tab
 * carries the numbers; this one is for seeing that "semi-infinite" means a
 * body so deep the far end never hears about the face.
 */
export function Semi3DCanvas({ view, dark }: { view: SemiView; dark: boolean }) {
  const cam = useOrbitCam(0.75, -0.3);
  const pal = paletteFor(view.cargo, dark);
  const redrawKey = `${JSON.stringify(view)}|${dark}|${cam.camTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const fit = Math.min(W, H) * 0.3;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, fit * cam.zoomRef.current);

    // Block from x = -1.6 (the face) to 1.6 (deep), 0.6 tall, 0.6 wide.
    const X0 = -1.6;
    const X1 = 1.6;
    const hy = 0.6;
    const hz = 0.6;
    const N = 60;
    const OV = 1.5 / N;
    for (let i = 0; i < N; i++) {
      const u0 = i / N;
      const u1 = (i + 1) / N + OV;
      const x = ((i + 0.5) / N) * view.depthMax;
      const th = view.t > 0 ? thetaAt(view, x, view.t) : 0;
      const fill = mix(pal.lo, pal.hi, th, 0.95);
      const a = X0 + u0 * (X1 - X0);
      const b = X0 + Math.min(1, u1) * (X1 - X0);
      // top and front faces of each slice
      pt.quad([[a, hy, -hz], [b, hy, -hz], [b, hy, hz], [a, hy, hz]], fill);
      pt.quad([[a, -hy, hz], [b, -hy, hz], [b, hy, hz], [a, hy, hz]], fill);
    }
    // The face itself, at the surface value.
    pt.quad([[X0, -hy, -hz], [X0, -hy, hz], [X0, hy, hz], [X0, hy, -hz]], mix(pal.lo, pal.hi, 1, 0.95));
    wireBox(pt, X0, -hy, -hz, X1, hy, hz, FAINT(dark));

    // The front, as a plane.
    const d = penetration(view.D, view.t);
    if (view.t > 0 && d < view.depthMax) {
      const xd = X0 + (d / view.depthMax) * (X1 - X0);
      const c = dark ? '#fbbf24' : '#b45309';
      pt.seg([xd, -hy, -hz], [xd, hy, -hz], c, 1.6);
      pt.seg([xd, hy, -hz], [xd, hy, hz], c, 1.6);
      pt.seg([xd, hy, hz], [xd, -hy, hz], c, 1.6);
      pt.seg([xd, -hy, hz], [xd, -hy, -hz], c, 1.6);
    }
    pt.flush();
    pt.chip([X0, hy + 0.15, 0], view.surface === 'held' ? 'face held' : 'face, through a film', dark);
    if (view.t > 0 && d < view.depthMax) {
      pt.chip([X0 + (d / view.depthMax) * (X1 - X0), hy + 0.15, 0], 'δ', dark);
    }
    pt.chip([X1, hy + 0.15, 0], '→ ∞', dark);
    pt.hint(dark);
  }, { running: false, redrawKey });

  useOrbitControls(canvasRef, cam, false);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[280px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[320px]"
      aria-label="A long block with its face at the left, shaded by how far the surface change has penetrated, with the penetration depth drawn as a plane; drag to rotate."
    />
  );
}
