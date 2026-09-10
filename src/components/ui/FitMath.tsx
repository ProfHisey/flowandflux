import { useLayoutEffect, useRef, useState } from 'react';
import { BlockMath } from 'react-katex';

/**
 * A display equation that shrinks to fit its container instead of growing
 * a scrollbar. KaTeX sizes everything in em, so scaling the font-size is a
 * faithful zoom of the whole expression. Below MIN_SCALE it stops shrinking
 * and lets the wrapper scroll — a nine-term Navier–Stokes on a phone reads
 * better scrolled than microscopic.
 *
 * The inner wrapper is inline-block so its width is the equation's natural
 * width at the current scale, whatever the container is doing; dividing by
 * the scale recovers the full-size width, and the container's clientWidth
 * over that is the scale to use. A ResizeObserver on the container re-fits
 * on any layout change.
 */
const MIN_SCALE = 0.62;

export function FitMath({ math, className = '' }: { math: string; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const fit = () => {
      const natural = inner.offsetWidth / scaleRef.current;
      if (!(natural > 0) || box.clientWidth <= 0) return;
      const s = Math.max(MIN_SCALE, Math.min(1, (box.clientWidth - 2) / natural));
      if (Math.abs(s - scaleRef.current) > 0.005) {
        scaleRef.current = s;
        setScale(s);
      }
    };
    fit();
    // Watch the equation as well as the container: KaTeX's web fonts land
    // after first paint and reflow the expression by a few percent, and the
    // container never changes size when that happens — so a fit taken
    // against fallback-font widths would otherwise stick forever. Observing
    // the inner box cannot loop: a scale change resizes it, the re-fit
    // recovers the same natural width, and the guard below swallows it.
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    ro.observe(inner);
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) fit(); });
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [math]);

  return (
    <div ref={boxRef} className={'min-w-0 overflow-x-auto py-1 text-center ' + className}>
      <div ref={innerRef} className="inline-block max-w-none" style={{ fontSize: `${scale}em` }}>
        <BlockMath math={math} />
      </div>
    </div>
  );
}
