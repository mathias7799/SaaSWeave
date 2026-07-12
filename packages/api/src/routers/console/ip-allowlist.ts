import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { recordAudit } from "@saasweave/db";
import {
  createOrganizationIpRule,
  deleteOrganizationIpRule,
  listOrganizationIpRules
} from "@saasweave/db";

import { invalidateOrganizationIpRules } from "#@/lib/ip-allowlist";
import { requireFeature } from "#@/lib/procedures/factory";

const ipAllowlistProcedure = requireFeature("ip_allowlist");

function assertCanManageIpAllowlist(role: string) {
  if (!["owner", "admin"].includes(role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "You do not have access to IP allowlist settings."
    });
  }
}

export const ipAllowlistRouter = {
  list: ipAllowlistProcedure
    .route({ description: "IP allowlist rules for this workspace", method: "GET" })
    .handler(({ context }) => listOrganizationIpRules(context.organization.id)),

  create: ipAllowlistProcedure
    .route({
      description: "Add an IPv4 address or CIDR to the workspace allowlist",
      method: "POST"
    })
    .input(
      z.object({
        cidr: z.string().min(1).max(64),
        label: z.string().max(100).optional()
      })
    )
    .handler(async ({ context, input }) => {
      assertCanManageIpAllowlist(context.organization.role);
      try {
        const rule = await createOrganizationIpRule({
          cidr: input.cidr,
          createdBy: context.session.user.id,
          label: input.label,
          organizationId: context.organization.id
        });
        await invalidateOrganizationIpRules(context.organization.id);
        await recordAudit({
          action: "ip_allowlist.rule_added",
          actorId: context.session.user.id,
          actorName: context.session.user.name,
          metadata: { cidr: rule.cidr },
          organizationId: context.organization.id,
          targetLabel: rule.cidr,
          targetType: "ip_allowlist"
        });
        return rule;
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: error instanceof Error ? error.message : "Could not add IP rule."
        });
      }
    }),

  delete: ipAllowlistProcedure
    .route({ description: "Remove an IP allowlist rule", method: "POST" })
    .errors({ RULE_NOT_FOUND: { description: "No such IP rule on this workspace", status: 404 } })
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, errors, input }) => {
      assertCanManageIpAllowlist(context.organization.role);
      const deleted = await deleteOrganizationIpRule(context.organization.id, input.id);
      if (!deleted) throw errors.RULE_NOT_FOUND();
      await invalidateOrganizationIpRules(context.organization.id);
      await recordAudit({
        action: "ip_allowlist.rule_removed",
        actorId: context.session.user.id,
        actorName: context.session.user.name,
        organizationId: context.organization.id,
        targetLabel: input.id,
        targetType: "ip_allowlist"
      });
      return { ok: true };
    })
};
