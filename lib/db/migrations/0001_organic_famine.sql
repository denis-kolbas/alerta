CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_name" text NOT NULL,
	"braze_instance_url" text,
	"braze_api_key" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "clients_brand_name_unique" UNIQUE("brand_name")
);
--> statement-breakpoint
CREATE TABLE "event_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar NOT NULL,
	"event_name" varchar NOT NULL,
	"timestamp" timestamp NOT NULL,
	"count" integer NOT NULL
);
