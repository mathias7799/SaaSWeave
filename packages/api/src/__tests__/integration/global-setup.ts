import { runDatabaseMigrations } from "@saasweave/db";

export default async function globalSetup(): Promise<void> {
  await runDatabaseMigrations();
}
