ALTER TABLE "data_export_request" ADD COLUMN "download_revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN "replaced_at" timestamp;--> statement-breakpoint
CREATE INDEX "data_export_request_expires_at_idx" ON "data_export_request" ("expires_at");--> statement-breakpoint
CREATE INDEX "media_asset_replaced_at_idx" ON "media_asset" ("replaced_at");