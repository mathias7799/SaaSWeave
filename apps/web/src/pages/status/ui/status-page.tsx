import { useQuery } from "@tanstack/react-query";

import { Badge, SectionHeading } from "@/shared/ui/console-kit";

import { getStatusQueryOptions } from "@/pages/status/api/get-status.query";

export function StatusPage() {
  const status = useQuery(getStatusQueryOptions());

  const unreachable = status.isError;
  const healthy = !unreachable && status.data?.status === "healthy";
  const checks = Object.entries(status.data?.checks ?? {});

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-16">
      <SectionHeading
        eyebrow="Platform"
        title="System status"
        description="Live readiness checks for the API and its dependencies."
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">API readiness</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {status.isLoading
                ? "Checking…"
                : unreachable
                  ? "Could not reach the status endpoint."
                  : healthy
                    ? "All dependencies are healthy."
                    : "One or more checks are failing."}
            </p>
          </div>
          <Badge tone={status.isLoading ? "neutral" : healthy ? "success" : "destructive"}>
            {status.isLoading
              ? "Checking"
              : unreachable
                ? "Unreachable"
                : healthy
                  ? "Healthy"
                  : "Degraded"}
          </Badge>
        </div>

        {checks.length > 0 && (
          <ul className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
            {checks.map(([name, check]) => (
              <li key={name} className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-foreground">{name}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {typeof check.latencyMs === "number" && <span>{check.latencyMs}ms</span>}
                  <Badge tone={check.status === "healthy" ? "success" : "destructive"}>
                    {check.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
