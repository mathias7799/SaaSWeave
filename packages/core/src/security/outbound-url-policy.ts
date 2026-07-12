import { isIP } from "node:net";

/** Documented outbound HTTP limits shared across validation and transport layers. */
export const OUTBOUND_HTTP_LIMITS = {
  // Deliberate SSRF hardening: tenant webhooks may target standard web service ports only.
  ALLOWED_PORTS: [80, 443] as const,
  BODY_IDLE_TIMEOUT_MS: 10_000,
  CONNECT_TIMEOUT_MS: 5_000,
  HEADERS_TIMEOUT_MS: 10_000,
  MAX_REDIRECTS: 3,
  MAX_REQUEST_BODY_BYTES: 256 * 1024,
  MAX_RESPONSE_BODY_BYTES: 2_000,
  TOTAL_TIMEOUT_MS: 30_000
} as const;

export type OutboundUrlErrorCode = "blocked_webhook_url" | "invalid_webhook_url";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback"
]);

function ipv4ToOctets(ip: string): number[] {
  return ip.split(".").map((part) => Number(part));
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b, c, d] = octets;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224 && a <= 239) return true;
  if (a >= 240) return true;
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;
  return false;
}

function parseEmbeddedMappedIpv4(embedded: string): number[] | null {
  if (isIP(embedded) === 4) {
    return ipv4ToOctets(embedded);
  }
  const parts = embedded.split(":");
  if (parts.length === 2) {
    const high = Number.parseInt(parts[0]!, 16);
    const low = Number.parseInt(parts[1]!, 16);
    if (Number.isNaN(high) || Number.isNaN(low)) return null;
    return [high >> 8, high & 0xff, low >> 8, low & 0xff];
  }
  return null;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().split("%")[0]!;
  if (lower === "::" || lower === "::1") {
    return true;
  }

  if (lower.startsWith("::ffff:")) {
    const embedded = lower.slice("::ffff:".length);
    const octets = parseEmbeddedMappedIpv4(embedded);
    if (octets) {
      return isPrivateIPv4(octets);
    }
  }

  const firstColon = lower.indexOf(":");
  const firstHextet = firstColon === -1 ? lower : lower.slice(0, firstColon);
  const secondColon = lower.indexOf(":", firstColon + 1);
  const secondHextet =
    firstColon === -1
      ? ""
      : secondColon === -1
        ? lower.slice(firstColon + 1)
        : lower.slice(firstColon + 1, secondColon);
  const value = Number.parseInt(firstHextet || "0", 16);
  const secondValue = Number.parseInt(secondHextet || "0", 16);
  if (Number.isNaN(value) || Number.isNaN(secondValue)) {
    return true;
  }

  if ((value & 0xfe00) === 0xfc00) return true;
  if ((value & 0xffc0) === 0xfe80) return true;
  if ((value & 0xff00) === 0x6400) return true;
  if ((value & 0xff00) === 0x0100) return true;
  if ((value & 0xff00) === 0x0200) return true;
  if ((value & 0xff00) === 0x0000 && value !== 0x2001) return true;
  if ((value & 0xff00) === 0xff00) return true;

  if (value === 0x2001 && secondValue === 0x0db8) return true;
  if (value === 0x2001 && secondValue >= 0x0010 && secondValue <= 0x001f) return true;
  if (value === 0x2001 && secondValue >= 0x0020 && secondValue <= 0x002f) return true;

  if (lower.startsWith("2002:")) {
    const tail = lower.slice("2002:".length);
    const v4part = tail.split(":")[0];
    if (v4part && v4part.includes(".")) {
      const octets = ipv4ToOctets(v4part);
      if (octets.length === 4) return isPrivateIPv4(octets);
    }
  }

  return false;
}

/** Returns true when the IP must never be contacted by outbound webhook delivery. */
export function isBlockedOutboundAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return isPrivateIPv4(ipv4ToOctets(ip));
  }
  if (version === 6) {
    return isPrivateIPv6(ip);
  }
  return true;
}

function resolvePort(url: URL): number | null {
  if (!url.port) {
    if (url.protocol === "http:") return 80;
    if (url.protocol === "https:") return 443;
    return null;
  }
  const port = Number(url.port);
  return Number.isInteger(port) && port > 0 && port <= 65_535 ? port : null;
}

function isAllowedPort(port: number): boolean {
  return (OUTBOUND_HTTP_LIMITS.ALLOWED_PORTS as readonly number[]).includes(port);
}

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.toLowerCase().replace(/\.$/, "");
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (BLOCKED_HOSTNAMES.has(normalized)) return true;
  if (normalized.endsWith(".localhost")) return true;
  const literalVersion = isIP(normalized);
  if (literalVersion === 4 || literalVersion === 6) {
    return isBlockedOutboundAddress(normalized);
  }
  return false;
}

export type ParsedOutboundUrl = {
  hostname: string;
  origin: string;
  port: number;
  protocol: "http:" | "https:";
  url: URL;
};

export function parseOutboundUrl(
  rawUrl: string
): { ok: true; value: ParsedOutboundUrl } | { error: OutboundUrlErrorCode; ok: false } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "invalid_webhook_url", ok: false };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "invalid_webhook_url", ok: false };
  }

  if (!url.hostname || url.username || url.password) {
    return { error: "invalid_webhook_url", ok: false };
  }

  if (isBlockedHostname(url.hostname)) {
    return { error: "blocked_webhook_url", ok: false };
  }

  const port = resolvePort(url);
  if (port === null || !isAllowedPort(port)) {
    return { error: "invalid_webhook_url", ok: false };
  }

  return {
    ok: true,
    value: {
      hostname: url.hostname,
      origin: `${url.protocol}//${url.host}`,
      port,
      protocol: url.protocol,
      url
    }
  };
}

export function assertOutboundAddressesAllowed(addresses: string[]): OutboundUrlErrorCode | null {
  for (const address of addresses) {
    if (isBlockedOutboundAddress(address)) {
      return "blocked_webhook_url";
    }
  }
  return null;
}

export function outboundOriginsMatch(a: string, b: string): boolean {
  const left = parseOutboundUrl(a);
  const right = parseOutboundUrl(b);
  if (!left.ok || !right.ok) return false;
  return left.value.origin === right.value.origin;
}
