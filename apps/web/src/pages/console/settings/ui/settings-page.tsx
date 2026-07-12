import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@saasweave/auth/react/auth-client";
import { useNavigate } from "@saasweave/i18n/tanstack-start/hooks/use-navigate";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { consoleCommonMessages, settingsMessages } from "@/shared/lib/console-messages";
import { Panel, PanelHeader, SectionHeading } from "@/shared/ui/console-kit";

import { useGetConsoleFeaturesQuery } from "@/pages/console/features/api/get-features.query";
import { DataExportSettingsPanel } from "@/pages/console/settings/ui/data-export-settings-panel";
import { IpAllowlistSettingsPanel } from "@/pages/console/settings/ui/ip-allowlist-settings-panel";
import { SsoSettingsPanel } from "@/pages/console/settings/ui/sso-settings-panel";

export function SettingsPage({ userName, userEmail }: { userName: string; userEmail: string }) {
  const featuresQuery = useGetConsoleFeaturesQuery();
  const ssoEnabled = featuresQuery.data?.some(
    (feature) => feature.key === "sso" && feature.enabledForOrg
  );
  const ipAllowlistEnabled = featuresQuery.data?.some(
    (feature) => feature.key === "ip_allowlist" && feature.enabledForOrg
  );
  const dataExportEnabled = featuresQuery.data?.some(
    (feature) => feature.key === "data_export" && feature.enabledForOrg
  );

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.organizationEyebrow()}
        title={settingsMessages.title()}
        description={settingsMessages.description()}
      />

      <WorkspacePanel />
      {dataExportEnabled ? <DataExportSettingsPanel /> : null}
      {ssoEnabled ? <SsoSettingsPanel /> : null}
      {ipAllowlistEnabled ? <IpAllowlistSettingsPanel /> : null}
      <AccountPanel userEmail={userEmail} userName={userName} />
      <DangerZone />
    </div>
  );
}

function WorkspacePanel() {
  const { data: activeOrganization, isPending } = authClient.useActiveOrganization();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (activeOrganization && activeOrganization.id !== loadedId) {
    setLoadedId(activeOrganization.id);
    setName(activeOrganization.name);
    setSlug(activeOrganization.slug);
  }

  const dirty =
    !!activeOrganization && (name !== activeOrganization.name || slug !== activeOrganization.slug);

  async function save() {
    if (!activeOrganization) return;
    setSaving(true);
    try {
      const result = await authClient.organization.update({
        data: { name, slug },
        organizationId: activeOrganization.id
      });
      if (result.error) throw new Error(result.error.message);
      toast.success(settingsMessages.workspaceUpdated());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : settingsMessages.workspaceUpdateFailed()
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={settingsMessages.workspaceTitle()}
        description={settingsMessages.workspaceDescription()}
        action={
          <Button disabled={!dirty || saving} onClick={save} size="sm">
            {saving ? consoleCommonMessages.saving() : consoleCommonMessages.saveChanges()}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">{settingsMessages.workspaceNameLabel()}</Label>
          <Input
            disabled={isPending}
            id="workspace-name"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="workspace-slug">{settingsMessages.workspaceUrlLabel()}</Label>
          <div className="flex items-center rounded-lg border border-input/70 bg-background pl-3 focus-within:border-ring focus-within:ring-[1px] focus-within:ring-border">
            <span className="text-sm text-muted-foreground">
              {settingsMessages.workspaceUrlPrefix()}
            </span>
            <Input
              className="border-0 bg-transparent pl-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
              disabled={isPending}
              id="workspace-slug"
              onChange={(event) => setSlug(event.target.value)}
              value={slug}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function AccountPanel({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim().length > 0 && name !== userName;

  async function save() {
    setSaving(true);
    try {
      const result = await authClient.updateUser({ name });
      if (result.error) throw new Error(result.error.message);
      toast.success(settingsMessages.accountUpdated());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : settingsMessages.accountUpdateFailed());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={settingsMessages.accountTitle()}
        description={settingsMessages.accountDescription()}
        action={
          <Button disabled={!dirty || saving} onClick={save} size="sm">
            {saving ? consoleCommonMessages.saving() : consoleCommonMessages.saveChanges()}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-name">{consoleCommonMessages.nameLabel()}</Label>
          <Input id="account-name" onChange={(event) => setName(event.target.value)} value={name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">{consoleCommonMessages.emailLabel()}</Label>
          <Input defaultValue={userEmail} id="account-email" readOnly type="email" />
          <p className="text-xs text-muted-foreground">{settingsMessages.emailChangeHint()}</p>
        </div>
      </div>
    </Panel>
  );
}

function DangerZone() {
  const navigate = useNavigate();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const { data: organizations } = authClient.useListOrganizations();
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = !!activeOrganization && confirm === activeOrganization.name;

  async function remove() {
    if (!activeOrganization) return;
    setDeleting(true);
    try {
      const result = await authClient.organization.delete({
        organizationId: activeOrganization.id
      });
      if (result.error) throw new Error(result.error.message);

      const next = (organizations ?? []).find((org) => org.id !== activeOrganization.id);
      if (next) await authClient.organization.setActive({ organizationId: next.id });

      toast.success(settingsMessages.workspaceDeleted());
      await navigate({ to: "/app" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : settingsMessages.workspaceDeleteFailed()
      );
      setDeleting(false);
    }
  }

  return (
    <Panel className="border-destructive/30">
      <PanelHeader
        title={settingsMessages.dangerZoneTitle()}
        description={settingsMessages.dangerZoneDescription()}
      />
      <div className="space-y-3 p-5">
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            {settingsMessages.confirmDeleteLabel({
              name: activeOrganization?.name ?? settingsMessages.workspaceNamePlaceholder()
            })}
          </Label>
          <Input
            className="max-w-sm"
            id="confirm-delete"
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={activeOrganization?.name ?? settingsMessages.workspaceNamePlaceholder()}
            value={confirm}
          />
        </div>
        <Button disabled={!canDelete || deleting} onClick={remove} variant="destructive">
          {deleting ? settingsMessages.deleting() : settingsMessages.deleteWorkspace()}
        </Button>
      </div>
    </Panel>
  );
}
