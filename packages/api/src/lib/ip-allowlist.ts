import { cacheInvalidateTag, cacheWrap, resolveSecurityFailureMode } from "@saasweave/cache";
import { ipMatchesAnyRule } from "@saasweave/core/security";
import { listOrganizationIpRules } from "@saasweave/db";

import { isFeatureEnabledForOrg } from "#@/lib/features";

const IP_RULES_NAMESPACE = "security";

function ipRulesTag(organizationId: string): string {
  return `organization:${organizationId}:ip-rules`;
}

export async function getOrganizationIpRuleCidrs(organizationId: string): Promise<string[]> {
  const rules = await cacheWrap(organizationId, () => listOrganizationIpRules(organizationId), {
    failureMode: resolveSecurityFailureMode(),
    namespace: IP_RULES_NAMESPACE,
    tags: [ipRulesTag(organizationId)],
    ttlSeconds: 60
  });
  return rules.map((rule) => rule.cidr);
}

export async function invalidateOrganizationIpRules(organizationId: string): Promise<void> {
  await cacheInvalidateTag(ipRulesTag(organizationId), {
    failureMode: resolveSecurityFailureMode()
  });
}

export async function assertIpAllowedForOrganization(
  organizationId: string,
  ip: string,
  options?: { bypass?: boolean }
): Promise<void> {
  if (options?.bypass) return;

  const enabled = await isFeatureEnabledForOrg(organizationId, "ip_allowlist");
  if (!enabled) return;

  const rules = await getOrganizationIpRuleCidrs(organizationId);
  if (rules.length === 0) return;

  if (!ipMatchesAnyRule(ip, rules)) {
    throw new Error("Your IP address is not allowed for this workspace.");
  }
}
