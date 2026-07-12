import { type MiddlewareHandler } from "hono";

import { ENV_SERVER } from "@saasweave/env/server/env";

import { securityResponseHeaders } from "#@/lib/security-response-headers";

export { securityResponseHeaders } from "#@/lib/security-response-headers";

export function applySecurityHeadersToHonoResponse(
  response: Response,
  nodeEnv = ENV_SERVER.NODE_ENV
): Response {
  if (!ENV_SERVER.SECURITY_HEADERS_ENABLED) {
    return response;
  }

  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityResponseHeaders(nodeEnv))) {
    headers.set(name, value);
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

  const secured = applySecurityHeadersToHonoResponse(c.res, ENV_SERVER.NODE_ENV);
  c.res = secured;
};
