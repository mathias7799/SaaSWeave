import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@saasweave/auth/react/auth-client";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";

import { consoleCommonMessages, securityMessages } from "@/shared/lib/console-messages";
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

import { changePassword, listSessions } from "@/features/auth";

const SESSIONS_QUERY_KEY = ["auth", "sessions"];

function parseDevice(userAgent: string | null | undefined): { label: string; mobile: boolean } {
  if (!userAgent) return { label: securityMessages.unknownDevice(), mobile: false };
  const mobile = /Mobile|Android|iPhone/.test(userAgent);
  const browser = /Edg\//.test(userAgent)
    ? securityMessages.browserEdge()
    : /Chrome\//.test(userAgent)
      ? securityMessages.browserChrome()
      : /Firefox\//.test(userAgent)
        ? securityMessages.browserFirefox()
        : /Safari\//.test(userAgent)
          ? securityMessages.browserSafari()
          : securityMessages.browserGeneric();
  const os = /Windows/.test(userAgent)
    ? securityMessages.osWindows()
    : /Mac OS/.test(userAgent)
      ? securityMessages.osMacos()
      : /Linux/.test(userAgent)
        ? securityMessages.osLinux()
        : /Android/.test(userAgent)
          ? securityMessages.osAndroid()
          : /iPhone|iPad/.test(userAgent)
            ? securityMessages.osIos()
            : "";
  return {
    label: os ? securityMessages.deviceOnOs({ browser, os }) : browser,
    mobile
  };
}

function sessionsQueryOptions() {
  return queryOptions({
    queryFn: () => listSessions(),
    queryKey: SESSIONS_QUERY_KEY
  });
}

function useSessionsQuery() {
  return useQuery(sessionsQueryOptions());
}

function SessionsPanel() {
  const { data: current } = authClient.useSession();
  const query = useSessionsQuery();
  const queryClient = useQueryClient();
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  async function revoke(token: string) {
    setPendingToken(token);
    try {
      const result = await authClient.revokeSession({ token });
      if (result.error) throw new Error(result.error.message);
      toast.success(securityMessages.sessionRevoked());
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : securityMessages.revokeSessionFailed());
    } finally {
      setPendingToken(null);
    }
  }

  async function revokeOthers() {
    setRevokingOthers(true);
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error(result.error.message);
      toast.success(securityMessages.otherSessionsRevoked());
      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : securityMessages.revokeSessionsFailed());
    } finally {
      setRevokingOthers(false);
    }
  }

  if (query.isError) {
    return (
      <ConsoleErrorState
        description={securityMessages.sessionsError()}
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  const sessions = query.data;
  const hasOthers = sessions.some((session) => session.token !== current?.session.token);

  return (
    <Panel>
      <PanelHeader
        title={securityMessages.sessionsTitle()}
        description={securityMessages.sessionsDescription()}
        action={
          hasOthers ? (
            <Button disabled={revokingOthers} onClick={revokeOthers} size="sm" variant="outline">
              {revokingOthers
                ? securityMessages.revoking()
                : securityMessages.signOutOtherDevices()}
            </Button>
          ) : null
        }
      />
      {sessions.length > 0 ? (
        <ul className="divide-y divide-border">
          {sessions.map((session) => {
            const device = parseDevice(session.userAgent);
            const Icon = device.mobile ? Smartphone : Laptop;
            const isCurrent = session.token === current?.session.token;
            return (
              <li className="flex items-center justify-between gap-4 px-5 py-3.5" key={session.id}>
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="flex items-center gap-2 text-sm text-foreground">
                      {device.label}
                      {isCurrent ? (
                        <Badge tone="success">{securityMessages.thisDevice()}</Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {securityMessages.activeSince({
                        ip: session.ipAddress ?? securityMessages.unknownIp(),
                        time: formatRelativeTime(new Date(session.updatedAt).toISOString())
                      })}
                    </p>
                  </div>
                </div>
                {!isCurrent ? (
                  <Button
                    disabled={pendingToken === session.token}
                    onClick={() => revoke(session.token)}
                    size="sm"
                    variant="outline"
                  >
                    {pendingToken === session.token
                      ? securityMessages.revoking()
                      : securityMessages.revoke()}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <ConsoleEmptyState title={securityMessages.emptySessionsTitle()} />
      )}
    </Panel>
  );
}

function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword;

  async function save() {
    setSaving(true);
    try {
      await changePassword({ data: { currentPassword, newPassword } });
      toast.success(securityMessages.passwordChanged());
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : securityMessages.passwordChangeFailed());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={securityMessages.passwordTitle()}
        description={securityMessages.passwordDescription()}
        action={
          <Button disabled={!canSubmit || saving} onClick={save} size="sm">
            {saving ? consoleCommonMessages.saving() : securityMessages.changePassword()}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="current-password">{securityMessages.currentPasswordLabel()}</Label>
          <Input
            id="current-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            type="password"
            value={currentPassword}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">{securityMessages.newPasswordLabel()}</Label>
          <Input
            id="new-password"
            onChange={(event) => setNewPassword(event.target.value)}
            type="password"
            value={newPassword}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-new-password">{securityMessages.confirmPasswordLabel()}</Label>
          <Input
            id="confirm-new-password"
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
            value={confirmPassword}
          />
        </div>
      </div>
    </Panel>
  );
}

function TwoFactorPanel() {
  const { data: session } = authClient.useSession();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = Boolean(
    session?.user && "twoFactorEnabled" in session.user && session.user.twoFactorEnabled
  );

  async function startEnable() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.enable({ password });
      if (result.error) throw new Error(result.error.message);
      const data = result.data;
      const totp = data && "totpURI" in data ? data : null;
      setTotpUri(totp?.totpURI ?? null);
      setBackupCodes(totp?.backupCodes ?? null);
      toast.success(securityMessages.scanQrToast());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : securityMessages.enable2faFailed());
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndFinish() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) throw new Error(result.error.message);
      toast.success(securityMessages.twoFactorOn());
      setPassword("");
      setCode("");
      setTotpUri(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : securityMessages.invalidCode());
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) throw new Error(result.error.message);
      toast.success(securityMessages.twoFactorDisabled());
      setPassword("");
      setTotpUri(null);
      setBackupCodes(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : securityMessages.disable2faFailed());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title={securityMessages.twoFactorTitle()}
        description={securityMessages.twoFactorDescription()}
      />
      <div className="space-y-4 p-5">
        {enabled && !totpUri ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{securityMessages.twoFactorEnabled()}</p>
            <div className="grid max-w-sm gap-2">
              <Label htmlFor="disable-2fa-password">
                {securityMessages.disablePasswordLabel()}
              </Label>
              <Input
                id="disable-2fa-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            <Button disabled={!password || busy} onClick={disable} size="sm" variant="outline">
              {busy ? securityMessages.disabling() : securityMessages.disable2fa()}
            </Button>
          </div>
        ) : totpUri ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{securityMessages.setupInstructions()}</p>
            <code className="block rounded-lg border border-border bg-muted/40 p-3 text-xs break-all">
              {totpUri}
            </code>
            {backupCodes ? (
              <p className="text-xs text-muted-foreground">
                {securityMessages.backupCodes({ codes: backupCodes.join(", ") })}
              </p>
            ) : null}
            <div className="grid max-w-xs gap-2">
              <Label htmlFor="verify-2fa-code">{securityMessages.authenticatorCodeLabel()}</Label>
              <Input
                id="verify-2fa-code"
                onChange={(event) => setCode(event.target.value)}
                value={code}
              />
            </div>
            <Button disabled={code.length < 6 || busy} onClick={verifyAndFinish} size="sm">
              {busy ? securityMessages.verifying() : securityMessages.verifyAndEnable()}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{securityMessages.twoFactorPitch()}</p>
            <div className="grid max-w-sm gap-2">
              <Label htmlFor="enable-2fa-password">{securityMessages.currentPasswordLabel()}</Label>
              <Input
                id="enable-2fa-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            <Button disabled={!password || busy} onClick={startEnable} size="sm">
              {busy ? securityMessages.starting() : securityMessages.enable2fa()}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function SecurityPage() {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.accountEyebrow()}
        title={securityMessages.title()}
        description={securityMessages.description()}
      />
      <ChangePasswordPanel />
      <TwoFactorPanel />
      <SessionsPanel />
    </div>
  );
}
