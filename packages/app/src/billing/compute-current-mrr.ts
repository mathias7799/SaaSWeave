import { db, getPlatformSettings } from "@saasweave/db";
import { organization } from "@saasweave/db/schema";

import { getPlanCatalog, resolvePlanEntry } from "#@/billing/plan-catalog";

export type ComputeCurrentMrrResult = {
  activeOrgs: number;
  churnedMrr: number | null;
  currency: string;
  mrr: number;
  newMrr: number;
};

type OrgRow = {
  createdAt: Date;
  planId: string | null;
  subscriptionStatus: string | null;
};

function currentPeriodMonth(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

function monthBounds(periodMonth: string): { monthStart: Date; nextMonth: Date } {
  const [year, month] = periodMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const nextMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { monthStart, nextMonth };
}

function sumMrrForOrgs(
  orgs: OrgRow[],
  catalog: Map<string, { name: string; price: number; seats: number }>
): number {
  return orgs.reduce((sum, org) => sum + resolvePlanEntry(catalog, org.planId).price, 0);
}

/** Shared MRR math for admin analytics and the nightly snapshot job. */
export async function computeCurrentMrr(
  periodMonth: string = currentPeriodMonth()
): Promise<ComputeCurrentMrrResult> {
  const [{ monthStart, nextMonth }, catalog, orgRows, settings] = await Promise.all([
    Promise.resolve(monthBounds(periodMonth)),
    getPlanCatalog(),
    db
      .select({
        createdAt: organization.createdAt,
        planId: organization.planId,
        subscriptionStatus: organization.subscriptionStatus
      })
      .from(organization),
    getPlatformSettings()
  ]);

  const activeOrgs = orgRows.filter((org) => org.subscriptionStatus !== "canceled");
  const mrr = sumMrrForOrgs(activeOrgs, catalog);
  const newMrr = sumMrrForOrgs(
    activeOrgs.filter((org) => org.createdAt >= monthStart && org.createdAt < nextMonth),
    catalog
  );

  return {
    activeOrgs: activeOrgs.length,
    // Cancellation timestamps are not stored on organizations; monthly churn is unknown.
    churnedMrr: null,
    currency: settings.currency,
    mrr,
    newMrr
  };
}

export function periodMonthLabel(periodMonth: string): string {
  const [year, month] = periodMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}
