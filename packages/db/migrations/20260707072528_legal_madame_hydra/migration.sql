CREATE TABLE "audit_log" (
	"action" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"metadata" jsonb,
	"organization_id" text,
	"target_label" text,
	"target_type" text
);
--> statement-breakpoint
CREATE INDEX "audit_log_org_createdAt_idx" ON "audit_log" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log" ("created_at");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;