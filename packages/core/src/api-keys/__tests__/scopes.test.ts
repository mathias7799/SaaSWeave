import { describe, expect, it } from "vite-plus/test";

import {
  API_KEY_SCOPE_PRESETS,
  API_KEY_SCOPES,
  apiKeyHasScopes,
  normalizeApiKeyScopesInput,
  resolveApiKeyScopes,
  scopesFromPreset
} from "#@/api-keys/scopes";

describe("API_KEY_SCOPE_PRESETS", () => {
  it("defines full, integration, and read_only presets from the canonical scope list", () => {
    expect(API_KEY_SCOPE_PRESETS.full).toEqual([...API_KEY_SCOPES]);
    expect(API_KEY_SCOPE_PRESETS.integration).toEqual([
      "usage:read",
      "usage:write",
      "webhooks:read",
      "webhooks:write"
    ]);
    expect(API_KEY_SCOPE_PRESETS.read_only).toEqual(["usage:read", "audit:read"]);
  });
});

describe("resolveApiKeyScopes", () => {
  it("treats legacy empty scope lists as full access", () => {
    expect(resolveApiKeyScopes([])).toEqual([...API_KEY_SCOPES]);
  });

  it("filters unknown scopes while preserving valid ones", () => {
    expect(resolveApiKeyScopes(["usage:read", "bogus:write", "audit:read"])).toEqual([
      "usage:read",
      "audit:read"
    ]);
  });

  it("returns an empty list when every scope is invalid", () => {
    expect(resolveApiKeyScopes(["invalid", "also-invalid"])).toEqual([]);
  });
});

describe("scopesFromPreset", () => {
  it.each([
    { preset: "full" as const, expected: [...API_KEY_SCOPES] },
    {
      preset: "integration" as const,
      expected: ["usage:read", "usage:write", "webhooks:read", "webhooks:write"]
    },
    { preset: "read_only" as const, expected: ["usage:read", "audit:read"] }
  ])("returns scopes for the $preset preset", ({ preset, expected }) => {
    expect(scopesFromPreset(preset)).toEqual(expected);
  });
});

describe("apiKeyHasScopes", () => {
  it("grants access when all required scopes are present", () => {
    expect(apiKeyHasScopes(["usage:read", "audit:read"], ["usage:read"])).toBe(true);
  });

  it("grants access for legacy empty keys against any required scope", () => {
    expect(apiKeyHasScopes([], ["webhooks:write", "audit:read"])).toBe(true);
  });

  it("denies access when a required scope is missing", () => {
    expect(apiKeyHasScopes(["usage:read"], ["usage:write"])).toBe(false);
  });

  it("ignores invalid granted scopes when checking membership", () => {
    expect(apiKeyHasScopes(["usage:read", "invalid"], ["usage:read", "usage:write"])).toBe(false);
  });
});

describe("normalizeApiKeyScopesInput", () => {
  it("deduplicates valid scopes", () => {
    expect(normalizeApiKeyScopesInput(["usage:read", "usage:read", "audit:read"])).toEqual([
      "usage:read",
      "audit:read"
    ]);
  });

  it("throws when any scope is invalid", () => {
    expect(() => normalizeApiKeyScopesInput(["usage:read", "admin:all"])).toThrow(
      "Invalid API key scopes: admin:all"
    );
  });

  it("throws listing every invalid scope", () => {
    expect(() => normalizeApiKeyScopesInput(["bad:a", "usage:read", "bad:b"])).toThrow(
      "Invalid API key scopes: bad:a, bad:b"
    );
  });
});
