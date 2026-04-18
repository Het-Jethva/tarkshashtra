CREATE TYPE "public"."override_field" AS ENUM('category', 'priority');--> statement-breakpoint
CREATE TYPE "public"."complaint_sentiment" AS ENUM('Angry', 'Frustrated', 'Neutral', 'Satisfied');--> statement-breakpoint
CREATE TABLE "complaint_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"complaint_id" text NOT NULL,
	"field" "override_field" NOT NULL,
	"from_value" text,
	"to_value" text NOT NULL,
	"reason" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "customer_name_normalized" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "customer_contact_normalized" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "sentiment" "complaint_sentiment";--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "sentiment_score" integer;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "keywords" jsonb;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "priority_reason" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "duplicate_of_complaint_id" text;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "duplicate_score" real;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "is_repeat_complainant" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "repeat_count_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "ai_helpful" boolean;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "ai_helpful_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "manager_overridden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "complaints" ADD COLUMN "manager_override_reason" text;--> statement-breakpoint
ALTER TABLE "complaint_overrides" ADD CONSTRAINT "complaint_overrides_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "complaint_overrides_complaint_id_idx" ON "complaint_overrides" USING btree ("complaint_id");--> statement-breakpoint
CREATE INDEX "complaint_overrides_created_at_idx" ON "complaint_overrides" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "complaints_sentiment_idx" ON "complaints" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "complaints_assigned_to_idx" ON "complaints" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "complaints_customer_contact_normalized_idx" ON "complaints" USING btree ("customer_contact_normalized");--> statement-breakpoint
CREATE INDEX "complaints_customer_name_normalized_idx" ON "complaints" USING btree ("customer_name_normalized");