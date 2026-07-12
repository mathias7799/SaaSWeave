import { hostname } from "node:os";
import { join } from "node:path/posix";

import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { SmartCoercionPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { experimental_RethrowHandlerPlugin as RethrowHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { cors } from "hono/cors";
import { type ContentfulStatusCode } from "hono/utils/http-status";

import { createContext } from "@saasweave/api/lib/context/hono/create-context";
import { constructWebhookEvent, isStripeEnabled } from "@saasweave/api/lib/stripe";
import { dispatchStripeWebhook } from "@saasweave/api/lib/stripe-dispatch";
import { appRouter } from "@saasweave/api/routers/index";
import { auth } from "@saasweave/auth/index";
import { getPublicAuthProviderFlags } from "@saasweave/auth/public-providers";
import {
  type RateLimitFailureMode,
  checkRateLimit,
  resolveClientIp,
  resolveSecurityFailureMode
} from "@saasweave/cache";
import {
  DEFAULT_JSON_BODY_MAX_BYTES,
  readBoundedRequestOrNull,
  STRIPE_WEBHOOK_MAX_BYTES
} from "@saasweave/core/security";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { log, parseError } from "@saasweave/logger/server";
import {
  honoLogIngestionMiddleware,
  honoLoggerMiddleware,
  type HonoLogVariables
} from "@saasweave/logger/server/hono/middleware";
import {
  LOG_INGEST_RATE_LIMIT,
  LOG_INGEST_RATE_WINDOW_SECONDS
} from "@saasweave/logger/server/ingest/sanitize";
import {
  honoMetricsMiddleware,
  metricsHandler,
  startEventLoopLagMonitor
} from "@saasweave/observability";

import {
  boundedJsonBodyMiddleware,
  buildApiBodyLimitExclusionPattern
} from "#@/middleware/bounded-json-body";
import { authRateLimitMiddleware, maintenanceModeMiddleware } from "#@/middleware/platform";
import {
  applySecurityHeadersToHonoResponse,
  securityHeadersMiddleware
} from "#@/middleware/security-headers";
import { dataExportRoutes } from "#@/routes/data-export";
import { mediaRoutes } from "#@/routes/media";
import "#@/shared/lib/logger";

type ServerVariables = {
  Variables: HonoLogVariables["Variables"] & {
    boundedRequest?: Request;
  };
};

const serverHostname = hostname();
const serverUrl = new URL(ENV_SERVER.VITE_SERVER_URL);
const serverPort = Number(serverUrl.port || (serverUrl.protocol === "https:" ? 443 : 80));
const CSP_REPORT_MAX_BYTES = 16 * 1_024;
const CSP_REPORT_RATE_LIMIT = 60;
const CSP_REPORT_RATE_WINDOW_SECONDS = 60;

function logIngestRateLimitFailureMode(): RateLimitFailureMode {
  return resolveSecurityFailureMode();
}

export const app = new Hono<ServerVariables>().basePath(
  new URL(ENV_SERVER.VITE_SERVER_URL).pathname
);

app.use(
  "/*",
  cors({
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"],
    credentials: true,
    origin: [new URL(ENV_SERVER.VITE_WEB_URL).origin]
  })
);

app.use(
  "/*",
  honoLoggerMiddleware({
    exclude: ["**/health/**", "**/_logs/ingest", "**/csp-report"],
    enrich: (ctx) => {
      ctx.event.hostname = serverHostname;
    }
  })
);

app.use("/*", securityHeadersMiddleware);

if (ENV_SERVER.METRICS_ENABLED) {
  startEventLoopLagMonitor();
  app.use("/*", honoMetricsMiddleware());
  app.get("/metrics", bearerAuth({ token: ENV_SERVER.METRICS_BEARER_TOKEN! }), async (c) => {
    const response = await metricsHandler();
    return c.newResponse(response.body, response);
  });
}

app.post(
  "/_logs/ingest",
  honoLogIngestionMiddleware({
    checkRateLimit: async (key) =>
      checkRateLimit(key, LOG_INGEST_RATE_LIMIT, LOG_INGEST_RATE_WINDOW_SECONDS, {
        failureMode: logIngestRateLimitFailureMode()
      }),
    getSocketAddress: (context) => getConnInfo(context).remote.address,
    resolveClientIp: ({ headers, socketAddress }) =>
      resolveClientIp(headers, {
        socketAddress,
        trustProxyHeaders: ENV_SERVER.TRUST_PROXY_HEADERS
      }),
    resolveIdentity: async (headers) => {
      const session = await auth.api.getSession({ headers });
      if (!session?.user?.id) return null;
      return { user: { id: session.user.id } };
    }
  })
);

app.onError((error, c) => {
  const requestLog = c.get("log");
  if (requestLog) {
    requestLog.error(error);
  } else {
    log.error({ event: "hono_global_error", error });
  }

  const parsed = parseError(error);

  const response = c.json(
    {
      message: parsed.message,
      ...(parsed.code ? { code: parsed.code } : {}),
      ...(parsed.why ? { why: parsed.why } : {}),
      ...(parsed.fix ? { fix: parsed.fix } : {}),
      ...(parsed.link ? { link: parsed.link } : {})
    },
    parsed.status as ContentfulStatusCode
  );

  return applySecurityHeadersToHonoResponse(response, ENV_SERVER.NODE_ENV);
});

/**
 * Disable /auth/reference calls as they are handled by the OpenAPI generator
 * @see https://better-auth.com/docs/plugins/open-api#configuration
 */
app.on(["POST", "GET"], "/auth/reference", (c) =>
  applySecurityHeadersToHonoResponse(
    c.redirect(`${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference`, 301),
    ENV_SERVER.NODE_ENV
  )
);

app.post("/csp-report", async (c) => {
  const clientIp = resolveClientIp(c.req.raw.headers, {
    socketAddress: getConnInfo(c).remote.address,
    trustProxyHeaders: ENV_SERVER.TRUST_PROXY_HEADERS
  });
  const rate = await checkRateLimit(
    `csp-report:${clientIp}`,
    CSP_REPORT_RATE_LIMIT,
    CSP_REPORT_RATE_WINDOW_SECONDS,
    { failureMode: resolveSecurityFailureMode() }
  );
  if (!rate.allowed) {
    return applySecurityHeadersToHonoResponse(
      c.body(null, 429, { "Retry-After": String(rate.retryAfterSeconds) }),
      ENV_SERVER.NODE_ENV
    );
  }

  try {
    const body = await readBoundedRequestOrNull(c.req.raw, CSP_REPORT_MAX_BYTES);
    if (body === null) {
      return applySecurityHeadersToHonoResponse(c.body(null, 413), ENV_SERVER.NODE_ENV);
    }
  } catch {
    // Ignore malformed collector payloads.
  }

  return applySecurityHeadersToHonoResponse(c.body(null, 204), ENV_SERVER.NODE_ENV);
});

app.get("/auth/open-api/generate-schema", async (c) => {
  // IMPORTANT: Need to explicitly do this instead of relying on the OpenAPI plugin's built-in schema generation
  // Otherwise, it will 404 with the /auth/* endpoint
  const schema = await auth.api.generateOpenAPISchema();
  return c.json(schema);
});

app.use("/*", maintenanceModeMiddleware);
app.use(
  "/*",
  boundedJsonBodyMiddleware({
    defaultMaxBytes: DEFAULT_JSON_BODY_MAX_BYTES,
    excludePath: buildApiBodyLimitExclusionPattern(serverUrl.pathname)
  })
);

app.get("/auth/providers", async (c) => c.json(await getPublicAuthProviderFlags(ENV_SERVER)));

app.on(["POST", "GET"], "/auth/*", authRateLimitMiddleware, async (c) => auth.handler(c.req.raw));

app.route("/media", mediaRoutes);
app.route("/exports", dataExportRoutes);

/**
 * Stripe webhook. Verifies the signature against STRIPE_WEBHOOK_SECRET and
 * updates per-organization subscription state. No-op (400) when Stripe is not
 * configured. Point Stripe (or `stripe listen`) at `<server>/stripe/webhook`.
 */
app.post("/stripe/webhook", async (c) => {
  if (!isStripeEnabled()) return c.json({ error: "stripe_disabled" }, 400);
  const signature = c.req.header("stripe-signature");
  if (!signature) return c.json({ error: "missing_signature" }, 400);

  const rawBytes = await readBoundedRequestOrNull(c.req.raw, STRIPE_WEBHOOK_MAX_BYTES);
  if (rawBytes === null) return c.json({ error: "payload_too_large" }, 413);

  const rawBody = new TextDecoder().decode(rawBytes);
  try {
    const event = constructWebhookEvent(rawBody, signature);
    await dispatchStripeWebhook(event);
    return c.json({ received: true });
  } catch (error) {
    c.get("log")?.error(error instanceof Error ? error : String(error));
    return c.json({ error: "invalid_signature" }, 400);
  }
});

const openApiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error, { context }) => {
      context.logger.set({ handler: "openapi" });
      context.logger.error(error instanceof Error ? error : String(error));
    })
  ],
  plugins: [
    new SmartCoercionPlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()]
    }),
    new OpenAPIReferencePlugin({
      docsConfig: () => {
        const apiBasePath = new URL(ENV_SERVER.VITE_SERVER_URL).pathname;
        return {
          content: undefined,
          metaData: {
            description: "Documentation for the @saasweave/server API.",
            title: "@saasweave/server API Documentation"
          },
          sources: [
            {
              title: "API Reference",
              url: join(apiBasePath, "docs", "spec.json")
            },
            {
              title: "Auth API Reference",
              url: join(apiBasePath, "auth", "open-api", "generate-schema")
            }
          ],
          theme: "deepSpace"
        };
      },
      docsPath: "/docs",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        components: {
          securitySchemes: {
            authCookie: {
              description: `**(optional)** Session cookie from signing-in, required for protected endpoints [View Auth Reference](${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference)`,
              in: "cookie",
              name: "better-auth.session_token",
              type: "apiKey"
            },
            bearerApiKey: {
              description: "Workspace API key bearer token (`Authorization: Bearer swv_...`)",
              type: "http",
              scheme: "bearer"
            }
          }
        },
        info: {
          description: `This is the API for @saasweave/server.\n## Usage\nFor authentication, you can sign in via the \`/sign-in\` endpoint in [the Auth Reference](${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference). Include the session cookie in subsequent requests to access protected endpoints.\n## Resources\n - [Official Website](${ENV_SERVER.VITE_WEB_URL})\n - [Auth API Reference](${ENV_SERVER.VITE_SERVER_URL}/docs#auth-api-reference)`,
          title: "@saasweave/server API",
          version: ENV_SERVER.SOURCE_COMMIT
        },
        servers: [
          {
            description: "Primary API Server",
            url: ENV_SERVER.VITE_SERVER_URL
          }
        ]
      },
      specPath: "/docs/spec.json"
    }),
    new RethrowHandlerPlugin({
      filter: (error) => !(error instanceof ORPCError)
    })
  ]
});

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error, { context }) => {
      context.logger.set({ handler: "rpc" });
      context.logger.error(error instanceof Error ? error : String(error));
    })
  ],
  plugins: []
});

app.use("/*", async (c, next) => {
  const context = await createContext({
    context: c,
    logger: c.get("log"),
    socketAddress: getConnInfo(c).remote.address
  });

  const request = c.get("boundedRequest") ?? c.req.raw;

  // oRPC at /rpc/*
  const rpcResult = await rpcHandler.handle(request, {
    context,
    prefix: join(new URL(ENV_SERVER.VITE_SERVER_URL).pathname, "rpc") as `/${string}`
  });

  if (rpcResult.matched) {
    return c.newResponse(rpcResult.response.body, rpcResult.response);
  }

  // OpenAPI docs at /docs/*
  if (ENV_SERVER.ENABLE_OPEN_API_DOCS) {
    const docsResult = await openApiHandler.handle(request, {
      context,
      prefix: join(new URL(ENV_SERVER.VITE_SERVER_URL).pathname, "docs") as `/${string}`
    });

    if (docsResult.matched) {
      return c.newResponse(docsResult.response.body, docsResult.response);
    }
  }

  // OpenAPI REST API at /*
  const openApiResult = await openApiHandler.handle(request, {
    context,
    prefix: new URL(ENV_SERVER.VITE_SERVER_URL).pathname as `/${string}`
  });

  if (openApiResult.matched) {
    return c.newResponse(openApiResult.response.body, openApiResult.response);
  }

  await next();
});

void (async () => {
  try {
    const server = serve(
      {
        fetch: app.fetch,
        port: serverPort
      },
      (info) => {
        log.info({
          event: "server_started",
          url: `http://localhost:${info.port}${new URL(ENV_SERVER.VITE_SERVER_URL).pathname}`
        });
      }
    );

    let shuttingDown = false;
    function shutdown(signal: string) {
      if (shuttingDown) return;
      shuttingDown = true;
      log.info({ event: "server_shutdown", signal });
      const timer = setTimeout(() => process.exit(1), 10_000);
      timer.unref();
      server.close(() => {
        clearTimeout(timer);
        process.exit(0);
      });
    }
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
      log.error({ event: "unhandled_rejection", error: reason });
    });
    process.on("uncaughtException", (error) => {
      log.error({ event: "uncaught_exception", error });
      process.exit(1);
    });
  } catch (error) {
    log.error({ event: "server_startup_failed", error });
    process.exit(1);
  }
})();
