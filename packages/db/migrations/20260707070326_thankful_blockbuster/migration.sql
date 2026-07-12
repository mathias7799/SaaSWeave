CREATE TABLE "usage_event" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"metric" text NOT NULL,
	"organization_id" text NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "usage_event_org_metric_idx" ON "usage_event" ("organization_id","metric");--> statement-breakpoint
CREATE INDEX "usage_event_createdAt_idx" ON "usage_event" ("created_at");--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;