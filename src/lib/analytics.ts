/**
 * Anonymous usage counting — which tool was opened, roughly how long for.
 *
 * ===================================================================
 * COLLECTION IS ON, for site operations: seeing which tools are worth
 * the maintenance. PUBLICATION IS NOT. These counts are not to be
 * analyzed for, or reported in, any paper until an IRB determination
 * is in hand — see notes/analytics-plan.md. Set ANALYTICS_ENABLED to
 * false and redeploy to stop collecting entirely.
 * ===================================================================
 *
 * The design exists to be checkable, not merely to be called anonymous. Four
 * invariants, in the order they matter:
 *
 *  1. NO IDENTIFIER, ANYWHERE. No cookie, no sessionStorage, no generated
 *     visitor id. localStorage holds exactly one key, a boolean opt-out,
 *     which identifies nobody.
 *
 *  2. NO SESSION LINKAGE. Every event stands alone. Nothing transmitted lets
 *     two events be attributed to the same person, so no visitor's path
 *     through the site can be reconstructed. This is the invariant that makes
 *     a class-sized audience safe: isolated counts are not re-identifying, but
 *     a SEQUENCE of modules from one person would be near-unique.
 *
 *  3. DURATIONS BUCKETED IN THE BROWSER. Raw times never leave the client.
 *
 *  4. A CLOSED VOCABULARY. Module ids and the Feature enum below are the only
 *     strings that ever transmit. Never a slider value, never a preset's
 *     parameters, never anything a visitor typed.
 *
 * Also: silent on localhost, silent under Do Not Track or Global Privacy
 * Control, silent if the visitor opted out, and silent if anything throws —
 * analytics must never be able to break the page.
 *
 * Transport is Plausible (cookieless, no IP retention). Swap `send()` and the
 * loader for a self-hosted instance and nothing else here changes.
 */

/** The switch. Turns collection and the third-party script on or off
 *  together; nothing here runs, and no request is made, when it is false. */
export const ANALYTICS_ENABLED = true;

/**
 * Plausible's current script format: the site is identified by the hashed
 * filename, so there is no `data-domain` attribute and `init()` must be called.
 * This is the snippet their dashboard issues, loaded from here rather than
 * pasted into index.html — see initAnalytics() for why that matters.
 */
const PLAUSIBLE_SRC = 'https://plausible.io/js/pa-daqymW3bWDOhuUGNzyZtM.js';
const OPT_OUT_KEY = 'ff-no-analytics';

/** The only feature names that may ever be transmitted. */
export type Feature = '3d' | 'preset' | 'play' | 'reset' | 'profile' | 'box-drag';

type PlausibleFn = ((event: string, opts?: { props?: Record<string, string> }) => void) & {
  q?: unknown[];
  init?: (opts?: Record<string, unknown>) => void;
  o?: Record<string, unknown>;
};
declare global {
  interface Window {
    plausible?: PlausibleFn;
  }
}

// ------------------------------------------------------------- buckets

/** Upper bound (exclusive), label. */
const BUCKETS: readonly (readonly [number, string])[] = [
  [10, '0-10s'],
  [30, '10-30s'],
  [60, '30-60s'],
  [120, '1-2m'],
  [300, '2-5m'],
  [600, '5-10m'],
  [1800, '10-30m'],
] as const;

/**
 * Coarse duration label for a number of ACTIVE seconds. Exported for
 * verify.ts: the boundaries are the one piece of logic here that can be
 * silently wrong, and a shifted bucket would misreport every figure.
 */
export function bucket(seconds: number): string {
  // NaN and negatives are nonsense and read as trivial; +Infinity is not
  // nonsense, it is merely larger than every bound, so let it fall through
  // the loop to the top bucket rather than reporting it as a glance.
  if (Number.isNaN(seconds) || seconds < 0) return '0-10s';
  for (const [limit, label] of BUCKETS) if (seconds < limit) return label;
  return '30m+';
}

// ------------------------------------------------------------- opt-out

export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false; // private mode, blocked storage: treat as not opted out
  }
}

export function setOptedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* nothing we can do, and nothing that should surface to the visitor */
  }
}

// ------------------------------------------------------------- guards

function allowed(): boolean {
  if (!ANALYTICS_ENABLED) return false;
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;

  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '' || host.endsWith('.local')) {
    return false;
  }

  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  const dnt = nav.doNotTrack ?? nav.msDoNotTrack ?? (window as { doNotTrack?: string }).doNotTrack;
  if (dnt === '1' || dnt === 'yes') return false;
  if (nav.globalPrivacyControl === true) return false;

  return !isOptedOut();
}

// ------------------------------------------------------------- transport

let loaded = false;

/**
 * Load the counting script once, if we are allowed to count at all.
 *
 * The vendor's instructions say to paste their snippet into index.html. Doing
 * it from here instead is deliberate and strictly more private: a snippet in
 * the document head loads and fires its automatic pageview for EVERY visitor,
 * including ones sending Do Not Track or Global Privacy Control, and including
 * anyone who ticked the opt-out. Loading behind allowed() means those visitors
 * never fetch the script at all, so there is no request to their servers and
 * nothing to retract. The bytes are identical to the snippet otherwise.
 */
export function initAnalytics(): void {
  if (loaded || !allowed()) return;
  loaded = true;
  try {
    // Queue shim, verbatim from the vendor snippet: events fired before the
    // script lands are replayed once it does.
    const p =
      window.plausible ||
      (((...args: unknown[]) => {
        (p.q = p.q || []).push(args);
      }) as PlausibleFn);
    p.init = p.init || ((opts?: Record<string, unknown>) => { p.o = opts || {}; });
    window.plausible = p;

    const s = document.createElement('script');
    s.async = true;
    s.src = PLAUSIBLE_SRC;
    document.head.appendChild(s);

    // Starts tracking and sends one automatic pageview per page load. That
    // pageview is the site-wide visitor count; the module breakdown comes from
    // the custom events below. Hash-based routing is deliberately NOT enabled:
    // a hash change already emits module_view, and turning it on would double
    // every module visit as a pageview too.
    p.init();
  } catch {
    /* never break the page over a counter */
  }
}

function send(event: string, props: Record<string, string>): void {
  if (!allowed()) return;
  try {
    window.plausible?.(event, { props });
  } catch {
    /* never break the page over a counter */
  }
}

// ------------------------------------------------------------- events

/** A module was opened. */
export function trackView(module: string): void {
  send('module_view', { module });
}

/**
 * The first real interaction inside a module visit — a slider, a drag, a
 * toggle. Fired at most once per visit by useModuleAnalytics. The ratio of
 * engage to view is the adoption figure worth reporting: it separates a
 * visitor who clicked through the nav from one who actually used the thing.
 */
export function trackEngage(module: string): void {
  send('module_engage', { module });
}

/** A module visit ended. `seconds` is ACTIVE time; it is bucketed here. */
export function trackDwell(module: string, seconds: number): void {
  send('module_dwell', { module, bucket: bucket(seconds) });
}

/** A named feature was used. Enum only — see the closed-vocabulary invariant. */
export function trackFeature(module: string, feature: Feature): void {
  send('feature_use', { module, feature });
}
