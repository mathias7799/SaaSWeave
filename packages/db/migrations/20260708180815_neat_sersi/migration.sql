CREATE TABLE "processed_event" (
	"id" text PRIMARY KEY,
	"source" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
