"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { POLL_INTERVAL_MS, POLL_MAX_ATTEMPTS } from "@/lib/globalping/config";
import type { MeasurementResponse } from "@/lib/globalping/types";

export interface UseMeasurementState {
  status: "idle" | "creating" | "polling" | "done" | "error";
  measurementId: string | null;
  measurement: MeasurementResponse | null;
  iranRequested: boolean;
  error: string | null;
  rateLimitInfo?: {
    limit?: number;
    remaining?: number;
    resetSeconds?: number;
    retryAfterSeconds?: number;
  };
  /** Stop polling (does NOT cancel the server-side measurement). */
  stop: () => void;
  /** Reset to idle, clearing any previous result. */
  reset: () => void;
  /** Create a new measurement and start polling. */
  create: (body: unknown) => Promise<void>;
}

export function useMeasurement(): UseMeasurementState {
  const [state, setState] = useState<UseMeasurementState>({
    status: "idle",
    measurementId: null,
    measurement: null,
    iranRequested: false,
    error: null,
    stop: () => {},
    reset: () => {},
    create: async () => {},
  });
  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopRef.current = true;
    clearTimer();
    setState((s) => ({
      ...s,
      status: s.status === "done" || s.status === "error" ? s.status : "done",
    }));
  }, [clearTimer]);

  const reset = useCallback(() => {
    stopRef.current = true;
    clearTimer();
    setState({
      status: "idle",
      measurementId: null,
      measurement: null,
      iranRequested: false,
      error: null,
      stop,
      reset,
      create: async () => {},
    });
  }, [clearTimer, stop]);

  const poll = useCallback(
    async (id: string, iranRequested: boolean) => {
      stopRef.current = false;
      let attempts = 0;
      const tick = async () => {
        if (stopRef.current) return;
        attempts++;
        try {
          const res = await fetch(
            `/api/measurements/${encodeURIComponent(id)}?iranRequested=${iranRequested ? "1" : "0"}`,
            { cache: "no-store" },
          );
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as {
              error?: { message?: string; type?: string; rateLimit?: unknown };
            } | null;
            const msg =
              data?.error?.message ?? `خطای ناشناخته (${res.status})`;
            setState((s) => ({
              ...s,
              status: "error",
              error: msg,
              rateLimitInfo:
                data?.error && typeof data.error === "object" && "rateLimit" in data.error
                  ? (data.error.rateLimit as never)
                  : undefined,
            }));
            return;
          }
          const data = (await res.json()) as {
            measurement: MeasurementResponse;
            iranRequested: boolean;
          };
          const m = data.measurement;
          setState((s) => ({ ...s, measurement: m, iranRequested: data.iranRequested }));
          if (m.status === "finished" || m.status === "failed") {
            setState((s) => ({ ...s, status: "done" }));
            return;
          }
          if (attempts >= POLL_MAX_ATTEMPTS) {
            setState((s) => ({
              ...s,
              status: "error",
              error: `پاسخ نهایی پس از ${POLL_MAX_ATTEMPTS} تلاش دریافت نشد. ممکن است اندازه‌گیری همچنان در حال اجرا باشد — چند لحظه دیگر دوباره تلاش کنید.`,
            }));
            return;
          }
          timerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        } catch {
          if (stopRef.current) return;
          setState((s) => ({
            ...s,
            status: "error",
            error: "خطای شبکه هنگام دریافت نتیجه اندازه‌گیری.",
          }));
        }
      };
      tick();
    },
    [],
  );

  const create = useCallback(
    async (body: unknown) => {
      stopRef.current = false;
      setState({
        status: "creating",
        measurementId: null,
        measurement: null,
        iranRequested: false,
        error: null,
        stop,
        reset,
        create,
      });
      try {
        const res = await fetch("/api/measurements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string; type?: string; rateLimit?: unknown };
          } | null;
          const msg =
            data?.error?.message ?? `خطای ناشناخته (${res.status})`;
          setState((s) => ({
            ...s,
            status: "error",
            error: msg,
            rateLimitInfo:
              data?.error && typeof data.error === "object" && "rateLimit" in data.error
                ? (data.error.rateLimit as never)
                : undefined,
          }));
          return;
        }
        const data = (await res.json()) as {
          id: string;
          probesCount: number;
          iranRequested: boolean;
        };
        setState((s) => ({
          ...s,
          status: "polling",
          measurementId: data.id,
          iranRequested: data.iranRequested,
        }));
        await poll(data.id, data.iranRequested);
      } catch {
        setState((s) => ({
          ...s,
          status: "error",
          error: "خطای شبکه هنگام ارسال درخواست اندازه‌گیری.",
        }));
      }
    },
    [poll, reset, stop],
  );

  useEffect(() => {
    return () => {
      stopRef.current = true;
      clearTimer();
    };
  }, [clearTimer]);

  // Keep `stop`/`reset`/`create` references stable enough while still
  // returning the latest state.
  return {
    ...state,
    stop,
    reset,
    create,
  };
}
