import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";

export const WEBHOOK_DELIVERY_STATUSES = ["delivered", "failed"] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

/** Customer-configured outbound webhook endpoint for a workspace. */
export const webhookEndpoint = pgTable(
  "webhook_endpoint",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    url: text("url").notNull()
  },
  (table) => [index("webhook_endpoint_org_idx").on(table.organizationId)]
);

/** Delivery attempt log for outbound webhook calls. */
export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    attempt: text("attempt").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    endpointId: text("endpoint_id")
      .notNull()
      .references(() => webhookEndpoint.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    id: text("id").primaryKey(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    responseBody: text("response_body"),
    responseStatus: text("response_status"),
    status: text("status").$type<WebhookDeliveryStatus>().notNull()
  },
  (table) => [
    index("webhook_delivery_endpoint_created_idx").on(table.endpointId, table.createdAt),
    index("webhook_delivery_created_at_idx").on(table.createdAt),
    check("webhook_delivery_status_check", sql`${table.status} IN ('delivered', 'failed')`)
  ]
);
