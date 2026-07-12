import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { settingsMessages } from "@/shared/lib/console-messages";
import { ConsoleSkeleton, Panel, PanelHeader } from "@/shared/ui/console-kit";

export function IpAllowlistSettingsPanel() {
  const queryClient = useQueryClient();
  const rules = useQuery(orpc.console.ipAllowlist.list.queryOptions());
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");

  const create = useMutation({
    mutationFn: () =>
      client.console.ipAllowlist.create({
        cidr: cidr.trim(),
        label: label.trim() || undefined
      }),
    onSuccess: async () => {
      toast.success(settingsMessages.ipAllowlistRuleAdded());
      setCidr("");
      setLabel("");
      await queryClient.invalidateQueries({ queryKey: orpc.console.ipAllowlist.list.queryKey() });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  const remove = useMutation({
    mutationFn: (id: string) => client.console.ipAllowlist.delete({ id }),
    onSuccess: async () => {
      toast.success(settingsMessages.ipAllowlistRuleRemoved());
      await queryClient.invalidateQueries({ queryKey: orpc.console.ipAllowlist.list.queryKey() });
    },
    onError: (error: Error) => toast.error(error.message)
  });

  if (!rules.data) return <ConsoleSkeleton />;

  return (
    <Panel>
      <PanelHeader
        description={settingsMessages.ipAllowlistDescription()}
        title={settingsMessages.ipAllowlistTitle()}
      />
      <div className="space-y-4 p-5">
        {rules.data.length > 0 ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rules.data.map((rule) => (
              <li
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                key={rule.id}
              >
                <div>
                  <p className="font-mono font-medium">{rule.cidr}</p>
                  {rule.label ? (
                    <p className="text-xs text-muted-foreground">{rule.label}</p>
                  ) : null}
                </div>
                <Button
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(rule.id)}
                  size="sm"
                  variant="outline"
                >
                  {settingsMessages.ipAllowlistRemove()}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{settingsMessages.ipAllowlistEmpty()}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ip-cidr">{settingsMessages.ipAllowlistCidrLabel()}</Label>
            <Input
              id="ip-cidr"
              onChange={(event) => setCidr(event.target.value)}
              placeholder="203.0.113.0/24"
              value={cidr}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ip-label">{settingsMessages.ipAllowlistLabelField()}</Label>
            <Input
              id="ip-label"
              onChange={(event) => setLabel(event.target.value)}
              placeholder={settingsMessages.ipAllowlistLabelPlaceholder()}
              value={label}
            />
          </div>
        </div>
        <Button
          disabled={create.isPending || !cidr.trim()}
          onClick={() => create.mutate()}
          size="sm"
        >
          {create.isPending
            ? settingsMessages.ipAllowlistAdding()
            : settingsMessages.ipAllowlistAdd()}
        </Button>
      </div>
    </Panel>
  );
}
