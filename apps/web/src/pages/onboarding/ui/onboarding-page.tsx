import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { authClient } from "@saasweave/auth/react/auth-client";
import { useNavigate } from "@saasweave/i18n/tanstack-start/hooks/use-navigate";
import { type NavigateTo } from "@saasweave/i18n/tanstack-start/types";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { Container } from "@/shared/ui/container";
import { LogoIcon } from "@/shared/ui/logo";

import { appConfig } from "@/config/app.config";

type Step = "workspace" | "invite";

function StepDots({ step }: { step: Step }) {
  const steps: Step[] = ["workspace", "invite"];
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {steps.map((entry) => (
        <span
          className={`size-1.5 rounded-full transition-colors ${entry === step ? "bg-brand" : "bg-muted"}`}
          key={entry}
        />
      ))}
    </div>
  );
}

function WorkspaceStep({ onNext }: { onNext: () => void }) {
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [name, setName] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (activeOrganization && activeOrganization.id !== loadedId) {
    setLoadedId(activeOrganization.id);
    setName(activeOrganization.name);
  }

  async function save() {
    if (!activeOrganization || !name.trim()) {
      onNext();
      return;
    }
    setSaving(true);
    try {
      if (name.trim() !== activeOrganization.name) {
        const result = await authClient.organization.update({
          data: { name: name.trim() },
          organizationId: activeOrganization.id
        });
        if (result.error) throw new Error(result.error.message);
      }
      onNext();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save workspace name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-bold">Name your workspace</h1>
        <p className="text-sm text-muted-foreground">
          This is what your team will see. You can change it any time from Settings.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="onboarding-workspace-name">Workspace name</Label>
        <Input
          id="onboarding-workspace-name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <Button className="w-full" disabled={saving} light="skeuomorphic" onClick={save}>
        {saving ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}

function InviteStep({ onFinish }: { onFinish: () => void }) {
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.organization.inviteMember({
        email,
        role: "member"
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to invite member");
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      setInvited((prev) => [...prev, email]);
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: orpc.console.team.queryOptions().queryKey });
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-bold">Invite your team</h1>
        <p className="text-sm text-muted-foreground">
          Add teammates now, or skip and invite them later from Team settings.
        </p>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (email.trim()) mutation.mutate();
        }}
      >
        <Input
          aria-label="Teammate email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
          type="email"
          value={email}
        />
        <Button disabled={!email.trim() || mutation.isPending} type="submit" variant="outline">
          <UserPlus className="size-4" aria-hidden="true" />
          {mutation.isPending ? "Sending…" : "Invite"}
        </Button>
      </form>
      {invited.length > 0 ? (
        <ul className="space-y-1.5">
          {invited.map((sent) => (
            <li className="flex items-center gap-2 text-sm text-muted-foreground" key={sent}>
              <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />
              {sent}
            </li>
          ))}
        </ul>
      ) : null}
      <Button className="w-full" light="skeuomorphic" onClick={onFinish}>
        {invited.length > 0 ? "Done" : "Skip for now"}
      </Button>
    </div>
  );
}

export function OnboardingPage({ redirectTo = "/app" }: { redirectTo?: NavigateTo }) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("workspace");

  async function finish() {
    await navigate({ to: redirectTo });
  }

  return (
    <Container className="flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <LogoIcon className="flex size-8 items-center justify-center rounded-md" />
        <span className="sr-only">{appConfig.site.shortName}</span>
      </div>
      <StepDots step={step} />
      <div className="w-full rounded-xl border border-border p-6">
        {step === "workspace" ? (
          <WorkspaceStep onNext={() => setStep("invite")} />
        ) : (
          <InviteStep onFinish={finish} />
        )}
      </div>
    </Container>
  );
}
