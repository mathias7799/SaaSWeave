CREATE TABLE "platform_analytics_daily" (
	"id" text PRIMARY KEY,
	"metadata" jsonb,
	"metric_key" text NOT NULL,
	"refreshed_at" timestamp DEFAULT now() NOT NULL,
	"stat_date" date NOT NULL,
	"value" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batch_job_item" ADD COLUMN "claimed_at" timestamp;--> statement-breakpoint
ALTER TABLE "batch_job_item" ADD COLUMN "lease_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "batch_job_item" ADD COLUMN "worker_id" text;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD COLUMN "bytes_written" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD COLUMN "canceled_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD COLUMN "checkpoint" jsonb;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD COLUMN "format" text DEFAULT 'ndjson' NOT NULL;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD COLUMN "rows_written" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "batch_job_status_updated_idx" ON "batch_job" ("status","updated_at");--> statement-breakpoint
CREATE INDEX "batch_job_item_claimable_idx" ON "batch_job_item" ("batch_job_id","status","lease_expires_at","created_at");--> statement-breakpoint
CREATE INDEX "media_asset_owner_status_created_idx" ON "media_asset" ("owner_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_analytics_daily_date_metric_idx" ON "platform_analytics_daily" ("stat_date","metric_key");--> statement-breakpoint
CREATE INDEX "platform_analytics_daily_metric_date_idx" ON "platform_analytics_daily" ("metric_key","stat_date");--> statement-breakpoint
CREATE INDEX "usage_event_org_metric_created_idx" ON "usage_event" ("organization_id","metric","created_at");--> statement-breakpoint
ALTER TABLE "batch_job" ADD CONSTRAINT "batch_job_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'canceled'));--> statement-breakpoint
ALTER TABLE "batch_job_item" ADD CONSTRAINT "batch_job_item_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'failed'));--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_status_check" CHECK ("status" IN ('pending', 'processing', 'ready', 'failed', 'canceled'));--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_purpose_check" CHECK ("purpose" IN ('avatar', 'attachment', 'export', 'private'));--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_status_check" CHECK ("status" IN ('pending', 'uploaded', 'linked', 'orphan', 'deleted'));