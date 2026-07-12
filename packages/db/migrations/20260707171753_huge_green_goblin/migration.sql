CREATE TABLE "webhook_delivery" (
	"attempt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"endpoint_id" text NOT NULL,
	"event_type" text NOT NULL,
	"id" text PRIMARY KEY,
	"payload" jsonb NOT NULL,
	"response_body" text,
	"response_status" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoint" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"events" jsonb NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"secret" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "webhook_delivery_endpoint_created_idx" ON "webhook_delivery" ("endpoint_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_endpoint_org_idx" ON "webhook_endpoint" ("organization_id");--> statement-breakpoint
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_endpoint_id_webhook_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;