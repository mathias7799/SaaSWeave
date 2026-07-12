import { ORPCError } from "@orpc/server";

import { type ApiKeyScope, apiKeyHasScopes, resolveApiKeyScopes } from "@saasweave/core/api-keys";

import { isFeatureEnabledForOrg } from "#@/lib/features";

export async function assertApiKeyScopes(
  organizationId: string,
  granted: string[],
  required: ApiKeyScope[]
): Promise<void> {
  const scopesEnabled = await isFeatureEnabledForOrg(organizationId, "api_key_scopes");
  if (!scopesEnabled || required.length === 0) return;

  if (!apiKeyHasScopes(granted, required)) {
    throw new ORPCError("FORBIDDEN", {
      message: `API key lacks required scope(s): ${required.join(", ")}.`
    });
  }
}

export function summarizeApiKeyScopes(scopes: string[]): ApiKeyScope[] {
  return resolveApiKeyScopes(scopes);
}
