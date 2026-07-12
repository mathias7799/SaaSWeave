import { Building2, CreditCard, type LucideIcon, ShieldCheck, UserPlus, Users } from "lucide-react";

export type AuditEntryView = {
  id: string;
  action: string;
  actorName: string | null;
  targetType: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

/** Icon for an audit action, chosen by its category prefix. */
export function auditIcon(action: string): LucideIcon {
  if (action.startsWith("workspace")) return Building2;
  if (action.startsWith("invitation")) return UserPlus;
  if (action.startsWith("member")) return Users;
  if (action.startsWith("subscription")) return CreditCard;
  return ShieldCheck;
}

/** Human-readable sentence for an audit entry. */
export function auditSentence(entry: AuditEntryView): string {
  const target = entry.targetLabel ?? "";
  const role = typeof entry.metadata?.role === "string" ? entry.metadata.role : undefined;
  switch (entry.action) {
    case "workspace.created":
      return `Created ${target}`;
    case "workspace.updated":
      return `Updated workspace settings${target ? ` (${target})` : ""}`;
    case "workspace.deleted":
      return `Deleted ${target}`;
    case "member.added":
      return `${target} joined the workspace`;
    case "member.role_updated":
      return `${target}'s role changed${role ? ` to ${role}` : ""}`;
    case "member.removed":
      return `${target} was removed`;
    case "member.impersonated":
      return `${entry.actorName ?? "Someone"} started impersonating ${target}`;
    case "user.impersonated":
      return `${entry.actorName ?? "A platform admin"} started impersonating ${target}`;
    case "invitation.sent":
      return `${entry.actorName ?? "Someone"} invited ${target}`;
    case "invitation.cancelled":
      return `Invitation to ${target} was cancelled`;
    case "subscription.updated":
      return `Subscription updated${target ? ` to ${target}` : ""}`;
    default:
      return `${entry.action.replace(/[._]/g, " ")}${target ? `: ${target}` : ""}`;
  }
}
