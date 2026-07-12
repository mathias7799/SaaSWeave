/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import {
  createCallerFor,
  expectOrpcError,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner,
  seedPlatformAdmin
} from "./harness";

async function seedAdminCaller(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedPlatformAdmin(seed.userId);
  return createCallerFor({ seed, userRole: "admin" });
}

describe.sequential("admin features and plans", () => {
  integrationIt("features.list returns catalog entries with adoption stats", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId, "growth");
    await seedOrganizationFeatureFlags(seed.organizationId, { ai_assistant: true });
    const caller = await seedAdminCaller(seed);

    const result = await caller.admin.features.list({});

    expect(result.features.length).toBeGreaterThan(0);
    const aiFeature = result.features.find((entry) => entry.key === "ai_assistant");
    expect(aiFeature?.stats.totalWorkspaces).toBeGreaterThanOrEqual(1);
  });

  integrationIt("features.toggleGlobal and updateRollout mutate catalog flags", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    await caller.admin.features.toggleGlobal({ enabled: false, key: "webhooks" });
    await caller.admin.features.updateRollout({ key: "webhooks", rollout: 50 });

    const result = await caller.admin.features.list({ keys: ["webhooks"] });
    const webhooks = result.features.find((feature) => feature.key === "webhooks");
    expect(webhooks?.enabled).toBe(false);
    expect(webhooks?.rollout).toBe(50);
  });

  integrationIt("features.setForOrganization applies and clears workspace overrides", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    const caller = await seedAdminCaller(seed);

    await caller.admin.features.setForOrganization({
      enabled: true,
      key: "notifications",
      organizationId: seed.organizationId
    });
    await caller.admin.features.setForOrganization({
      enabled: null,
      key: "notifications",
      organizationId: seed.organizationId
    });

    const consoleCaller = await createCallerFor({ seed });
    const features = await consoleCaller.console.features();
    const notifications = features.find((entry) => entry.key === "notifications");
    expect(notifications?.overridden).toBe(false);
  });

  integrationIt("plans.create adds a catalog entry", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    const created = await caller.admin.plans.create({
      cta: "Start",
      highlights: ["Highlight"],
      id: "integration-plan",
      name: "Integration Plan",
      priceMonthly: 1200,
      seatsIncluded: 5,
      tagline: "For integration tests"
    });

    expect(created.id).toBe("integration-plan");
    const catalog = await caller.platform.plans();
    expect(catalog.some((plan) => plan.id === "integration-plan")).toBe(true);
  });

  integrationIt("plans.update edits an existing plan", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    await caller.admin.plans.create({
      cta: "Start",
      highlights: ["One"],
      id: "integration-update-plan",
      name: "Before",
      priceMonthly: 500,
      seatsIncluded: 2,
      tagline: "Before tagline"
    });

    const updated = await caller.admin.plans.update({
      id: "integration-update-plan",
      name: "After"
    });

    expect(updated.name).toBe("After");
  });

  integrationIt("plans.remove deletes an unused plan", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    await caller.admin.plans.create({
      cta: "Start",
      highlights: ["One"],
      id: "integration-remove-plan",
      name: "Disposable",
      priceMonthly: 100,
      seatsIncluded: 1,
      tagline: "Disposable plan"
    });

    const removed = await caller.admin.plans.remove({ id: "integration-remove-plan" });
    expect(removed).toEqual({ ok: true });
  });

  integrationIt("plans.create returns PLAN_EXISTS for duplicate ids", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);
    const input = {
      cta: "Start",
      highlights: ["One"],
      id: "integration-duplicate-plan",
      name: "Duplicate",
      priceMonthly: 100,
      seatsIncluded: 1,
      tagline: "Duplicate plan"
    };
    await caller.admin.plans.create(input);

    await expectOrpcError(() => caller.admin.plans.create(input), "PLAN_EXISTS");
  });

  integrationIt("plans.update returns PLAN_NOT_FOUND for missing ids", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    await expectOrpcError(
      () => caller.admin.plans.update({ id: "missing-plan-id", name: "Nope" }),
      "PLAN_NOT_FOUND"
    );
  });

  integrationIt("plans.remove returns PLAN_IN_USE when workspaces reference the plan", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId, "growth");
    const caller = await seedAdminCaller(seed);

    await expectOrpcError(() => caller.admin.plans.remove({ id: "growth" }), "PLAN_IN_USE");
  });
});
