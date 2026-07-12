import { index, pgTable, text } from "drizzle-orm/pg-core";

import { organization } from "#@/schema/auth.schema";
import { user } from "#@/schema/auth.schema";

/** Enterprise SSO provider configuration (OIDC or SAML). */
export const ssoProvider = pgTable(
  "sso_provider",
  {
    domain: text("domain").notNull(),
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    oidcConfig: text("oidc_config"),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade"
    }),
    providerId: text("provider_id").notNull().unique(),
    samlConfig: text("saml_config"),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" })
  },
  (table) => [
    index("sso_provider_domain_idx").on(table.domain),
    index("sso_provider_org_idx").on(table.organizationId)
  ]
);
