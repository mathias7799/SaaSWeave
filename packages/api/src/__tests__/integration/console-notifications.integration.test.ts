/* eslint-disable jest/no-standalone-expect, jest/require-to-throw-message -- assertions run inside the integrationIt() wrapper */
import { randomUUID } from "node:crypto";

import { describe, expect } from "vite-plus/test";

import { db } from "@saasweave/db";
import { notification } from "@saasweave/db/schema";

import {
  createCallerFor,
  integrationIt,
  seedOrganizationFeatureFlags,
  seedOrganizationPlan,
  seedOrgWithOwner
} from "./harness";

async function seedNotificationRows(input: {
  organizationId: string;
  userId: string;
}): Promise<{ readId: string; unreadId: string }> {
  const unreadId = randomUUID();
  const readId = randomUUID();
  const now = new Date();
  await db.insert(notification).values([
    {
      body: "Unread body",
      createdAt: now,
      id: unreadId,
      organizationId: input.organizationId,
      title: "Unread alert",
      type: "info",
      userId: input.userId
    },
    {
      body: "Read body",
      createdAt: new Date(now.getTime() - 60_000),
      id: readId,
      organizationId: input.organizationId,
      readAt: now,
      title: "Read alert",
      type: "info",
      userId: input.userId
    }
  ]);
  return { readId, unreadId };
}

describe.sequential("console notifications", () => {
  integrationIt("list and unreadCount reflect seeded notification rows", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { notifications: true });
    await seedNotificationRows({
      organizationId: seed.organizationId,
      userId: seed.userId
    });
    const caller = await createCallerFor({ seed });

    const listed = await caller.console.notifications.list();
    const unread = await caller.console.notifications.unreadCount();

    expect(listed).toHaveLength(2);
    expect(unread.count).toBe(1);
  });

  integrationIt("markRead and markAllRead update unread counts", async () => {
    const seed = await seedOrgWithOwner();
    await seedOrganizationPlan(seed.organizationId);
    await seedOrganizationFeatureFlags(seed.organizationId, { notifications: true });
    const ids = await seedNotificationRows({
      organizationId: seed.organizationId,
      userId: seed.userId
    });
    const caller = await createCallerFor({ seed });

    await caller.console.notifications.markRead({ id: ids.unreadId });
    expect((await caller.console.notifications.unreadCount()).count).toBe(0);

    const secondUnread = randomUUID();
    await db.insert(notification).values({
      body: "Another unread",
      id: secondUnread,
      organizationId: seed.organizationId,
      title: "Second",
      type: "info",
      userId: seed.userId
    });
    expect((await caller.console.notifications.unreadCount()).count).toBe(1);

    const markAll = await caller.console.notifications.markAllRead();
    expect(markAll).toEqual({ ok: true });
    expect((await caller.console.notifications.unreadCount()).count).toBe(0);
  });
});
