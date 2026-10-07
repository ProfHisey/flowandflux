import { useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { applyZoom, useWheelZoom } from '../FicksLaw/FickCanvas';
import { solveJump, type JumpParams } from '../../lib/bcprofile';

/**
 * Two materials touching, and the one place the heat–mass analogy breaks.
 *
 * Flux is continuous at an interface in both cases — whatever leaves one side
 * enters the other, and there is nowhere else for it to go. The VALUE is the
 * difference. A temperature is continuous because thermal equilibrium at a
 * contact means equal temperature, full stop. A concentration need not be:
 * equilibrium means equal CHEMICAL POTENTIAL, and a solute can be more
 * comfortable in one phase than the other, so C steps by the partition
 * coefficient Φ.
 *
 * Both are drawn on the same axes, from the same endpoints, so the contrast
 * is the only thing that moves: solid for the concentration (which jumps),
 * dashed for the temperature (which cannot). Set Φ = 1 and they coincide —
 * which is the honest statement that heat is the Φ = 1 case of the same
 * algebra, not a different subject.
 */
export function JumpCanvas({
  params,
  dark,
}: {
  params: JumpParams;
  dark: boolean;
}) {
  const zoomRef = useRef(1);
  const [zoomTick, setZoomTick] = useState(0);
  const redrawKey = `${JSON.stringify(params)}|${dark}|${zoomTick}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    applyZoom(ctx, zoomRef.current, W, H);

    const faint = dark ? '#64748b' : '#94a3b8';
    const label = dark ? '#cbd5e1' : '#475569';
    const accent = dark ? '#fbbf24' : '#b45309';
    const mass = dark ? '#818cf8' : '#4f46e5';
    const heat = dark ? '#f87171' : '#dc2626';

    const left = 30;
    const right = W - 14;
    const yTop = 24;
    const yBot = H - 26;

    const jMass = solveJump(params);
    const jHeat = solveJump({ ...params, phi: 1 });

    const vals = [
      params.left, params.right,
      jMass.interfaceLeft, jMass.interfaceRight,
      jHeat.interfaceLeft, jHeat.interfaceRight,
    ].filter(Number.isFinite);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 1e-12) hi = lo + 1;
    const pad = (hi - lo) * 0.2;
    lo -= pad;
    hi += pad;
    const toY = (v: number) => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);

    // The interface sits where the two thicknesses say it does.
    const frac = params.L1 / (params.L1 + params.L2);
    const xMid = left + (right - left) * frac;

    // bands
    ctx.fillStyle = dark ? 'rgba(129,140,248,0.12)' : 'rgba(79,70,229,0.09)';
    ctx.fillRect(left, yTop, xMid - left, yBot - yTop);
    ctx.fillStyle = dark ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.14)';
    ctx.fillRect(xMid, yTop, right - xMid, yBot - yTop);

    ctx.font = '500 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = faint;
    ctx.fillText('material 1', (left + xMid) / 2, yTop + 14);
    ctx.fillText('material 2', (xMid + right) / 2, yTop + 14);

    // the interface
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = faint;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xMid, yTop);
    ctx.lineTo(xMid, yBot);
    ctx.stroke();
    ctx.restore();

    const line = (
      a: [number, number], b: [number, number], color: string, dash: number[] | null,
    ) => {
      ctx.save();
      if (dash) ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.restore();
    };

    // Temperature: continuous, drawn dashed underneath.
    line([left, toY(params.left)], [xMid, toY(jHeat.interfaceLeft)], heat, [6, 4]);
    line([xMid, toY(jHeat.interfaceRight)], [right, toY(params.right)], heat, [6, 4]);

    // Concentration: the same problem with Φ, and it steps.
    line([left, toY(params.left)], [xMid, toY(jMass.interfaceLeft)], mass, null);
    line([xMid, toY(jMass.interfaceRight)], [right, toY(params.right)], mass, null);

    // The step itself, annotated.
    const y1 = toY(jMass.interfaceLeft);
    const y2 = toY(jMass.interfaceRight);
    if (Math.abs(y1 - y2) > 2) {
      ctx.strokeStyle = accent;
      ctx.fillStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xMid, y1);
      ctx.lineTo(xMid, y2);
      ctx.stroke();
      const dir = y2 > y1 ? 1 : -1;
      for (const [yy, dd] of [[y1, -dir], [y2, dir]] as const) {
        ctx.beginPath();
        ctx.moveTo(xMid, yy + dd * 1);
        ctx.lineTo(xMid - 4, yy + dd * 7);
        ctx.lineTo(xMid + 4, yy + dd * 7);
        ctx.closePath();
        ctx.fill();
      }
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('C jumps', xMid + 9, (y1 + y2) / 2 + 4);
    }

    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = heat;
    ctx.fillText('T does not', left + 6, toY(jHeat.interfaceLeft) - 8);
    ctx.fillStyle = mass;
    ctx.textAlign = 'right';
    ctx.fillText('C', xMid - 6, toY(jMass.interfaceLeft) - 8);

    ctx.fillStyle = label;
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('C₁ = Φ C₂   ·   flux is the same on both sides', (left + right) / 2, yBot + 16);
  }, { running: false, redrawKey });

  useWheelZoom(canvasRef, zoomRef, setZoomTick);

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[220px] w-full rounded-lg bg-slate-50 dark:bg-slate-950"
      aria-label="Two materials in contact. The concentration profile steps at the interface by the partition coefficient, while the temperature profile drawn on the same axes passes through continuously."
    />
  );
}
