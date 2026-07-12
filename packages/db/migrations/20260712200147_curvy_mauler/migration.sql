CREATE INDEX "audit_log_retention_candidate_idx" ON "audit_log" ("created_at") WHERE "action" NOT LIKE 'auth.%' AND "action" NOT LIKE 'security.%' AND "action" NOT LIKE 'api_key.%' AND "action" NOT LIKE 'sso.%' AND "action" NOT LIKE 'billing.%';--> statement-breakpoint
CREATE INDEX "webhook_delivery_created_at_idx" ON "webhook_delivery" ("created_at");--> statement-breakpoint
UPDATE "media_asset" SET "purpose" = 'private' WHERE "purpose" = 'export';--> statement-breakpoint
UPDATE "email_delivery" SET "provider" = 'console' WHERE "provider" = 'log';--> statement-breakpoint
ALTER TABLE "batch_job" ADD CONSTRAINT "batch_job_type_check" CHECK ("type" IN ('uppercase'));--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_format_check" CHECK ("format" IN ('ndjson'));--> statement-breakpoint
ALTER TABLE "email_delivery" ADD CONSTRAINT "email_delivery_provider_check" CHECK ("provider" IN ('console', 'resend', 'smtp'));--> statement-breakpoint
ALTER TABLE "email_delivery" ADD CONSTRAINT "email_delivery_status_check" CHECK ("status" IN ('sent', 'logged', 'failed'));--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_status_check" CHECK ("status" IN ('delivered', 'failed'));--> statement-breakpoint
ALTER TABLE "media_asset" DROP CONSTRAINT "media_asset_purpose_check", ADD CONSTRAINT "media_asset_purpose_check" CHECK ("purpose" IN ('avatar', 'attachment', 'private'));
