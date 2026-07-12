import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@saasweave/auth/react/auth-client";
import { useAuth } from "@saasweave/auth/react/tanstack-start/hooks";
import { Button } from "@saasweave/ui/components/button";
import { Input } from "@saasweave/ui/components/input";

import { impersonateAndOpenConsole } from "@/shared/lib/impersonate-and-open-console";
import { ConfirmActionDialog } from "@/shared/ui/confirm-action-dialog";
import {
  Badge,
  ConsoleEmptyState,
  ConsoleErrorState,
  ConsoleSkeleton,
  formatDate,
  Panel,
  PanelHeader,
  SectionHeading,
  Segmented
} from "@/shared/ui/console-kit";

const USERS_QUERY_KEY = ["auth", "admin", "users"];

function usersQueryOptions(search: string) {
  return queryOptions({
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: {
          limit: 100,
          searchField: "email",
          searchOperator: "contains",
          searchValue: search || undefined
        }
      });
      if (result.error) throw new Error(result.error.message ?? "Failed to load users");
      return result.data;
    },
    queryKey: [...USERS_QUERY_KEY, search]
  });
}

function RoleControl({
  userId,
  role,
  isSelf,
  onChanged
}: {
  userId: string;
  role: string;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function setRole(next: "admin" | "user") {
    if (next === role || pending) return;
    setPending(true);
    try {
      const result = await authClient.admin.setRole({ role: next, userId });
      if (result.error) throw new Error(result.error.message);
      toast.success(next === "admin" ? "Granted platform admin" : "Removed platform admin");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role");
    } finally {
      setPending(false);
    }
  }

  if (isSelf) {
    return (
      <Badge tone={role === "admin" ? "brand" : "neutral"}>
        {role === "admin" ? "Admin" : "User"}
      </Badge>
    );
  }

  return (
    <Segmented
      ariaLabel={`Role for user ${userId}`}
      onChange={setRole}
      options={[
        { label: "User", value: "user" },
        { label: "Admin", value: "admin" }
      ]}
      value={role === "admin" ? "admin" : "user"}
    />
  );
}

function BanControl({
  userId,
  banned,
  isSelf,
  onChanged
}: {
  userId: string;
  banned: boolean;
  isSelf: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function unban() {
    setPending(true);
    try {
      const result = await authClient.admin.unbanUser({ userId });
      if (result.error) throw new Error(result.error.message);
      toast.success("User unbanned");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not unban user");
    } finally {
      setPending(false);
    }
  }

  async function ban() {
    setPending(true);
    try {
      const result = await authClient.admin.banUser({
        banReason: "Banned by platform admin",
        userId
      });
      if (result.error) throw new Error(result.error.message);
      toast.success("User banned");
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not ban user");
    } finally {
      setPending(false);
    }
  }

  if (isSelf) return null;

  if (banned) {
    return (
      <Button disabled={pending} onClick={unban} size="sm" variant="outline">
        {pending ? "Unbanning…" : "Unban"}
      </Button>
    );
  }

  return (
    <ConfirmActionDialog
      confirmLabel="Ban user"
      description="They'll be signed out of every session immediately and won't be able to sign back in until unbanned."
      onConfirm={ban}
      title="Ban this user?"
    >
      <Button disabled={pending} size="sm" variant="outline">
        Ban
      </Button>
    </ConfirmActionDialog>
  );
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const query = useQuery(usersQueryOptions(search));
  const queryClient = useQueryClient();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY });
  }

  if (query.isError) {
    return (
      <ConsoleErrorState
        description="Couldn't load platform users."
        onRetry={() => query.refetch()}
      />
    );
  }
  if (!query.data) return <ConsoleSkeleton />;

  const users = query.data.users;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Platform"
        title="Users"
        description="Every account on the platform. Grant platform-admin access or ban accounts that violate your terms."
        action={<Badge tone="neutral">{query.data.total} total</Badge>}
      />

      <Panel>
        <PanelHeader
          title="All users"
          action={
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Search users by email"
                className="h-9 w-56 pl-8"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email"
                type="search"
                value={search}
              />
            </div>
          }
        />
        {users.length > 0 ? (
          <ul className="divide-y divide-border">
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <li className="flex items-center justify-between gap-4 px-5 py-3.5" key={user.id}>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {user.name}
                      {isSelf ? <Badge tone="neutral">You</Badge> : null}
                      {user.banned ? <Badge tone="destructive">Banned</Badge> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.email} · Joined {formatDate(user.createdAt.toISOString())}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleControl
                      isSelf={isSelf}
                      onChanged={refresh}
                      role={user.role ?? "user"}
                      userId={user.id}
                    />
                    <BanControl
                      banned={!!user.banned}
                      isSelf={isSelf}
                      onChanged={refresh}
                      userId={user.id}
                    />
                    {!isSelf ? (
                      <Button
                        onClick={() => impersonateAndOpenConsole(user.id)}
                        size="sm"
                        variant="outline"
                      >
                        Impersonate
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <ConsoleEmptyState title="No users match your search" />
        )}
      </Panel>
    </div>
  );
}
