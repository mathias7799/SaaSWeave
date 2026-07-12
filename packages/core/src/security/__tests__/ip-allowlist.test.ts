import { describe, expect, it } from "vite-plus/test";

import {
  MAX_IP_RULES_PER_ORG,
  ipMatchesAnyRule,
  ipMatchesRule,
  isValidIpRule
} from "#@/security/ip-allowlist";

describe("MAX_IP_RULES_PER_ORG", () => {
  it("caps organizations at 20 IP rules", () => {
    expect(MAX_IP_RULES_PER_ORG).toBe(20);
  });
});

describe("isValidIpRule", () => {
  it.each([
    { rule: "203.0.113.10", valid: true },
    { rule: "  203.0.113.10  ", valid: true },
    { rule: "203.0.113.0/24", valid: true },
    { rule: "0.0.0.0/0", valid: true },
    { rule: "255.255.255.255/32", valid: true },
    { rule: "256.1.1.1", valid: false },
    { rule: "not-an-ip", valid: false },
    { rule: "203.0.113.0/33", valid: false },
    { rule: "203.0.113.0/-1", valid: false },
    { rule: "203.0.113", valid: false },
    { rule: "", valid: false }
  ])("validates $rule as $valid", ({ rule, valid }) => {
    expect(isValidIpRule(rule)).toBe(valid);
  });
});

describe("ipMatchesRule", () => {
  it("matches exact IPv4 addresses", () => {
    expect(ipMatchesRule("198.51.100.42", "198.51.100.42")).toBe(true);
    expect(ipMatchesRule("198.51.100.42", "198.51.100.43")).toBe(false);
  });

  it("trims whitespace from CIDR rules", () => {
    expect(ipMatchesRule("10.0.0.15", "  10.0.0.0/24  ")).toBe(true);
  });

  it.each([
    { ip: "192.168.1.50", rule: "192.168.1.0/24", matches: true },
    { ip: "192.168.2.1", rule: "192.168.1.0/24", matches: false },
    { ip: "10.255.255.255", rule: "10.0.0.0/8", matches: true },
    { ip: "11.0.0.1", rule: "10.0.0.0/8", matches: false },
    { ip: "203.0.113.99", rule: "0.0.0.0/0", matches: true },
    { ip: "203.0.113.99", rule: "203.0.113.99/32", matches: true },
    { ip: "203.0.113.98", rule: "203.0.113.99/32", matches: false }
  ])("$ip matches $rule => $matches", ({ ip, rule, matches }) => {
    expect(ipMatchesRule(ip, rule)).toBe(matches);
  });

  it("rejects non-IPv4 clients", () => {
    expect(ipMatchesRule("::1", "127.0.0.1")).toBe(false);
    expect(ipMatchesRule("not-an-ip", "127.0.0.1/32")).toBe(false);
  });

  it("rejects malformed CIDR rules", () => {
    expect(ipMatchesRule("10.0.0.1", "10.0.0.0/99")).toBe(false);
    expect(ipMatchesRule("10.0.0.1", "999.0.0.0/8")).toBe(false);
  });
});

describe("ipMatchesAnyRule", () => {
  it("allows all traffic when no rules are configured", () => {
    expect(ipMatchesAnyRule("203.0.113.1", [])).toBe(true);
  });

  it("matches when any rule accepts the IP", () => {
    const rules = ["198.51.100.0/24", "203.0.113.10"];

    expect(ipMatchesAnyRule("203.0.113.10", rules)).toBe(true);
    expect(ipMatchesAnyRule("203.0.113.11", rules)).toBe(false);
    expect(ipMatchesAnyRule("198.51.100.200", rules)).toBe(true);
  });
});
