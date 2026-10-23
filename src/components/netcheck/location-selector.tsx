"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, MapPin, Network, RefreshCw, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toEnDigits } from "@/lib/globalping/format";
import type { CountryGroup } from "@/lib/globalping/probes";
import type { MeasurementLocationOption } from "@/lib/globalping/types";

export interface SelectedLocation {
  label: string;
  location: MeasurementLocationOption;
  /** True when this location was specifically an Iranian one. */
  iran: boolean;
}

interface ProbesApiResponse {
  ok: boolean;
  totalProbes?: number;
  countries?: CountryGroup[];
  cache?: { fresh: boolean; fetchedAt: number | null; count: number };
  error?: { message?: string };
}

interface LocationSelectorProps {
  value: SelectedLocation | null;
  onChange: (v: SelectedLocation | null) => void;
}

export function LocationSelector({ value, onChange }: LocationSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryGroup[]>([]);
  const [totalProbes, setTotalProbes] = useState<number | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{
    fresh: boolean;
    fetchedAt: number | null;
  } | null>(null);

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/probes${force ? "?force=1" : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as ProbesApiResponse | null;
          throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as ProbesApiResponse;
        setCountries(data.countries ?? []);
        setTotalProbes(data.totalProbes ?? null);
        setCacheInfo(
          data.cache
            ? { fresh: data.cache.fresh, fetchedAt: data.cache.fetchedAt }
            : null,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "خطا در بارگذاری پروب‌ها");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (open && countries.length === 0 && !loading) {
      void load();
    }
  }, [open, countries.length, loading, load]);

  const iranGroup = useMemo(
    () => countries.find((c) => c.countryCode === "IR") ?? null,
    [countries],
  );
  const otherGroups = useMemo(
    () => countries.filter((c) => c.countryCode !== "IR"),
    [countries],
  );

  const filteredIran = useMemo(
    () => filterGroup(iranGroup, query),
    [iranGroup, query],
  );
  const filteredOthers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return otherGroups;
    return otherGroups
      .map((g) => filterGroup(g, q))
      .filter((g) => g.probeCount > 0 || g.cities.length > 0 || g.networks.length > 0);
  }, [otherGroups, query]);

  function handleSelect(loc: SelectedLocation) {
    onChange(loc);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="flex gap-2">
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            type="button"
          >
            <span className="flex items-center gap-2 truncate">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              {value ? value.label : "انتخاب موقعیت پروب…"}
            </span>
          </Button>
        </PopoverTrigger>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(null)}
            aria-label="پاک کردن موقعیت"
            type="button"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      <PopoverContent
        className="w-[min(560px,95vw)] p-0 bg-background border shadow-lg z-50"
          align="start"
          >
        <div className="flex items-center gap-2 border-b p-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(toEnDigits(e.target.value))}
            placeholder="جست‌وجوی کشور، شهر، یا شبکه…"
            className="h-8 border-0 shadow-none focus-visible:ring-0"
            aria-label="جست‌وجوی موقعیت"
          />
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            aria-label="به‌روزرسانی فهرست پروب‌ها"
            title="به‌روزرسانی فهرست پروب‌ها از سرور Globalping"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            <span className="sr-only">به‌روزرسانی</span>
          </Button>
        </div>
        <ScrollArea className="netcheck-scroll max-h-96">
          <div className="p-2">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mr-2 h-7 px-2"
                  type="button"
                  onClick={() => load(true)}
                >
                  تلاش دوباره
                </Button>
              </div>
            )}
            {!error && loading && countries.length === 0 && (
              <div className="space-y-2 p-2 text-sm text-muted-foreground">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}
            {!error && !loading && countries.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                هیچ پروبی در دسترس نیست. دکمه به‌روزرسانی را بزنید یا چند
                لحظه دیگر تلاش کنید.
              </div>
            )}

            {/* Iran — always pinned at the top, even if zero probes */}
            {iranGroup ? (
              <GroupBlock
                group={iranGroup}
                filtered={filteredIran}
                onPick={handleSelect}
                pinned
              />
            ) : (
              !loading && countries.length > 0 && (
                <div className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <div className="font-medium">ایران در حال حاضر پروب آنلاینی ندارد.</div>
                  <div className="text-xs mt-1">
                    پروب‌های ایرانی در لحظه‌ای از فهرست خارج شده‌اند. می‌توانید
                    با دکمه به‌روزرسانی دوباره بررسی کنید.
                  </div>
                </div>
              )
            )}

            {/* Other countries */}
            {filteredOthers.map((g) => (
              <GroupBlock key={g.countryCode} group={g} filtered={g} onPick={handleSelect} />
            ))}
          </div>
        </ScrollArea>
        {totalProbes !== null && (
          <div className="border-t p-2 text-xs text-muted-foreground flex items-center justify-between">
            <span>
              {totalProbes.toLocaleString("fa-IR")} پروب آنلاین از{" "}
              {countries.length.toLocaleString("fa-IR")} کشور
            </span>
            {cacheInfo && (
              <span>
                {cacheInfo.fresh ? "کش تازه" : "کش قدیمی"} — در صورت نیاز
                به‌روزرسانی کنید
              </span>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterGroup(group: CountryGroup | null, query: string): CountryGroup {
  if (!group) return {} as CountryGroup;
  const q = query.trim().toLowerCase();
  if (!q) return group;
  const countryMatch =
    group.countryCode.toLowerCase().includes(q) ||
    group.countryName.toLowerCase().includes(q);
  const cities = group.cities.filter(
    (c) =>
      countryMatch ||
      c.city.toLowerCase().includes(q) ||
      c.networks.some((n) => n.network.toLowerCase().includes(q) || String(n.asn).includes(q)),
  );
  const networks = group.networks.filter(
    (n) =>
      countryMatch ||
      n.network.toLowerCase().includes(q) ||
      String(n.asn).includes(q),
  );
  return {
    ...group,
    probeCount: countryMatch ? group.probeCount : cities.reduce((s, c) => s + c.probeCount, 0),
    cities: countryMatch ? group.cities : cities,
    networks: countryMatch ? group.networks : networks,
  };
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupBlock
// ---------------------------------------------------------------------------

interface GroupBlockProps {
  group: CountryGroup;
  filtered: CountryGroup;
  onPick: (loc: SelectedLocation) => void;
  pinned?: boolean;
}

function GroupBlock({ group, filtered, onPick, pinned }: GroupBlockProps) {
  const [expanded, setExpanded] = useState(false);
  if (filtered.probeCount === 0 && filtered.cities.length === 0 && filtered.networks.length === 0) {
    return null;
  }
  const iran = group.countryCode === "IR";
  return (
    <div
      className={cn(
        "mb-2 rounded-md border",
        pinned
          ? "border-emerald-500/50 bg-emerald-500/5"
          : "border-border bg-card",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between p-2 text-right hover:bg-accent/50"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">
            {group.countryName}
            {pinned && (
              <Badge variant="secondary" className="mr-2 bg-emerald-600 text-white">
                اولویت‌دار
              </Badge>
            )}
          </span>
          {iran && (
            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-500/40">
              ایران
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {group.probeCount.toLocaleString("fa-IR")} پروب
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {expanded ? "بستن" : "گسترش"}
        </span>
      </button>
      {expanded && (
        <div className="border-t px-2 py-2">
          <button
            type="button"
            onClick={() =>
              onPick({
                label: `${group.countryName} — همه پروب‌ها`,
                location: { country: group.countryCode },
                iran,
              })
            }
            className="mb-2 flex w-full items-center justify-between rounded-md p-2 text-sm hover:bg-accent/60"
          >
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              همه پروب‌های آنلاین در {group.countryName}
            </span>
            <Badge variant="secondary">{group.probeCount.toLocaleString("fa-IR")} پروب</Badge>
          </button>
          {filtered.cities.length > 0 && (
            <div className="mb-2">
              <div className="px-2 pb-1 text-xs text-muted-foreground">شهرها</div>
              {filtered.cities.map((c) => (
                <CityRow key={`${c.countryCode}-${c.city}`} city={c} onPick={onPick} iran={iran} />
              ))}
            </div>
          )}
          {filtered.networks.length > 0 && (
            <div>
              <div className="px-2 pb-1 text-xs text-muted-foreground">شبکه‌ها (ASN)</div>
              {filtered.networks.slice(0, 20).map((n) => (
                <button
                  key={`${n.countryCode}-${n.asn}-${n.network}-${n.city}`}
                  type="button"
                  onClick={() =>
                    onPick({
                      label: `${n.network} — ASN ${n.asn.toLocaleString("fa-IR")} (${group.countryName}${n.city ? `، ${n.city}` : ""})`,
                      location: {
                        country: n.countryCode,
                        asn: n.asn,
                        network: n.network,
                      },
                      iran,
                    })
                  }
                  className="mb-1 flex w-full items-center justify-between rounded-md p-2 text-sm hover:bg-accent/60"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{n.network}</span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="tnum">ASN {n.asn.toLocaleString("fa-IR")}</Badge>
                    {n.city && <span>{n.city}</span>}
                    <span>{n.probeCount.toLocaleString("fa-IR")} پروب</span>
                  </span>
                </button>
              ))}
              {filtered.networks.length > 20 && (
                <div className="px-2 text-xs text-muted-foreground">
                  و {filtered.networks.length - 20} شبکه دیگر — برای کاهش دقیق‌تر جست‌وجو کنید.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CityRow({
  city,
  onPick,
  iran,
}: {
  city: CountryGroup["cities"][number];
  onPick: (loc: SelectedLocation) => void;
  iran: boolean;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          onPick({
            label: `${city.city} — همه پروب‌ها (${city.countryCode})`,
            location: { country: city.countryCode, city: city.city },
            iran,
          })
        }
        className="flex w-full items-center justify-between rounded-md p-2 text-sm hover:bg-accent/60"
      >
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {city.city}
        </span>
        <Badge variant="secondary">{city.probeCount.toLocaleString("fa-IR")} پروب</Badge>
      </button>
      {city.networks.map((n) => (
        <button
          key={`${city.countryCode}-${city.city}-${n.asn}-${n.network}`}
          type="button"
          onClick={() =>
            onPick({
              label: `${n.network} — ASN ${n.asn.toLocaleString("fa-IR")} (${city.city}، ${city.countryCode})`,
              location: {
                country: city.countryCode,
                city: city.city,
                asn: n.asn,
                network: n.network,
              },
              iran,
            })
          }
          className="mr-4 mb-1 flex w-[calc(100%-1rem)] items-center justify-between rounded-md p-1.5 text-sm hover:bg-accent/40"
        >
          <span className="flex items-center gap-2 truncate text-muted-foreground">
            <Network className="h-3.5 w-3.5" />
            <span className="truncate">{n.network}</span>
          </span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="tnum">ASN {n.asn.toLocaleString("fa-IR")}</Badge>
            <Check className="h-3 w-3 opacity-0" />
          </span>
        </button>
      ))}
    </div>
  );
}
