import { NextResponse } from "next/server";

import { getMeasurement } from "@/lib/globalping/measurements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_REGEX = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * GET /api/measurements/[id]
 *
 * Returns the current state of a measurement. The client polls this every
 * POLL_INTERVAL_MS until `status` reaches `finished` or `failed`.
 *
 * The `iranRequested` query flag (true|false) is echoed back so the client
 * can pair the polling response with the original create call without
 * re-deriving it.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  if (!ID_REGEX.test(id)) {
    return NextResponse.json(
      { ok: false, error: { type: "validation_error", message: "شناسه اندازه‌گیری نامعتبر است" } },
      { status: 400 },
    );
  }
  const url = new URL(req.url);
  const iranRequested = url.searchParams.get("iranRequested") === "1";

  try {
    const m = await getMeasurement(id);
    return NextResponse.json(
      { ok: true, measurement: m, iranRequested },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای ناشناخته";
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status: number }).status
        : 500;
    const type =
      err && typeof err === "object" && "type" in err
        ? (err as { type: string }).type
        : "unknown";
    return NextResponse.json(
      { ok: false, error: { type, message } },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
