CREATE TABLE "notification" (
	"action_url" text,
	"body" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text,
	"read_at" timestamp,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notification_user_createdAt_idx" ON "notification" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_readAt_idx" ON "notification" ("user_id","read_at");--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;