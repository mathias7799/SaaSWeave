import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  countUnreadNotifications,
  createNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@saasweave/db";

import { resetDb, seedMember, seedOrgWithOwner } from "./db-harness";

describe.sequential("notification", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates user-targeted notifications and marks them read", async () => {
    const seed = await seedOrgWithOwner();

    await createNotifications({
      audience: { kind: "user", userId: seed.userId },
      body: "Welcome aboard",
      organizationId: seed.organizationId,
      title: "Hello",
      type: "welcome"
    });

    const listed = await listNotifications(seed.userId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.read).toBe(false);
    expect(listed[0]?.title).toBe("Hello");

    expect(await countUnreadNotifications(seed.userId)).toBe(1);

    await markNotificationRead(seed.userId, listed[0]!.id);
    expect(await countUnreadNotifications(seed.userId)).toBe(0);
  });

  it("fans out org notifications and supports mark-all-read", async () => {
    const seed = await seedOrgWithOwner();
    const member = await seedMember({ organizationId: seed.organizationId });

    await createNotifications({
      audience: {
        excludeUserId: seed.userId,
        kind: "org",
        organizationId: seed.organizationId
      },
      title: "Workspace update",
      type: "org.announcement"
    });

    expect(await listNotifications(seed.userId)).toHaveLength(0);
    const memberNotifications = await listNotifications(member.userId);
    expect(memberNotifications).toHaveLength(1);

    await createNotifications({
      audience: { kind: "user", userId: member.userId },
      title: "Second",
      type: "reminder"
    });
    expect(await countUnreadNotifications(member.userId)).toBe(2);

    await markAllNotificationsRead(member.userId);
    expect(await countUnreadNotifications(member.userId)).toBe(0);
  });
});
