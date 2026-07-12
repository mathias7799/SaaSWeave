CREATE TABLE "email_delivery" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error" text,
	"id" text PRIMARY KEY,
	"organization_id" text,
	"provider" text NOT NULL,
	"recipient" text NOT NULL,
	"status" text NOT NULL,
	"subject" text NOT NULL,
	"template_key" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_delivery_createdAt_idx" ON "email_delivery" ("created_at");--> statement-breakpoint
ALTER TABLE "email_delivery" ADD CONSTRAINT "email_delivery_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL;