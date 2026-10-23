import { z } from "zod";

import { GLOBALPING_LIMITS } from "./config";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

const PORT_RANGE = {
  min: GLOBALPING_LIMITS.portMin,
  max: GLOBALPING_LIMITS.portMax,
};

const HOSTNAME_REGEX = /^(?=.{1,253}$)(([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)\.)+[a-z]{2,}$/i;
const IP_V4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_REGEX = /^([0-9a-f:]+)$/i;

const destinationSchema = z
  .string()
  .trim()
  .min(1, "مقصد خالی است")
  .max(253, "مقصد بیش از حد طولانی است")
  .superRefine((val, ctx) => {
    if (IP_V4_REGEX.test(val)) {
      const parts = val.split(".").map(Number);
      if (parts.some((p) => p < 0 || p > 255)) {
        ctx.addIssue({ code: "custom", message: "IPv4 نامعتبر است" });
      }
      return;
    }
    if (IP_V6_REGEX.test(val) && val.includes(":")) {
      return; // Accept any bracket-free IPv6 string; full validation will happen on the API side.
    }
    if (!HOSTNAME_REGEX.test(val)) {
      ctx.addIssue({
        code: "custom",
        message: "نام دامنه یا آدرس IP نامعتبر است",
      });
    }
  });

const portSchema = z
  .number({ message: "پورت باید عدد باشد" })
  .int("پورت باید عدد صحیح باشد")
  .min(PORT_RANGE.min, `پورت باید بین ${PORT_RANGE.min} و ${PORT_RANGE.max} باشد`)
  .max(PORT_RANGE.max, `پورت باید بین ${PORT_RANGE.min} و ${PORT_RANGE.max} باشد`);

const limitSchema = z
  .number()
  .int()
  .min(GLOBALPING_LIMITS.limitMin, `تعداد سرور باید حداقل ${GLOBALPING_LIMITS.limitMin} باشد`)
  .max(50, "تعداد سرور بیش از حد زیاد است — حداکثر ۵۰ سرور در هر درخواست")
  .default(1);

const packetsSchema = z
  .number()
  .int()
  .min(GLOBALPING_LIMITS.packetsMin, `تعداد بسته باید حداقل ${GLOBALPING_LIMITS.packetsMin} باشد`)
  .max(GLOBALPING_LIMITS.packetsMax, `تعداد بسته حداکثر ${GLOBALPING_LIMITS.packetsMax} است`)
  .default(3);

const dnsRecordTypeSchema = z.enum([
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
]);

const httpProtocolSchema = z.enum(["HTTP", "HTTPS", "HTTP2"]);
const httpMethodSchema = z.enum(["HEAD", "GET", "OPTIONS"]);

// ---------------------------------------------------------------------------
// Location filter
// ---------------------------------------------------------------------------

const locationLimitSchema = z
  .number()
  .int()
  .min(GLOBALPING_LIMITS.limitMin, `تعداد سرور باید حداقل ${GLOBALPING_LIMITS.limitMin} باشد`)
  .max(50, "تعداد سرور بیش از حد زیاد است — حداکثر ۵۰ سرور در هر درخواست");

const locationSchema = z
  .object({
    country: z.string().regex(/^[A-Z]{2}$/, "کد کشور باید دو حرف باشد").optional(),
    continent: z.enum(["AF", "AN", "AS", "EU", "NA", "OC", "SA"]).optional(),
    region: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    asn: z.number().int().positive().max(4294967295).optional(),
    network: z.string().max(120).optional(),
    state: z.string().regex(/^[A-Z]{2}$/, "کد ایالت باید دو حرف باشد").optional(),
    tags: z.array(z.string().max(60)).max(10).optional(),
    magic: z.string().max(120).optional(),
    /** Per-location probe count. When set on a location alongside the
     *  top-level `limit`, Globalping rejects the request with 422, so we
     *  strip this field when forwarding. Kept optional for forward
     *  compatibility and for use by callers that omit the global limit. */
    limit: locationLimitSchema.optional(),
  })
  .refine((v) => v.country || v.continent || v.region || v.city || v.asn || v.network || v.tags || v.magic, {
    message: "حداقل یکی از فیلدهای موقعیت باید مقدار داشته باشد",
  });

// ---------------------------------------------------------------------------
// Per-test-type request bodies. We use a "kind" discriminator at the
// app-level so we can distinguish TCP vs UDP (both map to type=traceroute
// on the Globalping API).
// ---------------------------------------------------------------------------

export const pingRequestSchema = z.object({
  kind: z.literal("ping"),
  target: destinationSchema,
  locations: z.array(locationSchema).min(1, "حداقل یک موقعیت انتخاب کنید").max(5),
  limit: limitSchema,
  packets: packetsSchema.optional(),
  ipVersion: z.union([z.literal(4), z.literal(6)]).optional(),
});

export const tcpRequestSchema = z.object({
  kind: z.literal("tcp"),
  target: destinationSchema,
  port: portSchema,
  locations: z.array(locationSchema).min(1, "حداقل یک موقعیت انتخاب کنید").max(5),
  limit: limitSchema,
  ipVersion: z.union([z.literal(4), z.literal(6)]).optional(),
});

export const udpRequestSchema = z.object({
  kind: z.literal("udp"),
  target: destinationSchema,
  port: portSchema,
  locations: z.array(locationSchema).min(1, "حداقل یک موقعیت انتخاب کنید").max(5),
  limit: limitSchema,
  ipVersion: z.union([z.literal(4), z.literal(6)]).optional(),
});

export const dnsRequestSchema = z.object({
  kind: z.literal("dns"),
  target: destinationSchema,
  recordType: dnsRecordTypeSchema.default("A"),
  protocol: z.enum(["TCP", "UDP"]).default("UDP"),
  resolver: z
    .string()
    .trim()
    .max(253)
    .optional()
    .superRefine((val, ctx) => {
      if (!val) return;
      if (IP_V4_REGEX.test(val)) {
        const parts = val.split(".").map(Number);
        if (parts.some((p) => p < 0 || p > 255)) {
          ctx.addIssue({ code: "custom", message: "IPv4 resolver نامعتبر است" });
        }
        return;
      }
      if (IP_V6_REGEX.test(val) && val.includes(":")) return;
      if (!HOSTNAME_REGEX.test(val)) {
        ctx.addIssue({ code: "custom", message: "resolver نامعتبر است" });
      }
    }),
  trace: z.boolean().default(false),
  locations: z.array(locationSchema).min(1, "حداقل یک موقعیت انتخاب کنید").max(5),
  limit: limitSchema,
});

export const httpRequestSchema = z.object({
  kind: z.literal("http"),
  target: destinationSchema,
  protocol: httpProtocolSchema.default("HTTPS"),
  port: portSchema.optional(),
  method: httpMethodSchema.default("HEAD"),
  path: z
    .string()
    .max(2048)
    .optional()
    .refine((v) => !v || v.startsWith("/") || v.startsWith("?"), {
      message: "مسیر باید با / یا ? شروع شود",
    }),
  query: z.string().max(1024).optional(),
  host: z.string().max(253).optional(),
  locations: z.array(locationSchema).min(1, "حداقل یک موقعیت انتخاب کنید").max(5),
  limit: limitSchema,
});

export type PingRequest = z.infer<typeof pingRequestSchema>;
export type TcpRequest = z.infer<typeof tcpRequestSchema>;
export type UdpRequest = z.infer<typeof udpRequestSchema>;
export type DnsRequest = z.infer<typeof dnsRequestSchema>;
export type HttpRequest = z.infer<typeof httpRequestSchema>;

export const testRequestSchema = z.discriminatedUnion("kind", [
  pingRequestSchema,
  tcpRequestSchema,
  udpRequestSchema,
  dnsRequestSchema,
  httpRequestSchema,
]);

export type TestRequest = z.infer<typeof testRequestSchema>;

export type TestKind = TestRequest["kind"];
