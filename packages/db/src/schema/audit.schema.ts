import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";

/**
 * Audit log — an append-only trail of security- and billing-relevant actions
 * across the platform. Org-scoped rows power the workspace activity feed;
 * the whole table powers the platform admin audit view. `actorId` is loosely
 * referenced (denormalized `actorName`) so entries survive user deletion.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    action: text("action").notNull(),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    metadata: jsonb("metadata"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade"
    }),
    targetLabel: text("target_label"),
    targetType: text("target_type")
  },
  (table) => [
    index("audit_log_org_createdAt_idx").on(table.organizationId, table.createdAt),
    index("audit_log_createdAt_idx").on(table.createdAt),
    // Platform audit view can filter by action; index it with createdAt for
    // the ORDER BY so the filter is not a sequential scan as the table grows.
    index("audit_log_action_createdAt_idx").on(table.action, table.createdAt),
    index("audit_log_retention_candidate_idx")
      .on(table.createdAt)
      .where(
        sql`${table.action} NOT LIKE 'auth.%' AND ${table.action} NOT LIKE 'security.%' AND ${table.action} NOT LIKE 'api_key.%' AND ${table.action} NOT LIKE 'sso.%' AND ${table.action} NOT LIKE 'billing.%'`
      )
  ]
);
