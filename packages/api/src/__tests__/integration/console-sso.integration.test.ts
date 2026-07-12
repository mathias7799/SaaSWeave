/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

describe.sequential("console sso", () => {
  integrationIt("list returns an empty array when sso is disabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { sso: false });
    const caller = await createCallerFor({ seed });

    const providers = await caller.console.sso.list();

    expect(providers).toEqual([]);
  });
});
