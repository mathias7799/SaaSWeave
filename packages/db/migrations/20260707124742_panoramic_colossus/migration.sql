CREATE TABLE "feature_flag" (
	"available_on" jsonb NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"key" text PRIMARY KEY,
	"name" text NOT NULL,
	"rollout" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_feature_flag" (
	"enabled" boolean NOT NULL,
	"feature_key" text NOT NULL,
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_feature_flag_org_feature_key" UNIQUE("organization_id","feature_key")
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"cta" text NOT NULL,
	"highlights" jsonb NOT NULL,
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"price_monthly" integer,
	"seat_price" integer,
	"seats_included" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"tagline" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"billing_mode" text NOT NULL,
	"currency" text NOT NULL,
	"id" text PRIMARY KEY,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"platform_name" text NOT NULL,
	"signups_open" boolean DEFAULT true NOT NULL,
	"support_email" text NOT NULL,
	"trials_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "organization_feature_flag_org_idx" ON "organization_feature_flag" ("organization_id");--> statement-breakpoint
ALTER TABLE "organization_feature_flag" ADD CONSTRAINT "organization_feature_flag_feature_key_feature_flag_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "feature_flag"("key") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_feature_flag" ADD CONSTRAINT "organization_feature_flag_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;