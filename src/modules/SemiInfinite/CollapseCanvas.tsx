import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import { erfcAcc, eta } from '../../lib/semiinf';
import { fmtTime, paletteFor, thetaAt, type SemiView } from './SemiCanvas';

/**
 * The similarity collapse — the one idea about semi-infinite media that is
 * easier to see than to derive.
 *
 * Four profiles at t1, 4 t1, 9 t1 and 16 t1, so their fronts sit at 1, 2, 3
 * and 4 times the first: equally spaced, because delta goes as sqrt(t).
 * Plotted against depth they fan out. Plotted against eta = x / 2 sqrt(D t)
 * they slide onto ONE curve, erfc(eta), because the problem has no length
 * scale of its own — the only length available is sqrt(D t), so the only
 * thing the profile can depend on is depth measured in units of it.
 *
 * Switch the surface to a film and that stops being true: the film brings
 * its own length, D/h (k/h for heat), so theta depends on two groups and the
 * curves do NOT collapse. Seeing them refuse is the honest argument for why
 * the semi-infinite-wall charts need Bi as a second parameter.
 *
 * Each point slides horizontally from its depth to its eta, so the morph is
 * literally the change of variable, not a crossfade between two plots.
 */

const ETA_MAX = 2.2;   // erfc(2.2) ~ 0.002: the profile is done by here
const MORPH_MS = 900;

export function CollapseCanvas({
  view,
  mode,
  dark,
}: {
  view: SemiView;
  mode: 'x' | 'eta';
  dark: boolean;
}) {
  const target = mode === 'eta' ? 1 : 0;
  const [morph, setMorph] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);

  // Time-based, so a throttled tab lands on the right frame rather than
  // stalling half-way; a timeout snaps it home regardless.
  useEffect(() => {
    fromRef.current = morph;
    startRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      const u = Math.min(1, (performance.now() - startRef.current) / MORPH_MS);
      const ease = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      setMorph(fromRef.current + (target - fromRef.current) * ease);
      if (u < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const snap = setTimeout(() => setMorph(target), MORPH_MS + 120);
    return () => { cancelAnimationFrame(raf); clearTimeout(snap); };
    // morph deliberately omitted: we read it once, as the starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const pal = paletteFor(view.cargo, dark);
  const tRef = view.tMax / 16;
  const times = [1, 4, 9, 16].map((k) => k * tRef);
  const redrawKey = `${JSON.stringify(view)}|${morph.toFixed(4)}|${dark}`;

  const canvasRef = useCanvas((ctx, frame) => {
    const { width: W, height: H } = frame;
    const faint = dark ? '#64748b' : '#94a3b8';
    const label = dark ? '#cbd5e1' : '#475569';
    const accent = dark ? '#fbbf24' : '#b45309';

    const xL = 40;
    const xR = W - 14;
    const yTop = 22;
    const yBot = H - 34;
    const toY = (th: number) => yBot - th * (yBot - yTop);
    // Depth axis spans the latest front with room to spare.
    const depthMax = view.depthMax;
    const sx = (x: number) => xL + (x / depthMax) * (xR - xL);
    const se = (e: number) => xL + (e / ETA_MAX) * (xR - xL);

    // ---- grid and axes
    ctx.strokeStyle = dark ? '#1e293b' : '#e2e8f0';
    ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(xL, toY(f));
      ctx.lineTo(xR, toY(f));
      ctx.stroke();
    }
    ctx.strokeStyle = faint;
    ctx.beginPath();
    ctx.moveTo(xL, yTop);
    ctx.lineTo(xL, yBot);
    ctx.lineTo(xR, yBot);
    ctx.stroke();
    ctx.fillStyle = faint;
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (const f of [0, 0.5, 1]) ctx.fillText(f.toFixed(1), xL - 5, toY(f) + 3);
    ctx.save();
    ctx.translate(12, (yTop + yBot) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('θ', 0, 0);
    ctx.restore();

    // Axis label crossfades with the morph.
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1 - morph;
    ctx.fillText(`depth x  (0 – ${(depthMax * view.toMm).toFixed(1)} mm)`, (xL + xR) / 2, yBot + 26);
    ctx.globalAlpha = morph;
    ctx.fillText(`η = x / 2√(Dt)   (0 – ${ETA_MAX})`, (xL + xR) / 2, yBot + 26);
    ctx.globalAlpha = 1;

    // ---- the reference erfc(eta), present only on the eta axis
    if (view.surface === 'held' && morph > 0.02) {
      ctx.save();
      ctx.globalAlpha = morph;
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const e = (i / 120) * ETA_MAX;
        const px = se(e);
        const py = toY(erfcAcc(e));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // ---- four profiles, each point sliding from its depth to its eta
    times.forEach((tk, k) => {
      const u = 0.35 + 0.65 * (k / 3);
      ctx.strokeStyle = pal.curve;
      ctx.globalAlpha = 0.35 + 0.65 * u;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 240; i++) {
        const x = (i / 240) * depthMax * 1.0;
        const e = eta(x, view.D, tk);
        const px = (1 - morph) * sx(x) + morph * se(Math.min(e, ETA_MAX * 1.05));
        if (px > xR + 2) break;
        const py = toY(thetaAt(view, x, tk));
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // ---- legend
    ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'right';
    times.forEach((tk, k) => {
      const yy = yTop + 6 + k * 13;
      ctx.globalAlpha = 0.35 + 0.65 * (0.35 + 0.65 * (k / 3));
      ctx.strokeStyle = pal.curve;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xR - 74, yy - 3);
      ctx.lineTo(xR - 58, yy - 3);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = label;
      ctx.fillText(`${['t₁', '4t₁', '9t₁', '16t₁'][k]} = ${fmtTime(tk)}`, xR, yy);
    });

    // ---- the verdict
    if (morph > 0.95) {
      ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = accent;
      if (view.surface === 'held') {
        ctx.fillText('one curve, every time: θ = erfc(η)', xL + 10, yBot - 10);
      } else {
        ctx.fillText('no single curve — the film has its own length, D/h', xL + 10, yBot - 10);
      }
    }
  }, { running: false, redrawKey });

  return (
    <canvas
      role="img"
      ref={canvasRef}
      className="block h-[240px] w-full rounded-lg bg-slate-50 dark:bg-slate-950 sm:h-[270px]"
      aria-label={
        mode === 'eta'
          ? view.surface === 'held'
            ? 'Four profiles at increasing times plotted against the similarity variable eta, collapsed onto a single erfc curve.'
            : 'Four profiles at increasing times plotted against eta. With a surface film they do not collapse onto one curve.'
          : 'Four profiles at times t, 4t, 9t and 16t plotted against depth, fanning out with fronts equally spaced.'
      }
    />
  );
}
