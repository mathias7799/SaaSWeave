import { z } from "zod";

import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "@saasweave/db";

import { requireFeature } from "#@/lib/procedures/factory";

const notificationsProcedure = requireFeature("notifications");

/**
 * Notifications router — the caller's in-app notifications. Rows are created by
 * the notification background job (fanned out per recipient), so read state is
 * tracked per user.
 */
export const notificationsRouter = {
  list: notificationsProcedure
    .route({ description: "The caller's recent notifications, newest first", method: "GET" })
    .handler(({ context }) => listNotifications(context.session.user.id, 20)),

  unreadCount: notificationsProcedure
    .route({ description: "Count of the caller's unread notifications", method: "GET" })
    .handler(async ({ context }) => {
      const count = await countUnreadNotifications(context.session.user.id);
      return { count };
    }),

  markRead: notificationsProcedure
    .route({ description: "Mark one notification read", method: "POST" })
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      await markNotificationRead(context.session.user.id, input.id);
      return { ok: true };
    }),

  markAllRead: notificationsProcedure
    .route({ description: "Mark all of the caller's notifications read", method: "POST" })
    .handler(async ({ context }) => {
      await markAllNotificationsRead(context.session.user.id);
      return { ok: true };
    })
};
