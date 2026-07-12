import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Idempotency ledger for at-least-once event sources (e.g. Stripe webhooks).
 * `id` is a namespaced key like `stripe:<eventId>`; presence means the event
 * was already handled and must not be processed again.
 */
export const processedEvent = pgTable(
  "processed_event",
  {
    id: text("id").primaryKey(),
    source: text("source").notNull(),
    processedAt: timestamp("processed_at").defaultNow().notNull()
  },
  (table) => [index("processed_event_processed_at_idx").on(table.processedAt)]
);
