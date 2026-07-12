/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { describe, expect } from "vite-plus/test";

import { EMAIL_TEMPLATES } from "@saasweave/mailer";

import { createCallerFor, integrationIt, seedOrgWithOwner, seedPlatformAdmin } from "./harness";

async function seedAdminCaller(seed: Awaited<ReturnType<typeof seedOrgWithOwner>>) {
  await seedPlatformAdmin(seed.userId);
  return createCallerFor({ seed, userRole: "admin" });
}

describe.sequential("admin emails", () => {
  integrationIt("deliveries returns an empty list before any sends", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    const deliveries = await caller.admin.emails.deliveries();

    expect(deliveries).toEqual([]);
  });

  integrationIt("list returns the transactional template catalog", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);

    const templates = await caller.admin.emails.list();

    expect(templates.length).toBe(EMAIL_TEMPLATES.length);
    expect(templates[0]?.key).toBeTruthy();
    expect(templates[0]?.fields.length).toBeGreaterThan(0);
  });

  integrationIt("preview renders HTML for a known template", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);
    const templateKey = EMAIL_TEMPLATES[0]!.key;

    const preview = await caller.admin.emails.preview({
      copy: {},
      key: templateKey
    });

    expect(preview.subject.length).toBeGreaterThan(0);
    expect(preview.html).toContain("<");
  });

  integrationIt("save persists copy overrides and returns the updated template", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);
    const templateKey = EMAIL_TEMPLATES[0]!.key;
    const template = (await caller.admin.emails.list()).find((entry) => entry.key === templateKey);
    const fieldKey = template?.fields[0]?.key;
    expect(fieldKey).toBeTruthy();

    const saved = await caller.admin.emails.save({
      copy: { [fieldKey!]: "Integration override copy" },
      key: templateKey,
      subject: "Integration subject"
    });

    expect(saved.subject).toBe("Integration subject");
    expect(saved.fields.find((field) => field.key === fieldKey)?.value).toBe(
      "Integration override copy"
    );
  });

  integrationIt("sendTest records a delivery attempt in console mode", async () => {
    const seed = await seedOrgWithOwner();
    const caller = await seedAdminCaller(seed);
    const templateKey = EMAIL_TEMPLATES[0]!.key;

    const sent = await caller.admin.emails.sendTest({
      key: templateKey,
      to: "admin-test@integration.test"
    });

    expect(sent).toEqual({ ok: true });
    const deliveries = await caller.admin.emails.deliveries();
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
  });
});
