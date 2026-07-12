import { type MiddlewareHandler } from "hono";

import { ENV_SERVER } from "@saasweave/env/server/env";

import { securityResponseHeaders } from "#@/lib/security-response-headers";

export { securityResponseHeaders } from "#@/lib/security-response-headers";

export const docsContentSecurityPolicy = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "worker-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'"
].join("; ");

export function applySecurityHeadersToHonoResponse(
  response: Response,
  nodeEnv = ENV_SERVER.NODE_ENV,
  contentSecurityPolicy?: string
): Response {
  if (!ENV_SERVER.SECURITY_HEADERS_ENABLED) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityResponseHeaders(nodeEnv))) {
    headers.set(name, value);
  }
  if (contentSecurityPolicy) {
    const headerName = headers.has("Content-Security-Policy-Report-Only")
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";
    headers.set(headerName, contentSecurityPolicy);
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}

export const securityHeadersMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  if (!ENV_SERVER.SECURITY_HEADERS_ENABLED) {
    return;
  }

  const serverBasePath = new URL(ENV_SERVER.VITE_SERVER_URL).pathname.replace(/\/$/, "");
  const docsPath = `${serverBasePath}/docs`;
  const secured = applySecurityHeadersToHonoResponse(
    c.res,
    ENV_SERVER.NODE_ENV,
    c.req.path === docsPath || c.req.path.startsWith(`${docsPath}/`)
      ? docsContentSecurityPolicy
      : undefined
  );
  c.res = secured;
};
