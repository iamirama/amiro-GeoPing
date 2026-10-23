import type {
  DnsResultData,
  HttpResultData,
  MeasurementResponse,
  MeasurementResultEntry,
  PingResultData,
  ProbeResultInfo,
  TracerouteResultData,
} from "./types";

// ---------------------------------------------------------------------------
// Per-probe outcome model
// ---------------------------------------------------------------------------

export type ProbeOutcome =
  | "ok"
  | "partial"
  | "timeout"
  | "failed-network"
  | "failed-dns"
  | "failed-tls"
  | "failed-connect"
  | "unknown";

export interface InterpretContext {
  kind: "ping" | "tcp" | "udp" | "dns" | "http";
}

export interface InterpretedProbe {
  probe: ProbeResultInfo;
  outcome: ProbeOutcome;
  /** One-line Persian summary of what happened for this probe. */
  summary: string;
  /** Persian label for the headline status (e.g. "پاسخ دریافت شد"). */
  statusLabel: string;
  /** True iff the actual probe location matches the requested Iran filter. */
  iranVerified: boolean;
  /** Structured metrics specific to the test kind. */
  metrics: Record<string, string | number | null | undefined>;
  /** Raw result object (already JSON-serialisable). */
  raw: MeasurementResultEntry["result"];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rttHuman(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  return `${Math.round(ms)} ms`;
}

function classifyIran(probe: ProbeResultInfo): boolean {
  return probe?.country === "IR";
}

// ---------------------------------------------------------------------------
// Ping
// ---------------------------------------------------------------------------

export function interpretPing(
  entry: MeasurementResultEntry,
): InterpretedProbe {
  const probe = entry.probe;
  const result = entry.result as PingResultData;
  const stats = result.stats ?? {};
  const total = stats.total ?? result.timings?.length ?? 0;
  const rcv = stats.rcv ?? result.timings?.filter((t) => t.rtt !== undefined && t.rtt !== null).length ?? 0;
  const lossPct = total > 0 ? Math.round(((total - rcv) / total) * 100) : null;

  let outcome: ProbeOutcome = "unknown";
  let statusLabel = "نامشخص";
  let summary = "نتیجه دریافت نشد.";

  if (result.status === "finished") {
    if (rcv > 0 && (lossPct ?? 100) < 100) {
      outcome = (lossPct ?? 0) > 0 ? "partial" : "ok";
      statusLabel = outcome === "partial" ? "پاسخ ناقص" : "پاسخ دریافت شد";
      summary = `${rcv} از ${total} بسته دریافت شد${lossPct !== null ? ` (${lossPct}% از دست رفته)` : ""}`;
    } else {
      outcome = "timeout";
      statusLabel = "بدون پاسخ";
      summary = total > 0
        ? `هیچ‌یک از ${total} بسته پاسخ ندادند (۱۰۰٪ از دست رفته)`
        : "پاسخی دریافت نشد.";
    }
  } else if (result.status === "failed") {
    outcome = "failed-network";
    statusLabel = "خطا";
    summary = result.rawOutput?.split("\n")[0] || "اندازه‌گیری ناموفق بود.";
  } else if (result.status === "in-progress" || result.status === "pending") {
    outcome = "unknown";
    statusLabel = "در حال اجرا";
    summary = "اندازه‌گیری هنوز در حال اجرا است.";
  }

  return {
    probe,
    outcome,
    summary,
    statusLabel,
    iranVerified: classifyIran(probe),
    raw: result,
    metrics: {
      packetsSent: total,
      packetsReceived: rcv,
      packetLossPct: lossPct,
      minMs: stats.min,
      avgMs: stats.avg,
      maxMs: stats.max,
      resolvedAddress: result.resolvedAddress,
      resolvedHostname: result.resolvedHostname,
      avgMsHuman: rttHuman(stats.avg),
    },
  };
}

// ---------------------------------------------------------------------------
// Traceroute — used by both TCP and UDP tests
// ---------------------------------------------------------------------------

export interface TracerouteInterp extends InterpretedProbe {
  /** Last hop with any host info; null if the route was entirely anonymous. */
  lastReachableHop: number | null;
  /** True iff the destination IP appeared in any hop (suggesting reach). */
  reachedDestination: boolean;
  /** Total hop count, including timeouts. */
  totalHops: number;
}

function interpretTraceroute(
  entry: MeasurementResultEntry,
  ctx: InterpretContext,
): TracerouteInterp {
  const probe = entry.probe;
  const result = entry.result as TracerouteResultData;
  const hops = result.hops ?? [];
  const totalHops = hops.length;
  const resolvedAddr = result.resolvedAddress;
  const reachedDestination = resolvedAddr
    ? hops.some((h) => h.resolvedAddress === resolvedAddr)
    : false;
  // Find the highest-indexed hop with any host info (non-anonymous).
  let lastReachableHop: number | null = null;
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!hops[i].anonymous && (hops[i].resolvedAddress || hops[i].resolvedHostname)) {
      lastReachableHop = i + 1;
      break;
    }
  }

  let outcome: ProbeOutcome = "unknown";
  let statusLabel = "نامشخص";
  let summary = "نتیجه قابل تفسیر نیست.";

  if (result.status === "finished") {
    if (reachedDestination) {
      // The destination's IP appeared somewhere in the route — for TCP this
      // is consistent with the destination's port answering.
      outcome = "ok";
      statusLabel = ctx.kind === "tcp" ? "اتصال برقرار شد" : "پاسخ از مقصد دریافت شد";
      summary =
        ctx.kind === "tcp"
          ? `مسیر تا مقصد روی پورت باز است (تعداد گام: ${totalHops}).`
          : `پاسخی از مقصد دریافت شد (تعداد گام: ${totalHops}).`;
    } else if (lastReachableHop !== null) {
      outcome = "timeout";
      statusLabel = "بدون پاسخ قطعی از مقصد";
      summary =
        ctx.kind === "tcp"
          ? `مسیر تا گام ${lastReachableHop} قابل ردیابی بود، اما اتصال TCP به مقصد روی این پورت بدون پاسخ ماند. این وضعیت هم می‌تواند به معنای بسته بودن پورت باشد و هم فیلترینگ یا timeout شبکه.`
          : `مسیر تا گام ${lastReachableHop} قابل ردیابی بود، اما پاسخی از مقصد روی این پورت دریافت نشد. UDP بدون اتصال است و نبود پاسخ به‌تنهایی دلیلی بر بسته بودن پورت نیست.`;
    } else {
      outcome = "timeout";
      statusLabel = "بدون پاسخ";
      summary =
        ctx.kind === "tcp"
          ? "هیچ پاسخی در طول مسیر دریافت نشد — احتمالاً فیلترینگ یا unreachable."
          : "هیچ پاسخی در طول مسیر دریافت نشد — UDP بدون اتصال است و این به‌تنهایی بسته بودن پورت را اثبات نمی‌کند.";
    }
  } else if (result.status === "failed") {
    outcome = "failed-network";
    statusLabel = "خطا";
    summary = result.rawOutput?.split("\n")[0] || "اندازه‌گیری ناموفق بود.";
  }

  return {
    probe,
    outcome,
    summary,
    statusLabel,
    iranVerified: classifyIran(probe),
    raw: result,
    metrics: {
      totalHops,
      lastReachableHop,
      reachedDestination: reachedDestination ? "بله" : "خیر",
      resolvedAddress: result.resolvedAddress,
      resolvedHostname: result.resolvedHostname,
    },
    lastReachableHop,
    reachedDestination,
    totalHops,
  };
}

export function interpretTcp(entry: MeasurementResultEntry): TracerouteInterp {
  return interpretTraceroute(entry, { kind: "tcp" });
}

export function interpretUdp(entry: MeasurementResultEntry): TracerouteInterp {
  return interpretTraceroute(entry, { kind: "udp" });
}

// ---------------------------------------------------------------------------
// DNS
// ---------------------------------------------------------------------------

export function interpretDns(entry: MeasurementResultEntry): InterpretedProbe {
  const probe = entry.probe;
  const result = entry.result as DnsResultData;
  const answers = result.answers ?? [];
  const rcode = result.statusCode ?? 0;
  const rcodeName = result.statusCodeName ?? "";

  let outcome: ProbeOutcome = "unknown";
  let statusLabel = "نامشخص";
  let summary = "نتیجه قابل تفسیر نیست.";

  if (result.status === "finished") {
    if (answers.length > 0) {
      outcome = "ok";
      statusLabel = "پاسخ DNS دریافت شد";
      summary = `${answers.length} رکورد ${answers[0]?.type ?? ""} برای ${answers[0]?.name ?? ""} یافت شد.`;
    } else if (rcode === 0) {
      outcome = "ok";
      statusLabel = "بدون پاسخ (NOERROR)";
      summary = "سرور پاسخ NOERROR داد اما هیچ رکوردی بازنگرداند.";
    } else if (rcode === 3) {
      outcome = "failed-dns";
      statusLabel = "NXDOMAIN";
      summary = "دامنه وجود ندارد (NXDOMAIN).";
    } else if (rcode > 0) {
      outcome = "failed-dns";
      statusLabel = `خطای DNS (${rcodeName || rcode})`;
      summary = `سرور DNS با کد ${rcode} (${rcodeName || "نامشخص"}) پاسخ داد.`;
    } else {
      outcome = "unknown";
      statusLabel = "بدون پاسخ";
      summary = "هیچ رکوردی دریافت نشد و کد وضعیت مشخص نیست.";
    }
  } else if (result.status === "failed") {
    outcome = "failed-dns";
    statusLabel = "خطا";
    summary = result.rawOutput?.split("\n")[0] || "پرس‌وجوی DNS ناموفق بود.";
  }

  return {
    probe,
    outcome,
    summary,
    statusLabel,
    iranVerified: classifyIran(probe),
    raw: result,
    metrics: {
      recordCount: answers.length,
      rcode,
      rcodeName,
      resolver: result.resolver,
      totalTimeMs: result.timings?.total,
      totalTimeHuman: rttHuman(result.timings?.total),
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export function interpretHttp(entry: MeasurementResultEntry): InterpretedProbe {
  const probe = entry.probe;
  const result = entry.result as HttpResultData;
  const status = result.statusCode;
  const failure = result.failureSource;

  let outcome: ProbeOutcome = "unknown";
  let statusLabel = "نامشخص";
  let summary = "نتیجه قابل تفسیر نیست.";

  if (result.status === "finished") {
    if (typeof status === "number" && status >= 200 && status < 400) {
      outcome = "ok";
      statusLabel = `HTTP ${status}`;
      summary = `سرور با کد ${status} پاسخ داد.`;
    } else if (typeof status === "number" && status >= 400) {
      outcome = "ok"; // We reached the server; the server answered with an HTTP error.
      statusLabel = `HTTP ${status}`;
      summary = `سرور پاسخ داد ولی کد وضعیت ${status} بازگرداند. توجه: خطای HTTP به‌معنای قطعی شبکه نیست.`;
    } else if (failure) {
      // Failure source taxonomy per Globalping docs.
      if (/dns/i.test(failure)) {
        outcome = "failed-dns";
        statusLabel = "خطای DNS";
      } else if (/tls|ssl/i.test(failure)) {
        outcome = "failed-tls";
        statusLabel = "خطای TLS";
      } else if (/connect|refused|reset|timeout/i.test(failure)) {
        outcome = "failed-connect";
        statusLabel = "خطای اتصال";
      } else {
        outcome = "failed-network";
        statusLabel = "خطای شبکه";
      }
      summary = `اتصال ناموفق بود: ${failure}`;
    } else {
      outcome = "unknown";
      statusLabel = "نامشخص";
      summary = "پاسخ دریافت شد ولی اطلاعات کافی برای تفسیر نیست.";
    }
  } else if (result.status === "failed") {
    outcome = "failed-network";
    statusLabel = "خطا";
    summary = result.rawOutput?.split("\n")[0] || "درخواست ناموفق بود.";
  }

  return {
    probe,
    outcome,
    summary,
    statusLabel,
    iranVerified: classifyIran(probe),
    raw: result,
    metrics: {
      statusCode: status,
      statusCodeName: result.statusCodeName,
      failureSource: failure,
      totalMs: result.timings?.total,
      dnsMs: result.timings?.dns,
      tcpMs: result.timings?.tcp,
      tlsMs: result.timings?.tls,
      firstByteMs: result.timings?.firstByte,
      totalMsHuman: rttHuman(result.timings?.total),
      resolvedAddress: result.resolvedAddress,
      tlsProtocol: result.tls?.protocol,
      tlsCipher: result.tls?.cipher,
    },
  };
}

// ---------------------------------------------------------------------------
// Top-level: build a measurement interpretation, including honest reporting
// when no Iranian probe was actually used despite one being requested.
// ---------------------------------------------------------------------------

export interface InterpretedMeasurement {
  id: string;
  type: "ping" | "traceroute" | "dns" | "mtr" | "http";
  status: MeasurementResponse["status"];
  target: string;
  createdAt: string;
  updatedAt: string;
  probes: InterpretedProbe[];
  /** True iff the request asked for an Iranian probe. */
  requestedIran: boolean;
  /** True iff at least one result actually came from an Iranian probe. */
  usedIranProbe: boolean;
}

export function interpretMeasurement(
  m: MeasurementResponse,
  requestedIran: boolean,
  kind: InterpretContext["kind"],
): InterpretedMeasurement {
  const entries = m.results ?? [];
  let interp: InterpretedProbe[];
  if (kind === "ping") {
    interp = entries.map(interpretPing);
  } else if (kind === "tcp") {
    interp = entries.map(interpretTcp);
  } else if (kind === "udp") {
    interp = entries.map(interpretUdp);
  } else if (kind === "dns") {
    interp = entries.map(interpretDns);
  } else {
    interp = entries.map(interpretHttp);
  }
  return {
    id: m.id,
    type: m.type,
    status: m.status,
    target: m.target,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    probes: interp,
    requestedIran,
    usedIranProbe: interp.some((p) => p.iranVerified),
  };
}
