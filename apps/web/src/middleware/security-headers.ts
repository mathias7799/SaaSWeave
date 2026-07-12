import { randomBytes } from "node:crypto";

import {
  applySecurityHeadersToResponse,
  buildWebContentSecurityPolicy,
  injectScriptNonces,
  parseDeploymentOrigins,
  webSecurityResponseHeaders
} from "@saasweave/core/security";
import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";
import { ENV_WEB_SERVER } from "@saasweave/env/web/env.server";

function isHtmlDocumentResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("text/html");
}

export function createRequestNonce(): string {
  return randomBytes(16).toString("base64");
}

function buildWebSecurityHeaders(nonce?: string): Record<string, string> {
  const origins = parseDeploymentOrigins({
    imgproxyUrl: ENV_WEB_ISOMORPHIC.VITE_IMGPROXY_URL,
    serverUrl: ENV_WEB_ISOMORPHIC.VITE_SERVER_URL,
    webUrl: ENV_WEB_ISOMORPHIC.VITE_WEB_URL
  });

  const csp = buildWebContentSecurityPolicy({
    nodeEnv: ENV_WEB_SERVER.NODE_ENV,
    nonce,
    origins,
    reportUri: ENV_WEB_SERVER.SECURITY_CSP_REPORT_URI
  });

  return webSecurityResponseHeaders(ENV_WEB_SERVER.NODE_ENV, {
    csp,
    cspReportOnly: ENV_WEB_SERVER.SECURITY_CSP_REPORT_ONLY
  });
}

/** Apply shared security headers to SSR and static HTML responses when enabled. */
export async function applySecurityHeaders(
  response: Response,
  nonce = createRequestNonce()
): Promise<Response> {
  if (!ENV_WEB_SERVER.SECURITY_HEADERS_ENABLED) {
    return response;
  }

  const securityHeaders = buildWebSecurityHeaders(
    isHtmlDocumentResponse(response) ? nonce : undefined
  );

  if (!isHtmlDocumentResponse(response)) {
    return applySecurityHeadersToResponse(response, securityHeaders);
  }

  const html = await response.text();
  const body = injectScriptNonces(html, nonce);
  const withBody = new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText
  });

  return applySecurityHeadersToResponse(withBody, securityHeaders);
}
