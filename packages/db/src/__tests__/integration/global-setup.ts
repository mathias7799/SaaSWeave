import { db } from "#@/connection";
import { runDatabaseMigrations } from "#@/migrate";

type DbWithClient = typeof db & {
  $client?: { end: (options?: { timeout?: number }) => Promise<void> };
};

export default async function globalSetup(): Promise<() => Promise<void>> {
  await runDatabaseMigrations();

  return async () => {
    const client = (db as DbWithClient).$client;
    if (client) {
      await client.end({ timeout: 5 });
    }
  };
}
