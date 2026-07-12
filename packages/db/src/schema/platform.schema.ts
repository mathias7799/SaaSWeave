import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique
} from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";

/**
 * Plan catalog — what the platform sells. Seeded once from
 * `@saasweave/core` defaults when empty (see `ensureCatalogSeeded`), then
 * fully admin-editable. `organization.planId` references `id` loosely (no
 * FK) so existing rows never break if the catalog is re-seeded.
 */
export const plan = pgTable("plan", {
  cta: text("cta").notNull(),
  highlights: jsonb("highlights").$type<string[]>().notNull(),
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  popular: boolean("popular").default(false).notNull(),
  priceMonthly: integer("price_monthly"),
  seatPrice: integer("seat_price"),
  seatsIncluded: integer("seats_included").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  tagline: text("tagline").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
});

/**
 * Feature flag catalog — global default state plus an optional staged
 * rollout percentage. Per-workspace overrides live in
 * `organizationFeatureFlag`; an override always wins over the global default.
 */
export const featureFlag = pgTable("feature_flag", {
  availableOn: jsonb("available_on").$type<string[]>().notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  rollout: integer("rollout"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
});

/** Per-workspace feature flag override. Presence of a row overrides the global default. */
export const organizationFeatureFlag = pgTable(
  "organization_feature_flag",
  {
    enabled: boolean("enabled").notNull(),
    featureKey: text("feature_key")
      .notNull()
      .references(() => featureFlag.key, { onDelete: "cascade" }),
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    index("organization_feature_flag_org_idx").on(table.organizationId),
    unique("organization_feature_flag_org_feature_key").on(table.organizationId, table.featureKey)
  ]
);

/**
 * Singleton platform-wide settings row (`id` is always `"default"`).
 * Created on first read with defaults if missing.
 */
export const platformSettings = pgTable("platform_settings", {
  billingMode: text("billing_mode").notNull(),
  currency: text("currency").notNull(),
  id: text("id").primaryKey(),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  platformName: text("platform_name").notNull(),
  signupsOpen: boolean("signups_open").default(true).notNull(),
  supportEmail: text("support_email").notNull(),
  trialsEnabled: boolean("trials_enabled").default(true).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull()
});
