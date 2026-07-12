import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { type RouterClient } from "@orpc/server";

import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";

import { type AppRouter } from "#@/routers/index";

const link = new RPCLink({
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include"
    });
  },
  url: `${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/rpc`
});

/** Browser-only oRPC client — uses HTTP transport; safe for client bundles. */
export const client: RouterClient<AppRouter> = createORPCClient(link);
