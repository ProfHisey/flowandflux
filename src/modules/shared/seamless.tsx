import { useEffect, useRef, useState } from 'react';
import { useOrbitCam } from './paint3d';

/**
 * The seamless 2D-to-3D handoff, extracted from the Divider prototype: the
 * module's picture is "always 3D". Face-on it is drawn by the instrumented
 * 2D canvas; the moment a drag starts, the 3D canvas mounts at the same
 * face-on camera pose and the SAME drag keeps rotating it — no mode click.
 * Double-click (or the 2D chip) animates the camera back to face-on and
 * restores the 2D view. Touch is excluded from the drag-flip (it would
 * fight page scroll); touch users keep the chip.
 *
 * Usage:
 *   const sd = useSeamlessDim(running);
 *   <Segmented value={sd.dim} onChange={sd.setDim} options={SEAMLESS_DIM_OPTIONS} />
 *   <div {...sd.wrapperProps}>
 *     {sd.dim === '3d' ? <Thing3DCanvas cam={sd.cam} ... /> : <ThingCanvas ... />}
 *   </div>
 *   {sd.dim === '2d' && <SeamlessHint noun="The wall" />}
 */
export function useSeamlessDim(
  loopRunning: boolean,
  pose3d: { yaw: number; pitch: number } = { yaw: 0.55, pitch: -0.32 },
) {
  const cam = useOrbitCam(0, 0); // init face-on: double-click reset = flat
  const [dim, setDimState] = useState<'2d' | '3d'>('2d');
  const animRef = useRef(0);
  const runningRef = useRef(loopRunning);
  runningRef.current = loopRunning;
  const poseRef = useRef(pose3d);
  poseRef.current = pose3d;
  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  const returnTo2D = () => {
    cancelAnimationFrame(animRef.current);
    if (document.hidden) {
      // rAF is paused in hidden tabs — snap instead of stalling mid-flight.
      cam.yawRef.current = 0;
      cam.pitchRef.current = 0;
      cam.zoomRef.current = 1;
      setDimState('2d');
      return;
    }
    const y0 = cam.yawRef.current;
    const p0 = cam.pitchRef.current;
    const z0 = cam.zoomRef.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 320);
      const e = 1 - (1 - t) ** 3;
      cam.yawRef.current = y0 * (1 - e);
      cam.pitchRef.current = p0 * (1 - e);
      cam.zoomRef.current = z0 + (1 - z0) * e;
      if (!runningRef.current) cam.setCamTick((k) => k + 1);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else setDimState('2d');
    };
    animRef.current = requestAnimationFrame(step);
  };

  const setDim = (d: '2d' | '3d') => {
    if (d === dim) return;
    if (d === '3d') {
      cancelAnimationFrame(animRef.current);
      cam.yawRef.current = poseRef.current.yaw;
      cam.pitchRef.current = poseRef.current.pitch;
      cam.zoomRef.current = 1;
      cam.setCamTick((t) => t + 1);
      setDimState('3d');
    } else {
      returnTo2D();
    }
  };

  // Drag on the 2D view: hand the pointer straight to the 3D camera.
  const onPointerDown = (e: React.PointerEvent) => {
    if (dim !== '2d' || e.pointerType === 'touch') return; // touch scrolls
    cancelAnimationFrame(animRef.current);
    const sx = e.clientX;
    const sy = e.clientY;
    let flipped = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!flipped) {
        if (Math.hypot(dx, dy) < 5) return; // a click is not a drag
        flipped = true;
        setDimState('3d');
      }
      cam.yawRef.current = dx * 0.008;
      cam.pitchRef.current = Math.min(1.35, Math.max(-1.35, -dy * 0.008));
      if (!runningRef.current) cam.setCamTick((t) => t + 1);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // Window-level listeners: the mid-drag component swap must not drop the pointer.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // In 3D, double-click means "back to 2D" — intercept before the canvas's
  // own instant camera reset so the return can animate instead.
  const onDoubleClickCapture = (e: React.MouseEvent) => {
    if (dim !== '3d') return;
    e.stopPropagation();
    returnTo2D();
  };

  return {
    cam,
    dim,
    setDim,
    wrapperProps: {
      onPointerDown,
      onDoubleClickCapture,
      className: dim === '2d' ? 'cursor-grab' : undefined,
    },
  };
}

export const SEAMLESS_DIM_OPTIONS = [
  { value: '2d' as const, label: '2D', title: 'Face-on view with measurements — or double-click the 3D view' },
  { value: '3d' as const, label: '3D', title: 'The same picture in space — or just drag the 2D view' },
];

export function SeamlessHint({ noun = 'The picture' }: { noun?: string }) {
  return (
    <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
      {noun} is secretly 3D — drag it and it rotates out of the page. Double-click
      the 3D view to lie it flat again.
    </p>
  );
}
