import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";

/**
 * Metered usage events. Product/server code records one row per billable unit
 * of consumption (AI tokens, API calls, …); the billing layer aggregates these
 * per organization per cycle and — when Stripe is configured — reports them to
 * Stripe billing meters.
 */
export const usageEvent = pgTable(
  "usage_event",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    feature: text("feature"),
    id: text("id").primaryKey(),
    inputTokens: integer("input_tokens"),
    metric: text("metric").notNull(),
    model: text("model"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    outputTokens: integer("output_tokens"),
    provider: text("provider"),
    quantity: integer("quantity").notNull()
  },
  (table) => [
    index("usage_event_org_metric_idx").on(table.organizationId, table.metric),
    index("usage_event_org_model_idx").on(table.organizationId, table.model),
    index("usage_event_createdAt_idx").on(table.createdAt),
    index("usage_event_org_metric_created_idx").on(
      table.organizationId,
      table.metric,
      table.createdAt
    )
  ]
);
