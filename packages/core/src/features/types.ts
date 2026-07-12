import { z } from "zod";

export const FEATURE_CATEGORIES = ["Core", "AI", "Collaboration", "Security", "Billing"] as const;

export const FeatureCategorySchema = z.enum(FEATURE_CATEGORIES);

export type FeatureCategory = z.infer<typeof FeatureCategorySchema>;

export const PlatformFeatureSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: FeatureCategorySchema,
  /** Default rollout state on the platform. */
  enabled: z.boolean(),
  /** Plan ids this feature is available on. */
  availableOn: z.array(z.string()),
  /** Optional staged rollout percentage (0-100). */
  rollout: z.number().int().min(0).max(100).nullable().optional()
});

export type PlatformFeatureType = z.infer<typeof PlatformFeatureSchema>;

/**
 * Shipped capabilities — synced to `feature_flag` and editable at `/admin/features`.
 * Only list features here when the product surface and API enforcement exist.
 */
export const DEFAULT_FEATURES: PlatformFeatureType[] = [
  {
    key: "api_keys",
    name: "API keys",
    description: "Programmatic access keys for workspace integrations.",
    category: "Core",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "webhooks",
    name: "Webhooks",
    description: "Outbound HTTP notifications for workspace events.",
    category: "Core",
    enabled: true,
    availableOn: ["growth", "scale", "enterprise"]
  },
  {
    key: "ai_assistant",
    name: "AI usage",
    description: "Workspace AI token usage, cost breakdowns, and model attribution.",
    category: "AI",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "sso",
    name: "SSO / SAML",
    description: "Single sign-on with SAML 2.0 for enterprise identity providers.",
    category: "Security",
    enabled: true,
    availableOn: ["scale", "enterprise"]
  },
  {
    key: "audit_logs",
    name: "Audit logs",
    description: "Immutable log of security-relevant workspace actions.",
    category: "Security",
    enabled: true,
    availableOn: ["scale", "enterprise"]
  },
  {
    key: "usage_billing",
    name: "Usage-based overage",
    description: "Record and bill metered usage beyond plan allowance.",
    category: "Billing",
    enabled: true,
    availableOn: ["growth", "scale", "enterprise"]
  },
  {
    key: "api_key_scopes",
    name: "API key scopes",
    description: "Assign read/write scopes to workspace API keys for least-privilege integrations.",
    category: "Core",
    enabled: true,
    availableOn: ["growth", "scale", "enterprise"]
  },
  {
    key: "annual_billing",
    name: "Annual billing",
    description: "Offer annual subscription checkout with configured Stripe annual prices.",
    category: "Billing",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "ip_allowlist",
    name: "IP allowlist",
    description: "Restrict workspace console and API access to configured IP ranges.",
    category: "Security",
    enabled: true,
    availableOn: ["scale", "enterprise"]
  },
  {
    key: "audit_export",
    name: "Audit log export",
    description: "Export workspace audit events as CSV or JSON for compliance.",
    category: "Security",
    enabled: true,
    availableOn: ["scale", "enterprise"]
  },
  {
    key: "data_export",
    name: "Data export",
    description: "Request a full workspace data export for GDPR portability.",
    category: "Security",
    enabled: true,
    availableOn: ["scale", "enterprise"]
  },
  {
    key: "magic_link",
    name: "Magic link sign-in",
    description: "Passwordless email link authentication for sign-in and sign-up.",
    category: "Security",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "billing_portal",
    name: "Billing portal",
    description: "Workspace billing page, Stripe checkout, and customer portal.",
    category: "Billing",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "team_management",
    name: "Team management",
    description: "Workspace roster, seat usage, and pending invitations.",
    category: "Core",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "notifications",
    name: "Notifications",
    description: "In-app notification inbox and unread counts for workspace members.",
    category: "Core",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "two_factor",
    name: "Two-factor authentication",
    description: "Console security page for enrolling and managing TOTP 2FA.",
    category: "Security",
    enabled: true,
    availableOn: ["starter", "growth", "scale", "enterprise"]
  },
  {
    key: "batch_jobs",
    name: "Batch processing",
    description: "Async batch enrichment and generation jobs.",
    category: "AI",
    enabled: false,
    availableOn: ["growth", "scale", "enterprise"]
  }
];

/** Keys backed by a real console surface and server-side enforcement. */
export const IMPLEMENTED_FEATURE_KEYS = DEFAULT_FEATURES.map((feature) => feature.key);

/**
 * Roadmap-only capabilities — not synced to the database and not toggleable yet.
 * Shown in admin as read-only TODO items until implemented.
 */
export const PLANNED_FEATURES: PlatformFeatureType[] = [
  {
    key: "custom_models",
    name: "Custom model routing",
    description: "TODO: Route requests to fine-tuned or bring-your-own models.",
    category: "AI",
    enabled: false,
    availableOn: ["scale", "enterprise"]
  },
  {
    key: "shared_workspaces",
    name: "Shared workspaces",
    description: "TODO: Cross-workspace collaboration, comments, and shared history.",
    category: "Collaboration",
    enabled: false,
    availableOn: ["growth", "scale", "enterprise"]
  },
  {
    key: "invoicing",
    name: "Custom invoicing",
    description: "TODO: Purchase orders, net terms, and manual invoicing.",
    category: "Billing",
    enabled: false,
    availableOn: ["enterprise"]
  }
];
