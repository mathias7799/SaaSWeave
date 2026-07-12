ALTER TABLE "organization" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false;