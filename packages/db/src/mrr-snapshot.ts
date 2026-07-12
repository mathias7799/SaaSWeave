import { randomUUID } from "node:crypto";

import { desc } from "drizzle-orm";

import { db } from "#@/connection";
import { mrrSnapshot } from "#@/schema/mrr-snapshot.schema";

export type MrrSnapshotRow = {
  activeOrgs: number;
  capturedAt: Date;
  churnedMrr: number | null;
  currency: string;
  id: string;
  mrr: number;
  newMrr: number;
  periodMonth: string;
};

export type UpsertMrrSnapshotInput = {
  activeOrgs: number;
  churnedMrr: number | null;
  currency: string;
  mrr: number;
  newMrr: number;
  periodMonth: string;
};

/** Insert or refresh the snapshot for a calendar month bucket. */
export async function upsertMrrSnapshot(input: UpsertMrrSnapshotInput): Promise<void> {
  const capturedAt = new Date();
  await db
    .insert(mrrSnapshot)
    .values({
      activeOrgs: input.activeOrgs,
      capturedAt,
      churnedMrr: input.churnedMrr,
      currency: input.currency,
      id: randomUUID(),
      mrr: input.mrr,
      newMrr: input.newMrr,
      periodMonth: input.periodMonth
    })
    .onConflictDoUpdate({
      set: {
        activeOrgs: input.activeOrgs,
        capturedAt,
        churnedMrr: input.churnedMrr,
        currency: input.currency,
        mrr: input.mrr,
        newMrr: input.newMrr
      },
      target: mrrSnapshot.periodMonth
    });
}

/** Most recent snapshots, newest month first. */
export async function listMrrSnapshots(limit: number): Promise<MrrSnapshotRow[]> {
  const rows = await db
    .select()
    .from(mrrSnapshot)
    .orderBy(desc(mrrSnapshot.periodMonth))
    .limit(limit);
  return rows;
}
