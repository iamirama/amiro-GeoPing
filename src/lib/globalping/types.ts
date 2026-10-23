// Globalping API types — derived from the official OpenAPI spec at
// https://github.com/jsdelivr/globalping/blob/master/public/v1/spec.yaml
// and verified against live API responses on 2026-10-22.

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

export interface ProbeLocation {
  continent: string | null;
  region: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  asn: number | null;
  latitude: number | null;
  longitude: number | null;
  network: string | null;
}

export interface Probe {
  version: string;
  location: ProbeLocation;
  tags: string[];
  resolvers: string[];
  /**
   * Globalping does not include an "online" flag in the public /v1/probes
   * list — every probe in that list is considered available for measurement.
   * We keep this field optional for forward compatibility.
   */
  online?: boolean;
}

// ---------------------------------------------------------------------------
// Location filter (request side)
// ---------------------------------------------------------------------------

export type ContinentCode =
  | "AF"
  | "AN"
  | "AS"
  | "EU"
  | "NA"
  | "OC"
  | "SA";

export interface MeasurementLocationOption {
  continent?: ContinentCode;
  region?: string;
  country?: string; // ISO 3166-1 alpha-2
  state?: string; // 2-letter US state code
  city?: string;
  asn?: number;
  network?: string;
  tags?: string[];
  magic?: string;
  limit?: number; // 1-500
}

// ---------------------------------------------------------------------------
// Measurement request bodies — one per supported test type
// ---------------------------------------------------------------------------

export type MeasurementType =
  | "ping"
  | "traceroute"
  | "dns"
  | "mtr"
  | "http";

export interface PingMeasurementOptions {
  packets?: number; // 1-16, default 3
  ipVersion?: 4 | 6; // experimental
}

export interface TracerouteMeasurementOptions {
  protocol?: "ICMP" | "TCP" | "UDP"; // default ICMP
  port?: number; // 0-65535, default 80 — applies only to TCP/UDP
  ipVersion?: 4 | 6;
}

export interface MtrMeasurementOptions {
  protocol?: "ICMP" | "TCP" | "UDP"; // default ICMP
  port?: number; // 0-65535, default 80 — applies only to TCP/UDP
  packets?: number; // 1-16, default 3
  ipVersion?: 4 | 6;
}

export type DnsRecordType =
  | "A"
  | "AAAA"
  | "ANY"
  | "CNAME"
  | "DNSKEY"
  | "DS"
  | "HTTPS"
  | "MX"
  | "NS"
  | "NSEC"
  | "PTR"
  | "RRSIG"
  | "SOA"
  | "TXT"
  | "SRV"
  | "SVCB";

export interface DnsMeasurementOptions {
  resolver?: string; // hostname or IP
  protocol?: "TCP" | "UDP"; // default UDP
  port?: number; // 0-65535, default 53
  trace?: boolean; // default false
  query?: {
    type?: DnsRecordType; // default A
  };
}

export type HttpProtocol = "HTTP" | "HTTPS" | "HTTP2";
export type HttpMethod = "HEAD" | "GET" | "OPTIONS";

export interface HttpMeasurementOptions {
  protocol?: HttpProtocol; // default HTTPS
  port?: number; // 0-65535, default 443 for HTTPS/HTTP2, 80 for HTTP
  request?: {
    host?: string;
    path?: string;
    query?: string;
    method?: HttpMethod; // default HEAD
    headers?: Record<string, string>;
  };
}

export type MeasurementOptions =
  | PingMeasurementOptions
  | TracerouteMeasurementOptions
  | MtrMeasurementOptions
  | DnsMeasurementOptions
  | HttpMeasurementOptions;

export interface CreateMeasurementRequest {
  type: MeasurementType;
  target: string;
  inProgressUpdates?: boolean;
  locations?: MeasurementLocationOption[];
  limit?: number; // 1-500, default 1
  timeout?: number; // 5-30, default 30 (probe-side)
  measurementOptions?: MeasurementOptions;
}

// ---------------------------------------------------------------------------
// Measurement response
// ---------------------------------------------------------------------------

export type MeasurementStatus =
  | "in-progress"
  | "finished"
  | "failed";

export interface CreateMeasurementResponse {
  id: string;
  probesCount: number;
  /** Present when 202 + Location header */
  location?: string;
}

export interface ApiError {
  error: {
    type: string;
    message: string;
    params?: Record<string, string>;
  };
  links?: {
    documentation?: string;
  };
}

export interface ProbeResultInfo {
  continent: string;
  region: string;
  country: string;
  state: string | null;
  city: string;
  asn: number;
  longitude: number;
  latitude: number;
  network: string;
  tags: string[];
  resolvers: string[];
}

export interface PingTiming {
  ttl?: number;
  rtt?: number;
}

export interface PingStats {
  min?: number;
  max?: number;
  avg?: number;
  total?: number;
  loss?: number;
  rcv?: number;
  drop?: number;
}

export interface PingResultData {
  status: MeasurementStatus | "in-progress" | "offline" | "pending";
  rawOutput?: string;
  resolvedAddress?: string;
  resolvedHostname?: string;
  timings?: PingTiming[];
  stats?: PingStats;
}

export interface TracerouteHopTiming {
  rtt?: number;
}

export interface TracerouteHop {
  resolvedAddress?: string;
  resolvedHostname?: string;
  /** Anonymous (timed-out) hop — no host info. */
  anonymous?: boolean;
  timings?: TracerouteHopTiming[];
}

export interface TracerouteResultData {
  status: MeasurementStatus | "in-progress" | "offline" | "pending";
  rawOutput?: string;
  resolvedAddress?: string;
  resolvedHostname?: string;
  hops?: TracerouteHop[];
}

export interface DnsAnswer {
  name: string;
  type: string;
  ttl: number;
  class: string;
  value: string;
}

export interface DnsResultData {
  status: MeasurementStatus | "in-progress" | "offline" | "pending";
  rawOutput?: string;
  statusCode?: number;
  statusCodeName?: string;
  resolver?: string;
  answers?: DnsAnswer[];
  timings?: { total?: number };
  /** DNS trace records (when trace=true). */
  hierarchy?: Array<Record<string, unknown>>;
}

export interface HttpResultData {
  status: MeasurementStatus | "in-progress" | "offline" | "pending";
  rawOutput?: string;
  rawBody?: string;
  rawHeaders?: string;
  headers?: Record<string, string>;
  truncated?: boolean;
  statusCode?: number;
  statusCodeName?: string;
  failureSource?: string;
  resolvedAddress?: string;
  timings?: {
    total?: number | null;
    dns?: number | null;
    tcp?: number | null;
    tls?: number | null;
    firstByte?: number | null;
    download?: number | null;
  };
  tls?: {
    protocol?: string;
    cipher?: string;
    authorized?: boolean;
    certificate?: {
      subject?: Record<string, string>;
      issuer?: Record<string, string>;
      validFrom?: string;
      validTo?: string;
    };
  };
}

export type ResultData =
  | PingResultData
  | TracerouteResultData
  | DnsResultData
  | HttpResultData;

export interface MeasurementResultEntry {
  probe: ProbeResultInfo;
  result: ResultData;
}

export interface MeasurementResponse {
  id: string;
  type: MeasurementType;
  status: MeasurementStatus;
  createdAt: string;
  updatedAt: string;
  target: string;
  limit: number;
  probesCount: number;
  locations?: MeasurementLocationOption[];
  measurementOptions?: MeasurementOptions;
  results?: MeasurementResultEntry[];
}

// ---------------------------------------------------------------------------
// Rate-limit headers (anonymous tier)
// ---------------------------------------------------------------------------

export interface RateLimitInfo {
  limit: number;
  consumed: number;
  remaining: number;
  /** Seconds until the window resets. */
  resetSeconds: number;
  requestCost: number;
}

export interface GlobalpingError extends Error {
  status: number;
  type: "validation_error" | "rate_limit" | "not_found" | "server" | "network" | "timeout" | "unknown";
  params?: Record<string, string>;
  rateLimit?: RateLimitInfo;
  retryAfterSeconds?: number;
}
