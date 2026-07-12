import { randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { isValidIpRule, MAX_IP_RULES_PER_ORG } from "@saasweave/core/security";

import { db } from "#@/connection";
import { organizationIpRule } from "#@/schema/index";

export type OrganizationIpRule = {
  id: string;
  cidr: string;
  label: string | null;
  createdAt: string;
};

export async function listOrganizationIpRules(
  organizationId: string
): Promise<OrganizationIpRule[]> {
  const rows = await db
    .select()
    .from(organizationIpRule)
    .where(eq(organizationIpRule.organizationId, organizationId))
    .orderBy(desc(organizationIpRule.createdAt));

  return rows.map((row) => {
    return {
      cidr: row.cidr,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      label: row.label
    };
  });
}

export async function createOrganizationIpRule(input: {
  organizationId: string;
  cidr: string;
  label?: string;
  createdBy?: string;
}): Promise<OrganizationIpRule> {
  const cidr = input.cidr.trim();
  if (!isValidIpRule(cidr)) {
    throw new Error("Invalid IPv4 address or CIDR range.");
  }

  const existing = await listOrganizationIpRules(input.organizationId);
  if (existing.length >= MAX_IP_RULES_PER_ORG) {
    throw new Error(`Maximum of ${MAX_IP_RULES_PER_ORG} IP rules per workspace.`);
  }
  if (existing.some((rule) => rule.cidr === cidr)) {
    throw new Error("This IP rule already exists.");
  }

  const id = randomUUID();
  const [row] = await db
    .insert(organizationIpRule)
    .values({
      cidr,
      createdBy: input.createdBy ?? null,
      id,
      label: input.label?.trim() ?? null,
      organizationId: input.organizationId
    })
    .returning();

  return {
    cidr: row.cidr,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    label: row.label
  };
}

export async function deleteOrganizationIpRule(
  organizationId: string,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(organizationIpRule)
    .where(
      and(eq(organizationIpRule.id, id), eq(organizationIpRule.organizationId, organizationId))
    )
    .returning({ id: organizationIpRule.id });

  return rows.length > 0;
}
