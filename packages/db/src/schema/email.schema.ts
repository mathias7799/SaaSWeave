import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";

export const EMAIL_DELIVERY_PROVIDERS = ["console", "resend", "smtp"] as const;
export type EmailDeliveryProvider = (typeof EMAIL_DELIVERY_PROVIDERS)[number];

export const EMAIL_DELIVERY_STATUSES = ["sent", "logged", "failed"] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

/**
 * Admin-editable overrides for transactional email templates. Defaults live in
 * code (@saasweave/mailer); a row here overrides the subject and/or copy fields
 * for a given template key. Data fields (recipient name, URLs) are always
 * supplied at send time and are never stored.
 */
export const emailTemplate = pgTable("email_template", {
  key: text("key").primaryKey(),
  subject: text("subject"),
  copy: jsonb("copy"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
});

/**
 * Delivery log — one row per transactional email the platform attempts to send.
 * `status` is "sent" when a live provider accepted it, "logged" when it ran in
 * console mode (no provider configured), or "failed" with the error captured.
 * Powers the admin delivery view. Recipient addresses are stored so operators
 * can confirm what actually went out.
 */
export const emailDelivery = pgTable(
  "email_delivery",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    error: text("error"),
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null"
    }),
    provider: text("provider").$type<EmailDeliveryProvider>().notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").$type<EmailDeliveryStatus>().notNull(),
    subject: text("subject").notNull(),
    templateKey: text("template_key").notNull()
  },
  (table) => [
    index("email_delivery_createdAt_idx").on(table.createdAt),
    check("email_delivery_provider_check", sql`${table.provider} IN ('console', 'resend', 'smtp')`),
    check("email_delivery_status_check", sql`${table.status} IN ('sent', 'logged', 'failed')`)
  ]
);
