import { ssoClient } from "@better-auth/sso/client";
import {
  adminClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";

export const API_AUTH_URL = `${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/auth`;

/**
 * IMPORTANT: Only use this for client-side operations (e.g. in React components or browser-only hooks).
 * It uses nanostores internally, which are not suitable for server-side usage due to lack of request isolation, leading to shared auth state.
 */
export const authClient = createAuthClient({
  baseURL: API_AUTH_URL,
  plugins: [organizationClient(), adminClient(), twoFactorClient(), ssoClient(), magicLinkClient()]
});

export type AuthSession = typeof authClient.$Infer.Session;
