import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Point-in-time monthly MRR snapshots written by the worker schedule job.
 * One row per calendar month (`period_month`); upserted on each nightly run.
 */
export const mrrSnapshot = pgTable(
  "mrr_snapshot",
  {
    activeOrgs: integer("active_orgs").notNull(),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    churnedMrr: integer("churned_mrr"),
    currency: text("currency").notNull(),
    id: text("id").primaryKey(),
    mrr: integer("mrr").notNull(),
    newMrr: integer("new_mrr").notNull(),
    periodMonth: text("period_month").notNull()
  },
  (table) => [unique("mrr_snapshot_period_month_key").on(table.periodMonth)]
);
