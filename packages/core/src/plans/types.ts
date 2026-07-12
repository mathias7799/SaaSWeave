import { z } from "zod";

export const PlanTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tagline: z.string().min(1),
  /** Monthly price in whole currency units. `null` renders as "Custom". */
  priceMonthly: z.number().int().nonnegative().nullable(),
  /** Per-seat add-on price, if the plan bills per seat beyond what's included. */
  seatPrice: z.number().int().nonnegative().nullable().optional(),
  seatsIncluded: z.number().int().nonnegative(),
  highlights: z.array(z.string()),
  popular: z.boolean().optional(),
  cta: z.string().min(1),
  sortOrder: z.number().int().optional()
});

export type PlanTierType = z.infer<typeof PlanTierSchema>;

/**
 * Seed source of truth for the `plan` DB table. Loaded once (on first read,
 * if the table is empty) then fully admin-editable from `/admin/plans`.
 */
export const DEFAULT_PLANS: PlanTierType[] = [
  {
    id: "starter",
    name: "Starter",
    tagline: "For small teams getting off the ground.",
    priceMonthly: 49,
    seatPrice: 12,
    seatsIncluded: 3,
    cta: "Downgrade",
    highlights: ["3 seats included", "10M AI tokens / mo", "Community support"],
    sortOrder: 0
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For teams putting AI into production.",
    priceMonthly: 199,
    seatPrice: 19,
    seatsIncluded: 10,
    popular: true,
    cta: "Choose Growth",
    highlights: ["10 seats included", "60M AI tokens / mo", "Usage-based overage", "Email support"],
    sortOrder: 1
  },
  {
    id: "scale",
    name: "Scale",
    tagline: "For scaling companies that need control.",
    priceMonthly: 499,
    seatPrice: 29,
    seatsIncluded: 25,
    cta: "Current plan",
    highlights: [
      "25 seats included",
      "120M AI tokens / mo",
      "SSO & audit logs",
      "Priority support"
    ],
    sortOrder: 2
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "For organizations with bespoke needs.",
    priceMonthly: null,
    seatPrice: null,
    seatsIncluded: 100,
    cta: "Contact sales",
    highlights: ["Unlimited seats", "Custom token limits", "SAML & SCIM", "Dedicated support"],
    sortOrder: 3
  }
];
