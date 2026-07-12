import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  getPlanCatalog,
  invalidatePlanCatalogCache,
  listPlans,
  planName,
  planPrice,
  planSeats,
  resolvePlanEntry,
  toPlanTier
} from "@saasweave/app/billing/plan-catalog";
import { type PlanTierType } from "@saasweave/core/plans";
import { db } from "@saasweave/db";
import { organization, plan } from "@saasweave/db/schema";

export { getPlanCatalog, listPlans, planName, planPrice, planSeats, resolvePlanEntry };

export type CreatePlanInput = Omit<PlanTierType, "sortOrder"> & { sortOrder?: number };

export async function createPlan(input: CreatePlanInput): Promise<PlanTierType> {
  const [row] = await db
    .insert(plan)
    .values({
      cta: input.cta,
      highlights: input.highlights,
      id: input.id || randomUUID(),
      name: input.name,
      popular: input.popular ?? false,
      priceMonthly: input.priceMonthly,
      seatPrice: input.seatPrice ?? null,
      seatsIncluded: input.seatsIncluded,
      sortOrder: input.sortOrder ?? 0,
      tagline: input.tagline
    })
    .returning();
  await invalidatePlanCatalogCache();
  return toPlanTier(row);
}

export type UpdatePlanInput = Partial<Omit<PlanTierType, "id">> & { id: string };

export async function updatePlan(input: UpdatePlanInput): Promise<PlanTierType | null> {
  const { id, ...rest } = input;
  const [row] = await db
    .update(plan)
    .set({
      ...(rest.cta !== undefined ? { cta: rest.cta } : {}),
      ...(rest.highlights !== undefined ? { highlights: rest.highlights } : {}),
      ...(rest.name !== undefined ? { name: rest.name } : {}),
      ...(rest.popular !== undefined ? { popular: rest.popular } : {}),
      ...(rest.priceMonthly !== undefined ? { priceMonthly: rest.priceMonthly } : {}),
      ...(rest.seatPrice !== undefined ? { seatPrice: rest.seatPrice } : {}),
      ...(rest.seatsIncluded !== undefined ? { seatsIncluded: rest.seatsIncluded } : {}),
      ...(rest.sortOrder !== undefined ? { sortOrder: rest.sortOrder } : {}),
      ...(rest.tagline !== undefined ? { tagline: rest.tagline } : {})
    })
    .where(eq(plan.id, id))
    .returning();
  await invalidatePlanCatalogCache();
  return row ? toPlanTier(row) : null;
}

export async function isPlanInUse(planId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.planId, planId))
    .limit(1);
  return !!row;
}

export async function deletePlan(planId: string): Promise<boolean> {
  const rows = await db.delete(plan).where(eq(plan.id, planId)).returning({ id: plan.id });
  await invalidatePlanCatalogCache();
  return rows.length > 0;
}
