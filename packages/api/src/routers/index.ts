import { type RouterClient } from "@orpc/server";

import { adminRouter } from "#@/routers/admin/index";
import { consoleRouter } from "#@/routers/console/index";
import { healthRouter } from "#@/routers/health/index";
import { platformRouter } from "#@/routers/platform/index";
import { privateRouter } from "#@/routers/private/index";

export const appRouter = {
  admin: adminRouter,
  console: consoleRouter,
  health: healthRouter,
  platform: platformRouter,
  private: privateRouter
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
