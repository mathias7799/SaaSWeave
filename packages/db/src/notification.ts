import { randomUUID } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { createLogger } from "@saasweave/logger/server";

import { db } from "#@/connection";
import { member, notification } from "#@/schema/index";

const log = createLogger({ operation: "db__notification" });

/**
 * Who should receive a notification:
 * - `user`: a single user.
 * - `org`: every member of a workspace (fanned out to one row each), optionally
 *   excluding the actor who triggered it.
 */
export type NotificationAudience =
  | { kind: "user"; userId: string }
  | { kind: "org"; organizationId: string; excludeUserId?: string };

export type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  organizationId?: string | null;
  audience: NotificationAudience;
};

export type NotificationEntry = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  organizationId: string | null;
  read: boolean;
  createdAt: string;
};

/** Resolve the recipient user ids for an audience. */
async function resolveRecipients(audience: NotificationAudience): Promise<string[]> {
  if (audience.kind === "user") return [audience.userId];
  const rows = await db
    .select({ userId: member.userId })
    .from(member)
    .where(eq(member.organizationId, audience.organizationId));
  return rows.map((row) => row.userId).filter((userId) => userId !== audience.excludeUserId);
}

/** Create a notification, fanned out to one row per recipient. Best-effort. */
export async function createNotifications(input: NotificationInput): Promise<void> {
  try {
    const recipients = await resolveRecipients(input.audience);
    if (recipients.length === 0) return;
    const now = new Date();
    await db.insert(notification).values(
      recipients.map((userId) => {
        return {
          actionUrl: input.actionUrl ?? null,
          body: input.body ?? null,
          createdAt: now,
          id: randomUUID(),
          organizationId: input.organizationId ?? null,
          title: input.title,
          type: input.type,
          userId
        };
      })
    );
  } catch (error) {
    log.error(error instanceof Error ? error : String(error), {
      event: "notification_create_failed"
    });
    // Notifications are non-critical; never break the triggering flow.
  }
}

/** Recent notifications for a user, newest first. */
export async function listNotifications(userId: string, limit = 20): Promise<NotificationEntry[]> {
  const rows = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  return rows.map((row) => {
    return {
      actionUrl: row.actionUrl,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      organizationId: row.organizationId,
      read: row.readAt !== null,
      title: row.title,
      type: row.type
    };
  });
}

/** Count a user's unread notifications. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
  return row?.count ?? 0;
}

/** Mark one notification read (scoped to its owner). */
export async function markNotificationRead(userId: string, id: string): Promise<void> {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, id), eq(notification.userId, userId)));
}

/** Mark all of a user's notifications read. */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, userId), isNull(notification.readAt)));
}
