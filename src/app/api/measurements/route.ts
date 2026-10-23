import { NextResponse } from "next/server";
import { z } from "zod";

import { createMeasurement } from "@/lib/globalping/measurements";
import { checkDestination } from "@/lib/globalping/security";
import { testRequestSchema } from "@/lib/globalping/validation";
import type {
  CreateMeasurementRequest,
  MeasurementOptions,
} from "@/lib/globalping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/measurements
 *
 * Validates the request body against the test-type schema, applies SSRF
 * checks on the destination, and forwards the request to Globalping.
 * Never fabricates a result — on any failure we return a Persian error
 * message with the appropriate HTTP status.
 *
 * Body: see `testRequestSchema`. The response is the Globalping
 * `{ id, probesCount }` payload (HTTP 202) plus an `iranRequested` flag
 * the client uses to verify probe attribution later.
 */
export async function POST(req: Request): Promise<Response> {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { type: "validation_error", message: "بدنه درخواست JSON معتبر نیست" } },
      { status: 400 },
    );
  }

  // Run a "soft" parse to surface friendly Persian errors first. The
  // discriminated union will reject unknown kinds here.
  let parsed;
  try {
    parsed = testRequestSchema.parse(bodyJson);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const firstIssue = err.issues[0];
      return NextResponse.json(
        {
          ok: false,
          error: {
            type: "validation_error",
            message: firstIssue?.message ?? "اعتبارسنجی ناموفق بود",
            params: Object.fromEntries(
              err.issues.map((i, idx) => [`${i.path.join(".")}-${idx}`.replace(/^-$/, "root"), i.message]),
            ),
          },
        },
        { status: 400 },
      );
    }
    throw err;
  }

  // SSRF check on the destination. This is mostly defense-in-depth because
  // Globalping itself enforces reachability, but we never want to send a
  // private/loopback target upstream.
  const ssrf = checkDestination(parsed.target);
  if (!ssrf.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: { type: "validation_error", message: ssrf.reason ?? "مقصد غیرمجاز است" },
      },
      { status: 400 },
    );
  }

  // Build the Globalping API request body.
  //
  // Globalping rejects requests that include BOTH a global `limit` AND a
  // per-location `limit` (HTTP 422 "locations.0.limit is not allowed when
  // a global limit is set"). We always use the global limit, so we strip
  // the per-location limit field before forwarding.
  const locations = parsed.locations.map(({ limit: _ignored, ...rest }) => rest);
  let apiBody: CreateMeasurementRequest;
  let iranRequested = false;
  switch (parsed.kind) {
    case "ping": {
      iranRequested = locations.some((l) => l.country === "IR");
      apiBody = {
        type: "ping",
        target: parsed.target,
        locations,
        limit: parsed.limit,
        measurementOptions: {
          ...(parsed.packets ? { packets: parsed.packets } : {}),
          ...(parsed.ipVersion ? { ipVersion: parsed.ipVersion } : {}),
        },
      };
      break;
    }
    case "tcp": {
      iranRequested = locations.some((l) => l.country === "IR");
      apiBody = {
        type: "traceroute",
        target: parsed.target,
        locations,
        limit: parsed.limit,
        measurementOptions: {
          protocol: "TCP",
          port: parsed.port,
          ...(parsed.ipVersion ? { ipVersion: parsed.ipVersion } : {}),
        },
      };
      break;
    }
    case "udp": {
      iranRequested = locations.some((l) => l.country === "IR");
      apiBody = {
        type: "traceroute",
        target: parsed.target,
        locations,
        limit: parsed.limit,
        measurementOptions: {
          protocol: "UDP",
          port: parsed.port,
          ...(parsed.ipVersion ? { ipVersion: parsed.ipVersion } : {}),
        },
      };
      break;
    }
    case "dns": {
      iranRequested = locations.some((l) => l.country === "IR");
      const opts: MeasurementOptions = {
        protocol: parsed.protocol,
        query: { type: parsed.recordType },
        trace: parsed.trace,
      };
      if (parsed.resolver) (opts as { resolver?: string }).resolver = parsed.resolver;
      apiBody = {
        type: "dns",
        target: parsed.target,
        locations,
        limit: parsed.limit,
        measurementOptions: opts,
      };
      break;
    }
    case "http": {
      iranRequested = locations.some((l) => l.country === "IR");
      apiBody = {
        type: "http",
        target: parsed.target,
        locations,
        limit: parsed.limit,
        measurementOptions: {
          protocol: parsed.protocol,
          ...(parsed.port ? { port: parsed.port } : {}),
          request: {
            method: parsed.method,
            ...(parsed.path ? { path: parsed.path } : {}),
            ...(parsed.query ? { query: parsed.query } : {}),
            ...(parsed.host ? { host: parsed.host } : {}),
          },
        },
      };
      break;
    }
    default: {
      // Exhaustiveness check — if a new TestKind is added without a
      // matching case above, this branch fires.
      void (parsed satisfies { kind: never });
      return NextResponse.json(
        { ok: false, error: { type: "validation_error", message: "نوع تست پشتیبانی نمی‌شود" } },
        { status: 400 },
      );
    }
  }

  try {
    const created = await createMeasurement(apiBody);
    return NextResponse.json(
      { ok: true, ...created, iranRequested },
      { status: 202 },
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
    const rateLimit =
      err && typeof err === "object" && "rateLimit" in err
        ? (err as { rateLimit?: unknown }).rateLimit
        : undefined;
    return NextResponse.json(
      { ok: false, error: { type, message, rateLimit } },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
