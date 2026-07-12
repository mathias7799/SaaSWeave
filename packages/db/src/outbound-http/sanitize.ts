import { isIP } from "node:net";

import { OutboundHttpError, type OutboundHttpFailureCode } from "#@/outbound-http/types";

const REDACTED_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[redacted-ip]" },
  { pattern: /whsec_[A-Za-z0-9_-]+/g, replacement: "[redacted-secret]" },
  { pattern: /:\/\/[^/@\s]+@/g, replacement: "://[redacted-credentials]@" }
];

const IPV6_TOKEN_PATTERN = /\[[0-9a-f:.%]+\](?::\d{1,5})?|(?:[0-9a-f]{0,4}:){2,}[0-9a-f:.%]*/gi;

function isIpv6ErrorToken(token: string): boolean {
  const unwrapped = token.startsWith("[") ? token.slice(1, token.indexOf("]")) : token;
  const withoutZone = unwrapped.split("%")[0] ?? unwrapped;
  if (isIP(withoutZone) === 6) return true;

  const portSeparator = withoutZone.lastIndexOf(":");
  if (portSeparator <= 0) return false;
  const possibleAddress = withoutZone.slice(0, portSeparator);
  const possiblePort = withoutZone.slice(portSeparator + 1);
  return /^\d{1,5}$/.test(possiblePort) && isIP(possibleAddress) === 6;
}

function redactIpv6Tokens(message: string): string {
  return message.replace(IPV6_TOKEN_PATTERN, (token) =>
    isIpv6ErrorToken(token) ? "[redacted-ip]" : token
  );
}

export function sanitizeOutboundFailureMessage(message: string): string {
  let sanitized = redactIpv6Tokens(message.slice(0, 500));
  for (const { pattern, replacement } of REDACTED_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

export function toSanitizedOutboundFailure(error: unknown): {
  code: OutboundHttpFailureCode;
  message: string;
} {
  if (error instanceof OutboundHttpError) {
    return {
      code: error.code,
      message: sanitizeOutboundFailureMessage(error.message)
    };
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.includes("aborted")) {
      return { code: "timeout", message: "timeout" };
    }
    return {
      code: "network_error",
      message: sanitizeOutboundFailureMessage(error.message)
    };
  }

  return { code: "network_error", message: "network_error" };
}
