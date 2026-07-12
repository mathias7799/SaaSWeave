CREATE TABLE "mrr_snapshot" (
	"active_orgs" integer NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"churned_mrr" integer,
	"currency" text NOT NULL,
	"id" text PRIMARY KEY,
	"mrr" integer NOT NULL,
	"new_mrr" integer NOT NULL,
	"period_month" text NOT NULL CONSTRAINT "mrr_snapshot_period_month_key" UNIQUE
);
