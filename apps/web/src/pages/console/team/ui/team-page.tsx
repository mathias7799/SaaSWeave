import { useMutation, useQuery } from "@tanstack/react-query";
import { MoreHorizontal, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@saasweave/auth/react/auth-client";
import { impersonateWorkspaceMember } from "@saasweave/auth/react/impersonation";
import { getAuthUserQueryOptions } from "@saasweave/auth/react/tanstack-start/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@saasweave/ui/components/avatar";
import { Button } from "@saasweave/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@saasweave/ui/components/dropdown-menu";
import { Input } from "@saasweave/ui/components/input";
import { Label } from "@saasweave/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@saasweave/ui/components/sheet";

import { consoleCommonMessages, teamMessages } from "@/shared/lib/console-messages";
import {
  Badge,
  ConsoleSkeleton,
  formatDate,
  formatNumber,
  Panel,
  PanelHeader,
  SectionHeading,
  StatTile
} from "@/shared/ui/console-kit";

import { useGetTeamQuery, useInvalidateTeamQuery } from "@/pages/console/team/api/get-team.query";

const ASSIGNABLE_ROLES = ["admin", "developer", "analyst", "billing", "member"] as const;

const ROLE_TONE: Record<string, "brand" | "info" | "neutral"> = {
  admin: "brand",
  analyst: "neutral",
  billing: "info",
  developer: "neutral",
  member: "neutral",
  owner: "brand"
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function InviteSheet() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("member");
  const invalidate = useInvalidateTeamQuery();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await authClient.organization.inviteMember({ email, role: role as "member" });
      if (result.error) throw new Error(result.error.message ?? teamMessages.inviteFailed());
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success(teamMessages.invitationSent({ email }));
      setEmail("");
      setRole("member");
      setOpen(false);
      await invalidate();
    }
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <UserPlus className="size-4" aria-hidden="true" />
          {teamMessages.inviteMembers()}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle>{teamMessages.inviteTitle()}</SheetTitle>
          <SheetDescription>{teamMessages.inviteDescription()}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-5 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-email">{consoleCommonMessages.emailLabel()}</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={teamMessages.emailPlaceholder()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{teamMessages.roleLabel()}</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ASSIGNABLE_ROLES.map((option) => (
                <option key={option} value={option}>
                  {teamMessages.roleLabelFor(option)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? teamMessages.sending() : teamMessages.sendInvitation()}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function MemberActions({
  memberId,
  memberName,
  role,
  userId,
  disabled
}: {
  memberId: string;
  memberName: string;
  role: string;
  userId: string;
  disabled: boolean;
}) {
  const invalidate = useInvalidateTeamQuery();

  const changeRole = useMutation({
    mutationFn: async (nextRole: string) => {
      const result = await authClient.organization.updateMemberRole({
        memberId,
        role: nextRole as "member"
      });
      if (result.error) throw new Error(result.error.message ?? teamMessages.updateRoleFailed());
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success(teamMessages.roleUpdated({ name: memberName }));
      await invalidate();
    }
  });

  const remove = useMutation({
    mutationFn: async () => {
      const result = await authClient.organization.removeMember({ memberIdOrEmail: memberId });
      if (result.error) throw new Error(result.error.message ?? teamMessages.removeFailed());
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success(teamMessages.memberRemoved({ name: memberName }));
      await invalidate();
    }
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={teamMessages.manageMemberAria({ name: memberName })}
          disabled={disabled}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{teamMessages.changeRole()}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(next) => changeRole.mutate(next)}>
          {ASSIGNABLE_ROLES.map((option) => (
            <DropdownMenuRadioItem key={option} value={option} className="cursor-pointer">
              {teamMessages.roleLabelFor(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={async () => {
            try {
              await impersonateWorkspaceMember(userId);
              window.location.assign("/app");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : teamMessages.impersonateFailed()
              );
            }
          }}
        >
          {teamMessages.impersonate()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onClick={() => remove.mutate()}
        >
          {teamMessages.removeFromWorkspace()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamPage() {
  const query = useGetTeamQuery();
  const { data: currentUser } = useQuery(getAuthUserQueryOptions());
  const invalidate = useInvalidateTeamQuery();

  const cancelInvite = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await authClient.organization.cancelInvitation({ invitationId });
      if (result.error) {
        throw new Error(result.error.message ?? teamMessages.cancelInvitationFailed());
      }
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success(teamMessages.invitationCancelled());
      await invalidate();
    }
  });

  if (!query.data) return <ConsoleSkeleton />;
  const data = query.data;

  const myRole = data.members.find((entry) => entry.userId === currentUser?.id)?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={consoleCommonMessages.organizationEyebrow()}
        title={teamMessages.title()}
        description={teamMessages.description()}
        action={canManage ? <InviteSheet /> : null}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={teamMessages.activeSeats()} value={formatNumber(data.seatsUsed)} />
        <StatTile label={teamMessages.seatsIncluded()} value={formatNumber(data.seatsIncluded)} />
        <StatTile label={teamMessages.pendingInvites()} value={formatNumber(data.pendingInvites)} />
      </div>

      <Panel>
        <PanelHeader
          title={teamMessages.membersTitle()}
          description={consoleCommonMessages.peopleCount({ count: data.members.length })}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-5 py-3 font-medium">{consoleCommonMessages.member()}</th>
                <th className="px-5 py-3 font-medium">{consoleCommonMessages.role()}</th>
                <th className="px-5 py-3 font-medium">{consoleCommonMessages.joined()}</th>
                <th className="px-5 py-3 text-right font-medium">
                  <span className="sr-only">{consoleCommonMessages.actionsSr()}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.members.map((member) => {
                const isSelf = member.userId === currentUser?.id;
                return (
                  <tr key={member.id} className="transition-colors hover:bg-muted/50">
                    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- cell contains the member name/email as text */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8 text-xs">
                          <AvatarImage src={member.image ?? undefined} alt={member.name} />
                          <AvatarFallback>{initials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">
                            {member.name}
                            {isSelf ? (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                {consoleCommonMessages.you()}
                              </span>
                            ) : null}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={ROLE_TONE[member.role] ?? "neutral"}>
                        {teamMessages.roleLabelFor(member.role)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(member.joinedAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canManage ? (
                        <MemberActions
                          memberId={member.id}
                          memberName={member.name}
                          role={member.role}
                          userId={member.userId}
                          disabled={isSelf || member.role === "owner"}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {data.invitations.length > 0 ? (
        <Panel>
          <PanelHeader
            title={teamMessages.pendingInvitationsTitle()}
            description={teamMessages.pendingAwaiting({ count: data.invitations.length })}
          />
          <ul className="divide-y divide-border">
            {data.invitations.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {teamMessages.invitedOn({
                      date: formatDate(invite.invitedAt),
                      role: teamMessages.roleLabelFor(invite.role)
                    })}
                  </p>
                </div>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelInvite.mutate(invite.id)}
                    disabled={cancelInvite.isPending}
                  >
                    <X className="size-4" aria-hidden="true" />
                    {teamMessages.cancelInvitation()}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
