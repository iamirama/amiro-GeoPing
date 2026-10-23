import { describe, expect, it, beforeEach } from "vitest";

import { _clearCacheForTest, _setCacheForTest, getCacheInfo, groupProbes } from "@/lib/globalping/probes";
import type { Probe } from "@/lib/globalping/types";

function makeProbe(opts: {
  country?: string | null;
  city?: string | null;
  asn?: number | null;
  network?: string | null;
  tags?: string[];
}): Probe {
  const tags = opts.tags ?? ["datacenter-network"];
  return {
    version: "0.53.0",
    location: {
      continent: "AS",
      region: "Southern Asia",
      country: opts.country ?? "IR",
      state: null,
      city: opts.city ?? "Tehran",
      asn: opts.asn ?? 59441,
      latitude: 35.69,
      longitude: 51.42,
      network: opts.network ?? "Hostiran Network",
    },
    tags: tags.includes("datacenter-network")
      ? tags
      : ["datacenter-network", ...tags],
    resolvers: ["private"],
  };
}

describe("groupProbes", () => {
  it("groups probes by country", () => {
    const probes = [
      makeProbe({ country: "IR", city: "Tehran", asn: 59441, network: "Hostiran" }),
      makeProbe({ country: "IR", city: "Tehran", asn: 58224, network: "TCI" }),
      makeProbe({ country: "DE", city: "Berlin", asn: 8560, network: "IONOS" }),
    ];
    const groups = groupProbes(probes);
    expect(groups).toHaveLength(2);
    expect(groups[0].countryCode).toBe("IR");
    expect(groups[0].probeCount).toBe(2);
    expect(groups[0].cities).toHaveLength(1);
    expect(groups[0].cities[0].networks).toHaveLength(2);
  });

  it("keeps Iran at the top by probe count", () => {
    const probes = [
      makeProbe({ country: "IR", city: "Tehran", asn: 59441, network: "Hostiran" }),
      makeProbe({ country: "IR", city: "Tehran", asn: 58224, network: "TCI" }),
      makeProbe({ country: "US", city: "Fremont", asn: 7247, network: "Mojo" }),
    ];
    const groups = groupProbes(probes);
    expect(groups[0].countryCode).toBe("IR");
  });
});

describe("probe cache", () => {
  beforeEach(() => {
    _clearCacheForTest();
  });

  it("reports stale cache after clear", () => {
    const info = getCacheInfo();
    expect(info.fresh).toBe(false);
    expect(info.count).toBe(0);
  });

  it("reports fresh cache after set", () => {
    _setCacheForTest([makeProbe({ country: "IR" })], 60);
    const info = getCacheInfo();
    expect(info.fresh).toBe(true);
    expect(info.count).toBe(1);
  });

  it("reports stale cache after TTL passes", () => {
    _setCacheForTest([makeProbe({ country: "IR" })], -1);
    const info = getCacheInfo();
    expect(info.fresh).toBe(false);
  });
});
