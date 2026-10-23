import "server-only";

import { PROBE_CACHE_TTL_SECONDS } from "./config";
import { fetchProbesRaw } from "./client";
import type { Probe } from "./types";

// ---------------------------------------------------------------------------
// In-memory TTL cache (server module singleton)
// ---------------------------------------------------------------------------

interface CacheEntry {
  probes: Probe[];
  fetchedAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

let cache: CacheEntry | null = null;
let inflight: Promise<Probe[]> | null = null;

function nowMs(): number {
  return Date.now();
}

function isFresh(entry: CacheEntry | null): entry is CacheEntry {
  return entry !== null && entry.expiresAt > nowMs();
}

/**
 * Returns the cached probe list if still fresh, otherwise fetches a new one.
 * Concurrent callers share a single inflight request to avoid duplicate
 * Globalping calls during cache misses.
 *
 * Network failures are NOT cached — if the last fetch failed, the next call
 * will retry.
 */
export async function getProbes(forceRefresh = false): Promise<Probe[]> {
  if (!forceRefresh && isFresh(cache)) {
    return cache!.probes;
  }
  if (inflight) {
    return inflight;
  }
  inflight = (async () => {
    try {
      const probes = await fetchProbesRaw();
      cache = {
        probes,
        fetchedAt: nowMs(),
        expiresAt: nowMs() + PROBE_CACHE_TTL_SECONDS * 1000,
      };
      return probes;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Test-only helper to inject a fake cache. */
export function _setCacheForTest(probes: Probe[], ttlSeconds: number): void {
  cache = {
    probes,
    fetchedAt: nowMs(),
    expiresAt: nowMs() + ttlSeconds * 1000,
  };
}

export function _clearCacheForTest(): void {
  cache = null;
  inflight = null;
}

/** Returns metadata about the current cache (for the debug panel). */
export function getCacheInfo(): {
  fresh: boolean;
  fetchedAt: number | null;
  expiresAt: number | null;
  count: number;
} {
  return {
    fresh: isFresh(cache),
    fetchedAt: cache?.fetchedAt ?? null,
    expiresAt: cache?.expiresAt ?? null,
    count: cache?.probes.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Aggregation — group probes by country / city / ASN for the UI
// ---------------------------------------------------------------------------

export interface CountryGroup {
  countryCode: string;
  countryName: string; // Persian-friendly name; falls back to code
  probeCount: number;
  cities: CityGroup[];
  networks: NetworkGroup[];
  /** True if at least one probe in the country is tagged eyeball-network. */
  hasEyeball: boolean;
  /** True if at least one probe in the country is tagged datacenter-network. */
  hasDatacenter: boolean;
}

export interface CityGroup {
  city: string;
  countryCode: string;
  probeCount: number;
  networks: NetworkGroup[];
}

export interface NetworkGroup {
  network: string;
  asn: number;
  countryCode: string;
  city: string;
  /** Raw probe tags (e.g. "eyeball-network", "datacenter-network"). */
  tags: string[];
  probeCount: number;
}

/**
 * Returns true if a probe should be considered "online" — i.e. present in
 * the public probe list. Globalping does not include offline probes in the
 * public list, so this is implicit.
 */
export function isProbeOnline(_probe: Probe): boolean {
  // Globalping includes only routable probes in /v1/probes. We expose this
  // function so the UI code can express intent without making assumptions.
  return true;
}

export function groupProbes(probes: Probe[]): CountryGroup[] {
  const byCountry = new Map<string, Probe[]>();
  for (const p of probes) {
    const c = p.location.country;
    if (!c) continue;
    const list = byCountry.get(c) ?? [];
    list.push(p);
    byCountry.set(c, list);
  }
  const countries: CountryGroup[] = [];
  for (const [countryCode, list] of byCountry) {
    const cities = groupByCity(list, countryCode);
    const networks = list.flatMap((p) =>
      (p.location.network && p.location.asn
        ? [{
            network: p.location.network as string,
            asn: p.location.asn as number,
            countryCode,
            city: p.location.city ?? "",
            tags: p.tags,
            probeCount: 1,
          }]
        : []),
    );
    countries.push({
      countryCode,
      countryName: COUNTRY_NAMES_FA[countryCode] ?? countryCode,
      probeCount: list.length,
      cities,
      networks: mergeNetworks(networks),
      hasEyeball: list.some((p) => p.tags.includes("eyeball-network")),
      hasDatacenter: list.some((p) => p.tags.includes("datacenter-network")),
    });
  }
  countries.sort((a, b) => b.probeCount - a.probeCount);
  return countries;
}

function groupByCity(probes: Probe[], countryCode: string): CityGroup[] {
  const byCity = new Map<string, Probe[]>();
  for (const p of probes) {
    const city = p.location.city;
    if (!city) continue;
    const list = byCity.get(city) ?? [];
    list.push(p);
    byCity.set(city, list);
  }
  const out: CityGroup[] = [];
  for (const [city, list] of byCity) {
    const nets = list.flatMap((p) =>
      (p.location.network && p.location.asn
        ? [{
            network: p.location.network as string,
            asn: p.location.asn as number,
            countryCode,
            city,
            tags: p.tags,
            probeCount: 1,
          }]
        : []),
    );
    out.push({
      city,
      countryCode,
      probeCount: list.length,
      networks: mergeNetworks(nets),
    });
  }
  out.sort((a, b) => b.probeCount - a.probeCount);
  return out;
}

function mergeNetworks(items: NetworkGroup[]): NetworkGroup[] {
  const byKey = new Map<string, NetworkGroup>();
  for (const n of items) {
    const key = `${n.asn}|${n.network}|${n.city}`;
    const existing = byKey.get(key);
    if (existing) existing.probeCount += n.probeCount;
    else byKey.set(key, { ...n });
  }
  return [...byKey.values()].sort((a, b) => b.probeCount - a.probeCount);
}

// ---------------------------------------------------------------------------
// Persian (فارسی) country names — minimal map, focused on the countries
// users are most likely to test from. For anything else, the ISO code is
// displayed verbatim.
// ---------------------------------------------------------------------------

export const COUNTRY_NAMES_FA: Record<string, string> = {
  IR: "ایران",
  US: "ایالات متحده",
  DE: "آلمان",
  NL: "هلند",
  GB: "بریتانیا",
  FR: "فرانسه",
  BR: "برزیل",
  RU: "روسیه",
  SG: "سنگاپور",
  JP: "ژاپن",
  CA: "کانادا",
  AU: "استرالیا",
  IN: "هند",
  CN: "چین",
  HK: "هنگ‌کنگ",
  KR: "کره جنوبی",
  TR: "ترکیه",
  AE: "امارات",
  SA: "عربستان سعودی",
  IL: "اسرائیل",
  EG: "مصر",
  ZA: "آفریقای جنوبی",
  NG: "نیجریه",
  KE: "کنیا",
  MX: "مکزیک",
  AR: "آرژانتین",
  CL: "شیلی",
  CO: "کلمبیا",
  PE: "پرو",
  IT: "ایتالیا",
  ES: "اسپانیا",
  PT: "پرتغال",
  CH: "سوئیس",
  AT: "اتریش",
  BE: "بلژیک",
  SE: "سوئد",
  NO: "نروژ",
  FI: "فنلاند",
  DK: "دانمارک",
  PL: "لهستان",
  CZ: "چک",
  RO: "رومانی",
  UA: "اوکراین",
  GR: "یونان",
  IE: "ایرلند",
  TH: "تایلند",
  VN: "ویتنام",
  ID: "اندونزی",
  MY: "مالزی",
  PH: "فیلیپین",
  NZ: "نیوزیلند",
  PK: "پاکستان",
  BD: "بنگلادش",
  LK: "سری‌لانکا",
  AZ: "آذربایجان",
  AM: "ارمنستان",
  GE: "گرجستان",
  KZ: "قزاقستان",
  UZ: "ازبکستان",
  TJ: "تاجیکستان",
  TM: "ترکمنستان",
  KG: "قرقیزستان",
  AF: "افغانستان",
  IQ: "عراق",
  JO: "اردن",
  LB: "لبنان",
  SY: "سوریه",
  KW: "کویت",
  QA: "قطر",
  BH: "بحرین",
  OM: "عمان",
  YE: "یمن",
  TU: "تونس",
  DZ: "الجزایر",
  MA: "مراکش",
  LY: "لیبی",
  SD: "سودان",
};
