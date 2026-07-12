import { and, eq } from "drizzle-orm";

import { db } from "@saasweave/db";
import { invitation, member, user } from "@saasweave/db/schema";

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  joinedAt: string;
};

export type TeamInvite = {
  id: string;
  email: string;
  role: string | null;
  invitedAt: string;
};

export type TeamResponse = {
  organizationId: string;
  members: TeamMember[];
  invitations: TeamInvite[];
  seatsUsed: number;
  seatsIncluded: number;
  pendingInvites: number;
};

/** Real, org-scoped roster + pending invitations for the active workspace. */
export async function getTeam(
  organizationId: string,
  seatsIncluded: number
): Promise<TeamResponse> {
  const members = await db
    .select({
      email: user.email,
      id: member.id,
      image: user.image,
      joinedAt: member.createdAt,
      name: user.name,
      role: member.role,
      userId: member.userId
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));

  const invites = await db
    .select({
      email: invitation.email,
      id: invitation.id,
      invitedAt: invitation.createdAt,
      role: invitation.role
    })
    .from(invitation)
    .where(and(eq(invitation.organizationId, organizationId), eq(invitation.status, "pending")));

  const shaped: TeamMember[] = members.map((entry) => {
    return {
      email: entry.email,
      id: entry.id,
      image: entry.image,
      joinedAt: entry.joinedAt.toISOString(),
      name: entry.name,
      role: entry.role,
      userId: entry.userId
    };
  });
  // Owners first, then everyone else in query order (no array mutation).
  const ordered = [
    ...shaped.filter((entry) => entry.role === "owner"),
    ...shaped.filter((entry) => entry.role !== "owner")
  ];

  return {
    invitations: invites.map((invite) => {
      return {
        email: invite.email,
        id: invite.id,
        invitedAt: invite.invitedAt.toISOString(),
        role: invite.role
      };
    }),
    members: ordered,
    organizationId,
    pendingInvites: invites.length,
    seatsIncluded,
    seatsUsed: members.length
  };
}
