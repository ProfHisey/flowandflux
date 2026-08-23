import { useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { nusselt, sherwood, type CorrParams } from '../../lib/correlations';
import {
  makePainter,
  useOrbitCam,
  useOrbitControls,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';

/**
 * The two boundary layers as SHELLS: the object sits in the stream with
 * its thermal film (amber) and concentration film (cyan) drawn as
 * translucent skins at their relative thicknesses. In water the cyan skin
 * hugs the surface while the amber one floats well clear — the (Sc/Pr)^1/3
 * gap, now something you can orbit around.
 */
export function Corr3DCanvas({
  params,
  dark,
  cam: camProp,
}: {
  params: CorrParams;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const offsetRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const internalCam = useOrbitCam(0.55, -0.28);
  const cam = camProp ?? internalCam;

  const redrawKey = `${JSON.stringify({ ...params, fluid: params.fluid.name })}|${dark}|${cam.camTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;

    const Nu = Math.max(1, nusselt(p));
    const Sh = Math.max(1, sherwood(p));
    const filmPx = (N: number) => Math.max(3, 44 - 8.5 * Math.log10(N));
    const dT = filmPx(Nu);
    const dC = filmPx(Sh);
    const amber = dark ? 'rgba(251,191,36,0.3)' : 'rgba(217,119,6,0.22)';
    const cyanC = dark ? 'rgba(34,211,238,0.32)' : 'rgba(8,145,178,0.24)';
    const bodyCol = dark ? 'rgba(100,116,139,0.95)' : 'rgba(148,163,184,0.95)';

    const sphereQuads = (R: number, col: string, skipFn?: (c: Vec3) => boolean) => {
      const NT = 16;
      for (let j = 0; j < NT; j++) {
        for (let k = 0; k < NT; k++) {
          const th0 = (j / NT) * Math.PI;
          const th1 = ((j + 1) / NT) * Math.PI;
          const ph0 = (k / NT) * Math.PI * 2;
          const ph1 = ((k + 1) / NT) * Math.PI * 2;
          const P = (th: number, ph: number): Vec3 => [
            R * Math.sin(th) * Math.cos(ph),
            R * Math.cos(th),
            R * Math.sin(th) * Math.sin(ph),
          ];
          const c = P((th0 + th1) / 2, (ph0 + ph1) / 2);
          if (skipFn && skipFn(c)) continue;
          pt.quad([P(th0, ph0), P(th1, ph0), P(th1, ph1), P(th0, ph1)], col);
        }
      }
    };
    const cylQuads = (R: number, L2: number, col: string) => {
      const NT = 18;
      for (let j = 0; j < NT; j++) {
        const t0 = (j / NT) * Math.PI * 2;
        const t1 = ((j + 1) / NT) * Math.PI * 2;
        pt.quad(
          [
            [-L2, R * Math.sin(t0), R * Math.cos(t0)],
            [L2, R * Math.sin(t0), R * Math.cos(t0)],
            [L2, R * Math.sin(t1), R * Math.cos(t1)],
            [-L2, R * Math.sin(t1), R * Math.cos(t1)],
          ],
          col,
        );
      }
    };

    // Flow arrows streaming past (along z).
    offsetRef.current = (offsetRef.current + 40 * frame.dt) % 60;
    const arr = dark ? 'rgba(148,163,184,0.45)' : 'rgba(100,116,139,0.4)';
    for (let row = -1; row <= 1; row++) {
      for (let d = -fit; d < fit; d += 60) {
        const z = d + offsetRef.current;
        if (z + 18 > fit) continue;
        pt.seg([-fit * 0.75, row * fit * 0.6, z], [-fit * 0.75, row * fit * 0.6, z + 16], arr, 1.5);
      }
    }

    if (p.geometry === 'sphere' || p.geometry === 'cylinder') {
      const R = 0.32 * fit;
      if (p.geometry === 'sphere') {
        sphereQuads(R, bodyCol);
        // Films as quarter-open shells so you can see inside the gap.
        const open = (c: Vec3) => c[0] > 0 && c[2] > 0;
        sphereQuads(R + Math.min(dT, dC), dC <= dT ? cyanC : amber, open);
        sphereQuads(R + Math.max(dT, dC), dC <= dT ? amber : cyanC, open);
      } else {
        const L2 = 0.65 * fit;
        cylQuads(R, L2, bodyCol);
        cylQuads(R + Math.min(dT, dC), L2, dC <= dT ? cyanC : amber);
        cylQuads(R + Math.max(dT, dC), L2, dC <= dT ? amber : cyanC);
      }
    } else if (p.geometry === 'plate') {
      const L2 = 0.8 * fit;
      const BD2 = 0.5 * fit;
      pt.quad([[-L2, 0, -BD2], [L2, 0, -BD2], [L2, 0, BD2], [-L2, 0, BD2]], bodyCol);
      // Films: sqrt-growing sheets above the plate.
      const grow = (g: number, col: string) => {
        const NX = 16;
        for (let i = 0; i < NX; i++) {
          const xa = -L2 + (2 * L2 * i) / NX;
          const xb = xa + (2 * L2) / NX;
          const ya = g * Math.sqrt(i / NX);
          const yb = g * Math.sqrt((i + 1) / NX);
          pt.quad([[xa, ya, -BD2], [xb, yb, -BD2], [xb, yb, BD2], [xa, ya, BD2]], col);
        }
      };
      grow(Math.max(dT, dC) * 1.6, dC <= dT ? amber : cyanC);
      grow(Math.min(dT, dC) * 1.6, dC <= dT ? cyanC : amber);
    } else {
      // Tube: outer shell solid, films as internal skins.
      const R = 0.3 * fit;
      const L2 = 0.75 * fit;
      cylQuads(R, L2, dark ? 'rgba(63,76,99,0.5)' : 'rgba(203,213,225,0.5)');
      cylQuads(Math.max(4, R - Math.min(dT, dC)), L2, dC <= dT ? cyanC : amber);
      cylQuads(Math.max(3, R - Math.max(dT, dC)), L2, dC <= dT ? amber : cyanC);
    }

    pt.flush();

    // Legend chips (screen-anchored via near-camera positions is fiddly —
    // draw as plain HUD text, the one 3D view where that is clearer).
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#fbbf24' : '#b45309';
    ctx.fillText(`amber shell · thermal film · Nu = ${fmt(Nu)}`, 10, 18);
    ctx.fillStyle = dark ? '#22d3ee' : '#0e7490';
    ctx.fillText(`cyan shell · concentration film · Sh = ${fmt(Sh)}`, 10, 34);
    pt.hint(dark, 'shell gap = (Sc/Pr)^⅓ — orbit around it');
  }, { running: true, redrawKey });

  useOrbitControls(canvasRef, cam, true);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="An object in a stream with its thermal and concentration boundary layers drawn as translucent 3D shells"
    />
  );
}

function fmt(v: number): string {
  return v >= 1000 ? v.toExponential(1) : String(Number(v.toPrecision(3)));
}
