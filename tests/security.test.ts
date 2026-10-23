import { describe, expect, it } from "vitest";

import { checkDestination, isPrivateIP } from "@/lib/globalping/security";

describe("isPrivateIP", () => {
  it("flags IPv4 private ranges", () => {
    expect(isPrivateIP("10.0.0.1")).toBe(true);
    expect(isPrivateIP("172.16.5.5")).toBe(true);
    expect(isPrivateIP("192.168.1.1")).toBe(true);
    expect(isPrivateIP("127.0.0.1")).toBe(true);
    expect(isPrivateIP("169.254.169.254")).toBe(true);
    expect(isPrivateIP("100.64.0.1")).toBe(true); // CGNAT
  });

  it("allows public IPv4 addresses", () => {
    expect(isPrivateIP("1.1.1.1")).toBe(false);
    expect(isPrivateIP("8.8.8.8")).toBe(false);
    expect(isPrivateIP("217.218.127.127")).toBe(false);
  });

  it("flags IPv6 loopback and link-local", () => {
    expect(isPrivateIP("::1")).toBe(true);
    expect(isPrivateIP("fe80::1")).toBe(true);
    expect(isPrivateIP("fc00::1")).toBe(true);
  });

  it("allows public IPv6 addresses", () => {
    expect(isPrivateIP("2606:4700:4700::1111")).toBe(false);
  });
});

describe("checkDestination", () => {
  it("accepts public hostname", () => {
    expect(checkDestination("example.com").ok).toBe(true);
  });

  it("accepts public IP", () => {
    expect(checkDestination("1.1.1.1").ok).toBe(true);
  });

  it("rejects empty", () => {
    expect(checkDestination("").ok).toBe(false);
  });

  it("rejects AWS metadata endpoint", () => {
    expect(checkDestination("169.254.169.254").ok).toBe(false);
    expect(checkDestination("metadata.google.internal").ok).toBe(false);
  });

  it("rejects private IPv4", () => {
    expect(checkDestination("10.0.0.1").ok).toBe(false);
    expect(checkDestination("127.0.0.1").ok).toBe(false);
  });

  it("rejects IPv6 loopback", () => {
    expect(checkDestination("::1").ok).toBe(false);
  });
});
