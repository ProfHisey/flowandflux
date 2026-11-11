import { sci } from '../../lib/format';

/** The laminar-transition threshold the page's prose warning also uses. */
export const RE_TRANSITION = 2000;

/**
 * Past the transition the derivation's own assumptions are gone: the
 * parabola is what Navier-Stokes gives IF the flow stayed laminar, and a
 * real one would not. Drawn on the canvas, where students are looking, not
 * only in the readouts below the fold. Shared by the 2D and 3D views so the
 * two can never disagree about when the picture has stopped being true.
 * Centered on (cx, cy) so each layout can park it where it covers no label.
 */
export function drawTurbulenceBanner(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, Re: number, dark: boolean,
): void {
  if (!(Re > RE_TRANSITION)) return;
  const l1 = `Re = ${sci(Re)} > ~2000: a real flow here would be turbulent`;
  const l2 = 'this laminar profile is only what N–S gives if the layers held';
  ctx.save();
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  const w1 = ctx.measureText(l1).width;
  ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
  const w = Math.max(w1, ctx.measureText(l2).width) + 18;
  const bx = cx - w / 2;
  const by = cy - 19;
  ctx.fillStyle = dark ? 'rgba(69,26,3,0.92)' : 'rgba(255,251,235,0.95)';
  ctx.strokeStyle = dark ? 'rgba(251,191,36,0.6)' : 'rgba(217,119,6,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, 38, 6);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = dark ? '#fbbf24' : '#b45309';
  ctx.fillText(l1, cx, by + 15);
  ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = dark ? '#fde68a' : '#92400e';
  ctx.fillText(l2, cx, by + 30);
  ctx.restore();
}
