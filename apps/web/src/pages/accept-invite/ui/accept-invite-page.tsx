import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@saasweave/auth/react/auth-client";
import { Button } from "@saasweave/ui/components/button";

import { SectionHeading } from "@/shared/ui/console-kit";

export function AcceptInvitePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/{-$locale}/(centered-layout)/(guest)/accept-invite/" });
  const invitationId = search.id;

  const accept = useMutation({
    mutationFn: async () => {
      if (!invitationId) throw new Error("Missing invitation id.");
      const result = await authClient.organization.acceptInvitation({ invitationId });
      if (result.error) throw new Error(result.error.message ?? "Could not accept invitation.");
      return result.data;
    },
    onSuccess: async () => {
      toast.success("Invitation accepted");
      await navigate({ to: "/{-$locale}/app/team" });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <SectionHeading
        eyebrow="Team"
        title="Accept invitation"
        description="Join the workspace you were invited to."
      />
      {!invitationId ? (
        <p className="text-sm text-muted-foreground">
          This invite link is missing an invitation id. Ask your teammate to resend the invite.
        </p>
      ) : (
        <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
          {accept.isPending ? "Joining workspace…" : "Accept invitation"}
        </Button>
      )}
    </div>
  );
}
