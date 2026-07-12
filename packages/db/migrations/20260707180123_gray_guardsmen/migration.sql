CREATE TABLE "sso_provider" (
	"domain" text NOT NULL,
	"id" text PRIMARY KEY,
	"issuer" text NOT NULL,
	"oidc_config" text,
	"organization_id" text,
	"provider_id" text NOT NULL UNIQUE,
	"saml_config" text,
	"user_id" text
);
--> statement-breakpoint
CREATE INDEX "sso_provider_domain_idx" ON "sso_provider" ("domain");--> statement-breakpoint
CREATE INDEX "sso_provider_org_idx" ON "sso_provider" ("organization_id");--> statement-breakpoint
ALTER TABLE "sso_provider" ADD CONSTRAINT "sso_provider_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sso_provider" ADD CONSTRAINT "sso_provider_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;