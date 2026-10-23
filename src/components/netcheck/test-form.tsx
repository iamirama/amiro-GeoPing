"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Globe,
  Loader2,
  Plug,
  Route,
  Search as SearchIcon,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toEnDigits } from "@/lib/globalping/format";
import { LocationSelector, type SelectedLocation } from "./location-selector";

// ---------------------------------------------------------------------------
// Test kinds
// ---------------------------------------------------------------------------

export type TestKind = "ping" | "tcp" | "udp" | "dns" | "http";

interface TestKindMeta {
  kind: TestKind;
  title: string;
  description: string;
  icon: typeof Activity;
}

const TEST_KINDS: TestKindMeta[] = [
  {
    kind: "ping",
    title: "پینگ",
    description: "تأخیر و از دست رفتن بسته‌ها (ICMP)",
    icon: Activity,
  },
  {
    kind: "tcp",
    title: "TCP",
    description: "اتصال به پورت مقصد روی TCP (از طریق Traceroute TCP)",
    icon: Plug,
  },
  {
    kind: "udp",
    title: "UDP",
    description: "مسیر UDP به پورت مقصد (نمی‌تواند قطعاً باز/بسته بودن را اثبات کند)",
    icon: Route,
  },
  {
    kind: "dns",
    title: "DNS",
    description: "پرس‌وجوی رکورد DNS از پروب واقعی",
    icon: Globe,
  },
  {
    kind: "http",
    title: "HTTP/HTTPS",
    description: "درخواست HTTP واقعی از پروب",
    icon: SearchIcon,
  },
];

export interface TestFormValue {
  kind: TestKind;
  target: string;
  port?: number;
  packets?: number;
  recordType?: string;
  dnsProtocol?: "TCP" | "UDP";
  resolver?: string;
  trace?: boolean;
  httpProtocol?: "HTTP" | "HTTPS" | "HTTP2";
  httpMethod?: "HEAD" | "GET" | "OPTIONS";
  httpPath?: string;
  httpQuery?: string;
  httpHost?: string;
  location: SelectedLocation | null;
  limit: number;
}

interface TestFormProps {
  value: TestFormValue;
  onChange: (v: TestFormValue) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function TestForm({
  value,
  onChange,
  onSubmit,
  isLoading,
}: TestFormProps) {
  const targetError = useMemo(() => validateTarget(value.kind, value.target), [value.kind, value.target]);
  const portError = useMemo(
    () =>
      (value.kind === "tcp" || value.kind === "udp") && value.port
        ? validatePort(value.port)
        : null,
    [value.kind, value.port],
  );
  const canSubmit =
    !isLoading &&
    value.target.trim().length > 0 &&
    !targetError &&
    !portError &&
    value.location !== null;

  function patch(p: Partial<TestFormValue>) {
    onChange({ ...value, ...p });
  }

  return (
    <div className="space-y-6">
      {/* Test type selector */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">نوع تست</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TEST_KINDS.map((t) => {
            const Icon = t.icon;
            const active = value.kind === t.kind;
            return (
              <button
                key={t.kind}
                type="button"
                onClick={() => patch({ kind: t.kind })}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-right transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent/50",
                )}
                aria-pressed={active}
              >
                <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Destination + per-kind fields */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="target">مقصد</Label>
          <Input
            id="target"
            value={value.target}
            onChange={(e) => patch({ target: toEnDigits(e.target.value) })}
            placeholder={
              value.kind === "http"
                ? "مثلاً example.com"
                : value.kind === "dns"
                  ? "مثلاً cloudflare.com"
                  : "مثلاً 1.1.1.1 یا example.com"
            }
            dir="ltr"
            className="text-left"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!targetError}
          />
          {targetError && (
            <p className="text-xs text-destructive">{targetError}</p>
          )}
        </div>

        {value.kind === "ping" && (
          <div className="space-y-2">
            <Label htmlFor="packets">تعداد بسته (۱ تا ۱۶)</Label>
            <Input
              id="packets"
              type="number"
              min={1}
              max={16}
              value={String(value.packets ?? 3)}
              onChange={(e) => patch({ packets: Number(toEnDigits(e.target.value)) })}
              dir="ltr"
            />
          </div>
        )}

        {(value.kind === "tcp" || value.kind === "udp") && (
          <div className="space-y-2">
            <Label htmlFor="port">پورت مقصد (۱ تا ۶۵۵۳۵)</Label>
            <Input
              id="port"
              type="number"
              min={1}
              max={65535}
              value={value.port ? String(value.port) : ""}
              onChange={(e) => patch({ port: Number(toEnDigits(e.target.value)) })}
              dir="ltr"
              placeholder="443"
              aria-invalid={!!portError}
            />
            {portError && (
              <p className="text-xs text-destructive">{portError}</p>
            )}
            {value.kind === "udp" && (
              <p className="text-xs text-muted-foreground">
                توجه: UDP بدون اتصال است؛ نبود پاسخ به‌تنهایی به‌معنای بسته بودن پورت نیست.
              </p>
            )}
            {value.kind === "tcp" && (
              <p className="text-xs text-muted-foreground">
                این تست از طریق Traceroute با پروتکل TCP روی پورت مقصد انجام می‌شود.
              </p>
            )}
          </div>
        )}

        {value.kind === "dns" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="recordType">نوع رکورد</Label>
              <Select
                value={value.recordType ?? "A"}
                onValueChange={(v) => patch({ recordType: v })}
              >
                <SelectTrigger id="recordType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "A",
                    "AAAA",
                    "ANY",
                    "CNAME",
                    "DNSKEY",
                    "DS",
                    "HTTPS",
                    "MX",
                    "NS",
                    "NSEC",
                    "PTR",
                    "RRSIG",
                    "SOA",
                    "TXT",
                    "SRV",
                    "SVCB",
                  ].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dnsProtocol">پروتکل</Label>
              <Select
                value={value.dnsProtocol ?? "UDP"}
                onValueChange={(v) => patch({ dnsProtocol: v as "TCP" | "UDP" })}
              >
                <SelectTrigger id="dnsProtocol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UDP">UDP</SelectItem>
                  <SelectItem value="TCP">TCP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="resolver">Resolver دل‌خواه (اختیاری)</Label>
              <Input
                id="resolver"
                value={value.resolver ?? ""}
                onChange={(e) => patch({ resolver: toEnDigits(e.target.value) })}
                placeholder="مثلاً 8.8.8.8 یا 1.1.1.1"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch
                id="trace"
                checked={!!value.trace}
                onCheckedChange={(c) => patch({ trace: c })}
              />
              <Label htmlFor="trace" className="text-sm">
                ردیابی مسیر تفویض (trace)
              </Label>
            </div>
          </>
        )}

        {value.kind === "http" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="httpProtocol">پروتکل</Label>
              <Select
                value={value.httpProtocol ?? "HTTPS"}
                onValueChange={(v) =>
                  patch({ httpProtocol: v as "HTTP" | "HTTPS" | "HTTP2" })
                }
              >
                <SelectTrigger id="httpProtocol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="HTTP2">HTTP/2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="httpMethod">روش</Label>
              <Select
                value={value.httpMethod ?? "HEAD"}
                onValueChange={(v) =>
                  patch({ httpMethod: v as "HEAD" | "GET" | "OPTIONS" })
                }
              >
                <SelectTrigger id="httpMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEAD">HEAD</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="httpPath">مسیر (Path)</Label>
              <Input
                id="httpPath"
                value={value.httpPath ?? ""}
                onChange={(e) => patch({ httpPath: e.target.value })}
                placeholder="/"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="httpHost">Host دل‌خواه (اختیاری)</Label>
              <Input
                id="httpHost"
                value={value.httpHost ?? ""}
                onChange={(e) => patch({ httpHost: e.target.value })}
                placeholder="example.com"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </>
        )}
      </div>

      {/* Location + limit */}
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label>موقعیت پروب</Label>
          <LocationSelector
  value={value.location}
  onChange={(l) => {
    // اگر کاربر لوکیشنی انتخاب کرد که شامل همه پروب‌هاست، limit را خودکار روی ۴ بگذار
    const isAllProbes = l?.label.includes("همه پروب‌ها");
    patch({ 
      location: l, 
      limit: isAllProbes ? 4 : 1 
    });
  }}
/>
          {value.location?.iran && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                ایران انتخاب شد
              </Badge>
              <span>پاسخ باید از پروب ایرانی برسد؛ در غیر این صورت به‌صورت صریح اعلام می‌شود.</span>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="limit">تعداد پروب</Label>
          <Input
            id="limit"
            type="number"
            min={1}
            max={50}
            value={String(value.limit ?? 1)}
            onChange={(e) => patch({ limit: Number(toEnDigits(e.target.value)) })}
            dir="ltr"
            className="w-28"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={!canSubmit} className="min-w-40">
          {isLoading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              در حال اجرا…
            </>
          ) : (
            <>
              <Send className="ml-2 h-4 w-4" />
              اجرای تست
            </>
          )}
        </Button>
        {!canSubmit && !isLoading && (
          <span className="text-xs text-muted-foreground">
            برای اجرای تست، مقصد و موقعیت را پر کنید.
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validation (client-side mirror of the server schemas)
// ---------------------------------------------------------------------------

const HOSTNAME_REGEX = /^(?=.{1,253}$)(([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)\.)+[a-z]{2,}$/i;
const IP_V4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_REGEX = /^([0-9a-f:]+)$/i;

function validateTarget(kind: TestKind, value: string): string | null {
  const v = value.trim();
  if (!v) return null; // Empty is allowed at this layer; submit button gates on it.
  if (kind === "http") {
    // Accept either http(s)://... or bare hostname
    const stripped = v.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    if (!isHostOrIp(stripped)) return "URL یا نام دامنه نامعتبر است";
    return null;
  }
  if (!isHostOrIp(v)) return "نام دامنه یا آدرس IP نامعتبر است";
  return null;
}

function isHostOrIp(v: string): boolean {
  if (IP_V4_REGEX.test(v)) {
    return v.split(".").map(Number).every((p) => p >= 0 && p <= 255);
  }
  if (IP_V6_REGEX.test(v) && v.includes(":")) return true;
  return HOSTNAME_REGEX.test(v);
}

function validatePort(port: number): string | null {
  if (!Number.isInteger(port)) return "پورت باید عدد صحیح باشد";
  if (port < 1 || port > 65535) return "پورت باید بین ۱ و ۶۵۵۳۵ باشد";
  return null;
}
