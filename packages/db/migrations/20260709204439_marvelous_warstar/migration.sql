CREATE TABLE "batch_job" (
	"completed_items" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	"error" text,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_items" integer NOT NULL,
	"type" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_job_item" (
	"attempts" integer DEFAULT 0 NOT NULL,
	"batch_job_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"id" text PRIMARY KEY,
	"input" jsonb NOT NULL,
	"output" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "batch_job_org_created_idx" ON "batch_job" ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "batch_job_org_status_idx" ON "batch_job" ("organization_id","status");--> statement-breakpoint
CREATE INDEX "batch_job_item_job_status_idx" ON "batch_job_item" ("batch_job_id","status");--> statement-breakpoint
CREATE INDEX "batch_job_item_job_created_idx" ON "batch_job_item" ("batch_job_id","created_at");--> statement-breakpoint
ALTER TABLE "batch_job" ADD CONSTRAINT "batch_job_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "batch_job" ADD CONSTRAINT "batch_job_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "batch_job_item" ADD CONSTRAINT "batch_job_item_batch_job_id_batch_job_id_fkey" FOREIGN KEY ("batch_job_id") REFERENCES "batch_job"("id") ON DELETE CASCADE;