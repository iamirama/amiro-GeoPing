"use client";
import { useMemo, useState } from "react";
import { Github, Globe, Heart, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/netcheck/theme-toggle";
import {
  TestForm,
  type TestFormValue,
} from "@/components/netcheck/test-form";
import { ResultsPanel } from "@/components/netcheck/results-panel";
import { useMeasurement } from "@/hooks/use-measurement";

export default function HomePage() {
  const [formValue, setFormValue] = useState<TestFormValue>({
    kind: "ping",
    target: "1.1.1.1",
    port: 443,
    packets: 3,
    recordType: "A",
    dnsProtocol: "UDP",
    trace: false,
    httpProtocol: "HTTPS",
    httpMethod: "HEAD",
    limit: 1,
    location: {
      label: "ایران — همه سرور‌های آنلاین",
      location: { country: "IR" },
      iran: true,
    },
  });

  const { status, measurement, iranRequested, error, create, reset, stop } =
    useMeasurement();

  const requestBody = useMemo(() => buildRequestBody(formValue), [formValue]);

  const isLoading = status === "creating" || status === "polling";

  function handleSubmit() {
    if (!requestBody) return;
    void create(requestBody);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg overflow-hidden bg-primary text-primary-foreground">
              <img
                src="/logo.svg"
                alt="NetCheck Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="font-semibold leading-tight">شبکه‌سنج</div>
              <div className="text-xs text-muted-foreground">
                NetCheck — تست شبکه
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com/iamirama"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>
                ساخته شده توسط <b>Amirhoseini</b>
              </span>
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* Hero */}
        <section className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">
            آزمون شبکه از سرور‌های ایران و جهان
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            شبکه‌سنج با استفاده از شبکه عمومی سرور‌های{" "}
            <span className="font-medium">Globalping</span>، تست‌های Ping،
            TCP، UDP، DNS و HTTP/HTTPS را از مکان‌های مختلف اجرا می‌کند.
            نتایج مستقیماً از اندازه‌گیری‌ها دریافت می‌شوند و موقعیت ایران
            به‌صورت پیش‌فرض در دسترس است.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Form */}
          <Card className="p-6">
            <TestForm
              value={formValue}
              onChange={setFormValue}
              onSubmit={handleSubmit}
              isLoading={isLoading}
            />
            {isLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={stop}
                >
                  توقف نظارت (سمت-سرور همچنان اجرا می‌شود)
                </button>
              </div>
            )}
          </Card>

          {/* Results */}
          <div>
            <ResultsPanel
              measurement={measurement}
              iranRequested={iranRequested}
              kind={formValue.kind}
              status={status}
              error={error}
              onClear={reset}
            />
          </div>
        </div>

        {/* Info section */}
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Caveat
            icon={ShieldCheck}
            title="اندازه‌گیری مستقیم"
            body="هر تست از طریق API عمومی Globalping اجرا می‌شود و نتایج به‌صورت مستقیم از سرورها دریافت می‌شوند."
          />
          <Caveat
            icon={Globe}
            title="سرور‌های ایران"
            body="موقعیت ایران به‌صورت پیش‌فرض و در صدر فهرست قرار دارد. در صورت در دسترس نبودن سرور ایرانی، وضعیت به کاربر اطلاع داده می‌شود."
          />
          <Caveat
            icon={Heart}
            title="رایگان و متن‌باز"
            body="بدون نیاز به کلید API پولی یا سرور اختصاصی. بر اساس سهمیهٔ عمومی Globalping کار می‌کند."
          />
        </section>
      </main>

      <footer className="border-t bg-muted/30 py-6 mt-auto">
        <div className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground space-y-2">
          <p>
            شبکه‌سنج (NetCheck) — ابزار تست شبکه مبتنی بر API عمومی{" "}
            <a
              href="https://globalping.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Globalping
            </a>
            . این پروژه به‌صورت مستقل توسعه یافته و هیچ وابستگی تجاری با
            Globalping ندارد.
          </p>
          <p>
            توجه: مقصد و پارامترهای تست شما ممکن است توسط سرویس Globalping
            ثبت یا نمایش‌داده شود. از وارد کردن اطلاعات حساس یا محرمانه
            خودداری کنید.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Caveat({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

/**
 * Translates the form value into the request body for POST /api/measurements.
 * Returns null if the form is incomplete.
 */
function buildRequestBody(v: TestFormValue): unknown | null {
  if (!v.target.trim() || !v.location) return null;

  const base = {
    limit: v.limit ?? 1,
    locations: [v.location.location],
  };

  switch (v.kind) {
    case "ping":
      return {
        kind: "ping",
        target: v.target.trim(),
        ...base,
        ...(v.packets ? { packets: v.packets } : {}),
      };
    case "tcp":
      return {
        kind: "tcp",
        target: v.target.trim(),
        port: v.port ?? 80,
        ...base,
      };
    case "udp":
      return {
        kind: "udp",
        target: v.target.trim(),
        port: v.port ?? 53,
        ...base,
      };
    case "dns":
      return {
        kind: "dns",
        target: v.target.trim(),
        recordType: v.recordType ?? "A",
        protocol: v.dnsProtocol ?? "UDP",
        trace: !!v.trace,
        ...(v.resolver ? { resolver: v.resolver.trim() } : {}),
        ...base,
      };
    case "http": {
      const target = v.target
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");
      return {
        kind: "http",
        target,
        protocol: v.httpProtocol ?? "HTTPS",
        method: v.httpMethod ?? "HEAD",
        ...(v.httpPath ? { path: v.httpPath } : {}),
        ...(v.httpQuery ? { query: v.httpQuery } : {}),
        ...(v.httpHost ? { host: v.httpHost.trim() } : {}),
        ...base,
      };
    }
    default:
      return null;
  }
}
