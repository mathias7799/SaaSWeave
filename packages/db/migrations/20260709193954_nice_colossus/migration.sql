ALTER TABLE "usage_event" ADD COLUMN "feature" text;--> statement-breakpoint
ALTER TABLE "usage_event" ADD COLUMN "input_tokens" integer;--> statement-breakpoint
ALTER TABLE "usage_event" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "usage_event" ADD COLUMN "output_tokens" integer;--> statement-breakpoint
ALTER TABLE "usage_event" ADD COLUMN "provider" text;--> statement-breakpoint
CREATE INDEX "usage_event_org_model_idx" ON "usage_event" ("organization_id","model");