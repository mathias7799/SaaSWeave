import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { settingsMessages } from "@/shared/lib/console-messages";
import { ConsoleSkeleton, Panel, PanelHeader } from "@/shared/ui/console-kit";

export function SsoSettingsPanel() {
  const queryClient = useQueryClient();
  const providers = useQuery(orpc.console.sso.list.queryOptions());
  const [providerId, setProviderId] = useState("");
  const [domain, setDomain] = useState("");
  const [issuer, setIssuer] = useState("");
  const [entryPoint, setEntryPoint] = useState("");
  const [cert, setCert] = useState("");

  const register = useMutation({
    mutationFn: () =>
      client.console.sso.registerSaml({
        domain,
        issuer,
        providerId,
        samlConfig: {
          callbackUrl: "/app",
          cert,
          entryPoint,
          signatureAlgorithm: "sha256",
          spMetadata: {},
          wantAssertionsSigned: true
        }
      }),
    onSuccess: async () => {
      toast.success(settingsMessages.ssoRegistered());
      await queryClient.invalidateQueries({ queryKey: orpc.console.sso.list.queryKey() });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.console.sso.delete({ providerId: id }),
    onSuccess: async () => {
      toast.success(settingsMessages.ssoRemoved());
      await queryClient.invalidateQueries({ queryKey: orpc.console.sso.list.queryKey() });
    }
  });

  if (!providers.data) return <ConsoleSkeleton />;

  return (
    <Panel>
      <PanelHeader
        description={settingsMessages.ssoDescription()}
        title={settingsMessages.ssoTitle()}
      />
      <div className="space-y-4 p-5">
        {providers.data.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {providers.data.map((provider) => (
              <li
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                key={provider.providerId}
              >
                <div>
                  <p className="font-medium">{provider.providerId}</p>
                  <p className="text-xs text-muted-foreground">
                    {provider.domain} · {provider.issuer}
                  </p>
                </div>
                <Button
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(provider.providerId)}
                  size="sm"
                  variant="outline"
                >
                  {settingsMessages.ssoRemove()}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{settingsMessages.ssoEmpty()}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sso-provider-id">{settingsMessages.ssoProviderIdLabel()}</Label>
            <Input
              id="sso-provider-id"
              onChange={(event) => setProviderId(event.target.value)}
              value={providerId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sso-domain">{settingsMessages.ssoDomainLabel()}</Label>
            <Input
              id="sso-domain"
              onChange={(event) => setDomain(event.target.value)}
              placeholder="company.com"
              value={domain}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sso-issuer">{settingsMessages.ssoIssuerLabel()}</Label>
            <Input
              id="sso-issuer"
              onChange={(event) => setIssuer(event.target.value)}
              value={issuer}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sso-entry-point">{settingsMessages.ssoEntryPointLabel()}</Label>
            <Input
              id="sso-entry-point"
              onChange={(event) => setEntryPoint(event.target.value)}
              value={entryPoint}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sso-cert">{settingsMessages.ssoCertLabel()}</Label>
            <textarea
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              id="sso-cert"
              onChange={(event) => setCert(event.target.value)}
              value={cert}
            />
          </div>
        </div>
        <Button
          disabled={
            register.isPending || !providerId || !domain || !issuer || !entryPoint || !cert.trim()
          }
          onClick={() => register.mutate()}
          size="sm"
        >
          {register.isPending ? settingsMessages.ssoRegistering() : settingsMessages.ssoRegister()}
        </Button>
      </div>
    </Panel>
  );
}
