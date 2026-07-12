import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { publicSettingsQueryKeys } from "@/shared/api/get-public-settings.query";
import { ConfirmActionDialog } from "@/shared/ui/confirm-action-dialog";
import {
  ConsoleErrorState,
  ConsoleSkeleton,
  Panel,
  PanelHeader,
  SectionHeading,
  Segmented,
  Switch
} from "@/shared/ui/console-kit";

import {
  adminSettingsQueryKeys,
  type AdminSettingsQueryResult,
  useGetAdminSettingsQuery
} from "@/pages/admin/settings/api/get-settings.query";
import { useUpdateSettingsMutation } from "@/pages/admin/settings/api/update-settings.mutation";

import { type BillingMode } from "@/config/platform.config";

export function AdminSettingsPage() {
  const query = useGetAdminSettingsQuery();

  if (query.isError) {
    return (
      <ConsoleErrorState
        description="Couldn't load platform settings."
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  return <SettingsForm settings={query.data} />;
}

function SettingsForm({ settings }: { settings: AdminSettingsQueryResult }) {
  const queryClient = useQueryClient();
  const [platformName, setPlatformName] = useState(settings.platformName);
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail);
  const [billingMode, setBillingMode] = useState<BillingMode>(settings.billingMode);
  const [currency, setCurrency] = useState(settings.currency);

  // The public platform.settings cache (sign-up gate, maintenance banner) is a separate
  // query key from admin.settings.get, so every successful write must invalidate both.
  function invalidateSettingsQueries() {
    void queryClient.invalidateQueries({ queryKey: adminSettingsQueryKeys.all() });
    void queryClient.invalidateQueries({ queryKey: publicSettingsQueryKeys.all() });
  }

  const mutation = useUpdateSettingsMutation({
    onError: (error) => toast.error(error.message || "Failed to update settings"),
    onSuccess: () => {
      toast.success("Settings saved");
      invalidateSettingsQueries();
    }
  });

  const generalDirty =
    platformName !== settings.platformName || supportEmail !== settings.supportEmail;
  const billingDirty = billingMode !== settings.billingMode || currency !== settings.currency;

  function toggle(key: "signupsOpen" | "trialsEnabled" | "maintenanceMode", next: boolean) {
    mutation.mutate(
      { [key]: next },
      {
        onSuccess: () => {
          toast.success(next ? "Enabled" : "Disabled");
          invalidateSettingsQueries();
        }
      }
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Platform settings"
        description="Global configuration for the whole SaaSWeave platform."
      />

      <Panel>
        <PanelHeader
          title="General"
          description="Identity shown to every customer"
          action={
            <Button
              disabled={!generalDirty || mutation.isPending}
              onClick={() => mutation.mutate({ platformName, supportEmail })}
              size="sm"
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          }
        />
        <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform-name">Platform name</Label>
            <Input
              id="platform-name"
              onChange={(event) => setPlatformName(event.target.value)}
              value={platformName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">Support email</Label>
            <Input
              id="support-email"
              onChange={(event) => setSupportEmail(event.target.value)}
              type="email"
              value={supportEmail}
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Billing"
          description="How the platform charges customers"
          action={
            <Button
              disabled={!billingDirty || mutation.isPending}
              onClick={() => mutation.mutate({ billingMode, currency })}
              size="sm"
            >
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          }
        />
        <div className="space-y-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Billing model</p>
              <p className="text-sm text-muted-foreground">
                Fixed-price tiers, metered usage, or a hybrid of both.
              </p>
            </div>
            <Segmented
              ariaLabel="Billing model"
              onChange={setBillingMode}
              options={[
                { label: "Subscription", value: "subscription" },
                { label: "Usage", value: "usage" },
                { label: "Hybrid", value: "hybrid" }
              ]}
              value={billingMode}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                onChange={(event) => setCurrency(event.target.value)}
                value={currency}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider">Payment provider</Label>
              <Input disabled id="provider" value="Stripe" />
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Access" description="Control who can join the platform" />
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Open sign-ups</p>
              <p className="text-sm text-muted-foreground">
                Allow anyone to create a workspace without an invite.
              </p>
            </div>
            <Switch
              checked={settings.signupsOpen}
              disabled={mutation.isPending}
              label="Toggle open sign-ups"
              onChange={(next) => toggle("signupsOpen", next)}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Free trials</p>
              <p className="text-sm text-muted-foreground">
                Offer a 14-day trial on paid plans at checkout.
              </p>
            </div>
            <Switch
              checked={settings.trialsEnabled}
              disabled={mutation.isPending}
              label="Toggle free trials"
              onChange={(next) => toggle("trialsEnabled", next)}
            />
          </div>
        </div>
      </Panel>

      <Panel
        className={settings.maintenanceMode ? "border-destructive/50" : "border-destructive/30"}
      >
        <PanelHeader
          title="Danger zone"
          description="Put the platform into maintenance mode. Every workspace sees a maintenance banner."
        />
        <div className="p-5">
          {settings.maintenanceMode ? (
            <Button
              disabled={mutation.isPending}
              onClick={() => toggle("maintenanceMode", false)}
              variant="outline"
            >
              Disable maintenance mode
            </Button>
          ) : (
            <ConfirmActionDialog
              confirmLabel="Enable maintenance mode"
              description="A maintenance banner appears across every workspace immediately. Turn it off from this same page when you're done."
              onConfirm={() => toggle("maintenanceMode", true)}
              title="Enable maintenance mode?"
            >
              <Button disabled={mutation.isPending} variant="destructive">
                Enable maintenance mode
              </Button>
            </ConfirmActionDialog>
          )}
        </div>
      </Panel>
    </div>
  );
}
