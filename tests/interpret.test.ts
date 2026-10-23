import { describe, expect, it } from "vitest";

import { interpretMeasurement } from "@/lib/globalping/interpret";
import type {
  MeasurementResponse,
  MeasurementResultEntry,
  ProbeResultInfo,
} from "@/lib/globalping/types";

function makeProbe(
  opts: Partial<ProbeResultInfo> = {},
): ProbeResultInfo {
  return {
    continent: "AS",
    region: "Southern Asia",
    country: opts.country ?? "IR",
    state: null,
    city: opts.city ?? "Tehran",
    asn: opts.asn ?? 59441,
    longitude: 51.42,
    latitude: 35.69,
    network: opts.network ?? "Hostiran Network",
    tags: opts.tags ?? ["datacenter-network"],
    resolvers: opts.resolvers ?? ["private"],
  };
}

function makePingResult(
  probe: Partial<ProbeResultInfo>,
  result: Record<string, unknown> = {},
): MeasurementResultEntry {
  return {
    probe: makeProbe(probe),
    result: {
      status: (result.status as string) ?? "finished",
      resolvedAddress: (result.resolvedAddress as string) ?? "1.1.1.1",
      resolvedHostname: (result.resolvedHostname as string) ?? "one.one.one.one",
      timings: (result.timings as never) ?? [{ ttl: 50, rtt: 81.7 }],
      stats: (result.stats as never) ?? { min: 81.282, max: 81.788, avg: 81.573, total: 4, loss: 0, rcv: 4, drop: 0 },
      rawOutput: (result.rawOutput as string) ?? "",
    } as MeasurementResultEntry["result"],
  };
}

function makeMeasurement(
  results: MeasurementResultEntry[],
  opts: Partial<MeasurementResponse> = {},
): MeasurementResponse {
  return {
    id: opts.id ?? "test-id",
    type: opts.type ?? "ping",
    status: opts.status ?? "finished",
    createdAt: opts.createdAt ?? new Date().toISOString(),
    updatedAt: opts.updatedAt ?? new Date().toISOString(),
    target: opts.target ?? "1.1.1.1",
    limit: opts.limit ?? 1,
    probesCount: opts.probesCount ?? results.length,
    results,
  };
}

describe("interpretMeasurement (ping)", () => {
  it("marks 0% loss as ok", () => {
    const m = makeMeasurement([
      makePingResult({ country: "IR" }, {
        status: "finished",
        stats: { total: 4, rcv: 4, loss: 0, min: 1, max: 2, avg: 1.5 },
      }),
    ]);
    const interp = interpretMeasurement(m, true, "ping");
    expect(interp.probes[0].outcome).toBe("ok");
    expect(interp.probes[0].iranVerified).toBe(true);
    expect(interp.usedIranProbe).toBe(true);
  });

  it("marks 100% loss as timeout", () => {
    const m = makeMeasurement([
      makePingResult({ country: "IR" }, {
        status: "finished",
        stats: { total: 4, rcv: 0, loss: 4, min: undefined, max: undefined, avg: undefined },
      }),
    ]);
    const interp = interpretMeasurement(m, true, "ping");
    expect(interp.probes[0].outcome).toBe("timeout");
    expect(interp.probes[0].statusLabel).toBe("بدون پاسخ");
  });

  it("flags when Iran was requested but no Iranian probe was used", () => {
    const m = makeMeasurement([
      makePingResult({ country: "DE", city: "Berlin", asn: 8560, network: "IONOS" }, {}),
    ]);
    const interp = interpretMeasurement(m, true, "ping");
    expect(interp.requestedIran).toBe(true);
    expect(interp.usedIranProbe).toBe(false);
  });

  it("marks partial loss as partial", () => {
    const m = makeMeasurement([
      makePingResult({}, {
        status: "finished",
        stats: { total: 4, rcv: 2, loss: 2, min: 1, max: 2, avg: 1.5 },
      }),
    ]);
    const interp = interpretMeasurement(m, true, "ping");
    expect(interp.probes[0].outcome).toBe("partial");
  });
});

describe("interpretMeasurement (traceroute TCP)", () => {
  it("marks reached destination as ok", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            resolvedAddress: "1.1.1.1",
            resolvedHostname: "one.one.one.one",
            hops: [
              { resolvedAddress: "10.0.0.1", timings: [{ rtt: 1 }] },
              { resolvedAddress: "1.1.1.1", timings: [{ rtt: 81 }] },
            ],
            rawOutput: "",
          },
        },
      ],
      { type: "traceroute" },
    );
    const interp = interpretMeasurement(m, true, "tcp");
    expect(interp.probes[0].outcome).toBe("ok");
    expect(interp.probes[0].statusLabel).toBe("اتصال برقرار شد");
  });

  it("marks unreachable destination as timeout", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            resolvedAddress: "1.1.1.1",
            resolvedHostname: "one.one.one.one",
            hops: [
              { resolvedAddress: "10.0.0.1", timings: [{ rtt: 1 }] },
              { anonymous: true, timings: [] },
              { anonymous: true, timings: [] },
            ],
            rawOutput: "",
          },
        },
      ],
      { type: "traceroute" },
    );
    const interp = interpretMeasurement(m, true, "tcp");
    expect(interp.probes[0].outcome).toBe("timeout");
  });
});

describe("interpretMeasurement (DNS)", () => {
  it("marks NOERROR with answers as ok", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            statusCode: 0,
            statusCodeName: "NOERROR",
            resolver: "8.8.8.8",
            answers: [
              { name: "cloudflare.com.", type: "A", ttl: 300, class: "IN", value: "104.16.132.229" },
            ],
            timings: { total: 74 },
          },
        },
      ],
      { type: "dns" },
    );
    const interp = interpretMeasurement(m, true, "dns");
    expect(interp.probes[0].outcome).toBe("ok");
    expect(interp.probes[0].statusLabel).toBe("پاسخ DNS دریافت شد");
  });

  it("marks NXDOMAIN as failed-dns", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            statusCode: 3,
            statusCodeName: "NXDOMAIN",
            answers: [],
          },
        },
      ],
      { type: "dns" },
    );
    const interp = interpretMeasurement(m, true, "dns");
    expect(interp.probes[0].outcome).toBe("failed-dns");
  });
});

describe("interpretMeasurement (HTTP)", () => {
  it("marks 2xx HTTP status as ok", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            statusCode: 200,
            statusCodeName: "OK",
            timings: { total: 100, dns: 5, tcp: 10, tls: 30, firstByte: 50, download: 5 },
          },
        },
      ],
      { type: "http" },
    );
    const interp = interpretMeasurement(m, true, "http");
    expect(interp.probes[0].outcome).toBe("ok");
    expect(interp.probes[0].statusLabel).toBe("HTTP 200");
  });

  it("marks 4xx HTTP status as ok (server answered)", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            statusCode: 404,
            statusCodeName: "Not Found",
          },
        },
      ],
      { type: "http" },
    );
    const interp = interpretMeasurement(m, true, "http");
    expect(interp.probes[0].outcome).toBe("ok");
  });

  it("marks connection failure as failed-connect", () => {
    const m = makeMeasurement(
      [
        {
          probe: makeProbe(),
          result: {
            status: "finished",
            failureSource: "connection-refused",
          },
        },
      ],
      { type: "http" },
    );
    const interp = interpretMeasurement(m, true, "http");
    expect(interp.probes[0].outcome).toBe("failed-connect");
  });
});
