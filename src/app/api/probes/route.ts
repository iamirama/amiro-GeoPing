import { NextResponse } from "next/server";

import { getCacheInfo, getProbes, groupProbes } from "@/lib/globalping/probes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/probes
 *
 * Returns the cached probe list, grouped by country / city / network so the
 * UI can render a searchable location picker. The list is refreshed in the
 * background at most every PROBE_CACHE_TTL_SECONDS.
 *
 * Query params:
 *   ?force=1   Force a refresh before returning. Bypasses the cache. Use
 *              sparingly — repeated force-refresh hits the Globalping API
 *              directly and contributes to the per-IP rate limit.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  try {
    const probes = await getProbes(force);
    const grouped = groupProbes(probes);
    return NextResponse.json(
      {
        ok: true,
        totalProbes: probes.length,
        countries: grouped,
        cache: getCacheInfo(),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : 500;
    return NextResponse.json(
      { ok: false, error: { message, status } },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
