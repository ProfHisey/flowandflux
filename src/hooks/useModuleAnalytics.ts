import { useEffect } from 'react';
import { initAnalytics, trackDwell, trackEngage, trackView } from '../lib/analytics';

/**
 * Measures one module visit: a view, at most one engagement, and an ACTIVE
 * dwell time. Called once in App.tsx, where the module id already lives — do
 * not scatter this through the modules.
 *
 * "Active" is doing real work here. Three things would otherwise turn a
 * left-open tab into a fictional multi-hour session:
 *
 *  - a BACKGROUNDED tab keeps its timers running, so time is only accumulated
 *    while document.visibilityState is 'visible';
 *  - a tool left on screen during a lecture is not engagement, so the clock
 *    stops after IDLE_MS with no pointer or key activity;
 *  - a hash-routed SPA changes module without a page load, so the flush is
 *    driven by this effect's cleanup rather than by any unload event.
 *
 * The dwell is also flushed when the tab is hidden, and a fresh measurement
 * starts if the visitor comes back. One long interrupted session therefore
 * reports as several short visits, which is both honest and better for the
 * no-linkage invariant than stitching them together.
 *
 * `beforeunload` is deliberately not used: it does not fire reliably on iOS
 * Safari. A hard tab-close loses the final partial dwell, which is a known and
 * acceptable undercount — every other exit path is covered.
 */

const IDLE_MS = 120_000;
const TICK_MS = 1000;

export function useModuleAnalytics(moduleId: string): void {
  useEffect(() => {
    initAnalytics();
    trackView(moduleId);

    let activeSeconds = 0;
    let lastActivity = Date.now();
    let engaged = false;
    let flushed = false;

    const flush = () => {
      if (flushed) return;
      flushed = true;
      if (activeSeconds >= 1) trackDwell(moduleId, activeSeconds);
    };

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastActivity > IDLE_MS) return;
      activeSeconds += TICK_MS / 1000;
    };

    // Any input keeps the clock running; a deliberate one also counts as
    // engagement. Scrolling and wheel-zoom reset idle but do not, on their
    // own, mean the visitor engaged with the simulation.
    const activity = () => {
      lastActivity = Date.now();
    };
    const engage = (e: Event) => {
      activity();
      if (engaged) return;
      // Ignore interactions with the site chrome: the nav, the theme toggle.
      if (e.target instanceof Node && !document.querySelector('main')?.contains(e.target)) return;
      engaged = true;
      trackEngage(moduleId);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flush();
      } else {
        // Back again: start a fresh, unlinked measurement.
        flushed = false;
        activeSeconds = 0;
        lastActivity = Date.now();
      }
    };

    const timer = window.setInterval(tick, TICK_MS);
    window.addEventListener('pointerdown', engage, true);
    window.addEventListener('keydown', engage, true);
    window.addEventListener('wheel', activity, { passive: true, capture: true });
    window.addEventListener('touchmove', activity, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', engage, true);
      window.removeEventListener('keydown', engage, true);
      window.removeEventListener('wheel', activity, true);
      window.removeEventListener('touchmove', activity, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [moduleId]);
}
