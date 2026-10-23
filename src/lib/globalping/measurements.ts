import "server-only";

import { createMeasurementRaw, getMeasurementRaw } from "./client";
import type {
  CreateMeasurementRequest,
  CreateMeasurementResponse,
  MeasurementResponse,
} from "./types";

/**
 * High-level measurement helpers. These wrap the raw client with our
 * app-specific request shapes and the polling logic the UI needs.
 */

export async function createMeasurement(
  body: CreateMeasurementRequest,
): Promise<CreateMeasurementResponse> {
  return createMeasurementRaw(body);
}

export async function getMeasurement(id: string): Promise<MeasurementResponse> {
  return getMeasurementRaw(id);
}

/**
 * Polls a measurement until it reaches a terminal status (finished/failed)
 * or until maxAttempts is exceeded. Returns the final response.
 *
 * This function is intended for *server-side* callers that need a fully
 * resolved measurement. Client-side polling happens through the
 * `/api/measurements/[id]` route.
 */
export async function pollMeasurement(
  id: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<MeasurementResponse> {
  const interval = opts.intervalMs ?? 3000;
  const max = opts.maxAttempts ?? 20;
  let last: MeasurementResponse | null = null;
  for (let i = 0; i < max; i++) {
    const m = await getMeasurementRaw(id);
    last = m;
    if (m.status === "finished" || m.status === "failed") return m;
    await new Promise((r) => setTimeout(r, interval));
  }
  return last as MeasurementResponse;
}
