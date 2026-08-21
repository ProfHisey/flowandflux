import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * The shared 3D machinery every rotatable view runs on: an orbit/zoom
 * camera (drag to rotate, scroll to zoom, double-click to reset) and a
 * depth-sorted painter over the plain 2D canvas. No 3D library — the same
 * approach the first Fick 3D view proved out, extracted so new views cost
 * ~150 lines instead of ~400.
 */

export type Vec3 = [number, number, number];

// ------------------------------------------------------------- camera

export function useOrbitCam(initYaw = 0.6, initPitch = -0.3) {
  const yawRef = useRef(initYaw);
  const pitchRef = useRef(initPitch);
  const zoomRef = useRef(1);
  const [camTick, setCamTick] = useState(0);
  const initRef = useRef({ initYaw, initPitch });
  return { yawRef, pitchRef, zoomRef, camTick, setCamTick, initRef };
}
export type OrbitCam = ReturnType<typeof useOrbitCam>;

/** Attach drag / wheel / double-click controls. Bumps camTick when the
 *  animation loop is off so static scenes still track the pointer. */
export function useOrbitControls(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cam: OrbitCam,
  loopRunning: boolean,
) {
  const { yawRef, pitchRef, zoomRef, setCamTick, initRef } = cam;
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const bump = () => {
      if (!loopRunning) setCamTick((t) => t + 1);
    };
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yawRef.current += (e.clientX - lastX) * 0.008;
      pitchRef.current = Math.min(
        1.35,
        Math.max(-1.35, pitchRef.current - (e.clientY - lastY) * 0.008),
      );
      lastX = e.clientX;
      lastY = e.clientY;
      bump();
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
    };
    const reset = () => {
      yawRef.current = initRef.current.initYaw;
      pitchRef.current = initRef.current.initPitch;
      zoomRef.current = 1;
      setCamTick((t) => t + 1);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current = Math.min(
        3,
        Math.max(0.5, zoomRef.current * Math.exp(-e.deltaY * 0.0012)),
      );
      bump();
    };

    el.style.cursor = 'grab';
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', reset);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('dblclick', reset);
      el.removeEventListener('wheel', wheel);
    };
  }, [canvasRef, loopRunning, yawRef, pitchRef, zoomRef, setCamTick, initRef]);
}

// ------------------------------------------------------------- painter

export interface Painter {
  view: (v: Vec3) => Vec3;
  px: (v: Vec3) => [number, number];
  quad: (pts: [Vec3, Vec3, Vec3, Vec3], fill: string) => void;
  seg: (a: Vec3, b: Vec3, stroke: string, w?: number) => void;
  /** Depth-cued dot. rgb like "226,232,240"; size and alpha scale with depth. */
  dot: (v: Vec3, fit: number, rgb: string, sizeMul?: number, alphaMul?: number) => void;
  /** Sort by depth and draw everything queued so far. */
  flush: () => void;
  /** Screen-space label pinned to a 3D anchor. Call AFTER flush. */
  chip: (v: Vec3, text: string, dark: boolean) => void;
  /** The bottom-right interaction hint. Call after flush. */
  hint: (dark: boolean, extraLeft?: string) => void;
}

export function makePainter(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  yaw: number,
  pitch: number,
  zoom: number,
): Painter {
  const cx = W / 2;
  const cy = H / 2;
  const cyw = Math.cos(yaw);
  const syw = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);

  const view = (v: Vec3): Vec3 => {
    const x = cyw * v[0] + syw * v[2];
    const z1 = -syw * v[0] + cyw * v[2];
    const y = cp * v[1] - sp * z1;
    const z = sp * v[1] + cp * z1;
    return [x, y, z]; // +z toward the viewer
  };
  const px = (v: Vec3): [number, number] => [cx + v[0] * zoom, cy - v[1] * zoom];

  const items: { z: number; f: () => void }[] = [];

  const quad = (pts: [Vec3, Vec3, Vec3, Vec3], fill: string) => {
    const vs = pts.map(view) as Vec3[];
    items.push({
      z: (vs[0][2] + vs[1][2] + vs[2][2] + vs[3][2]) / 4,
      f: () => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        const [ax, ay] = px(vs[0]);
        ctx.moveTo(ax, ay);
        for (let i = 1; i < 4; i++) {
          const [bx, by] = px(vs[i]);
          ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.fill();
      },
    });
  };

  const seg = (a: Vec3, b: Vec3, stroke: string, w = 1) => {
    const va = view(a);
    const vb = view(b);
    items.push({
      z: (va[2] + vb[2]) / 2,
      f: () => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = w;
        ctx.beginPath();
        const [ax, ay] = px(va);
        ctx.moveTo(ax, ay);
        const [bx, by] = px(vb);
        ctx.lineTo(bx, by);
        ctx.stroke();
      },
    });
  };

  const dot = (v: Vec3, fit: number, rgb: string, sizeMul = 1, alphaMul = 1) => {
    const vv = view(v);
    const depth = Math.min(1, Math.max(0, vv[2] / fit / 2 + 0.5));
    items.push({
      z: vv[2],
      f: () => {
        ctx.fillStyle = `rgba(${rgb},${((0.3 + 0.55 * depth) * alphaMul).toFixed(2)})`;
        ctx.beginPath();
        const [ax, ay] = px(vv);
        ctx.arc(ax, ay, (1.2 + 1.2 * depth) * zoom * sizeMul, 0, Math.PI * 2);
        ctx.fill();
      },
    });
  };

  const flush = () => {
    items.sort((a, b) => a.z - b.z);
    for (const it of items) it.f();
    items.length = 0;
  };

  const chip = (v: Vec3, text: string, dark: boolean) => {
    const [sx, sy] = px(view(v));
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    const w = ctx.measureText(text).width;
    ctx.fillStyle = dark ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.85)';
    ctx.fillRect(sx - w / 2 - 5, sy - 10, w + 10, 19);
    ctx.fillStyle = dark ? '#e2e8f0' : '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, sx, sy);
    ctx.textBaseline = 'alphabetic';
  };

  const hint = (dark: boolean, extraLeft?: string) => {
    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('drag to rotate · scroll to zoom · double-click to reset', W - 10, H - 10);
    if (extraLeft) {
      ctx.textAlign = 'left';
      ctx.fillText(extraLeft, 10, H - 10);
    }
  };

  return { view, px, quad, seg, dot, flush, chip, hint };
}

/** The 12 edges of an axis-aligned box, drawn faint. */
export function wireBox(
  pt: Painter,
  x0: number, y0: number, z0: number,
  x1: number, y1: number, z1: number,
  stroke: string,
) {
  const V: Vec3[] = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const E: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (const [a, b] of E) pt.seg(V[a], V[b], stroke);
}

export const FAINT = (dark: boolean) =>
  dark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.55)';
export const NEUTRAL_DOT = (dark: boolean) => (dark ? '226,232,240' : '15,23,42');
