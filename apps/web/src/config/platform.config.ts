/**
 * Platform configuration — product identity and defaults that aren't stored
 * in the database. Plans and feature flags used to live here as frozen
 * arrays; they are now real, admin-editable data (`packages/db` `plan` and
 * `feature_flag` tables, seeded once from `@saasweave/core`'s
 * `DEFAULT_PLANS`/`DEFAULT_FEATURES`). Fetch them via `catalog.plans`,
 * `admin.features.list`, or `console.features` instead of reading a static
 * config.
 *
 * The template ships intentionally generic ("workspace", "customer", "product")
 * so it fits whatever SaaSWeave turns out to be: a software product, an API, a
 * seat-based tool, or a usage-metered service.
 */

export type {
  FeatureCategory,
  PlatformFeatureType as PlatformFeature
} from "@saasweave/core/features";
export type { PlanTierType as PlanTier } from "@saasweave/core/plans";

export type BillingMode = "subscription" | "usage" | "hybrid";

export const platformConfig = Object.freeze({
  /** What you sell. Kept generic so the template fits any offering. */
  product: {
    /** How a single customer account is referred to across the UI. */
    accountNoun: "workspace",
    /** How the buyer is referred to in the admin platform. */
    customerNoun: "customer",
    /** The thing being sold, used in admin catalog copy. */
    offeringNoun: "plan"
  },

  currency: "USD",

  /**
   * Billing model default, seeded into `platform_settings.billingMode` on
   * first read. Admins change the live value from `/admin/settings`.
   *  - "subscription" → fixed-price tiers, plan picker, no usage meters
   *  - "usage"        → metered usage with overage, no plan tiers
   *  - "hybrid"       → a base plan plus metered overages (the default)
   */
  billingMode: "hybrid" as BillingMode,

  /** Annual billing discount, expressed as months free per year. */
  annualMonthsFree: 2
});
