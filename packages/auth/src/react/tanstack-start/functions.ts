import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { auth } from "#@/index";

export type AuthState = {
  impersonatedBy: string | null;
  user: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"] | null;
};

/**
 * This server function is meant to be called via authQueryOptions() in queries.ts,
 * which is used in the _auth layout route to protect all child routes under it (e.g. _auth/app/*)
 *
 * For securing server functions or API routes,
 * consider using authMiddleware from middleware.ts instead.
 */
export const $getAuthState = createServerFn({ method: "GET" }).handler(async () => _getAuthState());

export const $getUser = createServerFn({ method: "GET" }).handler(async () => {
  const state = await _getAuthState();
  return state.user;
});

type GetUserServerQuery = {
  disableCookieCache?: boolean | undefined;
  disableRefresh?: boolean | undefined;
};

/**
 * Server-only util, meant to be used by the $getUser server function and auth middleware so logic can be shared with optional query params.
 *
 * For server app logic, consider using authMiddleware instead.
 */
export const _getAuthState = createServerOnlyFn(
  async (query?: GetUserServerQuery): Promise<AuthState> => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
      query,
      returnHeaders: true
    });

    const cookies = session.headers?.getSetCookie();
    if (cookies?.length) {
      setResponseHeader("Set-Cookie", cookies);
    }

    return {
      impersonatedBy: session.response?.session?.impersonatedBy ?? null,
      user: session.response?.user ?? null
    };
  }
);

/** @deprecated Use {@link _getAuthState} when impersonation state is needed. */
export const _getUser = createServerOnlyFn(async (query?: GetUserServerQuery) => {
  const state = await _getAuthState(query);
  return state.user;
});
