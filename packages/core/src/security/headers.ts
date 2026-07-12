export type NodeEnv = "development" | "production";

export type SecurityHeadersProfile = "api" | "web";

export type BuildSecurityResponseHeadersOptions = {
  csp?: string;
  cspReportOnly?: boolean;
  nodeEnv: NodeEnv;
  profile: SecurityHeadersProfile;
};

const BASELINE_HEADERS = {
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
} as const;

const HSTS_VALUE = "max-age=31536000; includeSubDomains";

/** Pure security header builder — no I/O or env access. */
export function buildSecurityResponseHeaders(
  options: BuildSecurityResponseHeadersOptions
): Record<string, string> {
  const { csp, cspReportOnly = false, nodeEnv, profile } = options;

  const headers: Record<string, string> = {
    ...BASELINE_HEADERS
  };

  if (csp) {
    const headerName = cspReportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";
    headers[headerName] = csp;
  } else if (profile === "api") {
    headers["Content-Security-Policy"] =
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";
  }

  if (nodeEnv === "production") {
    headers["Strict-Transport-Security"] = HSTS_VALUE;
  }

  return headers;
}

export type ApiSecurityHeadersOptions = {
  csp?: string;
  cspReportOnly?: boolean;
  nodeEnv: NodeEnv;
};

/** Baseline security headers for API responses. CSP is API-oriented (no inline scripts). */
export function apiSecurityResponseHeaders(
  nodeEnv: NodeEnv,
  options: Omit<ApiSecurityHeadersOptions, "nodeEnv"> = {}
): Record<string, string> {
  return buildSecurityResponseHeaders({
    csp: options.csp,
    cspReportOnly: options.cspReportOnly,
    nodeEnv,
    profile: "api"
  });
}

export type WebSecurityHeadersOptions = {
  csp?: string;
  cspReportOnly?: boolean;
  nodeEnv: NodeEnv;
};

/** Security headers for HTML document responses (SSR + client hydration). */
export function webSecurityResponseHeaders(
  nodeEnv: NodeEnv,
  options: Omit<WebSecurityHeadersOptions, "nodeEnv"> = {}
): Record<string, string> {
  return buildSecurityResponseHeaders({
    csp: options.csp,
    cspReportOnly: options.cspReportOnly,
    nodeEnv,
    profile: "web"
  });
}

export function applySecurityHeadersToHeaders(
  headers: Headers,
  securityHeaders: Record<string, string>
): void {
  for (const [name, value] of Object.entries(securityHeaders)) {
    headers.set(name, value);
  }
}

export function applySecurityHeadersToResponse(
  response: Response,
  securityHeaders: Record<string, string>
): Response {
  const headers = new Headers(response.headers);
  applySecurityHeadersToHeaders(headers, securityHeaders);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText
  });
}
