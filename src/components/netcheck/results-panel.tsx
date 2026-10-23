"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  Eraser,
  MapPin,
  Network,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMs, formatTimestamp, toFaDigits } from "@/lib/globalping/format";
import type { InterpretedMeasurement, InterpretedProbe } from "@/lib/globalping/interpret";
import { interpretMeasurement } from "@/lib/globalping/interpret";
import type { MeasurementResponse } from "@/lib/globalping/types";

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface ResultsPanelProps {
  measurement: MeasurementResponse | null;
  iranRequested: boolean;
  kind: "ping" | "tcp" | "udp" | "dns" | "http";
  status: "creating" | "polling" | "done" | "error" | "idle";
  error?: string | null;
  onClear?: () => void;
}

export function ResultsPanel({
  measurement,
  iranRequested,
  kind,
  status,
  error,
  onClear,
}: ResultsPanelProps) {
  const interpretation = useMemo<InterpretedMeasurement | null>(() => {
    if (!measurement) return null;
    return interpretMeasurement(measurement, iranRequested, kind);
  }, [measurement, iranRequested, kind]);

  if (status === "creating") {
    return <Card className="p-6 text-center text-sm text-muted-foreground">
      <Clock className="mx-auto mb-2 h-5 w-5 animate-pulse" />
      در حال ساخت اندازه‌گیری…
    </Card>;
  }

  if (status === "error") {
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <div className="font-medium text-destructive">اندازه‌گیری ناموفق بود</div>
            <p className="mt-1 text-sm text-foreground/80">{error || "خطای ناشناخته."}</p>
            {onClear && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={onClear}>
                <Eraser className="ml-2 h-4 w-4" /> پاک کردن
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (status === "polling" && !measurement) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        <Clock className="mx-auto mb-2 h-5 w-5 animate-pulse" />
        در حال اجرای اندازه‌گیری از پروب‌ها…
      </Card>
    );
  }

  if (!interpretation) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        نتیجه‌ای برای نمایش وجود ندارد. یک تست اجرا کنید.
      </Card>
    );
  }

  return <ResultsView interpretation={interpretation} onClear={onClear} status={status} />;
}

// ---------------------------------------------------------------------------
// Results view
// ---------------------------------------------------------------------------

interface ResultsViewProps {
  interpretation: InterpretedMeasurement;
  status: "polling" | "done" | "idle" | "creating" | "error";
  onClear?: () => void;
}

function ResultsView({ interpretation, status, onClear }: ResultsViewProps) {
  const [copied, setCopied] = useState(false);
  const isFinished = interpretation.status === "finished" || interpretation.status === "failed";

  const json = useMemo(() => JSON.stringify(interpretation, null, 2), [interpretation]);

  function handleCopy() {
    void navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleDownload() {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `netcheck-${interpretation.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">
                نتیجه برای{" "}
                <span className="tnum text-primary" dir="ltr">
                  {interpretation.target}
                </span>
              </h3>
              {isFinished ? (
                <Badge variant={interpretation.status === "finished" ? "default" : "destructive"}>
                  {interpretation.status === "finished" ? "تکمیل شد" : "ناموفق"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="animate-pulse">در حال اجرا</Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              شناسه: <code className="tnum" dir="ltr">{interpretation.id}</code>
              {" — "}
              {formatTimestamp(interpretation.createdAt)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!isFinished}>
              <Copy className="ml-2 h-3.5 w-3.5" />
              {copied ? "کپی شد" : "کپی JSON"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!isFinished}>
              <Download className="ml-2 h-3.5 w-3.5" />
              دانلود
            </Button>
            {onClear && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <Eraser className="ml-2 h-3.5 w-3.5" />
                پاک کردن
              </Button>
            )}
          </div>
        </div>

        {/* Iran-verification banner */}
        {interpretation.requestedIran && (
          <div
            className={cn(
              "mt-3 rounded-md border p-3 text-sm",
              interpretation.usedIranProbe
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
            )}
          >
            {interpretation.usedIranProbe ? (
              <span>
                <ShieldAlert className="ml-1 inline h-4 w-4 align-middle" />
                موقعیت ایران انتخاب شد و پاسخ از پروب واقعی داخل ایران دریافت شد.
              </span>
            ) : (
              <span>
                <ShieldAlert className="ml-1 inline h-4 w-4 align-middle" />
                موقعیت ایران انتخاب شد اما هیچ پروب ایرانی در این نتیجه شرکت نکرد.
                این نتیجه نباید به‌عنوان پاسخ از داخل ایران تفسیر شود.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Probe results */}
      <div className="divide-y">
        {interpretation.probes.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {status === "polling"
              ? "در انتظار دریافت اولین پاسخ پروب…"
              : "هیچ پروبی در این اندازه‌گیری شرکت نکرد."}
          </div>
        )}
        {interpretation.probes.map((p, idx) => (
          <ProbeResultCard key={`${idx}-${p.probe.asn}`} probe={p} kind={interpretation.type} />
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Per-probe card
// ---------------------------------------------------------------------------

function ProbeResultCard({
  probe,
  kind,
}: {
  probe: InterpretedProbe;
  kind: "ping" | "traceroute" | "dns" | "mtr" | "http";
}) {
  const [expanded, setExpanded] = useState(false);
  const isIran = probe.probe.country === "IR";

  const outcomeColor = OUTCOME_COLORS[probe.outcome] ?? "secondary";
  const metrics = renderMetrics(probe, kind);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{probe.probe.city}</span>
            <Badge variant="outline">{probe.probe.country}</Badge>
            {isIran && (
              <Badge className="bg-emerald-600 text-white">ایران</Badge>
            )}
            <Network className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{probe.probe.network}</span>
            <Badge variant="outline" className="tnum">
              ASN {toFaDigits(probe.probe.asn)}
            </Badge>
          </div>
          <p className="mt-1 text-sm">{probe.summary}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={outcomeColor}>{probe.statusLabel}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            type="button"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="sr-only">جزئیات</span>
          </Button>
        </div>
      </div>

      {/* Metric chips */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-md border bg-muted/30 px-2 py-1"
          >
            <span className="text-muted-foreground">{m.label}: </span>
            <span className="tnum font-medium" dir="ltr">
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Expanded details — raw output */}
      {expanded && (
        <div className="mt-3">
          <RawOutput raw={probe.raw} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OUTCOME_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  ok: "default",
  partial: "secondary",
  timeout: "secondary",
  "failed-network": "destructive",
  "failed-dns": "destructive",
  "failed-tls": "destructive",
  "failed-connect": "destructive",
  unknown: "secondary",
};

interface Metric {
  label: string;
  value: string;
}

function renderMetrics(
  probe: InterpretedProbe,
  kind: "ping" | "traceroute" | "dns" | "mtr" | "http",
): Metric[] {
  if (kind === "ping") {
    const m = probe.metrics;
    return [
      { label: "بسته‌های ارسالی", value: String(m.packetsSent ?? "—") },
      { label: "بسته‌های دریافت‌شده", value: String(m.packetsReceived ?? "—") },
      { label: "از دست رفته", value: `${m.packetLossPct ?? "—"}%` },
      { label: "حداقل", value: typeof m.minMs === "number" ? formatMs(m.minMs) : "—" },
      { label: "میانگین", value: typeof m.avgMs === "number" ? formatMs(m.avgMs) : "—" },
      { label: "حداکثر", value: typeof m.maxMs === "number" ? formatMs(m.maxMs) : "—" },
      ...(m.resolvedAddress
        ? [{ label: "IP مقصد", value: String(m.resolvedAddress) }]
        : []),
    ];
  }
  if (kind === "traceroute") {
    const m = probe.metrics;
    return [
      { label: "تعداد گام", value: String(m.totalHops ?? "—") },
      { label: "آخرین گام قابل‌دسترس", value: String(m.lastReachableHop ?? "—") },
      { label: "مقصد در مسیر دیده شد", value: m.reachedDestination ? "بله" : "خیر" },
      ...(m.resolvedAddress
        ? [{ label: "IP مقصد", value: String(m.resolvedAddress) }]
        : []),
    ];
  }
  if (kind === "dns") {
    const m = probe.metrics;
    return [
      { label: "تعداد رکوردها", value: String(m.recordCount ?? "—") },
      { label: "کد DNS", value: String(m.rcode ?? "—") },
      ...(m.resolver ? [{ label: "Resolver", value: String(m.resolver) }] : []),
      { label: "زمان کل", value: typeof m.totalTimeMs === "number" ? formatMs(m.totalTimeMs) : "—" },
    ];
  }
  if (kind === "http") {
    const m = probe.metrics;
    return [
      { label: "کد HTTP", value: String(m.statusCode ?? "—") },
      { label: "زمان کل", value: typeof m.totalMs === "number" ? formatMs(m.totalMs) : "—" },
      ...(isNumber(m.dnsMs) ? [{ label: "DNS", value: formatMs(m.dnsMs) }] : []),
      ...(isNumber(m.tcpMs) ? [{ label: "TCP", value: formatMs(m.tcpMs) }] : []),
      ...(isNumber(m.tlsMs) ? [{ label: "TLS", value: formatMs(m.tlsMs) }] : []),
      ...(m.tlsProtocol
        ? [{ label: "نسخه TLS", value: String(m.tlsProtocol) }]
        : []),
    ];
  }
  return [];
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

function RawOutput({ raw }: { raw: InterpretedProbe["raw"] }) {
  let text = "";
  if (typeof raw === "object" && raw && "rawOutput" in raw) {
    const r = raw as { rawOutput?: string };
    text = r.rawOutput ?? "";
  }
  const answers =
    typeof raw === "object" && raw && "answers" in raw
      ? (raw as { answers?: unknown[] }).answers
      : undefined;
  return (
    <div className="space-y-3">
      {text && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">خروجی خام</div>
          <pre
            dir="ltr"
            className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed netcheck-scroll"
          >
            {text}
          </pre>
        </div>
      )}
      {answers && Array.isArray(answers) && answers.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted-foreground">پاسخ‌های DNS</div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 text-right">نام</th>
                <th className="py-1 text-right">نوع</th>
                <th className="py-1 text-right">TTL</th>
                <th className="py-1 text-right">مقدار</th>
              </tr>
            </thead>
            <tbody>
              {answers.map((a, i) => {
                const ans = a as { name?: string; type?: string; ttl?: number; value?: string };
                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1 tnum" dir="ltr">{ans.name}</td>
                    <td className="py-1">{ans.type}</td>
                    <td className="py-1 tnum">{ans.ttl}</td>
                    <td className="py-1 tnum" dir="ltr">{ans.value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">
          نمایش JSON کامل نتیجه
        </summary>
        <pre
          dir="ltr"
          className="mt-2 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed netcheck-scroll"
        >
          {JSON.stringify(raw, null, 2)}
        </pre>
      </details>
    </div>
  );
}
