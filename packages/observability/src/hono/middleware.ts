import { type Context, type Next } from "hono";

import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  renderMetrics,
  statusClass
} from "#@/metrics";

function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "/:id")
    .replace(/\/(?:swv|bnk)_[a-zA-Z0-9]+/g, "/:apiKey")
    .replace(/\?.*$/, "");
}

export function honoMetricsMiddleware() {
  return async (c: Context, next: Next) => {
    const started = performance.now();
    await next();
    const route = normalizeRoute(c.req.path);
    const method = c.req.method;
    const status = c.res.status;
    const statusLabel = statusClass(status);
    const duration = (performance.now() - started) / 1000;

    httpRequestsTotal.inc({ method, route, status_class: statusLabel });
    httpRequestDurationSeconds.observe({ method, route, status_class: statusLabel }, duration);
  };
}

export async function metricsHandler(): Promise<Response> {
  const body = await renderMetrics();
  return new Response(body, {
    headers: { "Content-Type": metricsRegistryContentType() }
  });
}

function metricsRegistryContentType(): string {
  return "text/plain; version=0.0.4; charset=utf-8";
}
