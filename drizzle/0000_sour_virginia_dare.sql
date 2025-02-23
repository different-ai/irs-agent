CREATE TABLE "agent_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"classification_id" text NOT NULL,
	"timestamp" timestamp NOT NULL,
	"human_action" jsonb,
	"human_result" text,
	"text" text,
	"tool_calls" jsonb,
	"tool_results" jsonb,
	"usage" jsonb,
	"finish_reason" text
);
--> statement-breakpoint
CREATE TABLE "classified_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"app_name" text,
	"window_name" text,
	"timestamp" timestamp NOT NULL,
	"type" text NOT NULL,
	"image" text,
	"classification" jsonb NOT NULL,
	"is_important" boolean NOT NULL,
	"confidence" text NOT NULL,
	"embedding" text,
	"hyper_info" text
);
--> statement-breakpoint
CREATE TABLE "financial_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"currency" text NOT NULL,
	"description" text NOT NULL,
	"sender_name" text,
	"receiver_name" text,
	"confidence" numeric NOT NULL,
	"source_text" text NOT NULL,
	"source_type" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "support_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp NOT NULL,
	"summary" text NOT NULL,
	"key_points" jsonb NOT NULL,
	"recommended_actions" jsonb NOT NULL,
	"timeframe" jsonb NOT NULL,
	"raw_data" jsonb
);
