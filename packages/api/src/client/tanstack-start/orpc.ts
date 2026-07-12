import { type RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createIsomorphicFn } from "@tanstack/react-start";

import { client as browserOrpcClient } from "#@/client/browser/orpc";
import { client as serverOrpcClient } from "#@/client/server/orpc";
import { type AppRouter } from "#@/routers/index";

const getORPCClient = createIsomorphicFn()
  .server(() => serverOrpcClient)
  .client(() => browserOrpcClient);

export const client = getORPCClient() as RouterClient<AppRouter>;

export const orpc = createTanstackQueryUtils(client);

export type { RouterClient };
