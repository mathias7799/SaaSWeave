/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner,
  seedUsageIntegration
} from "./harness";

describe.sequential("console billing (sample mode)", () => {
  integrationIt("billing returns sample data with stripe disabled", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId, "scale");
    await seedOrganizationFeatureFlags(seed.organizationId, { billing_portal: true });
    const caller = await createCallerFor({ seed });

    const billing = await caller.console.billing();

    expect(billing.stripeEnabled).toBe(false);
    expect(billing.plan.name).toBeTruthy();
    expect(billing.subscription.status).toBe("active");
    expect(billing.meters.length).toBeGreaterThanOrEqual(2);
  });

  integrationIt("billing reflects metered usage when events were recorded", async () => {
    const seed = await seedOrgWithOwner();
    await seedUsageIntegration(seed);
    await seedOrganizationFeatureFlags(seed.organizationId, {
      billing_portal: true,
      usage_billing: true
    });
    const caller = await createCallerFor({ seed });
    await caller.console.recordUsage({ metric: "api_calls", quantity: 42 });

    const billing = await caller.console.billing();

    expect(billing.meteredLive).toBe(true);
    expect(billing.meters.find((meter) => meter.key === "api_calls")?.used).toBe(42);
  });

  integrationIt("checkout rejects members without billing access (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner({ role: "member" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { billing_portal: true });
    const caller = await createCallerFor({ seed, role: "member" });

    await expectOrpcError(
      () => caller.console.checkout({ interval: "monthly", planId: "growth" }),
      "FORBIDDEN"
    );
  });

  integrationIt("checkout rejects annual billing when the feature is off (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, {
      annual_billing: false,
      billing_portal: true
    });
    const caller = await createCallerFor({ seed });

    await expectOrpcError(
      () => caller.console.checkout({ interval: "annual", planId: "growth" }),
      "FORBIDDEN"
    );
  });

  integrationIt(
    "checkout rejects annual billing without a configured Stripe price (BAD_REQUEST)",
    async () => {
      const seed = await seedOrgWithOwner();
      await seedOrganizationPlan(seed.organizationId);
      await seedOrganizationFeatureFlags(seed.organizationId, {
        annual_billing: true,
        billing_portal: true
      });
      const caller = await createCallerFor({ seed });

      await expectOrpcError(
        () => caller.console.checkout({ interval: "annual", planId: "growth" }),
        "BAD_REQUEST"
      );
    }
  );

  integrationIt("billingPortal rejects members without billing access (FORBIDDEN)", async () => {
    const seed = await seedOrgWithOwner({ role: "member" });
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { billing_portal: true });
    const caller = await createCallerFor({ seed, role: "member" });

    await expectOrpcError(() => caller.console.billingPortal(), "FORBIDDEN");
  });
});
