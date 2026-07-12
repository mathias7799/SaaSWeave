import { createRouterClient, type RouterClient } from "@orpc/server";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@saasweave/auth/index";
import { resolveClientIp } from "@saasweave/cache";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { createLogger } from "@saasweave/logger/server";

import { appRouter, type AppRouter } from "#@/routers/index";

/** In-process oRPC client for SSR loaders — never import from browser bundles. */
export const client: RouterClient<AppRouter> = createRouterClient(appRouter, {
  context: async () => {
    const headers = getRequestHeaders();
    const clientIp = resolveClientIp(headers, {
      trustProxyHeaders: ENV_SERVER.TRUST_PROXY_HEADERS
    });
    const session = await auth.api.getSession({ headers });
    return {
      clientIp,
      headers,
      logger: createLogger({ operation: "web__client__orpc" }),
      session
    };
  }
});

export { appRouter };
