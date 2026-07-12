import { ORPCError, os } from "@orpc/server";

import { type ApiKeyScope } from "@saasweave/core/api-keys";

import { assertApiKeyScopes } from "#@/lib/api-key-scopes";
import { type OrpcContext } from "#@/lib/context/types";
import { isFeatureEnabledForOrg } from "#@/lib/features";
import { assertIpAllowedForOrganization } from "#@/lib/ip-allowlist";
import { resolveActiveOrganization } from "#@/lib/organization";

const o = os.$context<OrpcContext>();

async function enforceOrgIpAccess(context: OrpcContext, organizationId: string): Promise<void> {
  const impersonating = Boolean(context.session?.session?.impersonatedBy);
  try {
    await assertIpAllowedForOrganization(organizationId, context.clientIp, {
      bypass: impersonating
    });
  } catch (error) {
    throw new ORPCError("FORBIDDEN", {
      message: error instanceof Error ? error.message : "IP address not allowed."
    });
  }
}

export const publicProcedure = o;

const requireAuth = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  return next({
    context: {
      session: context.session
    }
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth).route({
  spec: (spec) => {
    return {
      ...spec,
      security: [{ authCookie: [] }]
    };
  }
});

/**
 * Authenticated + scoped to the caller's active organization. Handlers receive
 * `context.organization` ({ id, role }); all tenant data must be read through it.
 */
export const orgProcedure = protectedProcedure.use(async ({ context, next }) => {
  const organization = await resolveActiveOrganization(context.session);
  await enforceOrgIpAccess(context, organization.id);
  return next({ context: { organization } });
});

/**
 * Workspace-scoped access via session or API key. API key callers receive a
 * synthetic `developer` role for authorization helpers.
 */
export const integrationProcedure = publicProcedure.use(async ({ context, next }) => {
  if (context.apiKey) {
    await enforceOrgIpAccess(context, context.apiKey.organizationId);
    return next({
      context: {
        organization: { id: context.apiKey.organizationId, role: "developer" }
      }
    });
  }
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }
  const organization = await resolveActiveOrganization(context.session);
  await enforceOrgIpAccess(context, organization.id);
  return next({
    context: {
      organization,
      session: context.session
    }
  });
});

/** Require API key scopes when the `api_key_scopes` feature is enabled. */
export function requireApiKeyScope(...required: ApiKeyScope[]) {
  return integrationProcedure.use(async ({ context, next }) => {
    if (context.apiKey) {
      await assertApiKeyScopes(context.apiKey.organizationId, context.apiKey.scopes, required);
    }
    return next();
  });
}

/** Require a feature flag to be enabled for the active organization. */
export function requireFeature(featureKey: string) {
  return orgProcedure.use(async ({ context, next }) => {
    const enabled = await isFeatureEnabledForOrg(context.organization.id, featureKey);
    if (!enabled) {
      throw new ORPCError("FORBIDDEN", {
        message: `Feature "${featureKey}" is not enabled for this workspace.`
      });
    }
    return next();
  });
}

/** Authenticated + requires the platform-admin role. */
export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
  if (context.session.user.role !== "admin") {
    throw new ORPCError("FORBIDDEN");
  }
  return next({ context });
});
