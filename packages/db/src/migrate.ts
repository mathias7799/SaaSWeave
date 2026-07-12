import { join } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";

/** Fixed session advisory lock key so concurrent migrate invocations serialize. */
const MIGRATION_ADVISORY_LOCK_KEY = 847_262_001;
const MIGRATION_MAX_ATTEMPTS = 3;
const MIGRATION_RETRY_DELAY_MS = 3_000;

/**
 * Applies pending Drizzle migrations under a Postgres session advisory lock.
 * Safe to run from multiple orchestrators or shells; only one holder runs migrate() at a time.
 */
export async function runDatabaseMigrations(): Promise<void> {
  const log = createLogger({ operation: "server__database_migration" });

  const migrationClient = postgres(ENV_SERVER.DATABASE_URL, {
    prepare: ENV_SERVER.DATABASE_PREPARED_STATEMENTS,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10
  });
  const migrationDb = drizzle({ client: migrationClient });

  // evlog wide-event model: accumulate context with set(), emit the terminal
  // outcome exactly once. Do not emit on this logger inside the finally block.
  log.set({ lockKey: MIGRATION_ADVISORY_LOCK_KEY });
  let lockHeld = false;

  try {
    await migrationClient`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
    lockHeld = true;

    let lastError: unknown;
    for (let attempt = 1; attempt <= MIGRATION_MAX_ATTEMPTS; attempt++) {
      try {
        await migrate(migrationDb, {
          migrationsFolder: join(import.meta.dirname, "../migrations")
        });
        log.emit({ attempts: attempt, event: "database_migration_completed" });
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MIGRATION_MAX_ATTEMPTS) {
          await new Promise((resolve) => {
            setTimeout(resolve, MIGRATION_RETRY_DELAY_MS);
          });
        }
      }
    }

    log.error(lastError instanceof Error ? lastError : String(lastError), {
      event: "database_migration_failed",
      maxAttempts: MIGRATION_MAX_ATTEMPTS
    });
    log.emit({ _forceKeep: true });
    throw lastError;
  } finally {
    if (lockHeld) {
      try {
        await migrationClient`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
      } catch (unlockError) {
        // The main logger is sealed once emit() has run; report this rare
        // failure on a fresh logger instance.
        const unlockLog = createLogger({ operation: "server__database_migration_unlock" });
        unlockLog.error(unlockError instanceof Error ? unlockError : String(unlockError), {
          event: "database_migration_lock_release_failed",
          lockKey: MIGRATION_ADVISORY_LOCK_KEY
        });
        unlockLog.emit({ _forceKeep: true });
      }
    }

    await migrationClient.end({ timeout: 5 });
  }
}
