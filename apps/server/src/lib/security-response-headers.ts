import {
  apiSecurityResponseHeaders,
  buildApiContentSecurityPolicy,
  type NodeEnv
} from "@saasweave/core/security";
import { ENV_SERVER } from "@saasweave/env/server/env";

export function securityResponseHeaders(nodeEnv: NodeEnv = ENV_SERVER.NODE_ENV) {
  return apiSecurityResponseHeaders(nodeEnv, {
    csp: buildApiContentSecurityPolicy(ENV_SERVER.SECURITY_CSP_REPORT_URI),
    cspReportOnly: ENV_SERVER.SECURITY_CSP_REPORT_ONLY
  });
}
