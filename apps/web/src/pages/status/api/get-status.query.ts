import { queryOptions } from "@tanstack/react-query";

import { ENV_WEB_ISOMORPHIC } from "@saasweave/env/web/env.isomorphic";

type ReadyHealth = {
  status: string;
  checks?: Record<string, { status: string; latencyMs?: number }>;
};

async function fetchStatus(): Promise<ReadyHealth> {
  const response = await fetch(`${ENV_WEB_ISOMORPHIC.VITE_SERVER_URL}/health/ready`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ReadyHealth | null;
    return body ?? { status: "unhealthy" };
  }
  return (await response.json()) as ReadyHealth;
}

export function getStatusQueryOptions() {
  return queryOptions({
    queryFn: fetchStatus,
    queryKey: ["platform", "status"],
    refetchInterval: 30_000
  });
}
