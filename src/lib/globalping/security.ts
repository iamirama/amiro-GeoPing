import "server-only";

import { isIP } from "node:net";

/**
 * SSRF protection — applied whenever a server-side route would otherwise
 * directly connect to a user-supplied destination.
 *
 * Currently the app uses Globalping as the only outbound target, so we don't
 * connect to the user's destination ourselves. We still expose these
 * helpers so future "direct" features can use them.
 *
 * Blocklist:
 *   - IPv4 private ranges (10/8, 172.16/12, 192.168/16, 100.64/10 CGNAT)
 *   - IPv4 loopback (127/8) and link-local (169.254/16)
 *   - IPv4 benchmark (198.18/15) and reserved (240/4)
 *   - IPv6 loopback (::1), link-local (fe80::/10), unique-local (fc00::/7)
 *   - Cloud-metadata hosts (169.254.169.254 and hostnames resolving to it)
 */

const BLOCKED_HOSTNAMES = new Set<string>([
  "metadata.google.internal",
  "169.254.169.254",
  "metadata",
  "metadata.aws.internal",
]);

export interface SsrfCheckResult {
  ok: boolean;
  reason?: string;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 240) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::")) return true; // ::, ::ffff:..., etc.
  return false;
}

export function isPrivateIP(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  if (isIP(ip) === 6) return isPrivateIPv6(ip);
  return false;
}

/**
 * Validates a hostname-only or IP-only destination string against our SSRF
 * policy. We do NOT resolve the hostname here (that would still be needed
 * before connecting to detect DNS-rebinding), but we do reject obvious
 * private IPs and known metadata hostnames.
 */
export function checkDestination(destination: string): SsrfCheckResult {
  const trimmed = destination.trim().toLowerCase();
  if (!trimmed) return { ok: false, reason: "مقصد خالی است" };
  if (BLOCKED_HOSTNAMES.has(trimmed)) {
    return { ok: false, reason: "مقصد در فهرست مسدودشده‌ها قرار دارد" };
  }
  // If it looks like an IP, check directly.
  if (isIP(trimmed)) {
    if (isPrivateIP(trimmed)) {
      return { ok: false, reason: "IP خصوصی/حلقه‌محلی مجاز نیست" };
    }
  }
  return { ok: true };
}
