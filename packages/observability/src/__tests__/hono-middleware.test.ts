import { beforeEach, describe, expect, it } from "vite-plus/test";

import { honoMetricsMiddleware, metricsHandler } from "#@/hono/middleware";
import { metricsRegistry } from "#@/metrics";

describe("hono metrics middleware", () => {
  beforeEach(() => {
    metricsRegistry.resetMetrics();
  });

  it("records normalized route, method, status, and duration", async () => {
    const middleware = honoMetricsMiddleware();
    const context = {
      req: {
        method: "GET",
        path: "/org/123e4567-e89b-12d3-a456-426614174000/key/swv_secret?raw=true"
      },
      res: new Response(null, { status: 404 })
    };

    await middleware(context as never, async () => undefined);

    const body = await metricsRegistry.metrics();
    expect(body).toContain(
      'http_requests_total{method="GET",route="/org/:id/key/:apiKey",status_class="4xx"} 1'
    );
    expect(body).toContain("http_request_duration_seconds_count");
  });

  it("serves prometheus text with the expected content type", async () => {
    const response = await metricsHandler();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; version=0.0.4; charset=utf-8");
    expect(await response.text()).toContain("# HELP");
  });
});
