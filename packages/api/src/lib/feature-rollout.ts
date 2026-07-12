import { createHash } from "node:crypto";

/** Stable rollout bucket in the range [0, 99] for an org + feature pair. */
export function rolloutBucket(organizationId: string, featureKey: string): number {
  const digest = createHash("sha256").update(`${organizationId}:${featureKey}`).digest();
  return digest.readUInt32BE(0) % 100;
}

/** Whether an organization is included in a staged rollout percentage. */
export function isInRollout(organizationId: string, featureKey: string, rollout: number): boolean {
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  return rolloutBucket(organizationId, featureKey) < rollout;
}

export function resolveFeatureEnabled(input: {
  organizationId: string;
  featureKey: string;
  globalEnabled: boolean;
  rollout: number | null | undefined;
  override: boolean | undefined;
  planEligible: boolean;
}): boolean {
  if (!input.planEligible) return false;
  if (input.override !== undefined) return input.override;
  if (!input.globalEnabled) return false;
  if (input.rollout == null) return true;
  return isInRollout(input.organizationId, input.featureKey, input.rollout);
}
