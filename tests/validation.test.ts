import { describe, expect, it } from "vitest";

import {
  dnsRequestSchema,
  httpRequestSchema,
  pingRequestSchema,
  tcpRequestSchema,
  udpRequestSchema,
} from "@/lib/globalping/validation";

describe("pingRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    const r = pingRequestSchema.parse({
      kind: "ping",
      target: "1.1.1.1",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.target).toBe("1.1.1.1");
    expect(r.limit).toBe(1);
  });

  it("rejects an empty target", () => {
    const r = pingRequestSchema.safeParse({
      kind: "ping",
      target: "",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a target with invalid characters", () => {
    const r = pingRequestSchema.safeParse({
      kind: "ping",
      target: "this is not a host name",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects limit over 50", () => {
    const r = pingRequestSchema.safeParse({
      kind: "ping",
      target: "1.1.1.1",
      locations: [{ country: "IR" }],
      limit: 999,
    });
    expect(r.success).toBe(false);
  });

  it("rejects packets > 16", () => {
    const r = pingRequestSchema.safeParse({
      kind: "ping",
      target: "1.1.1.1",
      locations: [{ country: "IR" }],
      limit: 1,
      packets: 99,
    });
    expect(r.success).toBe(false);
  });

  it("accepts IPv6 target", () => {
    const r = pingRequestSchema.safeParse({
      kind: "ping",
      target: "2606:4700:4700::1111",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(true);
  });

  it("accepts hostname target with subdomain", () => {
    const r = pingRequestSchema.safeParse({
      kind: "ping",
      target: "api.example.com",
      locations: [{ country: "DE" }],
      limit: 1,
    });
    expect(r.success).toBe(true);
  });
});

describe("tcpRequestSchema", () => {
  it("accepts valid port range", () => {
    const r = tcpRequestSchema.parse({
      kind: "tcp",
      target: "1.1.1.1",
      port: 443,
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.port).toBe(443);
  });

  it("rejects port 0", () => {
    const r = tcpRequestSchema.safeParse({
      kind: "tcp",
      target: "1.1.1.1",
      port: 0,
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(false);
  });

  it("rejects port > 65535", () => {
    const r = tcpRequestSchema.safeParse({
      kind: "tcp",
      target: "1.1.1.1",
      port: 70000,
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe("udpRequestSchema", () => {
  it("accepts DNS port 53", () => {
    const r = udpRequestSchema.parse({
      kind: "udp",
      target: "8.8.8.8",
      port: 53,
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.port).toBe(53);
  });
});

describe("dnsRequestSchema", () => {
  it("accepts minimal DNS request", () => {
    const r = dnsRequestSchema.parse({
      kind: "dns",
      target: "cloudflare.com",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.recordType).toBe("A");
    expect(r.protocol).toBe("UDP");
    expect(r.trace).toBe(false);
  });

  it("accepts custom resolver", () => {
    const r = dnsRequestSchema.parse({
      kind: "dns",
      target: "cloudflare.com",
      resolver: "1.1.1.1",
      recordType: "AAAA",
      protocol: "TCP",
      trace: true,
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.resolver).toBe("1.1.1.1");
    expect(r.recordType).toBe("AAAA");
    expect(r.protocol).toBe("TCP");
    expect(r.trace).toBe(true);
  });

  it("rejects unsupported record type", () => {
    const r = dnsRequestSchema.safeParse({
      kind: "dns",
      target: "cloudflare.com",
      recordType: "FOO",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(false);
  });
});

describe("httpRequestSchema", () => {
  it("accepts HTTPS by default", () => {
    const r = httpRequestSchema.parse({
      kind: "http",
      target: "example.com",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.protocol).toBe("HTTPS");
    expect(r.method).toBe("HEAD");
  });

  it("accepts HTTP/2 and GET", () => {
    const r = httpRequestSchema.parse({
      kind: "http",
      target: "example.com",
      protocol: "HTTP2",
      method: "GET",
      path: "/api/v1",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.protocol).toBe("HTTP2");
    expect(r.method).toBe("GET");
  });

  it("rejects path without leading / or ?", () => {
    const r = httpRequestSchema.safeParse({
      kind: "http",
      target: "example.com",
      path: "invalid-path",
      locations: [{ country: "IR" }],
      limit: 1,
    });
    expect(r.success).toBe(false);
  });
});
