CREATE TABLE "organization_ip_rule" (
	"cidr" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"id" text PRIMARY KEY,
	"label" text,
	"organization_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_key" ADD COLUMN "scopes" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX "organization_ip_rule_org_idx" ON "organization_ip_rule" ("organization_id");--> statement-breakpoint
ALTER TABLE "organization_ip_rule" ADD CONSTRAINT "organization_ip_rule_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "organization_ip_rule" ADD CONSTRAINT "organization_ip_rule_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;