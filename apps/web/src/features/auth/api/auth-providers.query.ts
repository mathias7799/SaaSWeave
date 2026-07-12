import { queryOptions } from "@tanstack/react-query";

import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";

export type AuthProviders = {
  github: boolean;
  google: boolean;
  magicLink: boolean;
};

export function getAuthProvidersQueryOptions() {
  return queryOptions({
    queryFn: async (): Promise<AuthProviders> => {
      const response = await fetch(`${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/auth/providers`);
      if (!response.ok) return { github: false, google: false, magicLink: false };
      return response.json() as Promise<AuthProviders>;
    },
    queryKey: ["auth", "providers"],
    staleTime: 60_000
  });
}
