import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization, user } from "#@/schema/auth.schema";

/** IPv4 address or CIDR range allowed to access a workspace. */
export const organizationIpRule = pgTable(
  "organization_ip_rule",
  {
    cidr: text("cidr").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    id: text("id").primaryKey(),
    label: text("label"),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
  },
  (table) => [index("organization_ip_rule_org_idx").on(table.organizationId)]
);
