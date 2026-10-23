import type { GlobalpingError, RateLimitInfo } from "./types";

export function isGlobalpingError(x: unknown): x is GlobalpingError {
  return (
    typeof x === "object" &&
    x !== null &&
    "status" in x &&
    "type" in x &&
    x instanceof Error
  );
}

function parseRateLimit(headers: Headers): RateLimitInfo | undefined {
  const limit = headers.get("x-ratelimit-limit");
  const consumed = headers.get("x-ratelimit-consumed");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const cost = headers.get("x-request-cost");
  if (!limit && !remaining) return undefined;
  return {
    limit: Number(limit ?? 0),
    consumed: Number(consumed ?? 0),
    remaining: Number(remaining ?? 0),
    resetSeconds: Number(reset ?? 0),
    requestCost: Number(cost ?? 1),
  };
}

export function makeError(
  status: number,
  message: string,
  opts: {
    type?: GlobalpingError["type"];
    params?: Record<string, string>;
    headers?: Headers;
  } = {},
): GlobalpingError {
  const e = new Error(message) as GlobalpingError;
  e.status = status;
  e.type = opts.type ?? "unknown";
  e.params = opts.params;
  e.name = "GlobalpingError";
  if (opts.headers) {
    e.rateLimit = parseRateLimit(opts.headers);
    const retryAfter = opts.headers.get("retry-after");
    if (retryAfter) {
      e.retryAfterSeconds = Number(retryAfter);
    }
  }
  return e;
}

/**
 * Maps a fetch failure (network error, non-2xx response, etc.) to a typed
 * GlobalpingError. The body is parsed only as JSON when present.
 */
export async function toGlobalpingError(
  res: Response,
  fallbackMessage: string,
): Promise<GlobalpingError> {
  const headers = res.headers;
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    bodyText = "";
  }
  let parsed: { error?: { type?: string; message?: string; params?: Record<string, string> } } | null = null;
  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = null;
    }
  }
  const apiMessage = parsed?.error?.message;
  const apiParams = parsed?.error?.params;
  const apiType = parsed?.error?.type;

  let type: GlobalpingError["type"] = "unknown";
  if (res.status === 429) type = "rate_limit";
  else if (res.status >= 400 && res.status < 500 && apiType === "validation_error") type = "validation_error";
  else if (res.status === 404) type = "not_found";
  else if (res.status >= 500) type = "server";

  const message =
    apiMessage ?? `${fallbackMessage}: HTTP ${res.status}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ""}`;

  return makeError(res.status, message, {
    type,
    params: apiParams,
    headers,
  });
}
