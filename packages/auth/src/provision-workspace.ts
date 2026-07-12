import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db, recordAudit } from "@saasweave/db";
import { member, organization } from "@saasweave/db/schema";
import { ENV_SERVER } from "@saasweave/env/server/env";
import { dispatchTemplateEmail } from "@saasweave/jobs/dispatch";

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

export async function provisionPersonalWorkspace(user: {
  email: string;
  id: string;
  name: string;
}): Promise<string> {
  const existing = await db
    .select({ organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, user.id))
    .limit(1);
  if (existing[0]) return existing[0].organizationId;

  const organizationId = randomUUID();
  const firstName = user.name.split(" ")[0] || user.name;
  await db.insert(organization).values({
    createdAt: new Date(),
    id: organizationId,
    name: `${firstName}'s workspace`,
    slug: slugify(user.name)
  });
  await db.insert(member).values({
    createdAt: new Date(),
    id: randomUUID(),
    organizationId,
    role: "owner",
    userId: user.id
  });
  await recordAudit({
    action: "workspace.created",
    actorId: user.id,
    actorName: user.name,
    organizationId,
    targetLabel: `${firstName}'s workspace`,
    targetType: "organization"
  });
  await dispatchTemplateEmail({
    key: "welcome",
    meta: { organizationId },
    to: user.email,
    values: { actionUrl: `${ENV_SERVER.VITE_WEB_URL}/app`, name: firstName }
  });
  return organizationId;
}
