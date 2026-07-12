import { type Context as HonoContext } from "hono";

import { auth } from "@saasweave/auth/index";
import { resolveClientIp } from "@saasweave/cache";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { type RequestLogger } from "@saasweave/logger/server";

import { verifyApiKey } from "#@/lib/api-keys";
import { type OrpcContext } from "#@/lib/context/types";

export type CreateContextOptions = {
  context: HonoContext;
  logger: RequestLogger;
  socketAddress?: string | null;
};

function parseBearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function createContext({
  context,
  logger,
  socketAddress
}: CreateContextOptions): Promise<OrpcContext> {
  const clientIp = resolveClientIp(context.req.raw.headers, {
    trustProxyHeaders: ENV_SERVER.TRUST_PROXY_HEADERS,
    socketAddress
  });
  const bearer = parseBearerToken(context.req.header("authorization"));
  if (bearer) {
    const apiKey = await verifyApiKey(bearer);
    if (apiKey) {
      return { apiKey, clientIp, headers: context.req.raw.headers, logger, session: null };
    }
  }

  const session = await auth.api.getSession({
    headers: context.req.raw.headers
  });
  return {
    clientIp,
    headers: context.req.raw.headers,
    logger,
    session
  };
}
