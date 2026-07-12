import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  getEmailCopy,
  getEmailDeliveries,
  recordEmailDelivery,
  saveEmailCopy
} from "@saasweave/db";

import { resetDb, seedOrgWithOwner } from "./db-harness";

describe.sequential("email", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("reads and saves email template copy", async () => {
    const empty = await getEmailCopy("welcome");
    expect(empty.subject).toBeNull();
    expect(empty.copy).toEqual({});

    await saveEmailCopy("welcome", "Welcome to the platform", {
      greeting: "Hello there"
    });

    const saved = await getEmailCopy("welcome");
    expect(saved.subject).toBe("Welcome to the platform");
    expect(saved.copy).toEqual({ greeting: "Hello there" });

    await saveEmailCopy("welcome", "Updated subject", { greeting: "Hi" });
    const updated = await getEmailCopy("welcome");
    expect(updated.subject).toBe("Updated subject");
  });

  it("records and lists email deliveries", async () => {
    const seed = await seedOrgWithOwner();

    await recordEmailDelivery({
      organizationId: seed.organizationId,
      provider: "resend",
      recipient: "user@example.com",
      status: "sent",
      subject: "Welcome",
      templateKey: "welcome"
    });
    await recordEmailDelivery({
      provider: "console",
      recipient: "other@example.com",
      status: "logged",
      subject: "Reminder",
      templateKey: "reminder"
    });
    await recordEmailDelivery({
      provider: "unknown",
      recipient: "ignored@example.com",
      status: "sent",
      subject: "Ignored",
      templateKey: "welcome"
    });

    const all = await getEmailDeliveries({ limit: 10 });
    expect(all).toHaveLength(2);

    const filtered = await getEmailDeliveries({ limit: 5, templateKey: "welcome" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.organizationId).toBe(seed.organizationId);
  });
});
