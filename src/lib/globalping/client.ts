import "server-only";

import {
  GLOBALPING_API_BASE,
  GLOBALPING_API_TOKEN,
  GLOBALPING_HTTP_TIMEOUT_MS,
} from "./config";
import { toGlobalpingError } from "./errors";
import type {
  CreateMeasurementResponse,
  GlobalpingError,
  MeasurementResponse,
  Probe,
} from "./types";

/**
 * Low-level Globalping HTTP client.
 *
 * - Server-only: this module MUST be imported only from route handlers or
 *   other server modules. It never runs in the browser.
 * - Optional Authorization header when GLOBALPING_API_TOKEN is set.
 * - Enforced per-request timeout (default 15s).
 * - Surfaces rate-limit info on errors via the GlobalpingError shape.
 */

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (GLOBALPING_API_TOKEN) {
    headers.Authorization = `Bearer ${GLOBALPING_API_TOKEN}`;
  }
  return headers;
}

function withTimeout(url: string, init: RequestInit): {
  promise: Promise<Response>;
  cancel: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GLOBALPING_HTTP_TIMEOUT_MS);
  return {
    promise: fetch(url, { ...init, signal: controller.signal }),
    cancel: () => clearTimeout(timer),
  };
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const { promise, cancel } = withTimeout(url, init);
  try {
    return await promise;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const e = new Error(
        `Globalping request timed out after ${GLOBALPING_HTTP_TIMEOUT_MS}ms: ${url}`,
      ) as GlobalpingError;
      e.status = 0;
      e.type = "timeout";
      e.name = "GlobalpingError";
      throw e;
    }
    const e = new Error(
      err instanceof Error ? err.message : "Network error contacting Globalping",
    ) as GlobalpingError;
    e.status = 0;
    e.type = "network";
    e.name = "GlobalpingError";
    throw e;
  } finally {
    cancel();
  }
}

/**
 * Fetch the full public probe list.
 *
 * Globalping returns the entire list in a single call; we cache it in
 * `probes.ts` to avoid hitting the network on every request.
 */
export async function fetchProbesRaw(signal?: AbortSignal): Promise<Probe[]> {
  const res = await timedFetch(`${GLOBALPING_API_BASE}/v1/probes`, {
    method: "GET",
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) {
    throw await toGlobalpingError(res, "Failed to fetch probes");
  }
  const data = (await res.json()) as Probe[];
  return data;
}

/**
 * POST /v1/measurements — create a new measurement.
 *
 * On 202 Accepted returns { id, probesCount }. Other status codes are
 * mapped to GlobalpingError with rate-limit info attached.
 */
export async function createMeasurementRaw(
  body: unknown,
): Promise<CreateMeasurementResponse> {
  const res = await timedFetch(`${GLOBALPING_API_BASE}/v1/measurements`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status !== 202 && !res.ok) {
    throw await toGlobalpingError(res, "Failed to create measurement");
  }
  const text = await res.text();
  if (!text) {
    // 202 with empty body — fall back to Location header ID.
    const location = res.headers.get("location") || "";
    const id = location.split("/").pop() || "";
    if (!id) {
      throw new Error("Globalping returned 202 with no measurement id") as GlobalpingError;
    }
    return { id, probesCount: 0, location };
  }
  return JSON.parse(text) as CreateMeasurementResponse;
}

/**
 * GET /v1/measurements/{id} — fetch current state of a measurement.
 */
export async function getMeasurementRaw(
  id: string,
): Promise<MeasurementResponse> {
  const res = await timedFetch(
    `${GLOBALPING_API_BASE}/v1/measurements/${encodeURIComponent(id)}`,
    { method: "GET", headers: authHeaders() },
  );
  if (!res.ok) {
    throw await toGlobalpingError(res, "Failed to fetch measurement");
  }
  return (await res.json()) as MeasurementResponse;
}
