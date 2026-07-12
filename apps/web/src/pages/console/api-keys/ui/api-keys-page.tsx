import { isDefinedError } from "@orpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@saasweave/ui/components/alert-dialog";
import { Button } from "@saasweave/ui/components/button";
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

import { apiKeysMessages, consoleCommonMessages } from "@/shared/lib/console-messages";
import {
  Badge,
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatRelativeTime,
  Panel,
  PanelHeader,
  SectionHeading
} from "@/shared/ui/console-kit";

import { useCreateApiKeyMutation } from "@/pages/console/api-keys/api/create-api-key.mutation";
import {
  apiKeysQueryKeys,
  useGetApiKeysQuery,
  type ApiKeysQueryResult
} from "@/pages/console/api-keys/api/get-api-keys.query";
import { useRevokeApiKeyMutation } from "@/pages/console/api-keys/api/revoke-api-key.mutation";
import { useGetConsoleFeaturesQuery } from "@/pages/console/features/api/get-features.query";

type ApiKey = ApiKeysQueryResult[number];
type ApiKeyPreset = "integration" | "read_only" | "full";

function CreateKeySheet({ scopesEnabled }: { scopesEnabled: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<ApiKeyPreset>("integration");
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useCreateApiKeyMutation({
    onError: (error) => toast.error(error.message || apiKeysMessages.createFailed()),
    onSuccess: (result) => {
      setSecret(result.secret);
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKeys.all() });
    }
  });

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setPreset("integration");
      setSecret(null);
      setCopied(false);
    }
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success(consoleCommonMessages.copiedToClipboard());
  }

  return (
    <Sheet onOpenChange={reset} open={open}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" />
          {apiKeysMessages.createKey()}
        </Button>
      </SheetTrigger>
      <SheetContent>
        {secret ? (
          <>
            <SheetHeader>
              <SheetTitle>{apiKeysMessages.copyNewKeyTitle()}</SheetTitle>
              <SheetDescription>{apiKeysMessages.copyNewKeyDescription()}</SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4 pb-4">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                  {secret}
                </code>
                <Button onClick={copySecret} size="icon-sm" variant="outline">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
            <SheetFooter>
              <Button onClick={() => reset(false)}>{consoleCommonMessages.done()}</Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{apiKeysMessages.createSheetTitle()}</SheetTitle>
              <SheetDescription>{apiKeysMessages.createSheetDescription()}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">{consoleCommonMessages.nameLabel()}</Label>
                <Input
                  id="key-name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder={apiKeysMessages.namePlaceholder()}
                  value={name}
                />
              </div>
              {scopesEnabled ? (
                <div className="space-y-2">
                  <Label htmlFor="key-preset">{apiKeysMessages.scopePresetLabel()}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    id="key-preset"
                    onChange={(event) => setPreset(event.target.value as ApiKeyPreset)}
                    value={preset}
                  >
                    <option value="integration">{apiKeysMessages.scopePresetIntegration()}</option>
                    <option value="read_only">{apiKeysMessages.scopePresetReadOnly()}</option>
                    <option value="full">{apiKeysMessages.scopePresetFull()}</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {apiKeysMessages.scopePresetHint()}
                  </p>
                </div>
              ) : null}
            </div>
            <SheetFooter>
              <Button
                disabled={!name.trim() || mutation.isPending}
                onClick={() =>
                  mutation.mutate({
                    name: name.trim(),
                    ...(scopesEnabled ? { preset } : {})
                  })
                }
              >
                {mutation.isPending
                  ? consoleCommonMessages.creating()
                  : apiKeysMessages.createKey()}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RevokeKeyButton({ apiKey }: { apiKey: ApiKey }) {
  const queryClient = useQueryClient();
  const mutation = useRevokeApiKeyMutation({
    onError: (error) => {
      if (isDefinedError(error) && error.code === "API_KEY_NOT_FOUND") {
        toast.error(apiKeysMessages.keyNotFound());
        return;
      }
      toast.error(error.message || apiKeysMessages.revokeFailed());
    },
    onSuccess: () => {
      toast.success(apiKeysMessages.keyRevoked());
      void queryClient.invalidateQueries({ queryKey: apiKeysQueryKeys.all() });
    }
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={mutation.isPending} size="sm" variant="outline">
          {apiKeysMessages.revoke()}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{apiKeysMessages.revokeTitle({ name: apiKey.name })}</AlertDialogTitle>
          <AlertDialogDescription>{apiKeysMessages.revokeDescription()}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{consoleCommonMessages.cancel()}</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate({ id: apiKey.id })}>
            {apiKeysMessages.revokeKey()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function keysPanelDescription(active: number, total: number): string {
  if (total > active) {
    return apiKeysMessages.keysActiveAndRevoked({ active, revoked: total - active });
  }
  return apiKeysMessages.keysActiveOnly({ count: active });
}

export function ApiKeysPage() {
  const query = useGetApiKeysQuery();
  const featuresQuery = useGetConsoleFeaturesQuery();
  const scopesEnabled = featuresQuery.data?.some(
    (feature) => feature.key === "api_key_scopes" && feature.enabledForOrg
  );

  if (query.isError) {
    return (
      <ConsoleErrorState
        description={apiKeysMessages.errorDescription()}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  const keys = query.data;
  const active = keys.filter((key) => !key.revokedAt);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.workspaceEyebrow()}
        title={apiKeysMessages.title()}
        description={apiKeysMessages.description()}
        action={<CreateKeySheet scopesEnabled={scopesEnabled ?? false} />}
      />

      <Panel>
        <PanelHeader
          title={apiKeysMessages.keysTitle()}
          description={keysPanelDescription(active.length, keys.length)}
        />
        {keys.length > 0 ? (
          <ul className="divide-y divide-border">
            {keys.map((key) => (
              <li className="flex items-center justify-between gap-4 px-5 py-3.5" key={key.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <KeyRound className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{key.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {key.keyPrefix} ·{" "}
                      {key.createdByName
                        ? apiKeysMessages.keyCreatedBy({
                            time: formatRelativeTime(key.createdAt),
                            name: key.createdByName
                          })
                        : apiKeysMessages.keyCreated({
                            time: formatRelativeTime(key.createdAt)
                          })}
                    </p>
                    {scopesEnabled && key.scopes.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} tone="neutral">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                {key.revokedAt ? (
                  <span className="text-xs text-muted-foreground">
                    {apiKeysMessages.revokedAt({ time: formatRelativeTime(key.revokedAt) })}
                  </span>
                ) : (
                  <RevokeKeyButton apiKey={key} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <ConsoleEmptyState
            description={apiKeysMessages.emptyDescription()}
            title={apiKeysMessages.emptyTitle()}
          />
        )}
      </Panel>
    </div>
  );
}
