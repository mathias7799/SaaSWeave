import {
  bigint,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

/** Persisted daily platform analytics aggregates refreshed by scheduled jobs. */
export const platformAnalyticsDaily = pgTable(
  "platform_analytics_daily",
  {
    id: text("id").primaryKey(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    metricKey: text("metric_key").notNull(),
    refreshedAt: timestamp("refreshed_at").defaultNow().notNull(),
    statDate: date("stat_date").notNull(),
    value: bigint("value", { mode: "number" }).notNull()
  },
  (table) => [
    uniqueIndex("platform_analytics_daily_date_metric_idx").on(table.statDate, table.metricKey),
    index("platform_analytics_daily_metric_date_idx").on(table.metricKey, table.statDate)
  ]
);
