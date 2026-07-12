import handler from "@tanstack/react-start/server-entry";

import { ENV_WEB_SERVER } from "@saasweave/env/web/env.server";
import { paraglideMiddleware } from "@saasweave/i18n/server";
import { LOG_SERVICES, createRequestLogger, initLogger } from "@saasweave/logger/server";

import { applySecurityHeaders } from "@/middleware/security-headers";

initLogger({
  env: {
    environment: ENV_WEB_SERVER.NODE_ENV,
    service: LOG_SERVICES.WEB_SERVER,
    version: ENV_WEB_SERVER.SOURCE_COMMIT
  },
  sampling: {
    keep: [{ status: 400 }, { duration: 1000 }],
    rates: {
      info: 0
    }
  }
});

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const requestLog = createRequestLogger({
      method: req.method,
      path: url.pathname
    });

    try {
      const response = await paraglideMiddleware(req, () => handler.fetch(req));
      requestLog.emit({ status: response.status });
      return await applySecurityHeaders(response);
    } catch (error) {
      requestLog.error(error instanceof Error ? error : new Error(String(error)));
      requestLog.emit({ status: 500 });
      return applySecurityHeaders(
        new Response("Internal Server Error", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          status: 500
        })
      );
    }
  }
};
