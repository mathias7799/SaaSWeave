import process from "node:process";

import { ENV_SERVER } from "@saasweave/env/server/env";
import { LOG_SERVICES, initLogger } from "@saasweave/logger/server";

import { runDatabaseMigrations } from "#@/migrate";

initLogger({
  env: {
    environment: ENV_SERVER.NODE_ENV,
    service: LOG_SERVICES.DEFAULT,
    version: ENV_SERVER.SOURCE_COMMIT
  }
});

try {
  await runDatabaseMigrations();
  process.exit(0);
} catch {
  process.exit(1);
}
