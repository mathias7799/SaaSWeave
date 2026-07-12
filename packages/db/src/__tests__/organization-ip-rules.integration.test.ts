import { beforeEach, describe, expect, it } from "vite-plus/test";

import { MAX_IP_RULES_PER_ORG } from "@saasweave/core/security";
import {
  createOrganizationIpRule,
  deleteOrganizationIpRule,
  listOrganizationIpRules
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("organization-ip-rules", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates, lists, and deletes IP rules", async () => {
    const seed = await seedOrgWithOwner();

    const created = await createOrganizationIpRule({
      cidr: "203.0.113.10",
      createdBy: seed.userId,
      label: "Office",
      organizationId: seed.organizationId
    });
    expect(created.cidr).toBe("203.0.113.10");
    expect(created.label).toBe("Office");

    const listed = await listOrganizationIpRules(seed.organizationId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);

    const deleted = await deleteOrganizationIpRule(seed.organizationId, created.id);
    expect(deleted).toBe(true);
    expect(await listOrganizationIpRules(seed.organizationId)).toHaveLength(0);

    const missing = await deleteOrganizationIpRule(seed.organizationId, created.id);
    expect(missing).toBe(false);
  });

  it("rejects invalid, duplicate, and over-limit rules", async () => {
    const seed = await seedOrgWithOwner();

    await expect(
      createOrganizationIpRule({
        cidr: "not-an-ip",
        organizationId: seed.organizationId
      })
    ).rejects.toThrow("Invalid IPv4 address or CIDR range.");

    await createOrganizationIpRule({
      cidr: "198.51.100.0/24",
      organizationId: seed.organizationId
    });

    await expect(
      createOrganizationIpRule({
        cidr: "198.51.100.0/24",
        organizationId: seed.organizationId
      })
    ).rejects.toThrow("This IP rule already exists.");

    for (let index = 1; index < MAX_IP_RULES_PER_ORG; index += 1) {
      await createOrganizationIpRule({
        cidr: `198.51.${index}.0/24`,
        organizationId: seed.organizationId
      });
    }

    await expect(
      createOrganizationIpRule({
        cidr: "198.51.100.1",
        organizationId: seed.organizationId
      })
    ).rejects.toThrow(`Maximum of ${MAX_IP_RULES_PER_ORG} IP rules per workspace.`);
  });
});
