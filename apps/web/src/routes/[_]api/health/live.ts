import process from "node:process";

import { createFileRoute } from "@tanstack/react-router";

import { HealthLiveOutputSchema } from "@saasweave/core/health";
import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";
import { ENV_WEB_SERVER } from "@saasweave/env/web/env.server";

export const Route = createFileRoute("/_api/health/live")({
  server: {
    handlers: {
      GET: () => {
        const body = HealthLiveOutputSchema.parse({
          buildSha: ENV_WEB_SERVER.SOURCE_COMMIT,
          environment: ENV_WEB_SERVER.NODE_ENV,
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptimeMs: Math.floor(process.uptime() * 1000),
          url: ENV_WEB_ISOMORPHIC.VITE_WEB_URL
        });

        return Response.json(body);
      }
    }
  }
});
