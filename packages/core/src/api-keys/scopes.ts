import { z } from "zod";

export const API_KEY_SCOPES = [
  "usage:read",
  "usage:write",
  "webhooks:read",
  "webhooks:write",
  "audit:read"
] as const;

export const ApiKeyScopeSchema = z.enum(API_KEY_SCOPES);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;

export const API_KEY_SCOPE_PRESETS = {
  full: [...API_KEY_SCOPES],
  integration: ["usage:read", "usage:write", "webhooks:read", "webhooks:write"] as const,
  read_only: ["usage:read", "audit:read"] as const
} as const;

export type ApiKeyScopePreset = keyof typeof API_KEY_SCOPE_PRESETS;

const PRESET_SCOPE_SET = new Set<string>(API_KEY_SCOPES);

/** Legacy keys with an empty scope list are treated as full access. */
export function resolveApiKeyScopes(scopes: string[]): ApiKeyScope[] {
  if (scopes.length === 0) {
    return [...API_KEY_SCOPES];
  }
  return scopes.filter((scope): scope is ApiKeyScope => PRESET_SCOPE_SET.has(scope));
}

export function scopesFromPreset(preset: ApiKeyScopePreset): ApiKeyScope[] {
  return [...API_KEY_SCOPE_PRESETS[preset]];
}

export function apiKeyHasScopes(granted: string[], required: ApiKeyScope[]): boolean {
  const resolved = resolveApiKeyScopes(granted);
  return required.every((scope) => resolved.includes(scope));
}

export function normalizeApiKeyScopesInput(scopes: string[]): ApiKeyScope[] {
  const unique = [...new Set(scopes)];
  const invalid = unique.filter((scope) => !PRESET_SCOPE_SET.has(scope));
  if (invalid.length > 0) {
    throw new Error(`Invalid API key scopes: ${invalid.join(", ")}`);
  }
  return unique as ApiKeyScope[];
}
