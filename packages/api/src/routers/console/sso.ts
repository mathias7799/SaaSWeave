import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { auth } from "@saasweave/auth/index";

import { isFeatureEnabledForOrg } from "#@/lib/features";
import { orgProcedure, requireFeature } from "#@/lib/procedures/factory";

function assertCanManageSso(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new ORPCError("FORBIDDEN", { message: "You do not have access to SSO settings." });
  }
}

const ssoProcedure = requireFeature("sso");

export const ssoRouter = {
  list: orgProcedure
    .route({ description: "SSO providers configured for this workspace", method: "GET" })
    .handler(async ({ context }) => {
      const enabled = await isFeatureEnabledForOrg(context.organization.id, "sso");
      if (!enabled) return [];

      const result = await auth.api.listSSOProviders({
        headers: context.headers
      });
      return result.providers.filter(
        (provider) => provider.organizationId === context.organization.id
      );
    }),

  registerSaml: ssoProcedure
    .route({ description: "Register a SAML identity provider for this workspace", method: "POST" })
    .input(
      z.object({
        domain: z.string().min(3),
        issuer: z.string().min(1),
        providerId: z.string().min(2).max(64),
        samlConfig: z.object({
          callbackUrl: z.string().default("/app"),
          cert: z.string().min(1),
          entryPoint: z.string().url(),
          signatureAlgorithm: z.string().default("sha256"),
          spMetadata: z.object({}).default({}),
          wantAssertionsSigned: z.boolean().default(true)
        })
      })
    )
    .handler(async ({ context, input }) => {
      assertCanManageSso(context.organization.role);

      await auth.api.registerSSOProvider({
        body: {
          domain: input.domain,
          issuer: input.issuer,
          organizationId: context.organization.id,
          providerId: input.providerId,
          samlConfig: input.samlConfig
        },
        headers: context.headers
      });
      return { ok: true };
    }),

  delete: ssoProcedure
    .route({ description: "Remove an SSO provider from this workspace", method: "POST" })
    .input(z.object({ providerId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      assertCanManageSso(context.organization.role);
      await auth.api.deleteSSOProvider({
        body: { providerId: input.providerId },
        headers: context.headers
      });
      return { ok: true };
    })
};
