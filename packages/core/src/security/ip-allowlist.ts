import { isIPv4 } from "node:net";

export const MAX_IP_RULES_PER_ORG = 20;

const CIDR_REGEX = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

export function isValidIpRule(cidr: string): boolean {
  const value = cidr.trim();
  if (IPV4_REGEX.test(value)) {
    return isIPv4(value);
  }
  if (!CIDR_REGEX.test(value)) return false;
  const [network, prefixRaw] = value.split("/");
  const prefix = Number(prefixRaw);
  return isIPv4(network) && prefix >= 0 && prefix <= 32;
}

export function ipMatchesRule(ip: string, rule: string): boolean {
  const normalizedRule = rule.trim();
  if (!isIPv4(ip)) return false;
  if (!normalizedRule.includes("/")) {
    return ip === normalizedRule;
  }
  const [network, prefixRaw] = normalizedRule.split("/");
  const prefix = Number(prefixRaw);
  if (!isIPv4(network) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network) & mask);
}

export function ipMatchesAnyRule(ip: string, rules: string[]): boolean {
  if (rules.length === 0) return true;
  return rules.some((rule) => ipMatchesRule(ip, rule));
}
