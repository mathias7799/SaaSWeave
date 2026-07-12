import { type NodeEnv } from "#@/security/headers";

export type CspDeploymentOrigins = {
  imgproxyOrigin?: string;
  serverOrigin: string;
  webOrigin: string;
};

export type BuildWebContentSecurityPolicyOptions = {
  nodeEnv: NodeEnv;
  nonce?: string;
  origins: CspDeploymentOrigins;
  reportUri?: string;
};

function uniqueOrigins(origins: string[]): string[] {
  return [...new Set(origins.filter(Boolean))];
}

function developmentConnectSrc(origins: CspDeploymentOrigins): string {
  const allowed = uniqueOrigins([
    "'self'",
    origins.webOrigin,
    origins.serverOrigin,
    "http://localhost:*",
    "ws://localhost:*",
    "ws:",
    "wss:"
  ]);
  return `connect-src ${allowed.join(" ")}`;
}

function productionConnectSrc(origins: CspDeploymentOrigins): string {
  const allowed = uniqueOrigins(["'self'", origins.webOrigin, origins.serverOrigin]);
  return `connect-src ${allowed.join(" ")}`;
}

function developmentScriptSrc(): string {
  return "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
}

function productionScriptSrc(nonce?: string): string {
  if (!nonce) {
    return "script-src 'self'";
  }
  return `script-src 'self' 'nonce-${nonce}'`;
}

function imgSrc(origins: CspDeploymentOrigins): string {
  const allowed = uniqueOrigins([
    "'self'",
    "data:",
    "blob:",
    origins.webOrigin,
    origins.serverOrigin,
    origins.imgproxyOrigin ?? ""
  ]);
  return `img-src ${allowed.join(" ")}`;
}

function reportDirective(reportUri?: string): string | null {
  if (!reportUri) return null;
  return `report-uri ${reportUri}`;
}

export function buildWebContentSecurityPolicy(
  options: BuildWebContentSecurityPolicyOptions
): string {
  const { nodeEnv, nonce, origins, reportUri } = options;
  const isDevelopment = nodeEnv === "development";

  const directives = [
    "default-src 'self'",
    isDevelopment ? developmentScriptSrc() : productionScriptSrc(nonce),
    "style-src 'self' 'unsafe-inline'",
    imgSrc(origins),
    "font-src 'self' data:",
    isDevelopment ? developmentConnectSrc(origins) : productionConnectSrc(origins),
    "form-action 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "worker-src 'self' blob:"
  ];

  if (!isDevelopment) {
    directives.push("upgrade-insecure-requests");
  }

  const report = reportDirective(reportUri);
  if (report) directives.push(report);

  return directives.join("; ");
}

export function buildApiContentSecurityPolicy(reportUri?: string): string {
  const directives = [
    "default-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'"
  ];

  const report = reportDirective(reportUri);
  if (report) directives.push(report);

  return directives.join("; ");
}

export function parseDeploymentOrigins(urls: {
  serverUrl: string;
  webUrl: string;
  imgproxyUrl?: string;
}): CspDeploymentOrigins {
  return {
    imgproxyOrigin: urls.imgproxyUrl ? new URL(urls.imgproxyUrl).origin : undefined,
    serverOrigin: new URL(urls.serverUrl).origin,
    webOrigin: new URL(urls.webUrl).origin
  };
}

export function injectScriptNonces(html: string, nonce: string): string {
  return html.replaceAll(/<script(?![^>]*\snonce=)/gi, `<script nonce="${nonce}"`);
}
