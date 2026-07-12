import { type AuthSession } from "@saasweave/auth/index";
import { type ApiKeyScope } from "@saasweave/core/api-keys";
import { type RequestLogger } from "@saasweave/logger/server";

export type ApiKeyAuth = {
  id: string;
  organizationId: string;
  scopes: ApiKeyScope[];
};

export type OrpcContext = {
  session: AuthSession | null;
  logger: RequestLogger;
  apiKey?: ApiKeyAuth;
  organization?: { id: string; role: string };
  headers: Headers;
  clientIp: string;
};
