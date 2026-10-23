/**
 * Globalping configuration.
 *
 * The base URL and default timeouts are not secrets. Override the base URL
 * with the GLOBALPING_API_BASE environment variable if you need to point at
 * a self-hosted or staging instance.
 */

export const GLOBALPING_API_BASE =
  process.env.GLOBALPING_API_BASE?.replace(/\/+$/, "") ||
  "https://api.globalping.io";

/**
 * Optional personal Globalping API token. When present, requests run under
 * the donor's quota instead of the shared anonymous quota. This is purely
 * optional — the app works without it on the anonymous tier.
 *
 * NEVER expose this token to the client. The token, when set, is read
 * only inside route handlers (Node.js runtime) and never sent to the
 * browser.
 */
export const GLOBALPING_API_TOKEN = process.env.GLOBALPING_API_TOKEN?.trim();

/** Server-side timeout for outgoing Globalping HTTP calls. */
export const GLOBALPING_HTTP_TIMEOUT_MS = Number(
  process.env.GLOBALPING_HTTP_TIMEOUT_MS ?? 15_000,
);

/** How long the probe list is cached in server memory (Globalping recommends
 *  minutes-to-hours; we use 5 minutes which balances freshness vs quota). */
export const PROBE_CACHE_TTL_SECONDS = Number(
  process.env.PROBE_CACHE_TTL_SECONDS ?? 300,
);

/** Polling cadence for an in-progress measurement. */
export const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 3_000);

/** Maximum number of polls before the client gives up. */
export const POLL_MAX_ATTEMPTS = Number(process.env.POLL_MAX_ATTEMPTS ?? 20);

/** Globalping hard limits. */
export const GLOBALPING_LIMITS = {
  /** Per-window anonymous request quota (observed via x-ratelimit-limit). */
  anonymousRateLimit: 250,
  /** Probe-side measurement timeout range (seconds). */
  timeoutMin: 5,
  timeoutMax: 30,
  /** Probe count range per measurement. */
  limitMin: 1,
  limitMax: 500,
  /** Ping/MTR packet range. */
  packetsMin: 1,
  packetsMax: 16,
  /** Port range. */
  portMin: 1,
  portMax: 65535,
} as const;
