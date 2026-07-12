import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { client, orpc } from "@saasweave/api/client/tanstack-start/orpc";
import { WEBHOOK_EVENTS } from "@saasweave/core/webhooks";
import { Button } from "@saasweave/ui/components/button";
import { Checkbox } from "@saasweave/ui/components/checkbox";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@saasweave/ui/components/sheet";

import { consoleCommonMessages, webhooksMessages } from "@/shared/lib/console-messages";
import {
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";

function CreateWebhookSheet() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["usage.recorded"]);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: { events: (typeof WEBHOOK_EVENTS)[number][]; url: string }) =>
      client.console.webhooks.create(input),
    onError: (error) => toast.error(error.message || webhooksMessages.createFailed()),
    onSuccess: (result) => {
      setSecret(result.secret);
      void queryClient.invalidateQueries({ queryKey: orpc.console.webhooks.list.queryKey() });
    }
  });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setUrl("");
      setEvents(["usage.recorded"]);
      setSecret(null);
      setCopied(false);
    }
  }

  function toggleEvent(event: string) {
    setEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event]
    );
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success(webhooksMessages.copiedSigningSecret());
  }

  return (
    <Sheet onOpenChange={reset} open={open}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          {webhooksMessages.addEndpoint()}
        </Button>
      </SheetTrigger>
      <SheetContent>
        {secret ? (
          <>
            <SheetHeader>
              <SheetTitle>{webhooksMessages.copySecretTitle()}</SheetTitle>
              <SheetDescription>{webhooksMessages.copySecretDescription()}</SheetDescription>
            </SheetHeader>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
              <code className="min-w-0 flex-1 truncate font-mono text-sm">{secret}</code>
              <Button onClick={copySecret} size="icon-sm" variant="outline">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
            <SheetFooter>
              <Button onClick={() => reset(false)}>{consoleCommonMessages.done()}</Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{webhooksMessages.registerTitle()}</SheetTitle>
              <SheetDescription>{webhooksMessages.registerDescription()}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">{webhooksMessages.endpointUrlLabel()}</Label>
                <Input
                  id="webhook-url"
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder={webhooksMessages.endpointUrlPlaceholder()}
                  type="url"
                  value={url}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{consoleCommonMessages.events()}</legend>
                {WEBHOOK_EVENTS.map((event) => (
                  <label className="flex items-center gap-2 text-sm" key={event}>
                    <Checkbox
                      checked={events.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <span className="font-mono text-xs">{event}</span>
                  </label>
                ))}
              </fieldset>
            </div>
            <SheetFooter>
              <Button
                disabled={!url.trim() || events.length === 0 || mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    events: events as (typeof WEBHOOK_EVENTS)[number][],
                    url: url.trim()
                  })
                }
              >
                {mutation.isPending
                  ? consoleCommonMessages.creating()
                  : webhooksMessages.createEndpoint()}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function WebhooksPage() {
  const queryClient = useQueryClient();
  const list = useQuery(orpc.console.webhooks.list.queryOptions());

  const toggle = useMutation({
    mutationFn: (input: { enabled: boolean; id: string }) =>
      client.console.webhooks.setEnabled(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orpc.console.webhooks.list.queryKey() });
    }
  });

  const remove = useMutation({
    mutationFn: (input: { id: string }) => client.console.webhooks.delete(input),
    onSuccess: () => {
      toast.success(webhooksMessages.deleted());
      void queryClient.invalidateQueries({ queryKey: orpc.console.webhooks.list.queryKey() });
    }
  });

  const sendTest = useMutation({
    mutationFn: (input: { id: string }) => client.console.webhooks.sendTest(input),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(webhooksMessages.testDelivered({ status: result.responseStatus }));
      } else {
        toast.error(
          webhooksMessages.testFailed({
            status: String(result.responseStatus || webhooksMessages.testNetworkError())
          })
        );
      }
    }
  });

  if (list.isError) {
    return (
      <ConsoleErrorState
        description={webhooksMessages.errorDescription()}
        onRetry={() => list.refetch()}
      />
    );
  }
  if (!list.data) return <ConsoleSkeleton />;

  return (
    <div className="space-y-8">
      <SectionHeading
        action={<CreateWebhookSheet />}
        description={webhooksMessages.description()}
        eyebrow={consoleCommonMessages.integrationsEyebrow()}
        title={webhooksMessages.title()}
      />

      <Panel>
        <PanelHeader
          description={webhooksMessages.endpointsDescription()}
          title={webhooksMessages.endpointsTitle()}
        />
        {list.data.length > 0 ? (
          <ul className="divide-y divide-border">
            {list.data.map((endpoint) => (
              <li
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={endpoint.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Webhook className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{endpoint.url}</p>
                    <p className="text-xs text-muted-foreground">
                      {webhooksMessages.endpointStatus({
                        events: endpoint.events.join(", "),
                        status: endpoint.enabled
                          ? consoleCommonMessages.enabled()
                          : consoleCommonMessages.disabled()
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ enabled: !endpoint.enabled, id: endpoint.id })}
                    size="sm"
                    variant="outline"
                  >
                    {endpoint.enabled ? webhooksMessages.disable() : webhooksMessages.enable()}
                  </Button>
                  <Button
                    disabled={sendTest.isPending}
                    onClick={() => sendTest.mutate({ id: endpoint.id })}
                    size="sm"
                    variant="outline"
                  >
                    {webhooksMessages.sendTest()}
                  </Button>
                  <Button
                    disabled={remove.isPending}
                    onClick={() => remove.mutate({ id: endpoint.id })}
                    size="sm"
                    variant="outline"
                  >
                    {webhooksMessages.delete()}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ConsoleEmptyState
            description={webhooksMessages.emptyDescription()}
            title={webhooksMessages.emptyTitle()}
          />
        )}
      </Panel>
    </div>
  );
}
