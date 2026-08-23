import { useCanvas } from '../../hooks/useCanvas';
import { biotOf, fourierOf, type HeislerParams } from '../../lib/transient';

/**
 * The triage flowchart as a map: log Bi across, log Fo up, the three
 * regimes as tinted regions, and the CURRENT setup as a dot that moves
 * live with the sliders. Every unsteady conduction problem ever assigned
 * lands somewhere on this plane; the point of the map is that the first
 * step of every one of them is to find out where.
 */

const LBI0 = -3;
const LBI1 = 3;
const LFO0 = -3;
const LFO1 = 2;

export function BiFoMapCanvas({ params, dark }: { params: HeislerParams; dark: boolean }) {
  const redrawKey = `${JSON.stringify(params)}|${dark}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const padL = 44;
    const padR = 12;
    const padT = 10;
    const padB = 30;
    const x0 = padL;
    const x1 = W - padR;
    const y0 = padT;
    const y1 = H - padB;
    const pw = x1 - x0;
    const ph = y1 - y0;
    if (pw <= 0 || ph <= 0) return;

    const X = (lBi: number) => x0 + ((lBi - LBI0) / (LBI1 - LBI0)) * pw;
    const Y = (lFo: number) => y1 - ((lFo - LFO0) / (LFO1 - LFO0)) * ph;
    const xBi = X(Math.log10(0.1)); // the Bi = 0.1 boundary
    const yFo = Y(Math.log10(0.2)); // the Fo = 0.2 boundary

    // Regions. The overlap corner picks up both tints and reads as its own.
    ctx.fillStyle = dark ? 'rgba(56,189,248,0.07)' : 'rgba(14,165,233,0.06)';
    ctx.fillRect(x0, y0, pw, ph); // one-term everywhere...
    ctx.fillStyle = dark ? 'rgba(52,211,153,0.14)' : 'rgba(16,185,129,0.13)';
    ctx.fillRect(x0, y0, xBi - x0, ph); // ...lumped stripe on the left...
    ctx.fillStyle = dark ? 'rgba(251,191,36,0.13)' : 'rgba(217,119,6,0.11)';
    ctx.fillRect(x0, yFo, pw, y1 - yFo); // ...semi-infinite band below.

    // Boundary lines.
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = dark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xBi, y0);
    ctx.lineTo(xBi, y1);
    ctx.moveTo(x0, yFo);
    ctx.lineTo(x1, yFo);
    ctx.stroke();
    ctx.setLineDash([]);

    // Axes + decade ticks.
    ctx.strokeStyle = dark ? '#334155' : '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0, y0, pw, ph);
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let e = LBI0; e <= LBI1; e++) {
      ctx.fillText(expLabel(e), X(e), y1 + 13);
    }
    ctx.textAlign = 'right';
    for (let e = LFO0; e <= LFO1; e++) {
      ctx.fillText(expLabel(e), x0 - 5, Y(e) + 3);
    }
    ctx.textAlign = 'center';
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.fillText('Bi = hL/k  →', (x0 + x1) / 2, H - 4);
    ctx.save();
    ctx.translate(11, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Fo = αt/L²  →', 0, 0);
    ctx.restore();

    // Boundary tags.
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText('Bi = 0.1', xBi + 4, y0 + 11);
    ctx.fillText('Fo = 0.2', x0 + 4, yFo - 4);

    // Region labels.
    ctx.font = '600 10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = dark ? '#6ee7b7' : '#047857';
    ctx.fillText('LUMPED', (x0 + xBi) / 2, y0 + 26);
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('single exponential', (x0 + xBi) / 2, y0 + 39);
    ctx.font = '600 10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#fcd34d' : '#b45309';
    ctx.fillText('SEMI-INFINITE', (xBi + x1) / 2, y1 - 18);
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('erf — the far side has not heard yet', (xBi + x1) / 2, y1 - 6);
    ctx.font = '600 10.5px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#7dd3fc' : '#0369a1';
    ctx.fillText('ONE-TERM — this page', (xBi + x1) / 2, y0 + 26);
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
    ctx.fillText('either works', (x0 + xBi) / 2, y1 - 8);

    // The current setup.
    const Bi = biotOf(params);
    const Fo = fourierOf(params);
    const lx = Math.min(LBI1, Math.max(LBI0, Math.log10(Bi)));
    const ly = Math.min(LFO1, Math.max(LFO0, Math.log10(Fo)));
    const dx = X(lx);
    const dy = Y(ly);
    const clamped = lx !== Math.log10(Bi) || ly !== Math.log10(Fo);
    ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';
    ctx.strokeStyle = dark ? '#fbbf24' : '#d97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = dark ? '#fbbf24' : '#b45309';
    ctx.textAlign = dx > (x0 + x1) / 2 ? 'right' : 'left';
    ctx.fillText(
      `you are here${clamped ? ' (off the map — clamped)' : ''}`,
      dx + (dx > (x0 + x1) / 2 ? -9 : 9),
      dy - 7,
    );
  }, { running: false, redrawKey });

  return (
    <canvas
      ref={canvasRef}
      className="block h-[260px] w-full rounded-lg bg-slate-50 dark:bg-slate-950"
      aria-label="A log-log map of Biot vs Fourier number, showing the lumped, semi-infinite and one-term regimes with the current setup marked"
    />
  );
}

function expLabel(e: number): string {
  if (e === 0) return '1';
  const sup: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³',
  };
  return `10${String(e).split('').map((c) => sup[c] ?? c).join('')}`;
}
