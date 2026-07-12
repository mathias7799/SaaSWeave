import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "#@/schema/auth.schema";

/**
 * In-app notifications. One row per recipient user (org-wide notifications are
 * fanned out to each member at creation) so read state is tracked per user.
 * `readAt` is null until the user reads it. `organizationId` scopes the
 * notification to a workspace so it disappears when the workspace is deleted.
 */
export const notification = pgTable(
  "notification",
  {
    actionUrl: text("action_url"),
    body: text("body"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade"
    }),
    readAt: timestamp("read_at"),
    title: text("title").notNull(),
    type: text("type").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [
    index("notification_user_createdAt_idx").on(table.userId, table.createdAt),
    index("notification_user_readAt_idx").on(table.userId, table.readAt)
  ]
);
