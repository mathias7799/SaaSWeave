import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { type MediaAssetPurpose, type MediaAssetStatus } from "@saasweave/core/media-asset";

import { user } from "#@/schema/auth.schema";

/** Generic object-storage record for uploaded files. */
export const mediaAsset = pgTable(
  "media_asset",
  {
    contentType: text("content_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    linkedAt: timestamp("linked_at"),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<MediaAssetPurpose>().notNull(),
    replacedAt: timestamp("replaced_at"),
    size: integer("size").notNull(),
    status: text("status").$type<MediaAssetStatus>().notNull(),
    uploadedAt: timestamp("uploaded_at")
  },
  (table) => [
    index("media_asset_owner_idx").on(table.ownerId),
    index("media_asset_status_idx").on(table.status),
    index("media_asset_replaced_at_idx").on(table.replacedAt),
    index("media_asset_owner_status_created_idx").on(table.ownerId, table.status, table.createdAt),
    check(
      "media_asset_purpose_check",
      sql`${table.purpose} IN ('avatar', 'attachment', 'private')`
    ),
    check(
      "media_asset_status_check",
      sql`${table.status} IN ('pending', 'uploaded', 'linked', 'orphan', 'deleted')`
    )
  ]
);
