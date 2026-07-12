CREATE TABLE "email_template" (
	"key" text PRIMARY KEY,
	"subject" text,
	"copy" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
