import { and, eq, lt } from "drizzle-orm";

import { db } from "@saasweave/db";
import { invitation } from "@saasweave/db/schema";

/** Expire pending invitations older than 30 days. */
export async function expireStaleInvitations(): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const rows = await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(and(eq(invitation.status, "pending"), lt(invitation.expiresAt, cutoff)))
    .returning({ id: invitation.id });
  return rows.length;
}
