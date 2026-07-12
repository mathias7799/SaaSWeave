import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@saasweave/db";
import { session } from "@saasweave/db/schema";

export type ActiveSession = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  ipAddress: string | null;
  token: string;
  updatedAt: Date;
  userAgent: string | null;
};

export async function listActiveSessionsForUser(userId: string): Promise<ActiveSession[]> {
  const now = new Date();

  return db
    .select({
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      id: session.id,
      ipAddress: session.ipAddress,
      token: session.token,
      updatedAt: session.updatedAt,
      userAgent: session.userAgent
    })
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, now)))
    .orderBy(desc(session.updatedAt));
}
