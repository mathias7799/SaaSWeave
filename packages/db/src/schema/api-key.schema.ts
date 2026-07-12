import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "#@/schema/auth.schema";

/**
 * Workspace-scoped API keys for programmatic access. Only a SHA-256 hash of
 * the secret is stored; the plaintext key is shown to the caller once, at
 * creation time, and never persisted or displayed again. `keyPrefix` is the
 * short, non-secret prefix shown afterward so a workspace can tell keys apart.
 */
export const apiKey = pgTable(
  "api_key",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    id: text("id").primaryKey(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    lastUsedAt: timestamp("last_used_at"),
    name: text("name").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    revokedAt: timestamp("revoked_at"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([])
  },
  (table) => [index("api_key_organizationId_idx").on(table.organizationId)]
);
