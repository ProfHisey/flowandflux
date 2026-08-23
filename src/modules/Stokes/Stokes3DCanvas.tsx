import { useEffect, useRef } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { dragForce, gEff, terminalVelocity, type StokesParams } from '../../lib/stokes';
import {
  FAINT,
  makePainter,
  NEUTRAL_DOT,
  useOrbitCam,
  useOrbitControls,
  wireBox,
  type OrbitCam,
  type Vec3,
} from '../shared/paint3d';

/**
 * The settling column as a volume: a glass box of particles all drifting
 * at terminal velocity (up, if they float), with the specimen sphere and
 * its strobe trail in the middle — plus the same true-magnitude free-body
 * arrows as the 2D tab, pinned to the sphere so they rotate with it. Drag
 * opposes the motion (up beside buoyancy when settling, down beside weight
 * when floating), and the two stacks balance at terminal velocity.
 */

const COUNT = 90;

export function Stokes3DCanvas({
  params,
  running,
  dark,
  cam: camProp,
}: {
  params: StokesParams;
  running: boolean;
  dark: boolean;
  /** Optional shared camera for the seamless 2D-to-3D handoff. */
  cam?: OrbitCam;
}) {
  const cloudRef = useRef<Vec3[]>([]);
  const strobeRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const internalCam = useOrbitCam(0.55, -0.28);
  const cam = camProp ?? internalCam;

  const redrawKey = `${JSON.stringify(params)}|${dark}|${cam.camTick}`;

  useEffect(() => {
    cloudRef.current = [];
  }, []);

  const canvasRef = useCanvas((ctx, frame) => {
    const p = paramsRef.current;
    const { width: W, height: H } = frame;
    const pt = makePainter(ctx, W, H, cam.yawRef.current, cam.pitchRef.current, cam.zoomRef.current);
    const fit = Math.min(W, H) / 2 - 26;
    const faint = FAINT(dark);
    const dt = running ? frame.dt : 0;

    const BX = 0.62 * fit;
    const BY = 0.92 * fit;
    const dir = terminalVelocity(p) >= 0 ? 1 : -1; // 1 = settling (down)
    const V = 30; // px/s, cosmetic

    const list = cloudRef.current;
    if (list.length === 0) {
      for (let i = 0; i < COUNT; i++) {
        list.push([
          (Math.random() - 0.5) * 2 * (BX - 4),
          (Math.random() - 0.5) * 2 * (BY - 4),
          (Math.random() - 0.5) * 2 * (BX - 4),
        ]);
      }
    }
    for (const q of list) {
      if (dt > 0) {
        q[1] -= dir * V * dt;
        if (dir > 0 && q[1] < -BY + 3) q[1] = BY - 3;
        if (dir < 0 && q[1] > BY - 3) q[1] = -BY + 3;
      }
      pt.dot(q, fit, dark ? '148,163,184' : '100,116,139', 1.1, 0.85);
    }

    // The specimen: a sphere whose drawn size tracks the radius slider.
    const R = 8 + 18 * Math.min(1, Math.max(0, (Math.log10(p.a) + 8) / 5.3));
    const NT = 14;
    const sphereCol = dark ? 'rgba(148,163,184,0.85)' : 'rgba(100,116,139,0.8)';
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
        pt.quad([P(th0, ph0), P(th1, ph0), P(th1, ph1), P(th0, ph1)], sphereCol);
      }
    }
    // Strobe trail: equally spaced = constant velocity.
    strobeRef.current = (strobeRef.current + dir * V * dt) % 24;
    for (let i = 1; i <= 6; i++) {
      const yy = dir * (i * 24 + strobeRef.current - 24);
      if (Math.abs(yy) > R + 4 && Math.abs(yy) < BY - 4) {
        pt.dot([0, yy, 0], fit, NEUTRAL_DOT(dark), 1.4, 0.7);
      }
    }
    // Motion arrow through the specimen.
    const aCol = dark ? '#f8fafc' : '#0f172a';
    pt.seg([0, dir * R * 0.7, 0], [0, -dir * (R + 14), 0], aCol, 2.5);
    pt.seg([0, -dir * (R + 14), 0], [-5, -dir * (R + 5), 0], aCol, 2.5);
    pt.seg([0, -dir * (R + 14), 0], [5, -dir * (R + 5), 0], aCol, 2.5);

    // Free-body arrows, true relative magnitudes — same semantics as the 2D
    // tab: weight down, buoyancy up, drag OPPOSING the motion, the two
    // stacks equal at terminal velocity. Model +y is up.
    const Wg = p.rhoP * (4 / 3) * Math.PI * p.a ** 3 * gEff(p);
    const B = p.rhoF * (4 / 3) * Math.PI * p.a ** 3 * gEff(p);
    const Dg = Math.abs(dragForce(p.mu, p.a, terminalVelocity(p)));
    const K = 70 / Math.max(Wg + (dir < 0 ? Dg : 0), B + (dir > 0 ? Dg : 0));
    const arrow3 = (x: number, endY: number, color: string) => {
      pt.seg([x, 0, 0], [x, endY, 0], color, 2.5);
      const back = endY > 0 ? -7 : 7;
      pt.seg([x, endY, 0], [x - 4.5, endY + back, 0], color, 2.5);
      pt.seg([x, endY, 0], [x + 4.5, endY + back, 0], color, 2.5);
    };
    const xW = -(R + 20);
    const xB = R + 20;
    const xD = R + 36;
    arrow3(xW, -Wg * K, dark ? '#f87171' : '#dc2626');
    arrow3(xB, B * K, dark ? '#38bdf8' : '#0284c7');
    arrow3(xD, dir * Dg * K, dark ? '#34d399' : '#047857');

    wireBox(pt, -BX, -BY, -BX, BX, BY, BX, faint);
    pt.flush();

    pt.chip([xW, -Wg * K - 14, 0], 'weight', dark);
    pt.chip([xB, B * K + 14, 0], 'buoyancy', dark);
    pt.chip([xD, dir * Dg * K + dir * 14, 0], 'drag', dark);

    pt.chip(
      [0, BY + 14, 0],
      p.gFactor > 1.5
        ? `spinning at ${Math.round(p.gFactor).toLocaleString()} × g`
        : dir > 0 ? 'settling at terminal velocity' : 'floating upward (ρp < ρf)',
      dark,
    );
    pt.hint(dark, 'force arrows at true relative magnitude — the numbers live on the 2D tab');
  }, { running, redrawKey });

  useOrbitControls(canvasRef, cam, running);

  return (
    <canvas
      ref={canvasRef}
      className="block h-[300px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[340px]"
      aria-label="A 3D suspension of particles settling at terminal velocity around a specimen sphere"
    />
  );
}
