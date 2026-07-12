CREATE TABLE "api_key" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"id" text PRIMARY KEY,
	"key_hash" text NOT NULL UNIQUE,
	"key_prefix" text NOT NULL,
	"name" text NOT NULL,
	"organization_id" text NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "api_key_organizationId_idx" ON "api_key" ("organization_id");--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;