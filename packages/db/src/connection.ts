import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ENV_SERVER } from "@saasweave/env/server/env";

import { relations as authRelations } from "#@/schema/auth.schema";
import { relations } from "#@/schema/relations";

const client = postgres(ENV_SERVER.DATABASE_URL, {
  prepare: ENV_SERVER.DATABASE_PREPARED_STATEMENTS,
  max: ENV_SERVER.DATABASE_MAX_CONNECTIONS,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle({
  client,
  // `defineRelationsPart()` must be merged into `defineRelations()` config.
  // https://orm.drizzle.team/docs/relations-v2#relations-parts
  relations: { ...relations, ...authRelations }
});
