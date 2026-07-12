import { asc } from "drizzle-orm";

import { cacheInvalidateTag, cacheWrap } from "@saasweave/cache";
import { type PlanTierType } from "@saasweave/core/plans";
import { DEFAULT_PLANS } from "@saasweave/core/plans";
import { db } from "@saasweave/db";
import { plan } from "@saasweave/db/schema";

const CATALOG_TAG = "platform:plans";
const CATALOG_CACHE_KEY = "catalog";
const CATALOG_NAMESPACE = "plans";

const FREE: { name: string; price: number; seats: number } = { name: "Free", price: 0, seats: 3 };

let seeded = false;

/** Insert the default plan catalog if the table is still empty. Runs once per process. */
export async function ensurePlansSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const [existing] = await db.select({ id: plan.id }).from(plan).limit(1);
  if (existing) return;
  await db
    .insert(plan)
    .values(
      DEFAULT_PLANS.map((entry, index) => {
        return {
          cta: entry.cta,
          highlights: entry.highlights,
          id: entry.id,
          name: entry.name,
          popular: entry.popular ?? false,
          priceMonthly: entry.priceMonthly,
          seatPrice: entry.seatPrice ?? null,
          seatsIncluded: entry.seatsIncluded,
          sortOrder: entry.sortOrder ?? index,
          tagline: entry.tagline
        };
      })
    )
    .onConflictDoNothing();
}

export function toPlanTier(row: typeof plan.$inferSelect): PlanTierType {
  return {
    cta: row.cta,
    highlights: row.highlights,
    id: row.id,
    name: row.name,
    popular: row.popular,
    priceMonthly: row.priceMonthly,
    seatPrice: row.seatPrice ?? undefined,
    seatsIncluded: row.seatsIncluded,
    sortOrder: row.sortOrder,
    tagline: row.tagline
  };
}

/** Full plan catalog, sorted for display. Seeds from `@saasweave/core` defaults on first read. */
export async function listPlans(): Promise<PlanTierType[]> {
  await ensurePlansSeeded();
  const rows = await db.select().from(plan).orderBy(asc(plan.sortOrder));
  return rows.map(toPlanTier);
}

/** Cached id -> {name, price, seats} lookup used by billing/analytics call sites. */
export async function getPlanCatalog(): Promise<
  Map<string, { name: string; price: number; seats: number }>
> {
  const entries = await cacheWrap(
    CATALOG_CACHE_KEY,
    async () => {
      const plans = await listPlans();
      return plans.map((entry) => [
        entry.id,
        { name: entry.name, price: entry.priceMonthly ?? 0, seats: entry.seatsIncluded }
      ]) as Array<[string, { name: string; price: number; seats: number }]>;
    },
    { namespace: CATALOG_NAMESPACE, tags: [CATALOG_TAG], ttlSeconds: 30 }
  );
  return new Map(entries);
}

export async function invalidatePlanCatalogCache(): Promise<void> {
  await cacheInvalidateTag(CATALOG_TAG);
}

/** Look up a resolved catalog entry (from `getPlanCatalog()`), falling back to Free. */
export function resolvePlanEntry(
  catalog: Map<string, { name: string; price: number; seats: number }>,
  planId: string | null | undefined
): { name: string; price: number; seats: number } {
  if (!planId) return FREE;
  return catalog.get(planId) ?? FREE;
}

export async function planEntry(
  planId: string | null | undefined
): Promise<{ name: string; price: number; seats: number }> {
  if (!planId) return FREE;
  const catalog = await getPlanCatalog();
  return catalog.get(planId) ?? FREE;
}

export async function planPrice(planId: string | null | undefined): Promise<number> {
  return (await planEntry(planId)).price;
}

export async function planSeats(planId: string | null | undefined): Promise<number> {
  return (await planEntry(planId)).seats;
}

export async function planName(planId: string | null | undefined): Promise<string> {
  return (await planEntry(planId)).name;
}
