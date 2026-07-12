import { useState } from "react";
import { toast } from "sonner";

import { stopImpersonating } from "@saasweave/auth/react/impersonation";
import { useAuth } from "@saasweave/auth/react/tanstack-start/hooks";
import { Button } from "@saasweave/ui/components/button";

export function ImpersonationBanner() {
  const { impersonatedBy, user } = useAuth();
  const [pending, setPending] = useState(false);

  if (!impersonatedBy || !user) return null;

  async function handleStop() {
    setPending(true);
    try {
      await stopImpersonating();
      window.location.assign("/app");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop impersonating.");
      setPending(false);
    }
  }

  return (
    <div className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center justify-between gap-3 border-b px-4 py-2 text-sm sm:px-6 lg:px-8">
      <p>
        <span className="font-medium">Impersonation active.</span> You are viewing the workspace as{" "}
        <span className="font-medium">{user.name}</span> ({user.email}).
      </p>
      <Button disabled={pending} onClick={handleStop} size="sm" variant="outline">
        {pending ? "Stopping…" : "Stop impersonating"}
      </Button>
    </div>
  );
}
