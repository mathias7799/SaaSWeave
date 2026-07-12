CREATE TABLE "data_export_request" (
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"file_key" text,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "data_export_request_org_created_idx" ON "data_export_request" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "data_export_request_org_status_idx" ON "data_export_request" ("organization_id","status");--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_requested_by_user_id_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;