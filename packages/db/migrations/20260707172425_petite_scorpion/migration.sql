CREATE TABLE "media_asset" (
	"content_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"linked_at" timestamp,
	"owner_id" text NOT NULL,
	"purpose" text NOT NULL,
	"size" integer NOT NULL,
	"status" text NOT NULL,
	"uploaded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"backup_codes" text NOT NULL,
	"id" text PRIMARY KEY,
	"secret" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "media_asset_owner_idx" ON "media_asset" ("owner_id");--> statement-breakpoint
CREATE INDEX "media_asset_status_idx" ON "media_asset" ("status");--> statement-breakpoint
CREATE INDEX "two_factor_userId_idx" ON "two_factor" ("user_id");--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_owner_id_user_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;