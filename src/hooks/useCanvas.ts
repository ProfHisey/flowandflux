import { useEffect, useRef, type RefObject } from 'react';

export interface FrameInfo {
  /** Seconds since the previous frame, clamped so a backgrounded tab cannot
   *  hand the simulation a multi-second jump. */
  dt: number;
  /** Seconds since the loop started. */
  t: number;
  /** CSS pixel width of the canvas. */
  width: number;
  /** CSS pixel height of the canvas. */
  height: number;
}

export type DrawFn = (ctx: CanvasRenderingContext2D, frame: FrameInfo) => void;

export interface CanvasOptions {
  /** Run the animation loop. When false the canvas still repaints once
   *  whenever `redrawKey` changes, so parameter edits stay visible while
   *  the simulation is paused. */
  running?: boolean;
  /** Any value that should force a single repaint while paused. */
  redrawKey?: unknown;
}

/**
 * requestAnimationFrame loop bound to a canvas, with device-pixel-ratio
 * scaling and ResizeObserver handling so the drawing stays crisp and the
 * draw callback can work in plain CSS pixels.
 *
 * The draw function is held in a ref, so a component can close over fresh
 * state on every render without tearing down and restarting the loop.
 */
export function useCanvas(
  draw: DrawFn,
  { running = true, redrawKey }: CanvasOptions = {},
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const sizeRef = useRef({ width: 0, height: 0 });

  // Keep the backing store matched to the element's laid-out size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      sizeRef.current = { width: rect.width, height: rect.height };
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    const start = last;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      const { width, height } = sizeRef.current;
      if (width > 0 && height > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        drawRef.current(ctx, { dt, t: (now - start) / 1000, width, height });
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // One repaint on demand while paused, so the picture tracks the controls
  // without the loop having to spin.
  useEffect(() => {
    if (running) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const id = requestAnimationFrame(() => {
      const { width, height } = sizeRef.current;
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawRef.current(ctx, { dt: 0, t: 0, width, height });
    });
    return () => cancelAnimationFrame(id);
  }, [running, redrawKey]);

  return canvasRef;
}
